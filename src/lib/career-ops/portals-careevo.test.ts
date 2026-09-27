import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import yaml from "js-yaml";

/**
 * Guards on the Indonesian market config.
 *
 * The engine does NOT fail uniformly on a bad config, and the split is the
 * reason these guards are worth writing. Two shapes are LOUD: a MISSING
 * portals.yml (engine/scan.mjs:3296-3299) prints "portals.yml not found. Run
 * onboarding first." and exits 1, and UNPARSEABLE YAML (engine/scan.mjs:3301-3307)
 * prints "failed to parse" and exits 1. Two shapes are SILENT and exit 0 behind
 * a healthy-looking summary: YAML that parses to a non-object is replaced by
 * `{}` (engine/scan.mjs:3308), so both lists normalise to [], and a well-formed
 * config whose entries are all `enabled: false` is skipped entry by entry
 * (engine/scan.mjs:3354). Either prints "Scanning 0 companies"
 * (engine/scan.mjs:3393) and a zero-filled summary indistinguishable from a
 * correct scan that matched nothing.
 *
 * Both halves of the walker are in that silent pair, boards and
 * tracked_companies alike: a config whose entries are all present and all
 * switched off is the same zero with the same receipt, and that is the 2026
 * bug — both Indonesian boards were configured correctly and disabled.
 *
 * DELIBERATELY UNGUARDED — `no-provider`: an enabled entry that no engine
 * provider claims, which scan.mjs drops into an unnamed skip count
 * (engine/audit-portals.mjs:126, surfaced as "N no-provider (skipped)" by
 * engine/verify-portals.mjs:907). No guard here can reach it, because nothing
 * in this file records which provider would claim an entry — only a live
 * `node engine/audit-portals.mjs --summary` can. It is 0 today, so it is a
 * named gap rather than a missing one; a board added by URL alone would open
 * it.
 *
 * These tests cannot prove the scan returns Indonesian jobs. They can only prove
 * the cheap ways of getting zero are absent. The live scan in Task 5 is the
 * actual evidence.
 */

const CONFIG = path.join(
  process.cwd(),
  "src",
  "lib",
  "career-ops",
  "portals-careevo.yml",
);

/**
 * Only the fields a guard actually reads. The interface grew with the guards:
 * `name` (for a readable assertion message), `provider`, `pageSize`,
 * `maxPages`, and `searchKeywords` were added in the same commit as the guards
 * that read them, which is the rule this comment has always stated.
 */
interface Papan {
  name?: string;
  enabled?: boolean;
  provider?: string;
  siteKey?: string;
  countryCode?: string;
  searchKeywords?: string;
  pageSize?: number;
  maxPages?: number;
}

interface FilterJudul {
  positive?: unknown;
  negative?: unknown;
}

interface FilterLokasi {
  allow?: unknown;
  strict?: unknown;
}

/**
 * The parsed document, cast the way portals.test.ts casts — to
 * `Record<string, unknown>`, then narrowed at each use. Not `as never`: that is
 * assignable to everything, so the declared return type is asserted rather than
 * checked and later drift compiles silently. Every field below is therefore
 * `unknown` until a helper earns it a real type.
 */
function config(): Record<string, unknown> {
  return yaml.load(readFileSync(CONFIG, "utf8")) as Record<string, unknown>;
}

/**
 * A list of strings, or []. Normalises exactly the way the engine does before
 * comparing (title-keywords.mjs:221-224 coerces a non-array to [] and drops
 * non-strings), because a guard that normalises differently from the thing it
 * guards is comparing two different documents.
 */
function daftarTeks(nilai: unknown): string[] {
  return Array.isArray(nilai)
    ? nilai.filter((k): k is string => typeof k === "string")
    : [];
}

/** A list of boards or companies, or []. */
function daftarPapan(nilai: unknown): Papan[] {
  return Array.isArray(nilai) ? (nilai as Papan[]) : [];
}

function judul(): FilterJudul | undefined {
  return config().title_filter as FilterJudul | undefined;
}

function lokasi(): FilterLokasi | undefined {
  return config().location_filter as FilterLokasi | undefined;
}

