import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import yaml from "js-yaml";

/**
 * Guards on the Indonesian market config.
 *
 * The engine fails SILENTLY on a bad config: a missing or malformed
 * portals.yml yields zero boards with no crash (engine/detect-reposts.mjs:737,741),
 * and scan.mjs reports that as `postingsKept: 0` — byte-identical to a correct
 * scan that matched nothing. That is how the 2026 attempt shipped a disabled
 * Glints entry and looked healthy.
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

interface Papan {
  name?: string;
  provider?: string;
  enabled?: boolean;
  siteKey?: string;
  countryCode?: string;
}

function config(): {
  title_filter?: { positive?: string[]; negative?: string[] };
  location_filter?: { allow?: string[]; always_allow?: string[]; strict?: boolean };
  job_boards?: Papan[];
  tracked_companies?: unknown[];
} {
  return yaml.load(readFileSync(CONFIG, "utf8")) as never;
}

/** A board counts as Indonesian when it is enabled AND names an ID market. */
function papanIndonesia(): Papan[] {
  return (config().job_boards ?? []).filter(
    (b) =>
      b.enabled === true &&
      (b.siteKey?.startsWith("ID") === true || b.countryCode === "ID"),
  );
}

describe("config pindai Indonesia", () => {
  it("bisa di-parse — konfigurasi rusak menghasilkan nol papan tanpa error", () => {
    // A parse throw here is the whole point: the engine cannot report this.
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
    const lf = config().location_filter;
    expect(Array.isArray(lf?.allow) && lf.allow.length).toBeGreaterThan(0);
  });

  it("tidak menyingkirkan Java, PHP, atau Ruby di negative", () => {
    // Mainstream backend languages in Indonesia. Vetoing them removes most
    // entry-level postings, which is the exact audience Careevo teaches.
    const negative = (config().title_filter?.negative ?? []).map((k) =>
      k.trim().toLowerCase(),
    );
    for (const language of ["java ", "php", "ruby", ".net"]) {
      expect(negative).not.toContain(language);
    }
  });

  it("memuat istilah peran tech Indonesia di positive", () => {
    const positive = (config().title_filter?.positive ?? []).map((k) =>
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
    expect(config().location_filter?.strict).toBeUndefined();
  });

  it("membawa perusahaan yang bisa dipindai", () => {
    expect((config().tracked_companies ?? []).length).toBeGreaterThanOrEqual(8);
  });
});
