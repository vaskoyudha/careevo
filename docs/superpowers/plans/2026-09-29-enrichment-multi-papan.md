# Enrichment Multi-Papan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every inbox row enrichable — not just Jobstreet — so the "Hasil Audit Sentinel" panel stops being empty for the 77 of 257 rows (30%) that currently always read "Belum diperiksa".

**Architecture:** One adapter per board behind a single `PapanAdapter` contract (`src/lib/career-ops/boards/`), a URL-keyed unified cache (`src/lib/career-ops/job-cache.ts`) replacing the Jobstreet-id-keyed one, and a post-scan enrichment step that fills the cache so the render path never waits on the network. `auditBaris` stays pure and board-agnostic: it receives `BahanAudit` and derives a verdict.

**Tech Stack:** TypeScript, Vitest (`environment: "node"`), Next.js server actions, Node 22 `fetch` + `AbortSignal.timeout`. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-29-enrichment-multi-papan-design.md`

## Global Constraints

- `engine/**` is vendored and must stay **byte-identical**. Never edit anything under `engine/`. It is read-only reference for endpoint shapes and HTML structure.
- **Never commit `.data/`.** It is gitignored. Every cache file this plan writes lives there.
- **No** database schema change, no migration, no `drizzle/` file.
- Business-logic identifiers stay **Indonesian** (`bahanAudit`, `perkayaSemua`, `ambilDetail`, `EntriCache`). Infra/UI stays English where the surrounding file already is.
- Tests run with `npx vitest run <path>`; `include` is `src/**/*.test.ts`, `environment: "node"`, `@` aliases to `./src`. There is **no jsdom** — component tests assert source text, not DOM.
- **Invariants that must not regress** (pinned in `inbox-audit.ts` and its tests): `fee_flags ⊆ flags`; `clean` ⇒ empty `flags`; a row that cannot be enriched is **never** `clean`; verdicts are derived, never stored in `pipeline.md`.
- **A row whose description we could not read must never be reported `clean`.** Every adapter returns `null` on failure and the row stays `enriched: false`.
- **`bacaInboxDiaudit` must not touch the network.** The render path reads the cache only; `perkayaSemua` is called by the scan action and the backfill script.
- Do **not** set `strict: true` on `location_filter` in `portals-careevo.yml` — unrelated, but this plan touches that file's neighbours; leave it alone.
- The working tree already contains an unrelated modified file (`docs/superpowers/plans/2026-09-29-loker-perusahaan-dan-sumber-scan.md`). **Stage only the files a task names.**

### Ruling: one adapter method, not two

The spec's `PapanAdapter` carries both `ambilFeed` (one request per board) and `ambilDetail` (one request per posting), with `kunciFeed(url)` choosing the grouping. **Planning-time probing found `kunciFeed` is not implementable for the one board it was written for.** Workable's inbox URLs are `https://apply.workable.com/j/<shortcode>` — the account slug is *not* in the URL, so no synchronous `kunciFeed(url)` can produce the grouping key; it is only recoverable from a 301 (`/j/<code>` → `/<slug>/j/<code>`), which is I/O. Kalibrr's company feed *is* implementable (`?company=<code>`), but probing showed its API ignores `job_id`/`company_code` scoping while honouring `company=`, and a company can exceed one page (bfifinance has 188 postings), so the feed path needs pagination for no benefit over one HTML fetch per row.

**Decision: every adapter implements `ambilDetail(url, io, konteks) → HasilPapan | null`.** Cost is one request per row for all six boards (~68 requests for the 77-row backfill, one time, then cached) versus ~53 for the mixed design — 15 extra requests on a one-time backfill, in exchange for one uniform contract, no pagination edge case, and no async `kunciFeed`. This preserves K1's actual goal ("menambah papan = menambah satu berkas", no per-host `if/else`). **If wrong:** the backfill takes ~15 more requests and Workable rows take 2 requests instead of 1.

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/career-ops/boards/types.ts` | **Create.** `BahanAudit`, `HasilPapan`, `KonteksPapan`, `PapanAdapter`, `Io`, `FetchJson`, `perusahaanTerkenal` |
| `src/lib/career-ops/boards/html.ts` | **Create.** `htmlKeTeks`, `ambilNextData`, `metaOgDescription`, `potongDivId`, `bersihkanPlaceholder` |
| `src/lib/career-ops/boards/url.ts` | **Create.** `hostDari`, `applyUrlOffPlatform` |
| `src/lib/career-ops/boards/jobstreet.ts` | **Create.** Jobstreet adapter (wraps `jobstreet-audit.ts`) |
| `src/lib/career-ops/boards/kalibrr.ts` | **Create.** Kalibrr adapter |
| `src/lib/career-ops/boards/workable.ts` | **Create.** Workable adapter (slug via 301) |
| `src/lib/career-ops/boards/smartrecruiters.ts` | **Create.** SmartRecruiters adapter |
| `src/lib/career-ops/boards/dealls.ts` | **Create.** Dealls adapter (`__NEXT_DATA__`) |
| `src/lib/career-ops/boards/breezy.ts` | **Create.** Breezy adapter (server-rendered HTML) |
| `src/lib/career-ops/boards/index.ts` | **Create.** `ADAPTER`, `adapterUntuk`, `namaPapan` |
| `src/lib/career-ops/io.ts` | **Create.** `ioDefault` — real network, timeout, 429 retry |
| `src/lib/career-ops/job-cache.ts` | **Create.** `EntriCache`, `bacaCache`, `tulisCache`, `perkayaSemua`, migration |
| `scripts/enrich-inbox.ts` | **Create.** One-time backfill CLI |
| `src/lib/career-ops/jobstreet-audit.ts` | **Modify.** `BahanAudit` re-exported from `boards/types`; `applyUrlFromTeaser` delegates |
| `src/lib/career-ops/jobstreet-enrich.ts` | **Delete.** Superseded by `boards/jobstreet.ts` + `job-cache.ts` |
| `src/lib/career-ops/inbox-audit.ts` | **Modify.** URL-keyed cache; add `papan` |
| `src/lib/career-ops/inbox.ts` | **Modify.** `bacaInboxDiaudit` reads cache only |
| `src/lib/jobs/hitung-kursus.ts` | **Modify.** Reads unified cache |
| `src/lib/jobs/persiapan-inbox.ts` | **Modify.** `kebutuhanDariInbox` takes `EntriCache` |
| `src/lib/jobs/trust.ts` | **Modify.** `ATS_DIIZINKAN` += `dealls.com`, `sejutacita.id` |
| `src/actions/inbox.ts` | **Modify.** Post-scan `perkayaSemua` |
| `src/actions/loker-inbox-persiapan.ts` | **Modify.** Reads unified cache |
| `src/app/(app)/loker/inbox/page.tsx` | **Modify.** Reads unified cache |
| `src/components/features/jobs/cari-lowongan-ui.tsx` | **Modify.** `verdictBadge` names the board |
| `src/lib/career-ops/index.ts` | **Modify.** Export `job-cache`, `boards` |
| `package.json` | **Modify.** `enrich:inbox` script |

---

## Pre-flight: shared test fixtures

Several tasks assert against the same live-measured payload shapes. These are the **real** shapes, captured from the live boards on 2026-09-29 — copy them verbatim into each test rather than re-inventing them. A task's brief repeats the ones it needs.

- Kalibrr feed item: `{ id, slug, name, company: { code, name }, description: "<p>…</p>", qualifications: "<p>…</p>", apply_redirect_url: null }`
- Workable widget: `{ name, description, jobs: [{ title, shortcode, shortlink, url, city, country, telecommuting, published_on, description }] }`; per-job detail adds `requirements`, `application_url`
- SmartRecruiters detail: `{ applyUrl, jobAd: { sections: { companyDescription: {text}, jobDescription: {text}, qualifications: {text}, additionalInformation: {text} } } }`
- Dealls page: `__NEXT_DATA__` → `props.pageProps.dehydratedState.queries[i].state.data.{responsibilities, requirements, externalPlatformApplyUrl}`
- Breezy page: `<div id="description" …>…</div>` plus `<meta property="og:description" content="…">`

---

### Task 1: Board contract, HTML helpers, URL helpers

**Files:**
- Create: `src/lib/career-ops/boards/types.ts`
- Create: `src/lib/career-ops/boards/html.ts`
- Create: `src/lib/career-ops/boards/url.ts`
- Test: `src/lib/career-ops/boards/html.test.ts`
- Test: `src/lib/career-ops/boards/url.test.ts`
- Test: `src/lib/career-ops/boards/types.test.ts`
- Modify: `src/lib/career-ops/jobstreet-audit.ts` (re-export `BahanAudit`)

**Interfaces:**
- Consumes: nothing.
- Produces: `BahanAudit`, `HasilPapan`, `KonteksPapan`, `PapanAdapter`, `Io`, `FetchJson` (from `./types`); `htmlKeTeks`, `ambilNextData`, `metaOgDescription`, `potongDivId`, `bersihkanPlaceholder` (from `./html`); `hostDari`, `applyUrlOffPlatform` (from `./url`); `perusahaanTerkenal` (from `./types`). Every later task imports these names exactly.

- [ ] **Step 1: Write `boards/types.ts`**

```typescript
/**
 * types.ts — the one contract every board adapter implements.
 *
 * `auditBaris` must never learn which board a row came from: it receives
 * `BahanAudit` and derives a verdict. Adapters are the only place board-specific
 * knowledge lives, so adding a board is adding one file, not editing a branch
 * per host.
 */

/** What `auditLoker` needs, named in the repo's Indonesian convention. */
export interface BahanAudit {
  description: string;
  apply_url: string;
  company: string;
  employer_known: boolean;
}

export type FetchJson = (
  url: string,
  init?: { headers?: Record<string, string> },
) => Promise<unknown>;

/**
 * The I/O an adapter may use. Injected rather than reached for globally — the
 * same reason `jobstreet-enrich.ts` injected `fetchJson`: it is what makes an
 * adapter testable under vitest's `node` environment with no network.
 */
export interface Io {
  fetchJson: FetchJson;
  /**
   * HTML plus the final URL after redirects. Dealls and Breezy parse the page;
   * Workable needs only `urlAkhir`, because its inbox URLs are `/j/<shortcode>`
   * and the account slug is recoverable only from the 301 target.
   */
  fetchHtml(url: string): Promise<{ html: string; urlAkhir: string }>;
}

/**
 * What the adapter may know about the inbox row it is enriching.
 *
 * `perusahaan` is the company the scan already recorded in `pipeline.md`. It is
 * the fallback when the board's own payload omits a company name — the same
 * role `fallbackCompany` plays in `bahanAudit`.
 */
export interface KonteksPapan {
  perusahaan: string;
}

/** What an adapter returns for one posting. */
export interface HasilPapan {
  bahan: BahanAudit;
  /** Occupational categories, when the board supplies them. Never inferred. */
  tags?: string[];
}

export interface PapanAdapter {
  /** "Kalibrr" — the human-readable name the UI may show. */
  nama: string;
  /** Whether this adapter owns the URL. Adapters must not overlap. */
  cocok(url: string): boolean;
  /**
   * Enrich one posting. Returns `null` when the board cannot be read — the
   * caller then leaves the row unenriched rather than guessing.
   */
  ambilDetail(
    url: string,
    io: Io,
    konteks: KonteksPapan,
  ): Promise<HasilPapan | null>;
}

/**
 * Whether a company name is one a candidate could look up.
 *
 * "Private Advertiser" is Jobstreet's anonymised-listing marker, and it is the
 * one name that is explicitly NOT verifiable. Shared by every adapter so the
 * rule has one definition rather than one per board.
 */
export function perusahaanTerkenal(nama: string | null | undefined): boolean {
  const n = (nama ?? "").trim();
  if (!n) return false;
  if (/^private advertiser$/i.test(n)) return false;
  return true;
}
```

- [ ] **Step 2: Write `boards/html.ts`**

```typescript
/**
 * html.ts — the HTML→text helpers the page-parsing adapters share.
 *
 * Breezy and Dealls have no JSON endpoint worth using, so their descriptions
 * come out of server-rendered HTML. One stripper, one entity decoder, so the
 * two adapters cannot drift on what "plain text" means.
 */

const ENTITAS: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  ndash: "\u2013", mdash: "\u2014", hellip: "\u2026",
  lsquo: "\u2018", rsquo: "\u2019", ldquo: "\u201c", rdquo: "\u201d",
};

function dekodeEntitas(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (utuh, kode: string) => {
    if (kode[0] === "#") {
      const hex = kode[1]?.toLowerCase() === "x";
      const n = Number.parseInt(hex ? kode.slice(2) : kode.slice(1), hex ? 16 : 10);
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : utuh;
    }
    return ENTITAS[kode.toLowerCase()] ?? utuh;
  });
}

/** HTML to readable plain text. Block boundaries become newlines, not spaces. */
export function htmlKeTeks(html: string): string {
  if (typeof html !== "string" || !html) return "";
  return dekodeEntitas(
    html
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6]|tr|section)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Parse the Next.js `__NEXT_DATA__` payload, or null when absent/invalid. */
export function ambilNextData(html: string): unknown | null {
  const m = /<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i.exec(html);
  if (!m) return null;
  try {
    return JSON.parse(m[1]) as unknown;
  } catch {
    return null;
  }
}