/** A board counts as Indonesian when it is enabled AND names an ID market. */
function papanIndonesia(): Papan[] {
  return daftarPapan(config().job_boards).filter(
    (b) =>
      b.enabled === true &&
      (b.siteKey?.startsWith("ID") === true || b.countryCode === "ID"),
  );
}

/** Enabled boards only — scan.mjs skips a disabled entry without a message. */
function papanAktif(): Papan[] {
  return daftarPapan(config().job_boards).filter((b) => b.enabled === true);
}

describe("config pindai Indonesia", () => {
  it("bisa di-parse — konfigurasi rusak menghasilkan nol papan tanpa error", () => {
    // A parse throw here is the whole point. The engine does report an
    // UNPARSEABLE config itself, loudly and with exit 1
    // (engine/scan.mjs:3301-3307); what it cannot report is a config that
    // parses into the wrong shape, or one whose entries are all disabled. A
    // throw here is the earlier and louder of those two.
    expect(() => config()).not.toThrow();
    expect(config()).toBeTypeOf("object");
  });

  it("punya minimal satu papan Indonesia yang AKTIF", () => {
    // The bug: both Indonesian boards were present and disabled, which reads as
    // "config healthy, no results" rather than "config wrong".
    expect(papanIndonesia().length).toBeGreaterThanOrEqual(1);
  });

  it("memicu location_filter lewat allow, bukan hanya always_allow", () => {
    // always_allow alone restricts nothing: a location-free posting passes
    // either way, so a config carrying only always_allow scans the whole world.
    // daftarTeks gives [] for a missing or non-array `allow`, so this covers
    // "location_filter was deleted" as well as "allow was emptied".
    expect(daftarTeks(lokasi()?.allow).length).toBeGreaterThan(0);
  });

  it("tidak menyingkirkan Java, PHP, atau Ruby di negative", () => {
    // Mainstream backend languages in Indonesia. Vetoing them removes most
    // entry-level postings, which is the exact audience Careevo teaches.
    const negative = daftarTeks(judul()?.negative).map((k) =>
      k.trim().toLowerCase(),
    );
    // "java" carries no trailing space and must never get one back: the engine
    // trims every entry before compiling (title-keywords.mjs:223), so the
    // template's `- "Java "` (portals.example.yml:506) already means "java"
    // there, and a probe copied from the template spells a string that no
    // trimmed element can ever equal.
    for (const language of ["java", "php", "ruby", ".net"]) {
      expect(negative).not.toContain(language);
      // The containment half, and the load-bearing one. The engine compiles any
      // 4+ character entry to a bare substring test (title-keywords.mjs:131,
      // `lower.includes(kw)` — the catch-all return of compileKeyword at :121,
      // not the two-and-three-letter branch just above it), so
      // `- "Java Developer"` vetoes real Java
      // postings while never equalling the element "java" — exact-element
      // matching alone waves it through, and it costs Indonesian yield just as
      // much. (Same reason the engine notes a bare `java` also vetoes
      // "JavaScript": one more reason it must not be there at all.)
      expect(negative.filter((k) => k.includes(language))).toEqual([]);
    }
  });

  it("memuat istilah peran tech Indonesia di positive", () => {
    const positive = daftarTeks(judul()?.positive).map((k) =>
      k.trim().toLowerCase(),
    );
    // Do NOT "simplify" these to shorter or single-word terms. `toContain` on an
    // array is EXACT-element matching, so every entry here has to be a literal
    // member of the 30-entry `positive` list — a substring such as "data" is
    // absent, because the config spells the three data roles out in full
    // ("data scientist", "data analyst", "data engineer"). A one-word swap
    // ("data", "fullstack", "cloud") turns this into a red test that reads like
    // a config regression, when the config is fine and the guard is wrong.
    for (const role of ["developer", "engineer", "mobile", "backend", "data scientist"]) {
      expect(positive).toContain(role);
    }
  });

  it("tidak memakai strict — gagal tertutup membuang baris tanpa lokasi", () => {
    // NOT self-sufficient, and deliberately so: `?.` means a config with no
    // location_filter at all also yields undefined and passes here. The guard
    // for that is "memicu location_filter lewat allow" above. This one only
    // says the key is not set to something truthy.
    expect(lokasi()?.strict).toBeUndefined();
  });

  it("membawa perusahaan yang bisa dipindai", () => {
    // ENABLED companies, not merely present ones — scan.mjs walks `enabled`
    // entries, so nine switched-off companies are the same zero as none, which
    // is the mirror image of the board guard above. The floor stays at 8: the
    // config ships 9, so one entry of real headroom exists and a single
    // deliberate removal is not an accident.
    const aktif = daftarPapan(config().tracked_companies).filter(
      (c) => c.enabled === true,
    );
    expect(aktif.length).toBeGreaterThanOrEqual(8);
  });

  it("setiap papan aktif punya provider dan batas halaman", () => {
    // scan.mjs reads provider/pageSize/maxPages off each entry. A board missing
    // any of them is dropped into an unnamed skip count, which reads as
    // "config healthy, no results" — the same invisible-zero class as a
    // disabled board.
    for (const b of papanAktif()) {
      expect(typeof b.provider, `${b.name}: provider`).toBe("string");
      expect(Number(b.pageSize), `${b.name}: pageSize`).toBeGreaterThan(0);
      expect(Number(b.maxPages), `${b.name}: maxPages`).toBeGreaterThan(0);
    }
  });

  it("memakai provider Indonesia yang dikenal engine", () => {
    // The four providers the engine ships for this market. An entry naming a
    // provider the engine does not have resolves to `unknown provider` and the
    // board is skipped, so a typo here is a silent zero for that entry.
    const dikenal = new Set(["jobstreet", "glints", "kalibrr", "dealls"]);
    for (const b of papanAktif()) {
      expect(dikenal.has(b.provider ?? ""), `${b.name}: ${b.provider}`).toBe(true);
    }
  });

  it("menyapu minimal delapan keluarga peran", () => {
    // Three families shipped before this change. Five were added. The floor of
    // eight leaves one family of headroom so a single deliberate removal is not
    // mistaken for the regression this guard exists to catch.
    const keluarga = new Set(
      papanAktif()
        .map((b) => (b.searchKeywords ?? "").trim().toLowerCase())
        .filter(Boolean),
    );
    expect(keluarga.size).toBeGreaterThanOrEqual(8);
  });

  it("punya minimal 27 papan aktif", () => {
    // 12 before (4 providers x 3 families), 15 added (3 answering providers x 5
    // families). A drop below 27 means the keyword widening was partly reverted.
    expect(papanAktif().length).toBeGreaterThanOrEqual(27);
  });

  it("memindai lebih dalam di Jobstreet dan Kalibrr — minimal 12 halaman", () => {
    // Depth is the lever, not breadth. At maxPages 3 each keyword family stops
    // at 90 postings, while Jobstreet lists 2,226 for "software engineer" and
    // 2,876 for "quality assurance" (measured 2026-09-27). Nothing in the
    // engine errors when depth is too shallow: the scan completes with a
    // plausible-looking count, a third of what the board offered. That silence
    // is exactly why this needs a guard.
    //
    // Only the two boards that answer are held to 12. Glints is WAF-blocked
    // (zero at any depth) and Dealls dries out at page 1, so requiring 12 of
    // them would demand a setting that buys nothing.
    const dalam = papanAktif().filter(
      (b) => b.provider === "jobstreet" || b.provider === "kalibrr",
    );
    expect(dalam.length).toBeGreaterThanOrEqual(16);
    for (const b of dalam) {
      expect(Number(b.maxPages), `${b.name}: maxPages`).toBeGreaterThanOrEqual(12);
    }
  });

  it("anggaran halaman total minimal 200", () => {
    // The ceiling arithmetic the docs quote is sum(maxPages) x pageSize. With
    // 16 entries at 12 and 11 at 3 that is 225. A revert of the deepening drops
    // it to 81 (27 x 3), which this catches even if the provider-scoped guard
    // above were ever loosened.
    const total = papanAktif().reduce((n, b) => n + (Number(b.maxPages) || 0), 0);
    expect(total).toBeGreaterThanOrEqual(200);
  });
});
