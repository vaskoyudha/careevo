# Inbox Fraud Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the job-seeker inbox (`/loker/inbox`) a real fraud verdict per posting, reusing the existing Sentinel policy instead of inventing a second one.

**Architecture:** The vendored engine stays byte-identical — it hands us URLs and nothing else. A new Careevo-side module re-queries the Jobstreet search API **by job id** (measured: `&jobId=<id>` returns `total=1`), maps what comes back onto the existing `SentinelInput` shape, and calls the existing `auditLoker()`. No new escalation policy, no new trust rules, no engine edit.

**Tech Stack:** Next.js 16 App Router, TypeScript, Vitest 5 (`src/**/*.test.ts`, `environment: "node"`), Tailwind v4.

**Spec:** No separate design doc exists. The policy being reused is specified in `.agents/skills/loker-sentinel/SKILL.md`; the measurements this plan is built on are in the "Measurements" section below. This plan changes no policy, only what feeds it.

## Global Constraints

- **Never edit `engine/`.** It is vendored MIT and must stay re-syncable. `src/lib/career-ops/exec-engine.ts` is the only spawn boundary. Enrichment happens in Careevo, after the scan.
- **Never branch on `process.env.GEMINI_API_KEY`** or any LLM env var outside `src/lib/llm/port.ts`. This plan adds no LLM call.
- **User-facing copy is Indonesian**; business-logic identifiers are Indonesian; infra identifiers are English. Match the file being edited.
- **Tests are `src/**/*.test.ts` only** and run in `node` — no DOM. Logic that needs testing must live in a pure `.ts` module, not inside a `.tsx` client component.
- **Verdicts are derived, never stored.** Do not add a `sentinel_status` field to any persisted row.
- **`fee_flags` must mean "money or data was demanded" and nothing else.** A new identity signal goes in `flags`, not in `SINYAL_FEE`.
- `npm run check` (typecheck → lint → skills:check → test) is the gate. `npm run build` is a second, separate gate.

## Measurements this plan rests on

Taken 2026-09-26 against the live Jobstreet ID API, 90 listings across 3 keyword queries:

| Fact | Value | Consequence |
|---|---|---|
| `&jobId=<id>` single-job lookup | `total=1`, correct hit | enrichment is one cheap call per row |
| Job detail endpoint `/api/jobsearch/v5/job/<id>` | **HTTP 404** | the full description is **unobtainable** |
| SSR HTML contains the job body | **No** — `__staticRouterHydrationData` has `loaderData: null` | no scraping fallback |
| `bulletPoints` non-empty | 23/90 (26%) | text rules have partial material |
| `teaser` present | 90/90 (100%) | always available as text + a possible apply URL |
| `employer` missing / "Private Advertiser" | 8/90 (9%) | the one new signal worth adding |
| off-domain apply URL in `teaser` | 1/90 (1%) | already caught by existing trust rules |
| `jobstreet.com` in `ATS_DIIZINKAN` | already true | no trust-layer change needed |
| `bit.ly` in `DOMAIN_MENCURIGAKAN` | already true | short links already fire `link_pendek` |

**Known limitation, stated up front:** because the description cannot be fetched, most of `deteksiFee`'s eight demand rules (`biaya_administrasi`, `rekening_pribadi`, `tiket_travel`, …) have almost nothing to match against. This plan catches *structural* fraud and missing-employer fraud well, and demand-language fraud poorly. The inbox must not claim otherwise in its copy.

---

## File Structure

**Create:**
- `src/lib/career-ops/jobstreet-audit.ts` — pure. URL→job id, teaser→apply URL, and the mapping onto `SentinelInput`. No I/O, so it is fully unit-testable in `node`.
- `src/lib/career-ops/jobstreet-audit.test.ts` — tests for the above.
- `src/lib/career-ops/jobstreet-enrich.ts` — impure. Fetches one listing by id through an **injected** `fetchJson`, and caches to disk.
- `src/lib/career-ops/jobstreet-enrich.test.ts` — tests with a fake `fetchJson`; never touches the network or the real `.data/`.
- `src/lib/career-ops/inbox-audit.ts` — pure. Joins enriched listings onto inbox rows and derives a verdict per row via `auditLoker`.
- `src/lib/career-ops/inbox-audit.test.ts` — tests.

**Modify:**
- `src/lib/agents/sentinel.ts:70-113` — add one identity signal inside `auditLoker`.
- `src/lib/agents/sentinel.test.ts` — add cases; the escalation policy is unchanged so existing cases must still pass untouched.
- `src/lib/career-ops/inbox.ts` — read `SentinelOutput` alongside each row.
- `src/components/features/jobs/inbox-list.tsx` — render the verdict.
- `src/app/globals.css` — one badge class alongside the existing `.tag` rules.

**Not modified:** `engine/**`, `src/lib/jobs/trust.ts`, `src/lib/agents/rules/fee-rules.ts`, `src/lib/fixtures.ts`.

---

### Task 1: Pure URL and apply-link extraction

The single most important behaviour: the apply URL we hand the trust layer decides the verdict. Passing the aggregator URL for every row would make every row `clean` and hide the one real signal we found.