/** The `og:description` meta content, in either attribute order. */
export function metaOgDescription(html: string): string | null {
  const m =
    /<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i.exec(html) ??
    /<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:description["']/i.exec(html);
  return m ? dekodeEntitas(m[1]).trim() || null : null;
}

/**
 * The balanced `<div id="…">…</div>` block.
 *
 * A non-greedy regex stops at the first `</div>`, which on Breezy cuts the
 * description off after its opening paragraph — measured: 79 chars instead of
 * 1725. Counting tags is the only way to find the real end.
 */
export function potongDivId(html: string, id: string): string | null {
  const penanda = new RegExp(`id=["']${id}["']`, "i").exec(html);
  if (!penanda) return null;
  const mulai = html.lastIndexOf("<div", penanda.index);
  if (mulai < 0) return null;

  const tag = /<\/?div\b[^>]*>/gi;
  tag.lastIndex = mulai;
  let kedalaman = 0;
  let m: RegExpExecArray | null;
  while ((m = tag.exec(html)) !== null) {
    kedalaman += m[0][1] === "/" ? -1 : 1;
    if (kedalaman === 0) return html.slice(mulai, tag.lastIndex);
  }
  return null;
}

/**
 * Drop the template placeholders Breezy's server-rendered page leaves behind —
 * `%BREADCRUMB_JOB_OPENINGS%`, `%BUTTON_APPLY_TO_POSITION%`. Left in, they read
 * as scam-ish shouting in a fraud audit.
 */
export function bersihkanPlaceholder(teks: string): string {
  return teks.replace(/%[A-Z_]+%/g, " ").replace(/\s{2,}/g, " ").trim();
}
```

- [ ] **Step 3: Write `boards/url.ts`**

```typescript
/**
 * url.ts — host and apply-URL helpers shared by the adapters.
 *
 * The load-bearing rule is `applyUrlOffPlatform`. The trust layer judges the URL
 * it is handed, and every board's own posting URL lives on a host that
 * `ATS_DIIZINKAN` already lists — so passing it makes every row `clean` and
 * hides the one signal that matters: a posting that sends the applicant to a
 * short link off the platform. The off-platform URL therefore wins when the
 * board names one.
 */

/** Lowercased hostname, or "" when the string will not parse. */
export function hostDari(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

/**
 * Hosts whose own URL carries no signal: the board/ATS host is listed in
 * `ATS_DIIZINKAN`, so a company↔domain check against it is skipped and a
 * shortener check against it is meaningless.
 */
const HOST_PAPAN =
  /(^|\.)(jobstreet\.(com|co\.id)|seek\.[a-z.]+|kalibrr\.com|workable\.com|smartrecruiters\.com|breezy\.hr|dealls\.com|sejutacita\.id)$/i;

/** The URL worth judging: an off-platform candidate, else the posting URL. */
export function applyUrlOffPlatform(
  kandidat: string | null | undefined,
  postingUrl: string,
): string {
  const k = (kandidat ?? "").trim();
  if (!k) return postingUrl;
  let u: URL;
  try {
    u = new URL(k);
  } catch {
    return postingUrl;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return postingUrl;
  if (HOST_PAPAN.test(u.hostname.toLowerCase())) return postingUrl;
  return k;
}
```

- [ ] **Step 4: Point `jobstreet-audit.ts` at the shared `BahanAudit` and helper**

Replace the local `BahanAudit` declaration and the two private helpers with imports. The public surface of the file (`jobIdFromUrl`, `applyUrlFromTeaser`, `bahanAudit`, and the re-exported `BahanAudit` type) is unchanged, so nothing that imports from it breaks.

Replace the import block at the top:

```typescript
import { applyUrlOffPlatform } from "./boards/url";
import type { BahanAudit } from "./boards/types";

export type { BahanAudit };
```

Delete the local `export interface BahanAudit { … }` block and the private `hostDari` function and `HOST_TERPERCAYA` constant.

Replace `applyUrlFromTeaser`'s body:

```typescript
/**
 * The url the applicant would actually be sent to. An off-platform link in the
 * teaser wins, because that is the url worth distrusting; anything on the
 * aggregator itself tells us nothing, so the posting url stands in.
 */
export function applyUrlFromTeaser(teaser: string, postingUrl: string): string {
  return applyUrlOffPlatform(URL_DI_TEASER.exec(teaser)?.[0], postingUrl);
}
```

- [ ] **Step 5: Write `boards/html.test.ts`**

```typescript
import { describe, expect, it } from "vitest";
import {
  ambilNextData,
  bersihkanPlaceholder,
  htmlKeTeks,
  metaOgDescription,
  potongDivId,
} from "./html";

describe("htmlKeTeks", () => {
  it("turns paragraphs and breaks into text with newlines", () => {
    expect(htmlKeTeks("<p>One</p><p>Two</p>")).toBe("One\nTwo");
    expect(htmlKeTeks("a<br>b")).toBe("a\nb");
  });

  it("decodes named and numeric entities", () => {
    expect(htmlKeTeks("R&amp;D &lt;x&gt; &nbsp; &#39;q&#39;")).toBe("R&D <x> 'q'");
  });

  it("drops script and style content entirely", () => {
    expect(htmlKeTeks("<style>p{}</style><script>x()</script>Keep")).toBe("Keep");
  });

  it("collapses runs of spaces but keeps paragraph breaks", () => {
    expect(htmlKeTeks("<p>a    b</p>\n\n\n\n<p>c</p>")).toBe("a b\n\nc");
  });

  it("returns an empty string for empty or non-string input", () => {
    expect(htmlKeTeks("")).toBe("");
    expect(htmlKeTeks(undefined as never)).toBe("");
  });
});

describe("ambilNextData", () => {
  it("parses the Next.js payload", () => {
    const html = '<script id="__NEXT_DATA__" type="application/json">{"a":1}</script>';
    expect(ambilNextData(html)).toEqual({ a: 1 });
  });

  it("returns null when the script tag is absent", () => {
    expect(ambilNextData("<html></html>")).toBeNull();
  });

  it("returns null rather than throwing on invalid JSON", () => {
    expect(ambilNextData('<script id="__NEXT_DATA__">{oops</script>')).toBeNull();
  });
});

describe("metaOgDescription", () => {
  it("reads the content in either attribute order", () => {
    expect(metaOgDescription('<meta property="og:description" content="Hi">')).toBe("Hi");
    expect(metaOgDescription('<meta content="Hi" property="og:description">')).toBe("Hi");
  });

  it("returns null when absent or empty", () => {
    expect(metaOgDescription("<html></html>")).toBeNull();
    expect(metaOgDescription('<meta property="og:description" content="">')).toBeNull();
  });
});

describe("potongDivId", () => {
  it("reads to the matching close tag, not the first one", () => {
    // The Breezy bug this exists for: a non-greedy regex stops after the inner
    // div and returns 79 chars where the real block is 1725.
    const html = '<div id="description"><div>inner</div><p>real body</p></div><footer>x</footer>';
    expect(potongDivId(html, "description")).toBe(
      '<div id="description"><div>inner</div><p>real body</p></div>',
    );
  });

  it("returns null when the id is absent", () => {
    expect(potongDivId("<div>a</div>", "description")).toBeNull();
  });

  it("returns null when the tags never balance", () => {
    expect(potongDivId('<div id="description"><div>open', "description")).toBeNull();
  });
});

describe("bersihkanPlaceholder", () => {
  it("strips Breezy's template tokens", () => {
    expect(
      bersihkanPlaceholder("%BREADCRUMB_JOB_OPENINGS% Fullstack Engineer %BUTTON_APPLY_TO_POSITION%"),
    ).toBe("Fullstack Engineer");
  });

  it("leaves ordinary text alone", () => {
    expect(bersihkanPlaceholder("Good Communication skills.")).toBe("Good Communication skills.");
  });
});
```

- [ ] **Step 6: Write `boards/url.test.ts`**

```typescript
import { describe, expect, it } from "vitest";
import { applyUrlOffPlatform, hostDari } from "./url";

describe("hostDari", () => {
  it("lowercases the hostname", () => {
    expect(hostDari("https://Apply.Workable.com/j/X")).toBe("apply.workable.com");
  });

  it("returns an empty string for an unparseable url", () => {
    expect(hostDari("not a url")).toBe("");
  });
});

describe("applyUrlOffPlatform", () => {
  const posting = "https://kredivo-group.breezy.hr/p/abc-engineer";

  it("keeps the posting url when the candidate is absent", () => {
    expect(applyUrlOffPlatform(null, posting)).toBe(posting);
    expect(applyUrlOffPlatform("  ", posting)).toBe(posting);
  });

  it("keeps the posting url when the candidate is on the same board host", () => {
    expect(applyUrlOffPlatform("https://kredivo-group.breezy.hr/p/abc", posting)).toBe(posting);
    expect(applyUrlOffPlatform("https://jobs.smartrecruiters.com/GudangAda/1", posting)).toBe(posting);
  });

  it("returns the off-platform url — the one signal worth judging", () => {
    expect(applyUrlOffPlatform("https://bit.ly/2yX06A9", posting)).toBe("https://bit.ly/2yX06A9");
    expect(applyUrlOffPlatform("https://careers.acme.co.id/apply/1", posting)).toBe(
      "https://careers.acme.co.id/apply/1",
    );
  });

  it("falls back to the posting url for a non-http scheme", () => {
    expect(applyUrlOffPlatform("mailto:hr@acme.co.id", posting)).toBe(posting);
  });

  it("falls back to the posting url for an unparseable candidate", () => {
    expect(applyUrlOffPlatform(":::", posting)).toBe(posting);
  });
});
```

- [ ] **Step 7: Write `boards/types.test.ts`**

```typescript
import { describe, expect, it } from "vitest";
import { perusahaanTerkenal } from "./types";

describe("perusahaanTerkenal", () => {
  it("accepts a named company", () => {
    expect(perusahaanTerkenal("Kredivo Group")).toBe(true);
  });

  it("rejects Jobstreet's anonymised marker", () => {
    expect(perusahaanTerkenal("Private Advertiser")).toBe(false);
    expect(perusahaanTerkenal("  private advertiser ")).toBe(false);
  });

  it("rejects empty and missing names", () => {
    expect(perusahaanTerkenal("")).toBe(false);
    expect(perusahaanTerkenal("   ")).toBe(false);
    expect(perusahaanTerkenal(null)).toBe(false);
    expect(perusahaanTerkenal(undefined)).toBe(false);
  });
});
```

- [ ] **Step 8: Run the new tests and the Jobstreet audit tests**

Run: `npx vitest run src/lib/career-ops/boards/html.test.ts src/lib/career-ops/boards/url.test.ts src/lib/career-ops/boards/types.test.ts src/lib/career-ops/jobstreet-audit.test.ts`

Expected: PASS. `jobstreet-audit.test.ts` must stay green unchanged — it pins `applyUrlFromTeaser`'s behaviour, which now delegates to `applyUrlOffPlatform`. If it fails, the delegation changed behaviour; fix the delegation, not the test.

- [ ] **Step 9: Typecheck**

Run: `npm run typecheck`

Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add src/lib/career-ops/boards/types.ts src/lib/career-ops/boards/html.ts src/lib/career-ops/boards/url.ts src/lib/career-ops/boards/html.test.ts src/lib/career-ops/boards/url.test.ts src/lib/career-ops/boards/types.test.ts src/lib/career-ops/jobstreet-audit.ts
git commit -m "feat(career-ops): board adapter contract, HTML and URL helpers"
```

---

### Task 2: IO layer

**Files:**
- Create: `src/lib/career-ops/io.ts`
- Test: `src/lib/career-ops/io.test.ts`

**Interfaces:**
- Consumes: `Io`, `FetchJson` from `./boards/types`.
- Produces: `ioDefault: Io` — the real-network implementation. Used by `scripts/enrich-inbox.ts` (Task 9) and `src/actions/inbox.ts` (Task 9).

- [ ] **Step 1: Write the failing test**

```typescript
import { afterEach, describe, expect, it, vi } from "vitest";
import { ioDefault } from "./io";

const respon = (over: Partial<Response> & { status?: number } = {}) =>
  ({
    ok: (over.status ?? 200) < 400,
    status: over.status ?? 200,
    url: "https://example.test/final",
    headers: new Headers(),
    json: async () => ({ ok: true }),
    text: async () => "<html></html>",
    ...over,
  }) as unknown as Response;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("ioDefault.fetchJson", () => {
  it("parses a successful JSON response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respon()));
    await expect(ioDefault.fetchJson("https://example.test/a")).resolves.toEqual({ ok: true });
  });

  it("throws on a non-ok response so the caller can leave the row unenriched", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respon({ status: 500 })));
    await expect(ioDefault.fetchJson("https://example.test/a")).rejects.toThrow("HTTP 500");
  });

  it("retries a 429 once and succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respon({ status: 429 }))
      .mockResolvedValueOnce(respon());
    vi.stubGlobal("fetch", fetchMock);
    await expect(ioDefault.fetchJson("https://example.test/a")).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("sends a browser-like User-Agent", async () => {
    const fetchMock = vi.fn().mockResolvedValue(respon());
    vi.stubGlobal("fetch", fetchMock);
    await ioDefault.fetchJson("https://example.test/a");
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(String((init.headers as Record<string, string>)["User-Agent"])).toContain("Mozilla/5.0");
    expect(init.signal).toBeDefined();
  });
});

describe("ioDefault.fetchHtml", () => {
  it("returns the body and the final URL after redirects", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        respon({ url: "https://apply.workable.com/indico/j/E7A5F89AC8", text: async () => "<p>hi</p>" }),
      ),
    );
    const out = await ioDefault.fetchHtml("https://apply.workable.com/j/E7A5F89AC8");
    expect(out.html).toBe("<p>hi</p>");
    expect(out.urlAkhir).toBe("https://apply.workable.com/indico/j/E7A5F89AC8");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/career-ops/io.test.ts`

Expected: FAIL — `Cannot find module './io'`.

- [ ] **Step 3: Write `io.ts`**

```typescript
/**
 * io.ts — the real-network `Io` implementation.
 *
 * Kept apart from the adapters so an adapter test never needs the network: the
 * adapter is handed an `Io` and a test hands it a stub. This is the same
 * dependency-injection shape `jobstreet-enrich.ts` used for `fetchJson`, and the
 * reason that file was testable at all under vitest's `node` environment.
 *
 * The timeout is here, not in `perkayaSemua`: a per-request deadline belongs to
 * the thing making the request. Ten seconds is generous for a JSON API and
 * short enough that one dead board cannot stall a scan's enrichment step.
 */

import type { Io } from "./boards/types";

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

const TIMEOUT_MS = 10_000;
const JEDA_429_MS = 1_000;

async function ambil(
  url: string,
  headers: Record<string, string>,
): Promise<Response> {
  const init: RequestInit = {
    redirect: "follow",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { "User-Agent": UA, ...headers },
  };
  let res = await fetch(url, init);

  // One retry on 429. A board that keeps rate-limiting past this fails the row,
  // and the row stays "Belum diperiksa" rather than getting a guessed verdict.
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, JEDA_429_MS));
    res = await fetch(url, init);
  }

  if (!res.ok) throw new Error(`HTTP ${res.status} untuk ${url}`);
  return res;
}

export const ioDefault: Io = {
  async fetchJson(url, init) {
    return (await ambil(url, { Accept: "application/json", ...(init?.headers ?? {}) })).json();
  },
  async fetchHtml(url) {
    const res = await ambil(url, { Accept: "text/html,application/xhtml+xml" });
    return { html: await res.text(), urlAkhir: res.url };
  },
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/career-ops/io.test.ts`

Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/career-ops/io.ts src/lib/career-ops/io.test.ts
git commit -m "feat(career-ops): io layer with timeout and 429 retry"
```

---

### Task 3: Jobstreet and Kalibrr adapters

**Files:**
- Create: `src/lib/career-ops/boards/jobstreet.ts`
- Create: `src/lib/career-ops/boards/kalibrr.ts`
- Test: `src/lib/career-ops/boards/jobstreet.test.ts`
- Test: `src/lib/career-ops/boards/kalibrr.test.ts`

**Interfaces:**
- Consumes: `BahanAudit`, `HasilPapan`, `KonteksPapan`, `PapanAdapter`, `Io`, `perusahaanTerkenal` from `./types`; `htmlKeTeks` from `./html`; `applyUrlOffPlatform`, `hostDari` from `./url`; `bahanAudit`, `jobIdFromUrl`, `ListingJobstreet` from `../jobstreet-audit`.
- Produces: `jobstreet: PapanAdapter`, `kalibrr: PapanAdapter`, plus `tagKlasifikasi(listing: ListingJobstreet): string[]` exported from `boards/jobstreet.ts`.

- [ ] **Step 1: Write `boards/jobstreet.ts`**

```typescript
/**
 * jobstreet.ts — the Jobstreet adapter.
 *
 * Jobstreet is the one board that was already enriched; this file moves its
 * fetch into the registry without rewriting the rules. `bahanAudit` and
 * `jobIdFromUrl` stay where they are and keep their tests — this is the wrapper,
 * not a second implementation.
 */

import {
  bahanAudit,
  jobIdFromUrl,
  type ListingJobstreet,
} from "../jobstreet-audit";
import type { HasilPapan, Io, PapanAdapter } from "./types";

const ENDPOINT = "https://id.jobstreet.com/api/jobsearch/v5/search";
const SITE_KEY = "ID-Main";

/**
 * Jobstreet's occupational categories, used as tags.
 *
 * A controlled vocabulary (`Information & Communication Technology`,
 * `Business/Systems Analysts`) — the employer's own classification, not our
 * guess, so it carries more weight than anything derived from the title. Moved
 * here from `persiapan-inbox.ts`, where it was the only board-specific branch
 * left in a module that must not know about boards.
 */
export function tagKlasifikasi(listing: ListingJobstreet): string[] {
  const klasifikasi = (listing as { classifications?: unknown }).classifications;
  if (!Array.isArray(klasifikasi)) return [];

  const tags: string[] = [];
  for (const item of klasifikasi) {
    const c = (item as { classification?: { description?: string } })?.classification;
    const s = (item as { subclassification?: { description?: string } })?.subclassification;
    for (const deskripsi of [c?.description, s?.description]) {
      if (typeof deskripsi === "string" && deskripsi.trim()) tags.push(deskripsi.trim());
    }
  }
  return tags;
}

/** One listing by job id, or null when the API has no such listing. */
async function ambilListing(jobId: string, io: Io): Promise<ListingJobstreet | null> {
  const url = `${ENDPOINT}?siteKey=${SITE_KEY}&jobId=${encodeURIComponent(jobId)}&pageSize=1`;
  const payload = (await io.fetchJson(url, {
    headers: { Referer: "https://id.jobstreet.com/" },
  })) as { data?: unknown[] } | null;
  const first = payload?.data?.[0];
  if (!first || typeof first !== "object") return null;
  return first as ListingJobstreet;
}

export const jobstreet: PapanAdapter = {
  nama: "Jobstreet",
  cocok: (url) => jobIdFromUrl(url) !== null,
  async ambilDetail(url, io, konteks): Promise<HasilPapan | null> {
    const jobId = jobIdFromUrl(url);
    if (!jobId) return null;
    const listing = await ambilListing(jobId, io);
    if (!listing) return null;
    return {
      bahan: bahanAudit(listing, konteks.perusahaan),
      tags: tagKlasifikasi(listing),
    };
  },
};
```

- [ ] **Step 2: Write `boards/jobstreet.test.ts`**

```typescript
import { describe, expect, it, vi } from "vitest";
import { jobstreet, tagKlasifikasi } from "./jobstreet";
import type { Io } from "./types";
import type { ListingJobstreet } from "../jobstreet-audit";

const listing = (over: Partial<ListingJobstreet> = {}): ListingJobstreet => ({
  id: "94839531",
  title: "AI Data Trainer",
  teaser: "Build our React dashboard",
  bulletPoints: ["TypeScript required"],
  companyName: "YO AI Labs",
  employer: { id: "1", name: "YO AI Labs" },
  ...over,
});

const io = (data: unknown[]): Io => ({
  fetchJson: vi.fn().mockResolvedValue({ data }),
  fetchHtml: vi.fn(),
});

describe("jobstreet adapter", () => {
  it("claims only jobstreet posting urls", () => {
    expect(jobstreet.cocok("https://id.jobstreet.com/id/job/94839531")).toBe(true);
    expect(jobstreet.cocok("https://dealls.com/loker/a~b")).toBe(false);
  });

  it("requests the documented single-job endpoint", async () => {
    const fake = io([listing()]);
    await jobstreet.ambilDetail(
      "https://id.jobstreet.com/id/job/94839531",
      fake,
      { perusahaan: "YO AI Labs" },
    );
    const url = String((fake.fetchJson as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(url).toContain("jobId=94839531");
    expect(url).toContain("siteKey=ID-Main");
  });

  it("joins the listing into the text the fee rules read", async () => {
    const hasil = await jobstreet.ambilDetail(
      "https://id.jobstreet.com/id/job/94839531",
      io([listing()]),
      { perusahaan: "YO AI Labs" },
    );
    expect(hasil?.bahan.description).toContain("TypeScript required");
    expect(hasil?.bahan.description).toContain("Build our React dashboard");
  });

  it("uses the pipeline row's company when the detail endpoint omits one", async () => {
    const hasil = await jobstreet.ambilDetail(
      "https://id.jobstreet.com/id/job/94839531",
      io([listing({ companyName: undefined as never, employer: undefined })]),
      { perusahaan: "PT Dari Pipeline" },
    );
    expect(hasil?.bahan.company).toBe("PT Dari Pipeline");
    expect(hasil?.bahan.employer_known).toBe(true);
  });

  it("returns null when the API has no such listing", async () => {
    expect(
      await jobstreet.ambilDetail("https://id.jobstreet.com/id/job/1", io([]), { perusahaan: "X" }),
    ).toBeNull();
  });

  it("returns null for a url it does not own", async () => {
    expect(
      await jobstreet.ambilDetail("https://dealls.com/loker/a~b", io([listing()]), {
        perusahaan: "X",
      }),
    ).toBeNull();
  });
});

describe("tagKlasifikasi", () => {
  it("turns classification descriptions into tags", () => {
    const tags = tagKlasifikasi(
      listing({
        classifications: [
          {
            classification: { id: "1", description: "Information & Communication Technology" },
            subclassification: { id: "2", description: "Business/Systems Analysts" },
          },
        ],
      } as unknown as Partial<ListingJobstreet>),
    );
    expect(tags).toContain("Information & Communication Technology");
    expect(tags).toContain("Business/Systems Analysts");
  });

  it("returns an empty list when the listing carries no classifications", () => {
    expect(tagKlasifikasi(listing())).toEqual([]);
  });
});
```

- [ ] **Step 3: Write `boards/kalibrr.ts`**

```typescript
/**
 * kalibrr.ts — the Kalibrr adapter.
 *
 * Kalibrr's search API has a `description` field, but it is a *global* search:
 * `company_code` and `job_id` are silently ignored (verified live — both return
 * unrelated employers), and only `company=<code>` scopes it. A company can also
 * exceed one page (a measured account has 188 postings), so a feed read needs
 * pagination for no benefit. The posting page is server-rendered with the full
 * text in `__NEXT_DATA__`, so one fetch per row is both simpler and complete.
 */

import { htmlKeTeks, ambilNextData } from "./html";
import { applyUrlOffPlatform, hostDari } from "./url";
import { perusahaanTerkenal, type HasilPapan, type Io, type PapanAdapter } from "./types";

/** `/c/<company-code>/jobs/<id>/<slug>` — the shape the scan records. */
const BAGIAN_URL = /^https?:\/\/(?:www\.)?kalibrr\.com\/c\/([^/]+)\/jobs\/(\d+)(?:\/([^/?#]+))?/i;

interface KalibrrJob {
  id?: number | string | null;
  slug?: string | null;
  name?: string | null;
  description?: string | null;
  qualifications?: string | null;
  apply_redirect_url?: string | null;
  function?: string | null;
  company?: { code?: string; name?: string } | null;
}

export const kalibrr: PapanAdapter = {
  nama: "Kalibrr",
  cocok: (url) => /(^|\.)kalibrr\.com$/i.test(hostDari(url)),

  async ambilDetail(url, io, konteks): Promise<HasilPapan | null> {
    if (!BAGIAN_URL.test(url)) return null;

    const { html } = await io.fetchHtml(url);
    const nd = ambilNextData(html) as
      | { props?: { pageProps?: { job?: KalibrrJob } } }
      | null;
    const job = nd?.props?.pageProps?.job;
    if (!job) return null;

    const description = [job.description, job.qualifications]
      .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
      .map(htmlKeTeks)
      .filter(Boolean)
      .join("\n");
    if (!description) return null;

    const nama = (job.company?.name ?? "").trim();
    const perusahaan = nama || konteks.perusahaan;

    return {
      bahan: {
        description,
        apply_url: applyUrlOffPlatform(job.apply_redirect_url, url),
        company: perusahaan,
        employer_known: perusahaanTerkenal(perusahaan),
      },
      tags: [job.function].filter((t): t is string => typeof t === "string" && t.trim() !== ""),
    };
  },
};
```

- [ ] **Step 4: Write `boards/kalibrr.test.ts`**

```typescript
import { describe, expect, it, vi } from "vitest";
import { kalibrr } from "./kalibrr";
import type { Io } from "./types";

/** The real `__NEXT_DATA__` shape, measured 2026-09-29. */
const halaman = (job: Record<string, unknown>) =>
  `<html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
    props: { pageProps: { job } },
  })}</script></body></html>`;

const io = (html: string): Io => ({
  fetchJson: vi.fn(),
  fetchHtml: vi.fn().mockResolvedValue({ html, urlAkhir: "https://www.kalibrr.com/x" }),
});

const URL_KALIBRR = "https://www.kalibrr.com/c/pt-akhdani-reka-solusi/jobs/264597/software-engineer-6";

describe("kalibrr adapter", () => {
  it("claims kalibrr urls only", () => {
    expect(kalibrr.cocok(URL_KALIBRR)).toBe(true);
    expect(kalibrr.cocok("https://id.jobstreet.com/id/job/1")).toBe(false);
  });

  it("joins description and qualifications, stripped of HTML", async () => {
    const hasil = await kalibrr.ambilDetail(
      URL_KALIBRR,
      io(
        halaman({
          description: "<p>Develop and maintain web apps.</p>",
          qualifications: "<p>5 years in IT.</p>",
          company: { code: "pt-akhdani-reka-solusi", name: "PT Akhdani Reka Solusi" },
        }),
      ),
      { perusahaan: "ignored" },
    );
    expect(hasil?.bahan.description).toBe("Develop and maintain web apps.\n5 years in IT.");
    expect(hasil?.bahan.company).toBe("PT Akhdani Reka Solusi");
  });

  it("prefers an off-platform apply_redirect_url", async () => {
    const hasil = await kalibrr.ambilDetail(
      URL_KALIBRR,
      io(halaman({ description: "<p>x</p>", apply_redirect_url: "https://bit.ly/abc" })),
      { perusahaan: "PT Foo" },
    );
    expect(hasil?.bahan.apply_url).toBe("https://bit.ly/abc");
  });

  it("falls back to the pipeline company when the page names none", async () => {
    const hasil = await kalibrr.ambilDetail(
      URL_KALIBRR,
      io(halaman({ description: "<p>x</p>" })),
      { perusahaan: "PT Dari Pipeline" },
    );
    expect(hasil?.bahan.company).toBe("PT Dari Pipeline");
    expect(hasil?.bahan.employer_known).toBe(true);
  });

  it("returns null when the page carries no description", async () => {
    expect(await kalibrr.ambilDetail(URL_KALIBRR, io(halaman({})), { perusahaan: "X" })).toBeNull();
  });

  it("returns null when there is no __NEXT_DATA__ payload", async () => {
    expect(await kalibrr.ambilDetail(URL_KALIBRR, io("<html></html>"), { perusahaan: "X" })).toBeNull();
  });

  it("returns null for a url it does not own", async () => {
    expect(
      await kalibrr.ambilDetail("https://dealls.com/loker/a~b", io(halaman({})), { perusahaan: "X" }),
    ).toBeNull();
  });

  it("carries the job function as a tag", async () => {
    const hasil = await kalibrr.ambilDetail(
      URL_KALIBRR,
      io(halaman({ description: "<p>x</p>", function: "Software Development" })),
      { perusahaan: "X" },
    );
    expect(hasil?.tags).toEqual(["Software Development"]);
  });
});
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/lib/career-ops/boards/jobstreet.test.ts src/lib/career-ops/boards/kalibrr.test.ts`

Expected: PASS — 8 + 8 tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/career-ops/boards/jobstreet.ts src/lib/career-ops/boards/kalibrr.ts src/lib/career-ops/boards/jobstreet.test.ts src/lib/career-ops/boards/kalibrr.test.ts
git commit -m "feat(career-ops): jobstreet and kalibrr board adapters"
```

---

### Task 4: Workable adapter

**Files:**
- Create: `src/lib/career-ops/boards/workable.ts`
- Test: `src/lib/career-ops/boards/workable.test.ts`

**Interfaces:**
- Consumes: `HasilPapan`, `Io`, `PapanAdapter`, `perusahaanTerkenal` from `./types`; `htmlKeTeks` from `./html`; `applyUrlOffPlatform`, `hostDari` from `./url`.
- Produces: `workable: PapanAdapter`.

**Why this adapter needs two requests:** the scan records Workable rows as `https://apply.workable.com/j/<shortcode>` — the account slug is not in the URL. `GET /j/<shortcode>` 301s to `/<slug>/j/<shortcode>`, and only the per-account job endpoint (`/api/v1/accounts/<slug>/jobs/<shortcode>`) carries the description. `/api/v1/jobs/<shortcode>` is a 404. So: follow the redirect once to learn the slug, then fetch the detail.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it, vi } from "vitest";
import { workable } from "./workable";
import type { Io } from "./types";

const URL_WORKABLE = "https://apply.workable.com/j/B2B2EFD9D7";

/** Measured shape of `/api/v1/accounts/<slug>/jobs/<shortcode>`. */
const detail = (over: Record<string, unknown> = {}) => ({
  title: "Account Manager (Telco)",
  shortcode: "B2B2EFD9D7",
  description: "<p>About Us</p><p>INDICO is Telkomsel Group's digital company.</p>",
  requirements: "<p>3+ years of experience.</p>",
  ...over,
});

const io = (
  opts: { detail?: unknown; urlAkhir?: string; detailThrows?: boolean } = {},
): Io => ({
  fetchJson: opts.detailThrows
    ? vi.fn().mockRejectedValue(new Error("HTTP 500"))
    : vi.fn().mockResolvedValue(opts.detail ?? detail()),
  fetchHtml: vi.fn().mockResolvedValue({
    html: "<html></html>",
    urlAkhir: opts.urlAkhir ?? "https://apply.workable.com/indico/j/B2B2EFD9D7",
  }),
});

describe("workable adapter", () => {
  it("claims only apply.workable.com urls", () => {
    expect(workable.cocok(URL_WORKABLE)).toBe(true);
    expect(workable.cocok("https://www.kalibrr.com/c/a/jobs/1/b")).toBe(false);
  });

  it("resolves the account slug from the redirect, then fetches that account's job", async () => {
    const fake = io();
    await workable.ambilDetail(URL_WORKABLE, fake, { perusahaan: "INDICO" });

    expect(fake.fetchHtml).toHaveBeenCalledWith(URL_WORKABLE);
    const url = String((fake.fetchJson as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(url).toBe("https://apply.workable.com/api/v1/accounts/indico/jobs/B2B2EFD9D7");
  });

  it("joins description and requirements into plain text", async () => {
    const hasil = await workable.ambilDetail(URL_WORKABLE, io(), { perusahaan: "INDICO" });
    expect(hasil?.bahan.description).toBe(
      "About Us\nINDICO is Telkomsel Group's digital company.\n3+ years of experience.",
    );
  });

  it("skips the redirect when the url already carries the slug", async () => {
    const fake = io();
    await workable.ambilDetail("https://apply.workable.com/indico/j/B2B2EFD9D7", fake, {
      perusahaan: "INDICO",
    });
    expect(fake.fetchHtml).not.toHaveBeenCalled();
  });

  it("uses the pipeline company, since the job endpoint names none", async () => {
    const hasil = await workable.ambilDetail(URL_WORKABLE, io(), { perusahaan: "INDICO" });
    expect(hasil?.bahan.company).toBe("INDICO");
    expect(hasil?.bahan.employer_known).toBe(true);
  });

  it("returns null when the redirect does not resolve a slug", async () => {
    const hasil = await workable.ambilDetail(URL_WORKABLE, io({ urlAkhir: "https://apply.workable.com/j/B2B2EFD9D7" }), {
      perusahaan: "INDICO",
    });
    expect(hasil).toBeNull();
  });

  it("returns null when the job endpoint has no description", async () => {
    const hasil = await workable.ambilDetail(URL_WORKABLE, io({ detail: detail({ description: "", requirements: "" }) }), {
      perusahaan: "INDICO",
    });
    expect(hasil).toBeNull();
  });

  it("returns null for a url it does not own", async () => {
    expect(await workable.ambilDetail("https://dealls.com/loker/a~b", io(), { perusahaan: "X" })).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/career-ops/boards/workable.test.ts`

Expected: FAIL — `Cannot find module './workable'`.

- [ ] **Step 3: Write `boards/workable.ts`**

```typescript
/**
 * workable.ts — the Workable adapter.
 *
 * Two requests per row, and the reason is in the URL the scan records. Workable
 * postings are written to `pipeline.md` as `apply.workable.com/j/<shortcode>` —
 * the account slug is not there. `GET /j/<shortcode>` 301s to
 * `/<slug>/j/<shortcode>`, and only the per-account endpoint
 * (`/api/v1/accounts/<slug>/jobs/<shortcode>`) carries the description:
 * `/api/v1/jobs/<shortcode>` answers 404, and the account widget's list omits
 * `description` unless `?details=true` is set, which returns the whole account.
 *
 * So the redirect is not an extra hop we could skip by cleverness — it is the
 * only way to learn the slug the detail endpoint needs.
 */

import { htmlKeTeks } from "./html";
import { applyUrlOffPlatform, hostDari } from "./url";
import { perusahaanTerkenal, type HasilPapan, type Io, type PapanAdapter } from "./types";

const HOST = "apply.workable.com";

/** `/j/<shortcode>` or `/<slug>/j/<shortcode>`. */
const SHORTCODE = /^https?:\/\/apply\.workable\.com\/(?:[A-Za-z0-9_-]+\/)?j\/([A-Za-z0-9]+)/i;
const SLUG = /^https?:\/\/apply\.workable\.com\/([A-Za-z0-9][A-Za-z0-9_-]*)\/j\//i;

interface WorkableJob {
  description?: string | null;
  requirements?: string | null;
  application_url?: string | null;
}

export const workable: PapanAdapter = {
  nama: "Workable",
  cocok: (url) => hostDari(url) === HOST,

  async ambilDetail(url, io, konteks): Promise<HasilPapan | null> {
    const shortcode = SHORTCODE.exec(url)?.[1];
    if (!shortcode) return null;

    let slug = SLUG.exec(url)?.[1];
    if (!slug) {
      const { urlAkhir } = await io.fetchHtml(url);
      slug = SLUG.exec(urlAkhir)?.[1];
    }
    if (!slug) return null;

    const detail = (await io.fetchJson(
      `https://apply.workable.com/api/v1/accounts/${slug}/jobs/${shortcode}`,
    )) as WorkableJob | null;
    if (!detail || typeof detail !== "object") return null;

    const description = [detail.description, detail.requirements]
      .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
      .map(htmlKeTeks)
      .filter(Boolean)
      .join("\n");
    if (!description) return null;

    return {
      bahan: {
        description,
        apply_url: applyUrlOffPlatform(detail.application_url, url),
        company: konteks.perusahaan,
        employer_known: perusahaanTerkenal(konteks.perusahaan),
      },
    };
  },
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/career-ops/boards/workable.test.ts`

Expected: PASS — 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/career-ops/boards/workable.ts src/lib/career-ops/boards/workable.test.ts
git commit -m "feat(career-ops): workable board adapter"
```

---

### Task 5: SmartRecruiters, Dealls, and Breezy adapters

**Files:**
- Create: `src/lib/career-ops/boards/smartrecruiters.ts`
- Create: `src/lib/career-ops/boards/dealls.ts`
- Create: `src/lib/career-ops/boards/breezy.ts`
- Test: `src/lib/career-ops/boards/smartrecruiters.test.ts`
- Test: `src/lib/career-ops/boards/dealls.test.ts`
- Test: `src/lib/career-ops/boards/breezy.test.ts`

**Interfaces:**
- Consumes: `HasilPapan`, `Io`, `PapanAdapter`, `perusahaanTerkenal` from `./types`; `htmlKeTeks`, `ambilNextData`, `metaOgDescription`, `potongDivId`, `bersihkanPlaceholder` from `./html`; `applyUrlOffPlatform`, `hostDari` from `./url`.
- Produces: `smartrecruiters: PapanAdapter`, `dealls: PapanAdapter`, `breezy: PapanAdapter`.

- [ ] **Step 1: Write `boards/smartrecruiters.ts`**

```typescript
/**
 * smartrecruiters.ts — the SmartRecruiters adapter.
 *
 * The list endpoint has no description; the per-posting detail does, nested
 * under `jobAd.sections`. Sections are joined in the engine's own order
 * (`engine/providers/smartrecruiters.mjs` `extractDescription`): company context
 * first, call-to-action last — so the fee rules read the same text the scanner
 * would have.
 */

import { htmlKeTeks } from "./html";
import { applyUrlOffPlatform, hostDari } from "./url";
import { perusahaanTerkenal, type HasilPapan, type Io, type PapanAdapter } from "./types";

const HOST = "jobs.smartrecruiters.com";
const BAGIAN_URL = /^https?:\/\/jobs\.smartrecruiters\.com\/([^/]+)\/(\d+)/i;

const URUTAN_BAGIAN = [
  "companyDescription",
  "jobDescription",
  "qualifications",
  "additionalInformation",
] as const;

interface SmartRecruitersDetail {
  applyUrl?: string | null;
  jobAd?: { sections?: Record<string, { text?: string } | undefined> } | null;
}

export const smartrecruiters: PapanAdapter = {
  nama: "SmartRecruiters",
  cocok: (url) => hostDari(url) === HOST,

  async ambilDetail(url, io, konteks): Promise<HasilPapan | null> {
    const m = BAGIAN_URL.exec(url);
    if (!m) return null;
    const [, slug, id] = m;

    const detail = (await io.fetchJson(
      `https://api.smartrecruiters.com/v1/companies/${slug}/postings/${id}`,
    )) as SmartRecruitersDetail | null;
    if (!detail || typeof detail !== "object") return null;

    const sections = detail.jobAd?.sections ?? {};
    const description = URUTAN_BAGIAN.map((k) => sections[k]?.text)
      .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
      .map(htmlKeTeks)
      .filter(Boolean)
      .join("\n");
    if (!description) return null;

    return {
      bahan: {
        description,
        apply_url: applyUrlOffPlatform(detail.applyUrl, url),
        company: konteks.perusahaan,
        employer_known: perusahaanTerkenal(konteks.perusahaan),
      },
    };
  },
};
```

- [ ] **Step 2: Write `boards/dealls.ts`**

```typescript
/**
 * dealls.ts — the Dealls adapter.
 *
 * Dealls (dealls.com, formerly SejutaCita) has no per-posting JSON endpoint: its
 * explore-job API's list documents carry no description. The posting page is
 * server-rendered, and its `__NEXT_DATA__` payload holds `responsibilities` and
 * `requirements`. One fetch per row.
 *
 * The slug in `pipeline.md` is `~<company-slug>`; the page 307-redirects a stale
 * company slug to the current one, so the fetch follows redirects and the final
 * URL is not load-bearing here.
 */

import { ambilNextData, htmlKeTeks } from "./html";
import { applyUrlOffPlatform, hostDari } from "./url";
import { perusahaanTerkenal, type HasilPapan, type Io, type PapanAdapter } from "./types";

const BAGIAN_URL = /^https?:\/\/dealls\.com\/loker\/([^~?#]+)(?:~([^?#]+))?/i;

interface DeallsData {
  responsibilities?: string | null;
  requirements?: string | null;
  externalPlatformApplyUrl?: string | null;
  company?: { name?: string } | null;
  jobRoleCategorySlug?: string | null;
  categorySlug?: string | null;
}

/**
 * The first dehydrated query that carries job text. Picking `queries[0]`
 * positionally would break the moment Dealls reorders its prefetches; the shape
 * is the contract, not the index.
 */
function cariDataJob(nd: unknown): DeallsData | null {
  const queries = (nd as { props?: { pageProps?: { dehydratedState?: { queries?: unknown[] } } } })
    ?.props?.pageProps?.dehydratedState?.queries;
  if (!Array.isArray(queries)) return null;
  for (const q of queries) {
    const data = (q as { state?: { data?: unknown } })?.state?.data as DeallsData | undefined;
    if (data && (typeof data.responsibilities === "string" || typeof data.requirements === "string")) {
      return data;
    }
  }
  return null;
}

export const dealls: PapanAdapter = {
  nama: "Dealls",
  cocok: (url) => /(^|\.)dealls\.com$/i.test(hostDari(url)),

  async ambilDetail(url, io, konteks): Promise<HasilPapan | null> {
    if (!BAGIAN_URL.test(url)) return null;

    const { html } = await io.fetchHtml(url);
    const data = cariDataJob(ambilNextData(html));
    if (!data) return null;

    const description = [data.responsibilities, data.requirements]
      .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
      .map(htmlKeTeks)
      .filter(Boolean)
      .join("\n");
    if (!description) return null;

    const nama = (data.company?.name ?? "").trim();
    const perusahaan = nama || konteks.perusahaan;

    return {
      bahan: {
        description,
        apply_url: applyUrlOffPlatform(data.externalPlatformApplyUrl, url),
        company: perusahaan,
        employer_known: perusahaanTerkenal(perusahaan),
      },
      tags: [data.jobRoleCategorySlug, data.categorySlug].filter(
        (t): t is string => typeof t === "string" && t.trim() !== "",
      ),
    };
  },
};
```

- [ ] **Step 3: Write `boards/breezy.ts`**

```typescript
/**
 * breezy.ts — the Breezy adapter.
 *
 * Breezy's public board feed (`<tenant>.breezy.hr/json`) is free and carries
 * every posting's title and URL — but no description, and its authenticated API
 * is out of bounds. The posting page IS server-rendered, though: the description
 * sits in `<div id="description">`, and `og:description` carries a summary as a
 * fallback.
 *
 * The container also holds Breezy's own template tokens
 * (`%BREADCRUMB_JOB_OPENINGS%`, `%BUTTON_APPLY_TO_POSITION%`). Left in, they read
 * as shouting in a fraud audit, so they are stripped.
 */

import { bersihkanPlaceholder, htmlKeTeks, metaOgDescription, potongDivId } from "./html";
import { applyUrlOffPlatform, hostDari } from "./url";
import { perusahaanTerkenal, type HasilPapan, type Io, type PapanAdapter } from "./types";

const HOST = /^[a-z0-9][a-z0-9-]*\.breezy\.hr$/i;
const BAGIAN_URL = /^https?:\/\/[a-z0-9][a-z0-9-]*\.breezy\.hr\/p\//i;

export const breezy: PapanAdapter = {
  nama: "Breezy",
  cocok: (url) => HOST.test(hostDari(url)),

  async ambilDetail(url, io, konteks): Promise<HasilPapan | null> {
    if (!BAGIAN_URL.test(url)) return null;

    const { html } = await io.fetchHtml(url);
    const blok = potongDivId(html, "description");
    const dariBlok = blok ? htmlKeTeks(blok) : "";
    const deskripsi = bersihkanPlaceholder(dariBlok || metaOgDescription(html) || "");
    if (!deskripsi) return null;

    return {
      bahan: {
        description: deskripsi,
        apply_url: applyUrlOffPlatform(null, url),
        company: konteks.perusahaan,
        employer_known: perusahaanTerkenal(konteks.perusahaan),
      },
    };
  },
};
```

- [ ] **Step 4: Write `boards/smartrecruiters.test.ts`**

```typescript
import { describe, expect, it, vi } from "vitest";
import { smartrecruiters } from "./smartrecruiters";
import type { Io } from "./types";

const URL_SR = "https://jobs.smartrecruiters.com/GudangAda/743999852547361-software-engineer-front-end";

/** Measured shape of `/v1/companies/<slug>/postings/<id>`. */
const detail = (over: Record<string, unknown> = {}) => ({
  applyUrl: "https://jobs.smartrecruiters.com/GudangAda/743999852547361-software-engineer-front-end-?oga=true",
  jobAd: {
    sections: {
      companyDescription: { text: "" },
      jobDescription: { text: "<p>Build the front end.</p>" },
      qualifications: { text: "<p>3 years React.</p>" },
      additionalInformation: { text: "" },
    },
  },
  ...over,
});

const io = (payload: unknown): Io => ({
  fetchJson: vi.fn().mockResolvedValue(payload),
  fetchHtml: vi.fn(),
});

describe("smartrecruiters adapter", () => {
  it("claims only jobs.smartrecruiters.com urls", () => {
    expect(smartrecruiters.cocok(URL_SR)).toBe(true);
    expect(smartrecruiters.cocok("https://apply.workable.com/j/X")).toBe(false);
  });

  it("requests the per-posting detail endpoint", async () => {
    const fake = io(detail());
    await smartrecruiters.ambilDetail(URL_SR, fake, { perusahaan: "GudangAda" });
    expect(String((fake.fetchJson as ReturnType<typeof vi.fn>).mock.calls[0][0])).toBe(
      "https://api.smartrecruiters.com/v1/companies/GudangAda/postings/743999852547361",
    );
  });

  it("joins sections in the engine's order, skipping empty ones", async () => {
    const hasil = await smartrecruiters.ambilDetail(URL_SR, io(detail()), { perusahaan: "GudangAda" });
    expect(hasil?.bahan.description).toBe("Build the front end.\n3 years React.");
  });

  it("keeps the posting url when applyUrl is on the same host", async () => {
    const hasil = await smartrecruiters.ambilDetail(URL_SR, io(detail()), { perusahaan: "GudangAda" });
    expect(hasil?.bahan.apply_url).toBe(URL_SR);
  });

  it("prefers an off-platform applyUrl", async () => {
    const hasil = await smartrecruiters.ambilDetail(
      URL_SR,
      io(detail({ applyUrl: "https://careers.acme.co.id/apply/1" })),
      { perusahaan: "GudangAda" },
    );
    expect(hasil?.bahan.apply_url).toBe("https://careers.acme.co.id/apply/1");
  });

  it("returns null when every section is empty", async () => {
    const kosong = detail({
      jobAd: { sections: { companyDescription: { text: "" }, jobDescription: { text: "" } } },
    });
    expect(await smartrecruiters.ambilDetail(URL_SR, io(kosong), { perusahaan: "X" })).toBeNull();
  });

  it("returns null for a url it does not own", async () => {
    expect(await smartrecruiters.ambilDetail("https://dealls.com/loker/a~b", io(detail()), { perusahaan: "X" })).toBeNull();
  });
});
```

- [ ] **Step 5: Write `boards/dealls.test.ts`**

```typescript
import { describe, expect, it, vi } from "vitest";
import { dealls } from "./dealls";
import type { Io } from "./types";

const URL_DEALLS = "https://dealls.com/loker/software-fullstack-engineer-pos-and~esb";

/** Measured shape: the job text lives in the first dehydrated query's data. */
const halaman = (data: Record<string, unknown>) =>
  `<html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
    props: {
      pageProps: {
        dehydratedState: { queries: [{ queryKey: ["job"], state: { data } }] },
      },
    },
  })}</script></body></html>`;

const io = (html: string): Io => ({
  fetchJson: vi.fn(),
  fetchHtml: vi.fn().mockResolvedValue({ html, urlAkhir: URL_DEALLS }),
});

describe("dealls adapter", () => {
  it("claims only dealls.com urls", () => {
    expect(dealls.cocok(URL_DEALLS)).toBe(true);
    expect(dealls.cocok("https://id.jobstreet.com/id/job/1")).toBe(false);
  });

  it("joins responsibilities and requirements", async () => {
    const hasil = await dealls.ambilDetail(
      URL_DEALLS,
      io(halaman({ responsibilities: "<p>Build POS.</p>", requirements: "<p>3 years.</p>" })),
      { perusahaan: "ESB" },
    );
    expect(hasil?.bahan.description).toBe("Build POS.\n3 years.");
  });

  it("reads the job query even when it is not the first one", async () => {
    const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
      props: {
        pageProps: {
          dehydratedState: {
            queries: [
              { state: { data: { unrelated: true } } },
              { state: { data: { responsibilities: "<p>Real</p>" } } },
            ],
          },
        },
      },
    })}</script>`;
    const hasil = await dealls.ambilDetail(URL_DEALLS, io(html), { perusahaan: "ESB" });
    expect(hasil?.bahan.description).toBe("Real");
  });

  it("prefers the page's company name over the pipeline fallback", async () => {
    const hasil = await dealls.ambilDetail(
      URL_DEALLS,
      io(halaman({ responsibilities: "<p>x</p>", company: { name: "CFACTORY.CO" } })),
      { perusahaan: "Stale Name" },
    );
    expect(hasil?.bahan.company).toBe("CFACTORY.CO");
  });

  it("prefers an off-platform externalPlatformApplyUrl", async () => {
    const hasil = await dealls.ambilDetail(
      URL_DEALLS,
      io(halaman({ responsibilities: "<p>x</p>", externalPlatformApplyUrl: "https://bit.ly/abc" })),
      { perusahaan: "ESB" },
    );
    expect(hasil?.bahan.apply_url).toBe("https://bit.ly/abc");
  });

  it("returns null when no query carries job text", async () => {
    expect(await dealls.ambilDetail(URL_DEALLS, io(halaman({ other: 1 })), { perusahaan: "X" })).toBeNull();
  });

  it("returns null when there is no __NEXT_DATA__ payload", async () => {
    expect(await dealls.ambilDetail(URL_DEALLS, io("<html></html>"), { perusahaan: "X" })).toBeNull();
  });

  it("returns null for a url it does not own", async () => {
    expect(await dealls.ambilDetail("https://id.jobstreet.com/id/job/1", io(halaman({})), { perusahaan: "X" })).toBeNull();
  });
});
```

- [ ] **Step 6: Write `boards/breezy.test.ts`**

```typescript
import { describe, expect, it, vi } from "vitest";
import { breezy } from "./breezy";
import type { Io } from "./types";

const URL_BREEZY = "https://kredivo-group.breezy.hr/p/c43a53b3bc63-fullstack-engineer-sde-2";

/** Measured shape: description in `<div id="description">`, summary in og:description. */
const halaman = (isi: string, og = "") =>
  `<html><head>${og ? `<meta property="og:description" content="${og}">` : ""}</head>` +
  `<body><div id="description" class="container position-description">${isi}</div></body></html>`;

const io = (html: string): Io => ({
  fetchJson: vi.fn(),
  fetchHtml: vi.fn().mockResolvedValue({ html, urlAkhir: URL_BREEZY }),
});

describe("breezy adapter", () => {
  it("claims only <tenant>.breezy.hr urls", () => {
    expect(breezy.cocok(URL_BREEZY)).toBe(true);
    expect(breezy.cocok("https://jobs.smartrecruiters.com/X/1")).toBe(false);
  });

  it("reads the whole description block, not just the first paragraph", async () => {
    // The bug this guards: a non-greedy regex returned 79 chars where the real
    // block is 1725, so the audit judged an almost-empty description.
    const hasil = await breezy.ambilDetail(
      URL_BREEZY,
      io(halaman("<div><p>Intro.</p></div><p>Standing in SQL is a plus.</p>")),
      { perusahaan: "Kredivo Group" },
    );
    expect(hasil?.bahan.description).toContain("Intro.");
    expect(hasil?.bahan.description).toContain("Standing in SQL is a plus.");
  });

  it("strips Breezy's template tokens", async () => {
    const hasil = await breezy.ambilDetail(
      URL_BREEZY,
      io(halaman("%BREADCRUMB_JOB_OPENINGS% Fullstack Engineer %BUTTON_APPLY_TO_POSITION%")),
      { perusahaan: "Kredivo Group" },
    );
    expect(hasil?.bahan.description).toBe("Fullstack Engineer");
  });

  it("falls back to og:description when the container is empty", async () => {
    const hasil = await breezy.ambilDetail(
      URL_BREEZY,
      io(halaman("", "As a Fullstack Engineer, you will cover everything.")),
      { perusahaan: "Kredivo Group" },
    );
    expect(hasil?.bahan.description).toBe("As a Fullstack Engineer, you will cover everything.");
  });

  it("uses the pipeline company and keeps the posting url", async () => {
    const hasil = await breezy.ambilDetail(URL_BREEZY, io(halaman("<p>x</p>")), {
      perusahaan: "Kredivo Group",
    });
    expect(hasil?.bahan.company).toBe("Kredivo Group");
    expect(hasil?.bahan.apply_url).toBe(URL_BREEZY);
  });

  it("returns null when there is neither a container nor og:description", async () => {
    expect(await breezy.ambilDetail(URL_BREEZY, io("<html></html>"), { perusahaan: "X" })).toBeNull();
  });

  it("returns null for a url it does not own", async () => {
    expect(await breezy.ambilDetail("https://dealls.com/loker/a~b", io(halaman("<p>x</p>")), { perusahaan: "X" })).toBeNull();
  });
});
```

- [ ] **Step 7: Run the three tests**

Run: `npx vitest run src/lib/career-ops/boards/smartrecruiters.test.ts src/lib/career-ops/boards/dealls.test.ts src/lib/career-ops/boards/breezy.test.ts`

Expected: PASS — 7 + 8 + 7 tests.

- [ ] **Step 8: Commit**

```bash
git add src/lib/career-ops/boards/smartrecruiters.ts src/lib/career-ops/boards/dealls.ts src/lib/career-ops/boards/breezy.ts src/lib/career-ops/boards/smartrecruiters.test.ts src/lib/career-ops/boards/dealls.test.ts src/lib/career-ops/boards/breezy.test.ts
git commit -m "feat(career-ops): smartrecruiters, dealls and breezy board adapters"
```

---

### Task 6: Board registry

**Files:**
- Create: `src/lib/career-ops/boards/index.ts`
- Test: `src/lib/career-ops/boards/index.test.ts`

**Interfaces:**
- Consumes: the six adapters from Tasks 3–5; `PapanAdapter` from `./types`.
- Produces: `ADAPTER: readonly PapanAdapter[]`, `adapterUntuk(url): PapanAdapter | null`, `namaPapan(url): string | undefined`. Used by `job-cache.ts` (Task 7), `inbox.ts` (Task 8), `index.ts` (Task 8).

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "vitest";
import { ADAPTER, adapterUntuk, namaPapan } from "./index";

/** Every board present in the real inbox, by one of its rows. */
const CONTOH: ReadonlyArray<readonly [string, string]> = [
  ["https://id.jobstreet.com/id/job/94821245", "Jobstreet"],
  ["https://www.kalibrr.com/c/cti-group/jobs/256183/cloud-engineer-11", "Kalibrr"],
  ["https://apply.workable.com/j/B2B2EFD9D7", "Workable"],
  ["https://jobs.smartrecruiters.com/Julo/743999771899216-lead-software-engineer", "SmartRecruiters"],
  ["https://dealls.com/loker/software-engineer-ai~sirclo", "Dealls"],
  ["https://kredivo-group.breezy.hr/p/c43a53b3bc63-fullstack-engineer-sde-2", "Breezy"],
];

describe("registry", () => {
  it("has one adapter per board the inbox actually contains", () => {
    expect(ADAPTER.map((a) => a.nama)).toEqual([
      "Jobstreet",
      "Kalibrr",
      "Workable",
      "SmartRecruiters",
      "Dealls",
      "Breezy",
    ]);
  });

  it.each(CONTOH)("routes %s to %s", (url, nama) => {
    expect(adapterUntuk(url)?.nama).toBe(nama);
    expect(namaPapan(url)).toBe(nama);
  });

  it("routes each sample to exactly one adapter", () => {
    // Overlapping `cocok` patterns would let adapter order silently decide which
    // board owns a row — a bug that shows up as the wrong description, not an error.
    for (const [url] of CONTOH) {
      expect(ADAPTER.filter((a) => a.cocok(url))).toHaveLength(1);
    }
  });

  it("returns null for a host no adapter claims", () => {
    expect(adapterUntuk("https://careers.allianz.com/job/1")).toBeNull();
    expect(namaPapan("https://careers.allianz.com/job/1")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/career-ops/boards/index.test.ts`

Expected: FAIL — `Cannot find module './index'`.

- [ ] **Step 3: Write `boards/index.ts`**

```typescript
/**
 * index.ts — the board registry.
 *
 * The one place that answers "which board owns this URL?". Order is deliberate
 * but should never matter: `index.test.ts` asserts each sample URL is claimed by
 * exactly one adapter, so a future overlapping pattern fails a test rather than
 * silently handing a row to the wrong board.
 */

import { breezy } from "./breezy";
import { dealls } from "./dealls";
import { jobstreet } from "./jobstreet";
import { kalibrr } from "./kalibrr";
import { smartrecruiters } from "./smartrecruiters";
import type { PapanAdapter } from "./types";
import { workable } from "./workable";

export const ADAPTER: readonly PapanAdapter[] = [
  jobstreet,
  kalibrr,
  workable,
  smartrecruiters,
  dealls,
  breezy,
];

/** The adapter that owns this URL, or null when no board claims it. */
export function adapterUntuk(url: string): PapanAdapter | null {
  return ADAPTER.find((a) => a.cocok(url)) ?? null;
}

/** The human-readable board name, or undefined when no adapter claims the URL. */
export function namaPapan(url: string): string | undefined {
  return adapterUntuk(url)?.nama;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/career-ops/boards/index.test.ts`

Expected: PASS — 9 tests (the `it.each` expands to six cases: 1 + 6 + 1 + 1).

- [ ] **Step 5: Commit**

```bash
git add src/lib/career-ops/boards/index.ts src/lib/career-ops/boards/index.test.ts
git commit -m "feat(career-ops): board registry"
```

---

### Task 7: Unified URL-keyed cache (created alongside the old one)

**Files:**
- Create: `src/lib/career-ops/job-cache.ts`
- Test: `src/lib/career-ops/job-cache.test.ts`

**Interfaces:**
- Consumes: `adapterUntuk` from `./boards`; `Io`, `BahanAudit` from `./boards/types`; `bahanAudit`, `jobIdFromUrl`, `type ListingJobstreet` from `./jobstreet-audit`; `tagKlasifikasi` from `./boards/jobstreet`; `normalisasiKunciUrl` from `./url-key`; `InboxJobShape` from `./pipeline-table`.
- Produces: `EntriCache`, `IsiCache`, `cachePath()`, `bacaCache()`, `tulisCache()`, `perkayaSemua(rows, io, opsi?)`. `bacaCache`/`tulisCache`/`perkayaSemua` are consumed by Tasks 8–9.

**Why this task does NOT delete `jobstreet-enrich.ts`:** deleting it here would break `inbox.ts`, `loker-inbox-persiapan.ts`, and `page.tsx`, which still import it — and a commit that does not typecheck is not a valid task. The old module is deleted in Task 8, in the same commit that moves its last callers onto this cache. Until then the two coexist, and nothing imports the new file yet, so this commit compiles on its own. Its four old exports are superseded — `ambilListing`/`FetchJson`/`fetchJsonDefault` by `boards/jobstreet.ts` + `io.ts`, and `bacaCache`/`tulisCache`/`perkaya` by this file — and its test's coverage (cache round-trip, corrupt file, a failed lookup does not blank the batch) is re-expressed below.

- [ ] **Step 1: Write the failing test**

```typescript
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bacaCache, perkayaSemua, tulisCache, type EntriCache } from "./job-cache";
import type { Io } from "./boards/types";
import type { InboxJobShape } from "./pipeline-table";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "job-cache-"));
  process.env.CAREERVO_JOB_CACHE = path.join(dir, "enrichment.json");
  process.env.CAREERVO_JOBSTREET_CACHE = path.join(dir, "listings.json");
});

afterEach(async () => {
  delete process.env.CAREERVO_JOB_CACHE;
  delete process.env.CAREERVO_JOBSTREET_CACHE;
  await rm(dir, { recursive: true, force: true });
});

const baris = (url: string, company = "Acme"): InboxJobShape => ({
  url,
  company,
  role: "Software Engineer",
  done: false,
});

const entri = (over: Partial<EntriCache> = {}): EntriCache => ({
  board: "Kalibrr",
  bahan: {
    description: "Build things.",
    apply_url: "https://www.kalibrr.com/c/a/jobs/1/b",
    company: "Acme",
    employer_known: true,
  },
  diambilPada: "2026-09-29",
  ...over,
});

const ioDengan = (handler: (url: string) => Promise<unknown>): Io => ({
  fetchJson: vi.fn().mockImplementation(handler),
  fetchHtml: vi.fn().mockImplementation(async () => ({ html: "<html></html>", urlAkhir: "" })),
});

describe("bacaCache / tulisCache", () => {
  it("round-trips an entry", async () => {
    await tulisCache({ "https://a.test/1": entri() });
    expect((await bacaCache())["https://a.test/1"].bahan.description).toBe("Build things.");
  });

  it("is an empty cache, not an error, when the file does not exist", async () => {
    expect(await bacaCache()).toEqual({});
  });

  it("is an empty cache, not an error, when the file is corrupt", async () => {
    await writeFile(process.env.CAREERVO_JOB_CACHE!, "{not json", "utf8");
    expect(await bacaCache()).toEqual({});
  });
});

describe("perkayaSemua", () => {
  it("does not re-fetch a URL already in the cache", async () => {
    const kunci = "https://www.kalibrr.com/c/a/jobs/1/b";
    await tulisCache({ [kunci]: entri() });
    const io = ioDengan(async () => ({ data: [] }));
    const out = await perkayaSemua([baris(kunci)], io);
    expect(io.fetchJson).not.toHaveBeenCalled();
    expect(out[kunci].bahan.description).toBe("Build things.");
  });

  it("leaves a URL whose board no adapter claims untouched", async () => {
    const io = ioDengan(async () => ({ data: [] }));
    const out = await perkayaSemua([baris("https://careers.allianz.com/job/1")], io);
    expect(Object.keys(out)).toEqual([]);
    expect(io.fetchJson).not.toHaveBeenCalled();
  });

  it("keeps a failed fetch out of the cache without failing the batch", async () => {
    const gagal = "https://jobs.smartrecruiters.com/Acme/1";
    const sukses = "https://jobs.smartrecruiters.com/Acme/2";
    const io = ioDengan(async (url) => {
      if (url.includes("/postings/1")) throw new Error("HTTP 500");
      return {
        applyUrl: "",
        jobAd: { sections: { jobDescription: { text: "<p>Real work.</p>" } } },
      };
    });
    const out = await perkayaSemua([baris(gagal), baris(sukses)], io);
    expect(out[gagal]).toBeUndefined();
    expect(out[sukses]?.bahan.description).toBe("Real work.");
    expect(out[sukses]?.board).toBe("SmartRecruiters");
  });

  it("writes what it fetched, so the next call is a cache hit", async () => {
    const url = "https://jobs.smartrecruiters.com/Acme/2";
    const io = ioDengan(async () => ({
      applyUrl: "",
      jobAd: { sections: { jobDescription: { text: "<p>Real work.</p>" } } },
    }));
    await perkayaSemua([baris(url)], io);
    expect((await bacaCache())["https://jobs.smartrecruiters.com/Acme/2"].board).toBe(
      "SmartRecruiters",
    );
  });

  it("never exceeds the concurrency limit", async () => {
    let aktif = 0;
    let puncak = 0;
    const io = ioDengan(async () => {
      aktif++;
      puncak = Math.max(puncak, aktif);
      await new Promise((r) => setTimeout(r, 5));
      aktif--;
      return { applyUrl: "", jobAd: { sections: { jobDescription: { text: "<p>x</p>" } } } };
    });
    const rows = Array.from({ length: 12 }, (_, i) =>
      baris(`https://jobs.smartrecruiters.com/Acme/${i + 100}`),
    );
    await perkayaSemua(rows, io, { konkurensi: 3 });
    expect(puncak).toBeLessThanOrEqual(3);
  });
});

describe("migration from the old Jobstreet cache", () => {
  it("maps {jobstreetId -> listing} onto URL keys without touching the network", async () => {
    await writeFile(
      process.env.CAREERVO_JOBSTREET_CACHE!,
      JSON.stringify({
        "94839531": {
          id: "94839531",
          title: "AI Engineer",
          teaser: "Build React dashboards",
          bulletPoints: ["TypeScript required"],
          companyName: "YO AI Labs",
          employer: { id: "1", name: "YO AI Labs" },
        },
      }),
      "utf8",
    );

    const io = ioDengan(async () => {
      throw new Error("migration must not fetch");
    });
    const url = "https://id.jobstreet.com/id/job/94839531";
    const out = await perkayaSemua([baris(url, "YO AI Labs")], io);

    expect(io.fetchJson).not.toHaveBeenCalled();
    expect(out["https://id.jobstreet.com/id/job/94839531"].board).toBe("Jobstreet");
    expect(out["https://id.jobstreet.com/id/job/94839531"].bahan.description).toContain(
      "TypeScript required",
    );
    // And it is persisted, so the migration happens once.
    expect((await bacaCache())["https://id.jobstreet.com/id/job/94839531"]).toBeDefined();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/career-ops/job-cache.test.ts`

Expected: FAIL — `Cannot find module './job-cache'`.

- [ ] **Step 3: Write `job-cache.ts`**

```typescript
/**
 * job-cache.ts — the one enrichment cache, keyed by normalized URL.
 *
 * Why URL and not Jobstreet id: an id only exists for one board. A URL key is
 * what every board has, and `normalisasiKunciUrl` is already the key the tracker
 * dedupes on, so the cache cannot disagree with the rest of the app about which
 * posting a row is.
 *
 * Two rules carried over from the file this replaces, both load-bearing:
 *   · A missing or corrupt cache is an EMPTY cache, never a throw — a cache is a
 *     derived view, and losing it must degrade to "belum diperiksa", not a 500.
 *   · A row whose fetch fails is left out of the cache entirely. Writing a
 *     half-entry would let `auditBaris` judge a posting on a description we do
 *     not have.
 */

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { adapterUntuk } from "./boards";
import { tagKlasifikasi } from "./boards/jobstreet";
import type { BahanAudit, Io } from "./boards/types";
import { bahanAudit, jobIdFromUrl, type ListingJobstreet } from "./jobstreet-audit";
import type { InboxJobShape } from "./pipeline-table";
import { normalisasiKunciUrl } from "./url-key";

/** One enriched posting, as stored. */
export interface EntriCache {
  /** The board that produced it — `PapanAdapter.nama`. */
  board: string;
  bahan: BahanAudit;
  /** Occupational categories, when the board supplied them. */
  tags?: string[];
  /** `YYYY-MM-DD` the entry was fetched. Debugging metadata, never read by logic. */
  diambilPada: string;
}

export type IsiCache = Record<string, EntriCache>;

/**
 * Where the cache lives. `.data/` is gitignored; this path is Careevo's own, and
 * deliberately outside the engine's data root — the vendored engine must never
 * be handed a file it does not own.
 */
export function cachePath(): string {
  const override = process.env.CAREERVO_JOB_CACHE?.trim();
  if (override) return path.resolve(process.cwd(), override);
  return path.join(process.cwd(), ".data", "job-cache", "enrichment.json");
}

/** The superseded `{jobstreetId -> listing}` cache, read once for migration. */
function cacheLamaPath(): string {
  const override = process.env.CAREERVO_JOBSTREET_CACHE?.trim();
  if (override) return path.resolve(process.cwd(), override);
  return path.join(process.cwd(), ".data", "jobstreet-cache", "listings.json");
}

async function bacaJson<T>(target: string): Promise<T | null> {
  try {
    const parsed: unknown = JSON.parse(await readFile(target, "utf8"));
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    return parsed as T;
  } catch {
    return null;
  }
}

/** Read the cache. A missing or corrupt file is an empty cache, never a throw. */
export async function bacaCache(): Promise<IsiCache> {
  return (await bacaJson<IsiCache>(cachePath())) ?? {};
}

/** Write via temp-then-rename, the same rule the other file stores use. */
export async function tulisCache(cache: IsiCache): Promise<void> {
  const target = cachePath();
  await mkdir(path.dirname(target), { recursive: true });
  const tmp = `${target}.tmp`;
  await writeFile(tmp, JSON.stringify(cache, null, 2), "utf8");
  await rename(tmp, target);
}

const hariIni = () => new Date().toISOString().slice(0, 10);

/**
 * Carry the 180 already-enriched Jobstreet rows over without a single request.
 *
 * The old cache is keyed by Jobstreet id and the new one by URL, so the mapping
 * needs the inbox rows to bridge them. Without this, the first run after the
 * upgrade would re-fetch all 180 — or, worse, show them all as "Belum diperiksa"
 * if the fetch were ever skipped.
 */
async function migrasiCacheLama(rows: InboxJobShape[], cache: IsiCache): Promise<boolean> {
  const lama = await bacaJson<Record<string, ListingJobstreet>>(cacheLamaPath());
  if (!lama) return false;

  let berubah = false;
  for (const row of rows) {
    const kunci = normalisasiKunciUrl(row.url);
    if (!kunci || cache[kunci]) continue;
    const id = jobIdFromUrl(row.url);
    const listing = id ? lama[id] : undefined;
    if (!listing) continue;
    cache[kunci] = {
      board: "Jobstreet",
      bahan: bahanAudit(listing, row.company),
      tags: tagKlasifikasi(listing),
      diambilPada: hariIni(),
    };
    berubah = true;
  }
  return berubah;
}

/**
 * Run `kerja` over `item` with at most `batas` in flight.
 *
 * A shared cursor rather than chunking: with chunking, one slow request holds up
 * the whole chunk. Bounded concurrency is what keeps a cold backfill from
 * hammering a board while still finishing promptly.
 */
async function kolam<T>(
  item: readonly T[],
  batas: number,
  kerja: (t: T) => Promise<void>,
): Promise<void> {
  let i = 0;
  const pekerja = Array.from({ length: Math.max(1, Math.min(batas, item.length)) }, async () => {
    while (i < item.length) {
      const idx = i++;
      await kerja(item[idx]);
    }
  });
  await Promise.all(pekerja);
}

/**
 * Fill the cache for every row a board adapter claims.
 *
 * Called after a scan and by `scripts/enrich-inbox.ts` — never from the render
 * path. The render path reads `bacaCache()` and must not wait on a network.
 */
export async function perkayaSemua(
  rows: readonly InboxJobShape[],
  io: Io,
  opsi: { konkurensi?: number; paksa?: boolean } = {},
): Promise<IsiCache> {
  const cache = await bacaCache();
  let berubah = await migrasiCacheLama([...rows], cache);

  const perlu = rows.filter((row) => {
    const kunci = normalisasiKunciUrl(row.url);
    if (!kunci) return false;
    if (!opsi.paksa && cache[kunci]) return false;
    return adapterUntuk(row.url) !== null;
  });

  await kolam(perlu, opsi.konkurensi ?? 4, async (row) => {
    const kunci = normalisasiKunciUrl(row.url);
    const adapter = adapterUntuk(row.url);
    if (!kunci || !adapter) return;
    try {
      const hasil = await adapter.ambilDetail(row.url, io, { perusahaan: row.company });
      if (!hasil) return;
      cache[kunci] = {
        board: adapter.nama,
        bahan: hasil.bahan,
        tags: hasil.tags,
        diambilPada: hariIni(),
      };
      berubah = true;
    } catch {
      // Leave it uncached: the row is reported unenriched, never judged blind.
    }
  });

  if (berubah) await tulisCache(cache);
  return cache;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/career-ops/job-cache.test.ts`

Expected: PASS — 9 tests.

- [ ] **Step 5: Confirm the new module is self-contained**

Run: `npx vitest run src/lib/career-ops/job-cache.test.ts && npm run typecheck`

Expected: PASS and no type errors. Nothing imports `job-cache.ts` yet, and `jobstreet-enrich.ts` is still present and still used — so this commit must leave the tree exactly as green as it found it.

- [ ] **Step 6: Commit**

```bash
git add src/lib/career-ops/job-cache.ts src/lib/career-ops/job-cache.test.ts
git commit -m "feat(career-ops): unified URL-keyed enrichment cache with migration"
```

---

### Task 8: Wire the unified cache through the app (atomic)

**Files:**
- Modify: `src/lib/career-ops/inbox-audit.ts`
- Modify: `src/lib/career-ops/inbox.ts`
- Modify: `src/lib/jobs/persiapan-inbox.ts`
- Modify: `src/lib/jobs/hitung-kursus.ts`
- Modify: `src/lib/jobs/trust.ts`
- Modify: `src/actions/loker-inbox-persiapan.ts`
- Modify: `src/app/(app)/loker/inbox/page.tsx`
- Modify: `src/lib/career-ops/index.ts`
- Delete: `src/lib/career-ops/jobstreet-enrich.ts`
- Delete: `src/lib/career-ops/jobstreet-enrich.test.ts`
- Test: `src/lib/career-ops/inbox-audit.test.ts`
- Test: `src/lib/career-ops/inbox-audit-wiring.test.ts`
- Test: `src/lib/jobs/persiapan-inbox.test.ts`
- Test: `src/lib/jobs/trust.test.ts`

**Interfaces:**
- Consumes: `EntriCache`, `IsiCache`, `bacaCache`, `perkayaSemua` from `./job-cache`; `namaPapan` from `./boards`; `normalisasiKunciUrl` from `./url-key`; `ATS_DIIZINKAN`, `cocokDaftarDomain` from `@/lib/jobs/trust`.
- Produces: `auditBaris(rows, cache: IsiCache): BarisDiaudit[]` where `BarisDiaudit` gains `papan?: string`; `bacaInboxDiaudit(options?: { cacheFile?: string })` — **cache read only, no network**; `kebutuhanDariInbox(job, entri: EntriCache | null)`; `hitungJumlahKursus(baris, katalog, cache: IsiCache)`.

**Why this task is one commit and not four:** the cache type change ripples through every consumer at once. `auditBaris` taking `IsiCache` instead of `Record<string, ListingJobstreet>` breaks `loker-inbox-persiapan.ts`; `kebutuhanDariInbox` taking `EntriCache` breaks `hitung-kursus.ts` and `persiapan-inbox.test.ts`; and deleting `jobstreet-enrich.ts` breaks `inbox.ts`, `loker-inbox-persiapan.ts`, and `page.tsx` — all at the same instant, because they all name the same type. Splitting these into separate commits would produce commits that do not typecheck, which the task-review gate must reject. The Dealls `ATS_DIIZINKAN` entry rides along because it is small, independent, and belongs to the same change of scope (the trust layer learning about a new board).

- [ ] **Step 1: Rewrite `inbox-audit.ts`**

```typescript
/**
 * inbox-audit.ts — derive a Sentinel verdict for every inbox row.
 *
 * Three rules govern this file, and each exists because of a way the obvious
 * implementation lies:
 *
 *  1. A row we could not enrich is NEVER reported `clean`. "We could not check"
 *     and "nothing is wrong" are different answers, and collapsing them would
 *     put a reassuring badge over a posting nobody inspected. Unenriched rows
 *     are `quarantined` with `enriched: false`, so the UI can say "belum
 *     diperiksa" rather than "aman".
 *  2. A row no board claims is left alone rather than judged against material
 *     that does not exist. A posting on a board we do not read is not a failure
 *     of this audit; it is simply out of scope.
 *  3. This module does not know which board a row came from. It receives
 *     `BahanAudit` and derives a verdict — the board registry is the only place
 *     board knowledge lives. `papan` is attached by the caller for display.
 *
 * Verdicts are computed here and returned beside the row. Nothing is written
 * back to `pipeline.md` — a verdict derived from a cache that can be deleted
 * must not become state that cannot be.
 */

import { auditLoker, type SentinelOutput } from "@/lib/agents/sentinel";
import type { IsiCache } from "./job-cache";
import type { InboxJobShape } from "./pipeline-table";
import { normalisasiKunciUrl } from "./url-key";

export type BarisDiaudit = InboxJobShape & {
  audit: SentinelOutput;
  enriched: boolean;
  /** The board the row came from, for the "belum diperiksa" copy. Display only. */
  papan?: string;
};

/**
 * The verdict for a row whose material we could not read.
 *
 * `data_tidak_terverifikasi` is deliberately its own id rather than a reuse of
 * `perusahaan_tidak_terverifikasi`: "we could not fetch this" is not a claim
 * about the employer, and merging them would tell a learner their posting was
 * rejected when the truth is that we did not look.
 */
function takTeraudit(): SentinelOutput {
  return {
    status: "quarantined",
    flags: ["data_tidak_terverifikasi"],
    fee_flags: [],
    trust_flags: [],
    trust_score: 0,
    trust_level: "low",
  };
}

export function auditBaris(rows: InboxJobShape[], cache: IsiCache): BarisDiaudit[] {
  return rows.map((row) => {
    const kunci = normalisasiKunciUrl(row.url);
    // "" means NO KEY — never a value that can match another "". A row whose URL
    // will not normalize is unenriched, not a cache hit on the empty string.
    const entri = kunci ? cache[kunci] : undefined;

    if (!entri) {
      return { ...row, audit: takTeraudit(), enriched: false };
    }

    // The pipeline row's company is the fallback: a board's detail payload
    // sometimes omits what its list endpoint recorded.
    const bahan = entri.bahan;
    return {
      ...row,
      audit: auditLoker({
        title: row.role,
        company: bahan.company || row.company,
        description: bahan.description,
        apply_url: bahan.apply_url,
        company_email: null,
        domain_age_days: null,
        employer_known: bahan.employer_known,
      }),
      enriched: true,
    };
  });
}
```

- [ ] **Step 2: Rewrite `bacaInboxDiaudit` in `inbox.ts`**

Replace the imports at the top of the file:

```typescript
import { auditBaris, type BarisDiaudit } from "./inbox-audit";
import { namaPapan } from "./boards";
import { bacaCache } from "./job-cache";
```

Replace the `bacaInboxDiaudit` function and its doc comment with:

```typescript
/**
 * The inbox with a derived fraud verdict on every row.
 *
 * **This function never touches the network.** The cache is filled by
 * `perkayaSemua` — after a successful scan (`jalankanScanAction`) and by
 * `scripts/enrich-inbox.ts` — so a page render is a disk read plus pure
 * derivation. That matters because this is called for every row on every
 * request (`dynamic = "force-dynamic"`), and the inbox now spans six boards: a
 * cold cache would otherwise mean ~68 requests inside one page render.
 *
 * A row whose material is not in the cache comes back `enriched: false` and
 * `quarantined`, never `clean` — see `inbox-audit.ts` for why that distinction
 * is the whole point.
 */
export async function bacaInboxDiaudit(
  options: { cacheFile?: string } = {},
): Promise<(BarisDiaudit & { firstSeen?: string })[]> {
  const rows = bacaInboxDenganTanggal();
  if (rows.length === 0) return [];

  if (options.cacheFile) process.env.CAREERVO_JOB_CACHE = options.cacheFile;
  const cache = await bacaCache();

  return auditBaris(rows as unknown as InboxJobShape[], cache).map((row, i) => ({
    ...row,
    papan: namaPapan(rows[i]?.url ?? ""),
    firstSeen: rows[i]?.firstSeen,
  }));
}
```

- [ ] **Step 3: Rewrite `inbox-audit.test.ts`**

```typescript
import { describe, expect, it } from "vitest";
import { auditBaris } from "./inbox-audit";
import type { EntriCache, IsiCache } from "./job-cache";
import type { InboxJobShape } from "./pipeline-table";

const URL_JOBSTREET = "https://id.jobstreet.com/id/job/94839531";

const row = (over: Partial<InboxJobShape> = {}): InboxJobShape => ({
  url: URL_JOBSTREET,
  company: "YO AI Labs",
  role: "AI Data Trainer - Remote",
  done: false,
  ...over,
});

const entri = (over: Partial<EntriCache> = {}): EntriCache => ({
  board: "Jobstreet",
  bahan: {
    description: "Build our React dashboard",
    apply_url: URL_JOBSTREET,
    company: "YO AI Labs",
    employer_known: true,
  },
  diambilPada: "2026-09-29",
  ...over,
});

/** The cache as `auditBaris` sees it: keyed by the normalized URL. */
const cache = (over: Partial<EntriCache> = {}): IsiCache => ({ [URL_JOBSTREET]: entri(over) });

describe("auditBaris", () => {
  it("cleans a row whose entry names a real employer", () => {
    const [out] = auditBaris([row()], cache());
    expect(out.audit.status).toBe("clean");
    expect(out.enriched).toBe(true);
  });

  it("quarantines a Private Advertiser row", () => {
    const [out] = auditBaris(
      [row({ company: "Private Advertiser" })],
      cache({
        bahan: {
          description: "x",
          apply_url: URL_JOBSTREET,
          company: "Private Advertiser",
          employer_known: false,
        },
      }),
    );
    expect(out.audit.status).toBe("quarantined");
    expect(out.audit.flags).toContain("perusahaan_tidak_terverifikasi");
  });

  it("quarantines an entry whose apply_url is a short link", () => {
    const [out] = auditBaris(
      [row()],
      cache({
        bahan: {
          description: "x",
          apply_url: "https://bit.ly/2yX06A9",
          company: "YO AI Labs",
          employer_known: true,
        },
      }),
    );
    expect(out.audit.status).toBe("quarantined");
    expect(out.audit.trust_flags).toContain("link_pendek");
  });

  it("never reports a row it could not enrich as audited-clean", () => {
    const [out] = auditBaris([row()], {});
    expect(out.enriched).toBe(false);
    expect(out.audit.status).not.toBe("clean");
  });

  it("judges a fee rule found in the description", () => {
    const [out] = auditBaris(
      [row()],
      cache({
        bahan: {
          description: "Dikenakan biaya administrasi Rp500.000",
          apply_url: URL_JOBSTREET,
          company: "YO AI Labs",
          employer_known: true,
        },
      }),
    );
    expect(out.audit.fee_flags).toContain("biaya_administrasi");
    // One content signal alone quarantines; it does not reject. `rejected` needs
    // two independent signals, which is the Sentinel policy pinned in
    // sentinel.test.ts.
    expect(out.audit.status).toBe("quarantined");
  });

  it("rejects when two independent fee rules appear in the description", () => {
    const [out] = auditBaris(
      [row()],
      cache({
        bahan: {
          description:
            "Dikenakan biaya administrasi Rp500.000\nKirim OTP ke nomor saya",
          apply_url: URL_JOBSTREET,
          company: "YO AI Labs",
          employer_known: true,
        },
      }),
    );
    expect(out.audit.fee_flags).toEqual(
      expect.arrayContaining(["biaya_administrasi", "panen_data"]),
    );
    expect(out.audit.status).toBe("rejected");
  });

  it("keys the cache by URL, so a normalized query string on the row still finds its entry", () => {
    // `utm_source` is in `url-key.ts`'s TRACKING_PARAMS denylist, so it normalizes
    // away and the lookup hits the base key. A param that is NOT denylisted (e.g.
    // `?src=x`) would keep its own key and this row would be unenriched — which is
    // the correct behaviour, not a bug, so the fixture must use a stripped param.
    const [out] = auditBaris(
      [row({ url: `${URL_JOBSTREET}?utm_source=x` })],
      cache(),
    );
    expect(out.enriched).toBe(true);
  });

  it("leaves a row no board claims marked unenriched rather than judging it blind", () => {
    const [out] = auditBaris([row({ url: "https://careers.allianz.com/job/1" })], {});
    expect(out.enriched).toBe(false);
  });

  it("treats an unnormalizable URL as unenriched, never as a cache hit", () => {
    // "" means NO KEY. If it were treated as a lookup key, every unparseable row
    // would match every other one.
    const [out] = auditBaris([row({ url: "N/A" })], { "": entri() });
    expect(out.enriched).toBe(false);
  });

  it("falls back to the pipeline row's company when the entry names none", () => {
    const [out] = auditBaris(
      [row({ company: "PT Dari Pipeline" })],
      cache({
        bahan: { description: "x", apply_url: URL_JOBSTREET, company: "", employer_known: true },
      }),
    );
    expect(out.audit.status).toBe("clean");
  });

  it("keeps one audit per row when several rows share a URL", () => {
    const out = auditBaris([row(), row()], cache());
    expect(out).toHaveLength(2);
    expect(out[0].audit.status).toBe(out[1].audit.status);
  });
});
```

- [ ] **Step 4: Rewrite `inbox-audit-wiring.test.ts`**

```typescript
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// MUST be stubbed before the data-root module resolves, so this test never
// touches the repo's real `.data/career-ops`.
const AKAR = mkdtempSync(path.join(tmpdir(), "careevo-inbox-audit-"));
vi.stubEnv("CAREER_OPS_ROOT", AKAR);

const { bacaInboxDiaudit } = await import("./inbox");

beforeEach(() => {
  mkdirSync(path.join(AKAR, "data"), { recursive: true });
});

afterAll(() => {
  vi.unstubAllEnvs();
});

const KOSONG = path.join(AKAR, "data", "pipeline.md");

/** A cache file inside the temp root, so the test never writes into the repo. */
const cacheFile = () => path.join(AKAR, "job-cache.json");

const write = (rows: string[]) =>
  writeFileSync(KOSONG, ["# Pipeline", "", "## Pending", "", ...rows, ""].join("\n"), "utf8");

/** One cache entry, keyed the way `perkayaSemua` writes it. */
const isiCache = (entries: Record<string, { board: string; description: string }>) => {
  const out: Record<string, unknown> = {};
  for (const [url, v] of Object.entries(entries)) {
    out[url] = {
      board: v.board,
      bahan: {
        description: v.description,
        apply_url: url,
        company: "PT Foo",
        employer_known: true,
      },
      diambilPada: "2026-09-29",
    };
  }
  writeFileSync(cacheFile(), JSON.stringify(out), "utf8");
};

describe("bacaInboxDiaudit", () => {
  it("returns an empty list, not an error, when the pipeline is empty", async () => {
    expect(await bacaInboxDiaudit({ cacheFile: cacheFile() })).toEqual([]);
  });

  it("gives every row a verdict and an enriched flag from the cache", async () => {
    write(["- [ ] https://id.jobstreet.com/id/job/111 | PT Foo | AI Engineer | Jakarta | posted: 2026-09-20"]);
    isiCache({ "https://id.jobstreet.com/id/job/111": { board: "Jobstreet", description: "Real work" } });
    const rows = await bacaInboxDiaudit({ cacheFile: cacheFile() });
    expect(rows).toHaveLength(1);
    expect(rows[0].enriched).toBe(true);
    expect(rows[0].audit.status).toBe("clean");
    expect(rows[0].firstSeen).toBeDefined();
  });

  it("marks a row missing from the cache as unenriched rather than clean", async () => {
    write(["- [ ] https://id.jobstreet.com/id/job/222 | PT Foo | AI Engineer | Jakarta | posted: 2026-09-20"]);
    const rows = await bacaInboxDiaudit({ cacheFile: cacheFile() });
    expect(rows[0].enriched).toBe(false);
    expect(rows[0].audit.status).not.toBe("clean");
  });

  it("enriches a non-Jobstreet row too, now that every board has an adapter", async () => {
    write(["- [ ] https://dealls.com/loker/software-engineer-ai~sirclo | Sirclo | Software Engineer AI"]);
    isiCache({
      "https://dealls.com/loker/software-engineer-ai~sirclo": { board: "Dealls", description: "Real work" },
    });
    const rows = await bacaInboxDiaudit({ cacheFile: cacheFile() });
    expect(rows[0].enriched).toBe(true);
    expect(rows[0].papan).toBe("Dealls");
  });

  it("names the board so the UI can say which one could not be read", async () => {
    write(["- [ ] https://kredivo-group.breezy.hr/p/abc-engineer | Kredivo Group | Fullstack Engineer"]);
    const rows = await bacaInboxDiaudit({ cacheFile: cacheFile() });
    expect(rows[0].enriched).toBe(false);
    expect(rows[0].papan).toBe("Breezy");
  });

  it("leaves a host no adapter claims without a board name", async () => {
    write(["- [ ] https://careers.allianz.com/job/9 | Allianz | PM | Jakarta | posted: 2026-09-20"]);
    const rows = await bacaInboxDiaudit({ cacheFile: cacheFile() });
    expect(rows[0].enriched).toBe(false);
    expect(rows[0].papan).toBeUndefined();
  });

  it("prefers the pipeline row's own posted date for firstSeen", async () => {
    writeFileSync(
      path.join(AKAR, "data", "scan-history.tsv"),
      "url\tfirst_seen\nhttps://id.jobstreet.com/id/job/444\t2026-09-01\n",
      "utf8",
    );
    write([
      "- [ ] https://id.jobstreet.com/id/job/444 | PT Foo | AI Engineer | Jakarta | posted: 2026-09-20",
    ]);
    isiCache({ "https://id.jobstreet.com/id/job/444": { board: "Jobstreet", description: "Real work" } });
    const rows = await bacaInboxDiaudit({ cacheFile: cacheFile() });
    expect(rows[0].firstSeen).toBe("2026-09-20");
    expect(rows[0].audit.status).toBe("clean");
  });
});
```

- [ ] **Step 5: Run both test files**

Run: `npx vitest run src/lib/career-ops/inbox-audit.test.ts src/lib/career-ops/inbox-audit-wiring.test.ts`

Expected: PASS — 11 + 7 tests.

- [ ] **Step 6: Add the Dealls domains to `ATS_DIIZINKAN`**

In `src/lib/jobs/trust.ts`, extend the Indonesian block (around line 70):

```typescript
  // Indonesian boards — added for Careevo; upstream has no ID entries here.
  "glints.com",
  "jobstreet.co.id",
  "jobstreet.com",
  "kalibrr.com",
  // Dealls (dealls.com) is powered by sejutacita.id and serves its postings from
  // both hosts. Without these, every Dealls row fails the company↔domain check
  // ("CFACTORY.CO" vs "dealls.com"), taking a 15-point penalty and sometimes a
  // false quarantine — the board's own host is exactly what this list is for.
  "dealls.com",
  "sejutacita.id",
];
```

- [ ] **Step 7: Add the guard to `trust.test.ts`**

`trust.test.ts` already imports `cocokDaftarDomain` and `nilaiKepercayaan` from `@/lib/jobs/trust` (lines 1–9). Add only `ATS_DIIZINKAN` to that existing import — do **not** add a second import line for the same module. Then append:

```typescript
describe("Indonesian boards are exempt from the company↔domain check", () => {
  // Dealls serves postings from dealls.com and sejutacita.id. A missing entry
  // here is not cosmetic: `nilaiKepercayaan` only skips the mismatch check for
  // listed hosts, so an omission quarantines a legitimate posting.
  it.each(["dealls.com", "www.dealls.com", "api.sejutacita.id"])(
    "lists %s",
    (host) => {
      expect(cocokDaftarDomain(host, ATS_DIIZINKAN)).toBe(true);
    },
  );

  it("does not flag a Dealls posting whose company is a brand name", () => {
    const out = nilaiKepercayaan({
      url: "https://dealls.com/loker/software-engineer-ai~sirclo",
      company: "CFACTORY.CO",
    });
    expect(out.flags).not.toContain("domain_tidak_cocok");
  });
});
```

- [ ] **Step 8: Rewrite `kebutuhanDariInbox` in `persiapan-inbox.ts`**

Replace the `ListingJobstreet` import and the classification helper. Delete `tagDariKlasifikasi` (its logic now lives in `boards/jobstreet.ts` as `tagKlasifikasi`).

Replace the imports:

```typescript
import type { InboxJob } from "@/lib/career-ops";
import type { EntriCache } from "@/lib/career-ops/job-cache";
```

Replace `kebutuhanDariInbox` and its doc comment:

```typescript
/**
 * Build the matching text for one scanned row from its cache entry.
 *
 * `level` is left undefined on purpose — see the module note. Returning it
 * omitted is what keeps the shared ranker's level bonus at zero instead of
 * adding a number we cannot justify.
 *
 * This used to take a `ListingJobstreet`, which is why the recommendation
 * panels only ever worked for Jobstreet rows. It now takes the board-agnostic
 * `EntriCache`, so a Kalibrr or Dealls description ranks exactly like a
 * Jobstreet one.
 */
export function kebutuhanDariInbox(
  job: InboxJob,
  entri: EntriCache | null,
): { kebutuhan: KebutuhanLoker; sumber: SumberKebutuhan } {
  const tags = entri?.tags ?? [];
  const deskripsi = entri?.bahan.description ?? "";

  if (entri && (deskripsi.trim() || tags.length > 0)) {
    return {
      kebutuhan: { title: job.role, description: deskripsi, tags },
      sumber: "penuh",
    };
  }

  // Nothing in the cache. The role string is all we honestly have.
  return {
    kebutuhan: { title: job.role, description: "", tags: [] },
    sumber: "ringan",
  };
}
```

- [ ] **Step 9: Update `persiapan-inbox.test.ts`**

Replace the `ListingJobstreet` fixture and the affected cases with `EntriCache`. Replace the import block and fixture:

```typescript
import { describe, expect, it } from "vitest";
import type { InboxJob } from "@/lib/career-ops";
import type { EntriCache } from "@/lib/career-ops/job-cache";
import type { JobFixture } from "@/lib/fixtures";
import {
  kebutuhanDariInbox,
  labelSumber,
  tagInferensiDariPeran,
} from "@/lib/jobs/persiapan-inbox";
import { skorKursusUntukLoker } from "@/lib/jobs/rekomendasi-kursus";
import type { EntriKatalog } from "@/lib/courses/katalog";

function baris(over: Partial<InboxJob> = {}): InboxJob {
  return {
    url: "https://id.jobstreet.com/id/job/1",
    company: "GudangAda",
    role: "Software Engineer (Front End)",
    location: "Tangerang, Banten",
    done: false,
    ...over,
  };
}

function entri(over: Partial<EntriCache> = {}): EntriCache {
  return {
    board: "Jobstreet",
    bahan: {
      description:
        "You will build our React and TypeScript dashboard with our design system.",
      apply_url: "https://id.jobstreet.com/id/job/1",
      company: "GudangAda",
      employer_known: true,
    },
    tags: ["Information & Communication Technology", "Business/Systems Analysts"],
    diambilPada: "2026-09-29",
    ...over,
  };
}
```

Then update the assertions:

```typescript
describe("kebutuhanDariInbox", () => {
  it("mengambil judul, deskripsi, dan kategori dari entri cache", () => {
    const { kebutuhan, sumber } = kebutuhanDariInbox(baris(), entri());
    expect(sumber).toBe("penuh");
    expect(kebutuhan.title).toBe("Software Engineer (Front End)");
    expect(kebutuhan.description).toContain("React");
    expect(kebutuhan.description).toContain("TypeScript");
  });

  it("TIDAK PERNAH mengarang level", () => {
    // Level proximity menambah `(2 - jarak) * 4` di ranker bersama. Level yang
    // ditebak akan menambah sampai 8 poin ke kursus yang dipilih untuk lowongan
    // yang tidak pernah menyebut level — jadi field-nya harus absen, bukan
    // default.
    const { kebutuhan } = kebutuhanDariInbox(baris(), entri());
    expect("level" in kebutuhan).toBe(false);
    expect(kebutuhan.level).toBeUndefined();
  });

  it("jatuh ke title-only saat entri tidak ada, dan mengatakannya", () => {
    const { kebutuhan, sumber } = kebutuhanDariInbox(baris(), null);
    expect(sumber).toBe("ringan");
    expect(kebutuhan.title).toBe("Software Engineer (Front End)");
    expect(kebutuhan.description).toBe("");
    expect(kebutuhan.tags).toEqual([]);
  });

  it("jatuh ke title-only saat entri ada tapi deskripsi dan tag kosong", () => {
    const kosong = entri({
      bahan: {
        description: "   ",
        apply_url: "https://id.jobstreet.com/id/job/1",
        company: "GudangAda",
        employer_known: true,
      },
      tags: [],
    });
    expect(kebutuhanDariInbox(baris(), kosong).sumber).toBe("ringan");
  });

  it("tetap 'penuh' bila hanya deskripsi yang ada, tanpa tag", () => {
    expect(kebutuhanDariInbox(baris(), entri({ tags: [] })).sumber).toBe("penuh");
  });

  it("tidak melempar pada row tanpa lokasi atau gaji", () => {
    const minimal: InboxJob = {
      url: "https://apply.workable.com/j/X",
      company: "X",
      role: "Backend Engineer",
      done: false,
    };
    expect(() => kebutuhanDariInbox(minimal, null)).not.toThrow();
  });

  it("membawa tag papan apa pun, bukan hanya Jobstreet", () => {
    const dealls = entri({
      board: "Dealls",
      bahan: {
        description: "Bangun POS.",
        apply_url: "https://dealls.com/loker/a~b",
        company: "ESB",
        employer_known: true,
      },
      tags: ["software-development"],
    });
    const { kebutuhan, sumber } = kebutuhanDariInbox(baris(), dealls);
    expect(sumber).toBe("penuh");
    expect(kebutuhan.tags).toEqual(["software-development"]);
  });
});
```

Update the `kesesuaian dengan ranker yang dipakai ulang` block to use `entri()` instead of `listing()`:

```typescript
  const { kebutuhan } = kebutuhanDariInbox(baris(), entri());
```

- [ ] **Step 10: Rewrite `hitung-kursus.ts`**

```typescript
import type { InboxJob } from "@/lib/career-ops";
import { normalisasiKunciUrl } from "@/lib/career-ops";
import type { IsiCache } from "@/lib/career-ops/job-cache";
import type { EntriKatalog } from "@/lib/courses/katalog";
import {
  kebutuhanDariInbox,
  rekomendasiKursusUntukInbox,
} from "@/lib/jobs/persiapan-inbox";

/**
 * Berapa kursus katalog yang cocok untuk tiap baris inbox.
 *
 * Dipakai untuk lencana "N kursus" di kartu, supaya seorang pembelajar bisa
 * melihat lowongan mana yang punya persiapan tersedia SEBELUM membuka popup.
 *
 * Kenapa tidak diambil dari klien lewat server action per kartu: daftar lengkap
 * punya ratusan baris. Satu permintaan per baris adalah ratusan permintaan untuk
 * sesuatu yang sebenarnya fungsi murni — ranker deterministik, katalog lokal, dan
 * deskripsi yang sudah ada di cache. Diukur pada korpus nyata: seluruh baris
 * dihitung dalam puluhan milidetik, jadi ini satu kali kerja server, bukan
 * jaringan.
 *
 * `Map` bukan objek biasa karena kuncinya adalah URL penuh, dan `Map` tidak
 * bisa terpancing ke "__proto__" seperti objek yang dibangun dari input.
 */
export function hitungJumlahKursus(
  baris: InboxJob[],
  katalog: EntriKatalog[],
  cache: IsiCache,
): Map<string, number> {
  const hasil = new Map<string, number>();
  for (const job of baris) {
    const kunci = normalisasiKunciUrl(job.url);
    const { kebutuhan } = kebutuhanDariInbox(job, (kunci ? cache[kunci] : undefined) ?? null);
    hasil.set(job.url, rekomendasiKursusUntukInbox(katalog, kebutuhan, 3).length);
  }
  return hasil;
}
```

- [ ] **Step 11: Update `loker-inbox-persiapan.ts`**

Replace the cache import:

```typescript
import { normalisasiKunciUrl } from "@/lib/career-ops";
import { bacaCache } from "@/lib/career-ops/job-cache";
```

Delete the now-unused `jobIdFromUrl` import.

Replace both cache lookups (in `detailLokerInboxAction` and `buatJalurLokerInboxAction`). In `detailLokerInboxAction`:

```typescript
  // Cache yang rusak adalah cache kosong, bukan error.
  const cache = await bacaCache().catch(() => ({}) as Record<string, never>);

  const status = auditBaris([baris], cache)[0].audit.status;
  const jobId = idLokerDariUrl(baris.url);
  const kunci = normalisasiKunciUrl(baris.url);
  const { kebutuhan, sumber } = kebutuhanDariInbox(baris, (kunci ? cache[kunci] : undefined) ?? null);
```

In `buatJalurLokerInboxAction`:

```typescript
  const cache = await bacaCache().catch(() => ({}) as Record<string, never>);
  const status = auditBaris([baris], cache)[0].audit.status;
  if (status === "rejected") {
    return { status: "error", message: "Lowongan ini ditolak Sentinel." };
  }

  const jobId = idLokerDariUrl(baris.url);
  const kunci = normalisasiKunciUrl(baris.url);
  const { kebutuhan } = kebutuhanDariInbox(baris, (kunci ? cache[kunci] : undefined) ?? null);
```

- [ ] **Step 12: Update `page.tsx`**

Replace the cache import:

```typescript
import { bacaCache } from "@/lib/career-ops/job-cache";
```

The call site already reads `await bacaCache().catch(() => ({}) as Record<string, never>)` — it needs no other change, because `hitungJumlahKursus`'s third parameter is now `IsiCache` and `bacaCache()` returns exactly that.

Also update the comment above `bacaInboxDiaudit` since it no longer reaches the network:

```typescript
  // Enrichment no longer happens here: the cache is filled after a scan and by
  // `scripts/enrich-inbox.ts`. A row missing from the cache renders as "belum
  // diperiksa" rather than taking the page down or blocking on a fetch.
```

- [ ] **Step 13: Export the new modules from `index.ts`**

Append to `src/lib/career-ops/index.ts`:

```typescript
export { bacaCache as bacaCacheLoker, tulisCache as tulisCacheLoker, perkayaSemua, type EntriCache, type IsiCache } from "./job-cache";
export { ADAPTER, adapterUntuk, namaPapan } from "./boards";
```

`bacaCache` is exported **aliased** to `bacaCacheLoker` on purpose: the barrel must keep exactly one unqualified `bacaCache`, and consumers that need it import straight from `@/lib/career-ops/job-cache` (Steps 11–12). Do not add an unaliased re-export — two `bacaCache` bindings in one barrel is a name collision `tsc` will reject.

- [ ] **Step 14: Delete the superseded module and its test**

Now that no caller remains, remove it:

```bash
git rm src/lib/career-ops/jobstreet-enrich.ts src/lib/career-ops/jobstreet-enrich.test.ts
grep -rn "jobstreet-enrich" src/ scripts/ || echo "no references"
```

Expected: `no references`. If the grep prints anything, a caller still imports the deleted module — that is a missed edit in an earlier step of this task, not a new task. Fix the import to point at `job-cache` (`bacaCache`) and re-run `npm run typecheck`.

- [ ] **Step 15: Run the affected tests, typecheck, and the full suite**

Run: `npx vitest run src/lib/jobs/trust.test.ts src/lib/jobs/persiapan-inbox.test.ts src/lib/jobs/verdict-inbox.test.ts src/lib/career-ops/inbox-audit.test.ts src/lib/career-ops/inbox-audit-wiring.test.ts src/lib/career-ops/job-cache.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: no errors.

Run: `npm test`

Expected: the whole suite passes. Any failure outside the files this plan names is a regression this task introduced — fix it here.

- [ ] **Step 16: Commit**

```bash
git add src/lib/career-ops/inbox-audit.ts src/lib/career-ops/inbox.ts src/lib/jobs/trust.ts src/lib/jobs/trust.test.ts src/lib/jobs/persiapan-inbox.ts src/lib/jobs/persiapan-inbox.test.ts src/lib/jobs/hitung-kursus.ts src/actions/loker-inbox-persiapan.ts "src/app/(app)/loker/inbox/page.tsx" src/lib/career-ops/index.ts src/lib/career-ops/inbox-audit.test.ts src/lib/career-ops/inbox-audit-wiring.test.ts
git rm src/lib/career-ops/jobstreet-enrich.ts src/lib/career-ops/jobstreet-enrich.test.ts
git commit -m "feat(career-ops): wire the unified cache through the app; drop the Jobstreet-only cache"
```

---

### Task 9: Post-scan enrichment and the backfill CLI

**Files:**
- Modify: `src/actions/inbox.ts`
- Create: `scripts/enrich-inbox.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `bacaInboxDenganTanggal` from `@/lib/career-ops`; `perkayaSemua` from `@/lib/career-ops/job-cache`; `ioDefault` from `@/lib/career-ops/io`; `adapterUntuk` from `@/lib/career-ops/boards`.
- Produces: the `enrich:inbox` npm script; post-scan cache fill.

- [ ] **Step 1: Add the post-scan step to `jalankanScanAction`**

In `src/actions/inbox.ts`, add the imports:

```typescript
import {
  bacaInbox,
  bacaInboxDenganTanggal,
  bacaRiwayatScan,
  bootstrapCareerOps,
  jalankanScan,
} from "@/lib/career-ops";
import { perkayaSemua } from "@/lib/career-ops/job-cache";
import { ioDefault } from "@/lib/career-ops/io";
```

Then, immediately after the `if (!hasil.ok) { … }` block returns and before `const run = hasil.hasil;`, insert:

```typescript
  // Fill the enrichment cache now, so the inbox render never waits on a board.
  // Best-effort on purpose: a board that is down must not turn a successful scan
  // into a failed one — the rows it could not fill simply render "Belum
  // diperiksa", which is the honest answer.
  let diperkaya = 0;
  try {
    const baris = bacaInboxDenganTanggal();
    const cache = await perkayaSemua(baris, ioDefault);
    // How many inbox rows have material now — not "how many this run fetched",
    // which the cache cannot tell us and which would be a different, unverifiable
    // number.
    diperkaya = baris.filter((r) => {
      const kunci = normalisasiKunciUrl(r.url);
      return kunci !== "" && Object.prototype.hasOwnProperty.call(cache, kunci);
    }).length;
  } catch {
    // ignore: enrichment is an optimisation, not a precondition
  }
```

Add `import { normalisasiKunciUrl } from "@/lib/career-ops";` to the import block above (the barrel already exports it — see `src/lib/career-ops/index.ts:31`).

Then extend the success return so the count is visible. Replace the final `return { … }`:

```typescript
  return {
    ok: true,
    pesan:
      ditambah > 0
        ? `${angka(ditambah)} lowongan baru ditemukan.`
        : "Tidak ada lowongan baru.",
    ditambah,
    diagnosa: cari,
    boardGagal,
    diperkaya,
  };
```

And add `diperkaya: number;` to `HasilScanAction`, plus include `diperkaya: 0` in every other `return` of the function (there are four: the session guard, the bootstrap guard, the scan-failed guard, and the success return).

- [ ] **Step 2: Write `scripts/enrich-inbox.ts`**

```typescript
/**
 * Backfill the enrichment cache for every inbox row, once.
 *
 * The post-scan step only touches rows a scan just added. This script exists for
 * the rows already in `pipeline.md` when the multi-board enrichment shipped —
 * measured 257 rows, of which 77 had no cache entry and so rendered "Belum
 * diperiksa" forever.
 *
 * Run with `npm run enrich:inbox`. Idempotent: a row already in the cache is
 * skipped, so re-running costs no requests.
 */

import { ADAPTER, adapterUntuk } from "../src/lib/career-ops/boards";
import { bacaInboxDenganTanggal } from "../src/lib/career-ops/inbox";
import { bacaCache, perkayaSemua } from "../src/lib/career-ops/job-cache";
import { ioDefault } from "../src/lib/career-ops/io";
import { normalisasiKunciUrl } from "../src/lib/career-ops/url-key";

function papanDari(url: string): string {
  return adapterUntuk(url)?.nama ?? "(papan tidak dikenal)";
}

/** Whether this row's material is in the cache — keyed the way `perkayaSemua` writes it. */
function adaDiCache(cache: Record<string, unknown>, url: string): boolean {
  const kunci = normalisasiKunciUrl(url);
  return kunci !== "" && Object.prototype.hasOwnProperty.call(cache, kunci);
}

async function main() {
  const rows = bacaInboxDenganTanggal();
  if (rows.length === 0) {
    console.log("Inbox kosong — tidak ada yang perlu diperkaya.");
    return;
  }

  const sebelum = await bacaCache();
  const belum = rows.filter((r) => !adaDiCache(sebelum, r.url)).length;

  console.log(`${rows.length} baris di inbox; ${belum} belum ada di cache.`);
  console.log(`Papan yang dikenali: ${ADAPTER.map((a) => a.nama).join(", ")}`);
  console.log("Mengambil deskripsi…");

  const mulai = Date.now();
  const cache = await perkayaSemua(rows, ioDefault);
  const detik = ((Date.now() - mulai) / 1000).toFixed(1);

  // Per-board tally, so a board that silently stopped working is visible here
  // rather than only as "Belum diperiksa" badges on the page.
  const terisi = new Map<string, number>();
  const kosong = new Map<string, number>();
  for (const row of rows) {
    const papan = papanDari(row.url);
    const peta = adaDiCache(cache, row.url) ? terisi : kosong;
    peta.set(papan, (peta.get(papan) ?? 0) + 1);
  }

  console.log(`\nSelesai dalam ${detik}s.`);
  for (const [papan, n] of [...terisi].sort((a, b) => b[1] - a[1])) {
    console.log(`  ✓ ${papan}: ${n} baris ter-enrich`);
  }
  for (const [papan, n] of [...kosong].sort((a, b) => b[1] - a[1])) {
    console.log(`  · ${papan}: ${n} baris belum bisa diambil`);
  }
  console.log(
    `\n${rows.length - rows.filter((r) => !adaDiCache(cache, r.url)).length}/${rows.length} baris inbox ter-enrich.`,
  );
}

main().catch((err) => {
  console.error("Gagal:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
```

- [ ] **Step 3: Add the npm script**

In `package.json`, add to `scripts` (keep the file's existing key order style):

```json
    "enrich:inbox": "tsx scripts/enrich-inbox.ts",
```

- [ ] **Step 4: Typecheck and lint**

Run: `npm run typecheck && npm run lint`

Expected: no errors. `scripts/enrich-inbox.ts` is inside the repo tsconfig, so it is typechecked.

- [ ] **Step 5: Commit**

```bash
git add src/actions/inbox.ts scripts/enrich-inbox.ts package.json
git commit -m "feat(career-ops): enrich the cache after a scan, plus a backfill CLI"
```

---

### Task 10: Name the board in the "Belum diperiksa" copy

**Files:**
- Modify: `src/components/features/jobs/cari-lowongan-ui.tsx`
- Test: `src/lib/jobs/verdict-inbox.test.ts`

**Interfaces:**
- Consumes: `BarisDiaudit["papan"]` (Task 8).
- Produces: no new exports.

**Why:** "Data lowongan ini belum bisa diambil dari papan aslinya" reads like a transient failure. For a board with no adapter it is permanent, and saying which board lets a learner act ("this one is on a board Careevo does not read") instead of retrying. The spec's K4.3 requires this copy change.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/jobs/verdict-inbox.test.ts`:

```typescript
describe("verdictBadge names the board it could not read", () => {
  it("names the board when the row knows it", () => {
    const v = verdictBadge(
      baris({
        papan: "Breezy",
        enriched: false,
        audit: audit("quarantined", ["data_tidak_terverifikasi"]),
      }),
    );
    expect(v?.label).toBe("Belum diperiksa");
    expect(v?.title).toContain("Breezy");
    expect(v?.sinyal.join(" ")).toContain("Breezy");
    expect(v?.terperiksa).toBe(false);
  });

  it("stays generic when the row does not know the board", () => {
    const v = verdictBadge(
      baris({ enriched: false, audit: audit("quarantined", ["data_tidak_terverifikasi"]) }),
    );
    expect(v?.title).not.toContain("undefined");
    expect(v?.sinyal).toEqual(["Data lowongan belum bisa diambil dari papan aslinya"]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/jobs/verdict-inbox.test.ts`

Expected: FAIL — the first case's `title` does not contain "Breezy".

- [ ] **Step 3: Update `verdictBadge`**

In `src/components/features/jobs/cari-lowongan-ui.tsx`, replace the `if (!row.enriched)` block:

```typescript
  if (!row.enriched) {
    // Naming the board matters: for a board with no adapter this state is
    // permanent, and a generic "belum bisa diambil" reads like a transient
    // failure a retry would fix.
    const papan = row.papan;
    return {
      label: "Belum diperiksa",
      cls: "verdict-unverified",
      status: "quarantined",
      title: papan
        ? `Lowongan dari ${papan} belum bisa dibaca otomatis, jadi belum diverifikasi.`
        : "Data lowongan ini belum bisa diambil dari papan aslinya, jadi belum diverifikasi.",
      sinyal: [
        papan
          ? `Papan ${papan} belum bisa dibaca otomatis`
          : "Data lowongan belum bisa diambil dari papan aslinya",
      ],
      terperiksa: false,
    };
  }
```

Also update the comment above `VerdictLoker`'s `terperiksa` field only if it now misstates the behaviour; it does not, so leave it.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/jobs/verdict-inbox.test.ts`

Expected: PASS — the original 6 + the wiring block + 2 new tests.

- [ ] **Step 5: Run the whole suite**

Run: `npm test`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/features/jobs/cari-lowongan-ui.tsx src/lib/jobs/verdict-inbox.test.ts
git commit -m "feat(jobs): name the board in the 'belum diperiksa' verdict copy"
```

---

## Acceptance evidence (not a task — run after Task 10)

The test suite proves the parsers and the wiring; it cannot prove the boards still answer. This is the only evidence that the fix works against the live boards, and it must be produced, not assumed:

- [ ] **1. Run the backfill against the real inbox**

```bash
npm run enrich:inbox
```

Expected: a per-board tally where **Kalibrr, Workable, SmartRecruiters, Dealls, and Breezy each show a non-zero `✓ … baris ter-enrich`**, and the closing `N/N baris inbox ter-enrich` rises from 180/257 to roughly 257/257 (a board that has since removed a posting legitimately leaves a few `· … belum bisa diambil`).

- [ ] **2. Confirm the count on disk**

```bash
python3 -c "import json;d=json.load(open('.data/job-cache/enrichment.json'));print(len(d),'entri cache')"
```

Expected: ≈257, up from 180.

- [ ] **3. Confirm the panel is no longer empty in the running app**

Start the app (`npm run dev`), open `/loker/inbox`, and open the popup for **Fullstack Engineer (SDE 2), Kredivo Group** — the row from the original screenshot. Its "Hasil Audit Sentinel" panel must now show either a verdict or a named signal, not the empty state. Capture a screenshot.

If any board reports zero enriched rows, that board's payload shape has changed since 2026-09-29; fix its adapter (its test fixture will need updating to the new shape) rather than accepting the gap.

## Self-Review

**1. Spec coverage**

| Spec item | Task |
|---|---|
| K1 registry adapter, `auditBaris` pure | 1, 3, 4, 5, 6, 8 |
| K2 unified URL-keyed cache + migration | 7 |
| K3 post-scan `perkayaSemua` + backfill | 7, 9 |
| K4.1 `ATS_DIIZINKAN` += dealls/sejutacita | 8 |
| K4.2 `apply_url` off-platform wins | 1 (`applyUrlOffPlatform`), 3, 4, 5 |
| K4.3 copy names the board | 10 |
| K4.4 `kebutuhanDariInbox` / `hitungJumlahKursus` read unified cache | 8 |
| T1 six boards | 6 |
| T2 per-board strategy without a browser | 3, 4, 5 |
| T3 scan discards descriptions | 9 (re-fetch), not addressed further — engine is byte-identical by constraint |
| T4 render must not wait | 8 (`bacaInboxDiaudit` is cache-only) |
| T5 `ATS_DIIZINKAN` lacks Dealls | 8 |
| T6 off-platform `apply_url` | 1, 3, 4, 5 |
| T7 request cost | measured at runtime by Task 9's script |
| G1 HTML shape change | 3, 4, 5 (`null` on unparseable) |
| G2 cold cache | 8 (render never fetches), 9 (backfill) |
| G3 429 | 2 (one retry), 7 (failure leaves the row uncached) |
| G4 old cache unmigrated | 7 (`migrasiCacheLama` + test) |
| G5 Dealls false quarantine | 8 |
| G6 `""` key | 8 (test "treats an unnormalizable URL as unenriched") |
| G7 `kunciFeed` underivable | **Resolved by the ruling**: `kunciFeed` is gone; every adapter uses `ambilDetail` |
| G8 feed larger than inbox | N/A under the ruling (no feed path) |

**2. Placeholder scan:** no `TBD`/`TODO`/"add error handling"/"similar to Task N" — every code step carries the code.

**3. Type consistency:** `BahanAudit` is declared once in `boards/types.ts` and re-exported by `jobstreet-audit.ts`; `EntriCache`/`IsiCache` are declared once in `job-cache.ts`; `Io`/`FetchJson` once in `boards/types.ts`; `HasilPapan` has no `url` field (the caller keys by the URL it asked about); `ambilDetail(url, io, konteks)` is the same signature in all six adapters; `papan` is set only in `inbox.ts` and read only in `cari-lowongan-ui.tsx`.