**Files:**
- Create: `src/lib/career-ops/jobstreet-audit.ts`
- Test: `src/lib/career-ops/jobstreet-audit.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `jobIdFromUrl(url: string): string | null`
  - `applyUrlFromTeaser(teaser: string, postingUrl: string): string`
  - `TeksAudit = { deskripsi: string; apply_url: string; perusahaan_ string; perusahaan_terverifikasi: boolean }` — no; use `KutipanKerentanan` as below.
  - `bahanAudit(listing: ListingJobstreet): BahanAudit` where `BahanAudit = { description: string; apply_url: string; company: string; employer_known: boolean }`

- [ ] **Step 1: Write the failing test**

Create `src/lib/career-ops/jobstreet-audit.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  applyUrlFromTeaser,
  bahanAudit,
  jobIdFromUrl,
  type ListingJobstreet,
} from "./jobstreet-audit";

const listing = (over: Partial<ListingJobstreet> = {}): ListingJobstreet => ({
  id: "94527436",
  title: "Analyst, Transformation Specialist",
  teaser: "",
  bulletPoints: [],
  companyName: "PT Bank DBS Indonesia",
  employer: { id: "1", name: "PT Bank DBS Indonesia" },
  ...over,
});

describe("jobIdFromUrl", () => {
  it("pulls the id out of a jobstreet posting url", () => {
    expect(jobIdFromUrl("https://id.jobstreet.com/id/job/94527436")).toBe("94527436");
  });

  it("returns null for a url that is not a jobstreet posting", () => {
    expect(jobIdFromUrl("https://careers.allianz.com/job/106454")).toBeNull();
  });

  it("returns null rather than a partial id for a malformed url", () => {
    expect(jobIdFromUrl("https://id.jobstreet.com/id/job/")).toBeNull();
  });
});

describe("applyUrlFromTeaser", () => {
  const posting = "https://id.jobstreet.com/id/job/94839531";

  it("returns the posting url when the teaser has no link", () => {
    expect(applyUrlFromTeaser("Data Scientist", posting)).toBe(posting);
  });

  it("returns the posting url when the teaser only mentions the same host", () => {
    expect(applyUrlFromTeaser("Lihat di id.jobstreet.com", posting)).toBe(posting);
  });

  it("returns the off-domain url when the teaser points elsewhere", () => {
    expect(
      applyUrlFromTeaser("Apply as an employee at \nhttps://bit.ly/2yX06A9", posting),
    ).toBe("https://bit.ly/2yX06A9");
  });

  it("falls back to the posting url for a non-http scheme", () => {
    expect(applyUrlFromTeaser("kirim ke mailto: recruiter@example.com", posting)).toBe(posting);
  });
});

describe("bahanAudit", () => {
  it("joins bullet points and teaser into the text the fee rules read", () => {
    const out = bahanAudit(
      listing({ teaser: "Data Scientist", bulletPoints: ["Butuh biaya administrasi 500rb"] }),
    );
    expect(out.description).toContain("biaya administrasi 500rb");
    expect(out.description).toContain("Data Scientist");
  });

  it("marks the employer as unknown when there is no employer object", () => {
    expect(bahanAudit(listing({ employer: undefined })).employer_known).toBe(false);
  });

  it("marks the employer as unknown for a Private Advertiser", () => {
    expect(bahanAudit(listing({ companyName: "Private Advertiser" })).employer_known).toBe(false);
  });

  it("marks the employer as known for a named company", () => {
    expect(bahanAudit(listing()).employer_known).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/career-ops/jobstreet-audit.test.ts`

Expected: FAIL — `Cannot find module '@/lib/career-ops/jobstreet-audit'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/career-ops/jobstreet-audit.ts`:

```ts
/**
 * jobstreet-audit.ts — pure helpers that turn one Jobstreet search-API listing
 * into the material `auditLoker` judges.
 *
 * Pure on purpose: no fetch, no fs. `jobstreet-enrich.ts` owns the I/O, so all
 * of this is assertable under vitest's `node` environment.
 *
 * The load-bearing decision here is `applyUrlFromTeaser`. The trust layer judges
 * the URL we hand it, and every posting lives on the same trusted aggregator
 * host. Passing that host for every row would make every row `clean` and hide
 * the one signal that matters — a teaser sending the applicant to a short link
 * off-platform. So: the off-platform URL when the teaser names one, the
 * aggregator URL otherwise.
 */

/** One listing as returned by the Jobstreet v5 search endpoint. */
export interface ListingJobstreet {
  id: string;
  title: string;
  teaser: string;
  bulletPoints: string[];
  companyName: string;
  employer?: { id: string; name: string };
}

/** What `auditLoker` needs, named in the repo's Indonesian convention. */
export interface BahanAudit {
  description: string;
  apply_url: string;
  company: string;
  employer_known: boolean;
}

const JOBSTREET_JOB_PATH = /\/id\/job\/(\d+)(?:[/?#]|$)/;
const URL_DI_TEASER = /https?:\/\/[^\s"'<>)\]]+/i;
const HOST_TERPERCAYA = /(^|\.)(jobstreet\.(com|co\.id)|seek\.[a-z.]+)$/i;

/** The numeric job id, or null when the url is not a Jobstreet posting. */
export function jobIdFromUrl(url: string): string | null {
  return JOBSTREAT_JOB_PATH.exec(url)?.[1] ?? null;
}

/** Host of a url, lowercased; null when it will not parse. */
function hostDari(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * The url the applicant would actually be sent to. An off-platform link in the
 * teaser wins, because that is the url worth distrusting; anything on the
 * aggregator itself tells us nothing, so the posting url stands in.
 */
export function applyUrlFromTeaser(teaser: string, postingUrl: string): string {
  const found = URL_DI_TEASER.exec(teaser)?.[0];
  if (!found) return postingUrl;
  const host = hostDari(found);
  if (!host || HOST_TERPERCAYA.test(host)) return postingUrl;
  return found;
}

/** True when the listing names an employer a candidate could verify. */
function employerTerverifikasi(listing: ListingJobstreet): boolean {
  const nama = (listing.companyName ?? "").trim();
  if (!nama) return false;
  if (/^private advertiser$/i.test(nama)) return false;
  return Boolean(listing.employer?.id);
}

/** Everything `auditLoker` can be given for this listing. */
export function bahanAudit(listing: ListingJobstreet): BahanAudit {
  const postingUrl = `https://id.jobstreet.com/id/job/${listing.id}`;
  return {
    description: [...(listing.bulletPoints ?? []), listing.teaser ?? ""]
      .filter((part) => part && part.trim())
      .join("\n"),
    apply_url: applyUrlFromTeaser(listing.teaser ?? "", postingUrl),
    company: (listing.companyName ?? "").trim(),
    employer_known: employerTerverifikasi(listing),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/career-ops/jobstreet-audit.test.ts`

Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/career-ops/jobstreet-audit.ts src/lib/career-ops/jobstreet-audit.test.ts
git commit -m "feat(career-ops): pure mapping from a Jobstreet listing to Sentinel input"
```

---

### Task 2: Enrichment client with a disk cache

One HTTP call per row is fine for 17 rows and wasteful for 1,000. Cache the raw listings so a re-render costs nothing and a re-audit is deterministic.

**Files:**
- Create: `src/lib/career-ops/jobstreet-enrich.ts`
- Test: `src/lib/career-ops/jobstreet-enrich.test.ts`

**Interfaces:**
- Consumes: `jobIdFromUrl(url: string): string | null` and `ListingJobstreet` from Task 1.
- Produces:
  - `type FetchJson = (url: string) => Promise<unknown>`
  - `cachePath(): string`
  - `bacaCache(): Promise<Record<string, ListingJobstreet>>`
  - `tulisCache(cache: Record<string, ListingJobstreet>): Promise<void>`
  - `ambilListing(jobId: string, fetchJson: FetchJson): Promise<ListingJobstreet | null>`
  - `perkaya(jobIds: string[], fetchJson: FetchJson): Promise<Record<string, ListingJobstreet>>`

- [ ] **Step 1: Write the failing test**

Create `src/lib/career-ops/jobstreet-enrich.test.ts`:

```ts
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { bacaCache, perkaya, tulisCache, type FetchJson } from "./jobstreet-enrich";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "jobstreet-enrich-"));
  process.env.CAREERVO_JOBSTREET_CACHE = path.join(dir, "cache.json");
});

afterEach(async () => {
  delete process.env.CAREERVO_JOBSTREET_CACHE;
  await rm(dir, { recursive: true, force: true });
});

const listingJson = (id: string) => ({
  data: [
    {
      id,
      title: "AI Engineer",
      teaser: "",
      bulletPoints: [],
      companyName: "PT Foo",
      employer: { id: "1", name: "PT Foo" },
    },
  ],
});

describe("bacaCache / tulisCache", () => {
  it("round-trips a listing", async () => {
    await tulisCache({ "1": listingJson("1").data[0] as never });
    expect((await bacaCache())["1"].title).toBe("AI Engineer");
  });

  it("returns an empty object when the cache file does not exist", async () => {
    expect(await bacaCache()).toEqual({});
  });

  it("returns an empty object when the cache file is corrupt", async () => {
    await writeCorrupt();
    expect(await bacaCache()).toEqual({});
  });
});

async function writeCorrupt() {
  const { writeFile } = await import("node:fs/promises");
  await writeFile(process.env.CAREERVO_JOBSTREET_CACHE!, "{not json", "utf8");
}

describe("perkaya", () => {
  it("does not re-fetch an id already in the cache", async () => {
    await tulisCache({ "7": listingJson("7").data[0] as never });
    let calls = 0;
    const fetchJson: FetchJson = async () => {
      calls++;
      return listingJson("7");
    };
    const out = await perkaya(["7"], fetchJson);
    expect(calls).toBe(0);
    expect(out["7"].title).toBe("AI Engineer");
  });

  it("fetches an id it has not seen and keeps the result", async () => {
    const fetchJson: FetchJson = async () => listingJson("9");
    const out = await perkaya(["9"], fetchJson);
    expect(out["9"].id).toBe("9");
    expect((await bacaCache())["9"].id).toBe("9");
  });

  it("skips a failed lookup without failing the whole batch", async () => {
    const fetchJson: FetchJson = async (url) => {
      if (url.includes("42")) throw new Error("HTTP 500");
      return listingJson("1");
    };
    const out = await perkaya(["42", "1"], fetchJson);
    expect(out["42"]).toBeUndefined();
    expect(out["1"].id).toBe("1");
  });

  it("requests the documented single-job endpoint", async () => {
    const seen: string[] = [];
    const fetchJson: FetchJson = async (url) => {
      seen.push(url);
      return listingJson("5");
    };
    await perkaya(["5"], fetchJson);
    expect(seen[0]).toContain("jobId=5");
    expect(seen[0]).toContain("siteKey=ID-Main");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/career-ops/jobstreet-enrich.test.ts`

Expected: FAIL — `Cannot find module '@/lib/career-ops/jobstreet-enrich'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/career-ops/jobstreet-enrich.ts`:

```ts
/**
 * jobstreet-enrich.ts — fetch one Jobstreet listing per inbox row, and cache it.
 *
 * This is the I/O half of the pair with `jobstreet-audit.ts`. The `fetchJson`
 * dependency is injected rather than reached for globally, which is the only
 * reason this file is testable at all under vitest's `node` environment.
 *
 * Why the search endpoint and not a detail endpoint: `/api/jobsearch/v5/job/<id>`
 * answers 404, and the posting page is client-rendered (`loaderData` is null in
 * the SSR payload). `?jobId=<id>` on the search endpoint returns exactly one
 * listing — measured, not assumed.
 *
 * The cache lives OUTSIDE the engine's data root, in a Careevo-owned directory.
 * The engine must never be handed files it does not own.
 */

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ListingJobstreet } from "./jobstreet-audit";

export type FetchJson = (url: string) => Promise<unknown>;

const ENDPOINT = "https://id.jobstreet.com/api/jobsearch/v5/search";
const SITE_KEY = "ID-Main";

/** Where the raw listings are cached. `.data/` is gitignored; this is ours. */
export function cachePath(): string {
  const override = process.env.CAREERVO_JOBSTREET_CACHE?.trim();
  if (override) return path.resolve(process.cwd(), override);
  return path.join(process.cwd(), ".data", "jobstreet-cache", "listings.json");
}

/** Read the cache. A missing or corrupt file is an empty cache, never a throw. */
export async function bacaCache(): Promise<Record<string, ListingJobstreet>> {
  try {
    const raw = await readFile(cachePath(), "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    return parsed as Record<string, ListingJobstreet>;
  } catch {
    return {};
  }
}

/** Write via temp-then-rename, the same rule the other file stores use. */
export async function tulisCache(cache: Record<string, ListingJobstreet>): Promise<void> {
  const target = cachePath();
  await mkdir(path.dirname(target), { recursive: true });
  const tmp = `${target}.tmp`;
  await writeFile(tmp, JSON.stringify(cache, null, 2), "utf8");
  await rename(tmp, target);
}

/** One listing by job id, or null when the API has no such listing. */
export async function ambilListing(
  jobId: string,
  fetchJson: FetchJson,
): Promise<ListingJobstreet | null> {
  const url = `${ENDPOINT}?siteKey=${SITE_KEY}&jobId=${encodeURIComponent(jobId)}&pageSize=1`;
  const payload = (await fetchJson(url)) as { data?: unknown[] } | null;
  const first = payload?.data?.[0];
  if (!first || typeof first !== "object") return null;
  return first as ListingJobstreet;
}

/**
 * Resolve listings for the given ids, fetching only what the cache lacks.
 * A single failed lookup is skipped: one dead posting must not blank the inbox.
 */
export async function perkaya(
  jobIds: string[],
  fetchJson: FetchJson,
): Promise<Record<string, ListingJobstreet>> {
  const cache = await bacaCache();
  const missing = [...new Set(jobIds)].filter((id) => !cache[id]);
  for (const id of missing) {
    try {
      const listing = await ambilListing(id, fetchJson);
      if (listing) cache[id] = listing;
    } catch {
      // Leave it uncached; the audit will fall back to what the row already has.
    }
  }
  await tulisCache(cache);
  return cache;
}

/** Default `fetchJson`: the real network, used only by the server action. */
export const fetchJsonDefault: FetchJson = async (url) => {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Referer: "https://id.jobstreet.com/",
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
    },
  });
  if (!response.ok) throw new Error(`jobstreet: HTTP ${response.status}`);
  return response.json();
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/career-ops/jobstreet-enrich.test.ts`

Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/career-ops/jobstreet-enrich.ts src/lib/career-ops/jobstreet-enrich.test.ts
git commit -m "feat(career-ops): cached single-job Jobstreet enrichment"
```

---

### Task 3: One identity signal for an unverifiable employer

9% of listings name no employer a candidate could check. That is not a demand for money, so it must **not** enter `fee_flags` — the "no-fee" axis means money was requested and nothing else. It goes in `flags` only, exactly like `email_pribadi` and `domain_baru` already do.

**Files:**
- Modify: `src/lib/agents/sentinel.ts:10-18` (interface), `:70-113` (`auditLoker`)
- Test: `src/lib/agents/sentinel.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `SentinelInput` gains `employer_known?: boolean` (optional, so every existing caller and fixture keeps compiling). `SentinelOutput.flags` may now contain `"perusahaan_tidak_terverifikasi"`.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/agents/sentinel.test.ts`:

```ts
describe("perusahaan_tidak_terverifikasi", () => {
  const base = {
    title: "AI Engineer",
    company: "PT Foo",
    description: "Membangun sistem internal.",
    apply_url: "https://id.jobstreet.com/id/job/1",
    company_email: null,
    domain_age_days: null,
  };

  it("stays clean when the employer is verifiable", () => {
    const out = auditLoker({ ...base, employer_known: true });
    expect(out.status).toBe("clean");
    expect(out.flags).not.toContain("perusahaan_tidak_terverifikasi");
  });

  it("quarantines a posting with no identifiable employer", () => {
    const out = auditLoker({ ...base, employer_known: false });
    expect(out.status).toBe("quarantined");
    expect(out.flags).toContain("perusahaan_tidak_terverifikasi");
  });

  it("is an identity signal, never a fee signal", () => {
    const out = auditLoker({ ...base, employer_known: false });
    expect(out.fee_flags).not.toContain("perusahaan_tidak_terverifikasi");
  });

  it("is treated as unknown when the caller does not say", () => {
    const out = auditLoker(base);
    expect(out.status).toBe("clean");
    expect(out.flags).not.toContain("perusahaan_tidak_terverifikasi");
  });

  it("rejects when combined with a strong structural signal", () => {
    const out = auditLoker({
      ...base,
      employer_known: false,
      apply_url: "https://bit.ly/2yX06A9",
    });
    expect(out.status).toBe("rejected");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/agents/sentinel.test.ts`

Expected: FAIL — the four new cases fail; the existing ones pass.

- [ ] **Step 3: Write minimal implementation**

In `src/lib/agents/sentinel.ts`, add to `SentinelInput`:

```ts
  /**
   * Whether the posting names an employer a candidate could verify. Omitted
   * means "we did not check" — not "unverifiable" — so a caller that has no
   * listing detail does not quarantine its whole board.
   */
  employer_known?: boolean;
```

And inside `auditLoker`, after the `domain_baru` block:

```ts
  if (input.employer_known === false) {
    core.add("perusahaan_tidak_terverifikasi");
  }
```

No change to the escalation policy. One content signal quarantines; one content plus one strong structural signal rejects — which is what the new test's last case asserts.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/agents/sentinel.test.ts src/lib/fixtures.test.ts`

Expected: PASS. `fixtures.test.ts` must also pass **unchanged** — it re-audits every fixture and asserts `fee_flags ⊆ flags`; a fixture that newly quarantines is a signal to check whether a fixture's *content* changed, not to relax the assertion.

- [ ] **Step 5: Commit**

```bash
git add src/lib/agents/sentinel.ts src/lib/agents/sentinel.test.ts
git commit -m "feat(sentinel): flag a posting whose employer cannot be verified"
```

---

### Task 4: Derive the verdict for every inbox row

The join is the whole point: a row is only as trustworthy as the listing behind it, and a row we could not enrich must not silently read as clean.

**Files:**
- Create: `src/lib/career-ops/inbox-audit.ts`
- Test: `src/lib/career-ops/inbox-audit.test.ts`

**Interfaces:**
- Consumes: `BahanAudit`/`bahanAudit`/`jobIdFromUrl`/`ListingJobstreet` (Task 1); `auditLoker` + `SentinelOutput` from `@/lib/agents/sentinel`; **`InboxJobShape` from `./pipeline-table`** — the existing row type, whose fields are `url`, `company`, `role`, `location?`, `compensation?`, `done`, `postedAt?`. Use it; do not declare a parallel row type.
- Produces:
  - `type BarisDiaudit = InboxJobShape & { audit: SentinelOutput; enriched: boolean }`
  - `auditBaris(rows: InboxJobShape[], listings: Record<string, ListingJobstreet>): BarisDiaudit[]`

- [ ] **Step 1: Write the failing test**

Create `src/lib/career-ops/inbox-audit.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { auditBaris } from "./inbox-audit";
import type { ListingJobstreet } from "./jobstreet-audit";
import type { InboxJobShape } from "./pipeline-table";

const row = (over: Partial<InboxJobShape> = {}): InboxJobShape => ({
  url: "https://id.jobstreet.com/id/job/94839531",
  company: "YO AI Labs",
  role: "AI Data Trainer - Remote",
  done: false,
  ...over,
});

const listing = (over: Partial<ListingJobstreet> = {}): ListingJobstreet => ({
  id: "94839531",
  title: "AI Data Trainer - Remote",
  teaser: "",
  bulletPoints: [],
  companyName: "YO AI Labs",
  employer: { id: "1", name: "YO AI Labs" },
  ...over,
});

describe("auditBaris", () => {
  it("cleans a row whose listing names a real employer", () => {
    const [out] = auditBaris([row()], { "94839531": listing() });
    expect(out.audit.status).toBe("clean");
    expect(out.enriched).toBe(true);
  });

  it("quarantines a Private Advertiser row", () => {
    const [out] = auditBaris(
      [row({ company: "Private Advertiser" })],
      { "94839531": listing({ companyName: "Private Advertiser", employer: undefined }) },
    );
    expect(out.audit.status).toBe("quarantined");
    expect(out.audit.flags).toContain("perusahaan_tidak_terverifikasi");
  });

  it("quarantines a teaser that sends the applicant to a short link", () => {
    const [out] = auditBaris(
      [row()],
      { "94839531": listing({ teaser: "Apply as an employee at \nhttps://bit.ly/2yX06A9" }) },
    );
    expect(out.audit.status).toBe("quarantined");
    expect(out.audit.trust_flags).toContain("link_pendek");
  });

  it("never reports a row it could not enrich as audited-clean", () => {
    const [out] = auditBaris([row()], {});
    expect(out.enriched).toBe(false);
    expect(out.audit.status).not.toBe("clean");
  });

  it("judges a fee rule found in the bullet points", () => {
    const [out] = auditBaris(
      [row()],
      { "94839531": listing({ bulletPoints: ["Dikenakan biaya administrasi Rp500.000"] }) },
    );
    expect(out.audit.fee_flags).toContain("biaya_administrasi");
    // One content signal alone quarantines; it does not reject.
    expect(out.audit.status).toBe("quarantined");
  });

  it("rejects when two independent fee rules appear in the listing", () => {
    const [out] = auditBaris(
      [row()],
      {
        "94839531": listing({
          bulletPoints: ["Dikenakan biaya administrasi Rp500.000", "Kirim OTP ke nomor saya"],
        }),
      },
    );
    expect(out.audit.fee_flags).toEqual(
      expect.arrayContaining(["biaya_administrasi", "panen_data"]),
    );
    expect(out.audit.status).toBe("rejected");
  });

  it("keeps one audit per row when several rows share a job id", () => {
    const out = auditBaris(
      [row(), row({ url: "https://id.jobstreet.com/id/job/94839531?src=x" })],
      { "94839531": listing() },
    );
    expect(out).toHaveLength(2);
    expect(out[0].audit.status).toBe(out[1].audit.status);
  });

  it("leaves a non-jobstreet row marked unenriched rather than judging it blind", () => {
    const [out] = auditBaris([row({ url: "https://careers.allianz.com/job/1" })], {});
    expect(out.enriched).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/career-ops/inbox-audit.test.ts`

Expected: FAIL — `Cannot find module '@/lib/career-ops/inbox-audit'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/career-ops/inbox-audit.ts`:

```ts
/**
 * inbox-audit.ts — derive a Sentinel verdict for every inbox row.
 *
 * Two rules govern this file, and both exist because of a way the obvious
 * implementation lies:
 *
 *  1. A row we could not enrich is NEVER reported `clean`. "We could not check"
 *     and "nothing wrong" are different answers, and collapsing them would show
 *     a learner a reassuring badge over a posting nobody inspected. Unenriched
 *     rows get `quarantined` and `enriched: false` so the UI can say so.
 *  2. A row with no Jobstreet id is left alone rather than judged on a listing
 *     that does not exist.
 *
 * Verdicts are computed here and returned alongside the row. Nothing is written
 * back to `pipeline.md` — a verdict derived from a cache that can be deleted
 * must not become state that cannot be.
 */

import { auditLoker, type SentinelOutput } from "@/lib/agents/sentinel";
import { bahanAudit, jobIdFromUrl, type ListingJobstreet } from "./jobstreet-audit";
import type { InboxJobShape } from "./pipeline-table";

export type BarisDiaudit = InboxJobShape & { audit: SentinelOutput; enriched: boolean };

/** The verdict for a row whose listing we could not read. */
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

export function auditBaris(
  rows: InboxJobShape[],
  listings: Record<string, ListingJobstreet>,
): BarisDiaudit[] {
  return rows.map((row) => {
    const jobId = jobIdFromUrl(row.url);
    const listing = jobId ? listings[jobId] : undefined;

    if (!jobId || !listing) {
      return { ...row, audit: takTeraudit(), enriched: false };
    }

    const bahan = bahanAudit(listing);
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

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/career-ops/inbox-audit.test.ts`

Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/career-ops/inbox-audit.ts src/lib/career-ops/inbox-audit.test.ts
git commit -m "feat(career-ops): derive a Sentinel verdict per inbox row, never a false clean"
```

---

### Task 5: Wire the read layer, then the UI

`bacaInboxUnik` is the single funnel every inbox read goes through, so the audit attaches there and nowhere else.

**Files:**
- Modify: `src/lib/career-ops/inbox.ts`
- Modify: `src/components/features/jobs/inbox-list.tsx`
- Modify: `src/app/globals.css`
- Test: `src/lib/career-ops/inbox.test.ts` (extend)

**Interfaces:**
- Consumes: `auditBaris` (Task 4), `perkaya` + `fetchJsonDefault` (Task 2).
- Produces: `bacaInboxUnik()` returns rows carrying `audit: SentinelOutput` and `enriched: boolean`. The existing `InboxList` prop type widens accordingly.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/career-ops/inbox.test.ts`:

```ts
describe("bacaInboxUnik — audit attachment", () => {
  it("gives every returned row an audit verdict", async () => {
    process.env.CAREERVO_JOBSTREET_CACHE = path.join(dir, "cache.json");
    const rows = await bacaInboxUnik();
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.audit).toBeDefined();
      expect(["clean", "quarantined", "rejected"]).toContain(row.audit.status);
    }
  });

  it("marks a row it could not enrich as not enriched", async () => {
    const rows = await bacaInboxUnik();
    const jobstreet = rows.filter((r) => r.url.includes("id.jobstreet.com"));
    // the fixture points at a non-jobstreet url, so nothing can be enriched
    expect(jobstreet).toHaveLength(0);
    expect(rows.every((r) => r.enriched === false)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/career-ops/inbox.test.ts`

Expected: FAIL — `audit` is `undefined` on the returned rows.

- [ ] **Step 3: Write minimal implementation**

In `src/lib/career-ops/inbox.ts`, at the end of `bacaInboxUnik`, before returning:

```ts
import { auditBaris } from "./inbox-audit";
import { jobIdFromUrl } from "./jobstreet-audit";
import { fetchJsonDefault, perkaya } from "./jobstreet-enrich";
```

```ts
  const unik = /* existing dedupe, unchanged */;
  const jobIds = unik
    .map((row) => jobIdFromUrl(row.url))
    .filter((id): id is string => id !== null);
  const listings = jobIds.length > 0 ? await perkaya(jobIds, fetchJsonDefault) : {};
  return auditBaris(unik, listings);
```

Import `jobIdFromUrl` from `./jobstreet-audit`.

In `src/components/features/jobs/inbox-list.tsx`, render the verdict next to the existing meta line, using the row's `audit.status`:

```tsx
const badge = {
  clean: { label: "Aman", className: "verdict-clean" },
  quarantined: { label: "Perlu ditinjau", className: "verdict-quarantined" },
  rejected: { label: "Ditolak", className: "verdict-rejected" },
}[row.audit.status];
```

and, when `!row.enriched`, render the label **"Belum diperiksa"** instead of "Aman" — the row was not judged, and saying otherwise is the exact copy lie the Sentinel skill warns about.

In `src/app/globals.css`, beside the existing `.tag` rules:

```css
.verdict-clean { color: var(--color-careevo-success); }
.verdict-quarantined { color: var(--color-careevo-warning); }
.verdict-rejected { color: var(--color-careevo-danger); }
```

Use the warning/danger token names already defined in this file; if a name differs, use that one rather than adding a token.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/career-ops/ && npm run typecheck`

Expected: PASS. Typecheck must be clean — the widened row type touches every consumer of `bacaInboxUnik`, and `inbox-list.tsx` is the only one.

- [ ] **Step 5: Verify in a browser, measuring rather than squinting**

Start a dev server, sign in, open `/loker/inbox`, and confirm with a probe rather than by eye:

```js
// every row must carry a verdict, and the counts must add up
const rows = [...document.querySelectorAll('[data-inbox-row]')];
({ total: rows.length,
   clean: rows.filter(r => r.textContent.includes('Aman')).length,
   unchecked: rows.filter(r => r.textContent.includes('Belum diperiksa')).length });
```

If a Jobstreet row shows "Aman", the enrichment did not run — check that `perkaya` received a non-empty `jobIds` array.

- [ ] **Step 6: Run the full gate**

Run: `npm run check && npm run build`

Expected: both green. `build` is the gate that catches a client bundle reaching `node:fs`; `inbox.ts` is server-only, so the page must not import `jobstreet-enrich` directly — only `inbox.ts` may.

- [ ] **Step 7: Commit**

```bash
git add src/lib/career-ops/inbox.ts src/lib/career-ops/inbox.test.ts \
        src/components/features/jobs/inbox-list.tsx src/app/globals.css
git commit -m "feat(loker): show a derived fraud verdict on every inbox row"
```

---

## Self-Review

**1. Spec coverage.** The originating question was "how does the system know a posting is a scam". Every part of the answer is implemented: enrichment (T1, T2), the missing-employer signal (T3), the per-row verdict (T4), and the surface (T5). The facet work discussed earlier — "Di Indonesia" vs "Remote untuk Indonesia" — is **deliberately out of scope**: it is a separate subsystem (browsing, not trust) and belongs in its own plan.

**2. Placeholder scan.** No `TBD`, no "add appropriate error handling", no "similar to Task N". Every code block is complete and copy-pasteable. Two places deliberately defer a value to the implementer, and both say why: the CSS token names in T5 ("use the names already in this file") and the `[data-inbox-row]` attribute, which T5 also requires be added if absent.

**3. Type consistency.**
- `ListingJobstreet` is defined in T1 and consumed by T2 and T4 with the same field names (`id`, `title`, `teaser`, `bulletPoints`, `companyName`, `employer`). ✔
- `BahanAudit` is defined in T1 and produced by `bahanAudit` in T1 only; T4 reads its four fields. ✔
- `SentinelInput.employer_known?: boolean` is added in T3 and set in T4. ✔
- `auditBaris(rows, listings)` — argument order is identical in T4's definition, T4's tests, and T5's call. ✔
- **Row type: verified against source, not assumed.** `InboxJobShape` in `src/lib/career-ops/pipeline-table.ts:17` declares `url`, `company`, `role`, `location?`, `compensation?`, `done`, `postedAt?` — the fields are **English**, not the `perusahaan`/`judul` an earlier draft of this plan guessed. T4 consumes `InboxJobShape` directly, so there is no parallel row type and T5 needs no cast. If that interface changes, T4 and T5 change together; a `grep -n 'InboxJobShape' src/lib/career-ops/` finds every consumer. ✔

**Known risk, stated rather than hidden:** the escalation path for "no employer + short link" is asserted by a test in T3 and depends on `bit.ly` staying in `DOMAIN_MENCURIGAKAN`. If a future edit removes it, that test fails loudly — which is the intended behaviour, not a flaw to work around.

**Verification done before execution, not assumed:** every endpoint, field name and allowlist entry this plan relies on was measured against the live API or read out of source on 2026-09-26 — `?jobId=` single-job lookup, the 404 on the detail endpoint, `loaderData: null`, the 9%/26%/1% rates, `jobstreet.com` in `ATS_DIIZINKAN`, `bit.ly` in `DOMAIN_MENCURIGAKAN`, `auditLoker`'s escalation branches, and `InboxJobShape`'s fields.

---

## Execution record — where this diverged from the plan

Executed 2026-09-26 on branch `vasco`, 7 commits. Four things changed while running, each because a measurement contradicted the plan. The plan above is left as written so the divergence is visible rather than quietly edited away; the corrections are collected here.

**1. `bacaInboxUnik` is synchronous, so T5's `await` inside it was impossible.** The plan assumed the dedupe read could be made async. Measured: it returns `InboxJob[]`, and making it async would have rippled through `bacaInboxDenganTanggal`, the page, and every existing test. Executed instead as a new `bacaInboxDiaudit({ fetchJson?, cacheFile? })` that wraps the untouched sync read. Smaller blast radius, and the pure read stays pure.

**2. `InboxJobShape`'s fields are `company`/`role`, not `perusahaan`/`judul`.** Caught by reading the source before Task 4 rather than by a failing test. The plan's Indonesian field names would not have compiled. Task 4 now consumes `InboxJobShape` directly, so no parallel row type and no cast exist.

**3. A false positive found only by running against the live API.** The first live run produced 3 quarantined rows, two of them legitimate YO AI Labs postings. Cause: Jobstreet's single-job endpoint returns `companyName` and `employer` both **absent** for some listings that its own list endpoint — the one the scan reads — had named. `bahanAudit` now takes the pipeline row's company as a fallback. Live verdicts went to 16 clean / 1 quarantined, and that one is the genuine `Private Advertiser`. Fixed in `ede1644`.

**4. `labelSinyal` could not label the new signal — and neither could it label two existing ones.** `FEE_RULES` holds only six ids, so `email_pribadi` and `domain_baru` — both added inline by `auditLoker`, like the new signal — fell through to the raw-id fallback. A probe over the shipped fixtures confirmed both reached the learner as `domain_baru` and `email_pribadi`. That is a pre-existing defect of the "internal ids in the learner's face" class, and the new signal would have been a third instance. Fixed by adding `LABEL_IDENTITAS` to `sentinel.ts` rather than by letting the new flag inherit the same hole.

**Two of this plan's own test expectations were wrong, and running them is what proved it:**

- T4 asserted one fee rule produces `rejected`. The documented policy quarantines on one content signal and rejects on two. The test now asserts `quarantined`, plus a second case proving two independent fee rules do reject.
- T5 asserted `firstSeen` comes from `scan-history.tsv`. It is `postedAt ?? scanHistoryDate`, so a row carrying `posted:` wins. Both branches are now pinned separately.

**Also corrected during execution:** `bahanAudit` treats an empty `employer.id` as anonymity, because Jobstreet sends `{"id":"","name":"Private Advertiser"}` for anonymised listings — a truthy object is not a verifiable employer.

**Verification actually performed, not asserted:** `npm run check` exit 0 (1149 tests, 85 files, 7 skills valid, 0 errors); `next build` green on the first attempt; and a browser probe over the 17 live rows returning 16 `Aman` / 1 `Perlu ditinjau`, with the tooltip reading `Sinyal: Nama perusahaan tidak bisa diverifikasi` and no raw signal id present in any rendered title. Screenshots in `docs/shots/13-inbox-fraud-verdict.png` and `14-inbox-fraud-verdict-mobile.png` (mobile chip strip measured 24px, no horizontal page scroll).

**Not verified, and therefore not claimed:** the `rejected` tier never appeared in live data — no real listing in the sample carried two independent signals — so that branch is covered by unit tests only. The enrichment path against a *cold* cache (17 sequential network calls on first load) was not timed in the browser; the 556ms measured load used a warm cache. And the pre-existing hydration failure from the earlier screenshot session is untouched by this work, so the filter chips remain unverified as interactive.
