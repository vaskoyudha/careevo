# Papan Loker Pasar Indonesia Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the job scanner return Indonesian tech postings by shipping a Careevo-owned `portals.yml` seed that enables the two Indonesian boards already present but disabled, and restores an Indonesian `title_filter` / `location_filter`.

**Architecture:** A new tracked file `src/lib/career-ops/portals-careevo.yml` becomes the preferred seed. `seedPortalsFromTemplate()` in `bootstrap.ts` resolves it first and falls back to the vendored `engine/templates/portals.example.yml`, so `engine/` stays byte-identical and the current behaviour survives if the new file is ever missing. Everything else in this plan is a guard on that data file plus one live scan to prove it works.

**Tech Stack:** TypeScript, Node `fs`/`path`, Vitest, `js-yaml` (devDependency, tests only), the vendored `engine/*.mjs` scanner.

**Spec:** `docs/superpowers/specs/2026-09-27-papan-loker-pasar-indonesia-design.md`

## Global Constraints

- `engine/**` is vendored and must stay **byte-identical**. Never edit `engine/templates/portals.example.yml`. This preserves the "Verbatim vendored core of career-ops" boundary in `AGENTS.md`, plus the `career-ops-port` and `careevo-attribution` skills.
- `portals.yml` seeding stays **write-once**. An existing `.data/career-ops/portals.yml` must never be replaced, so a user's local edits survive. This is why Task 5 deletes the file by hand.
- **No** database schema change, no migration, no `drizzle/` file in this plan.
- `js-yaml` is a **devDependency** (`package.json`). Production code in `src/` must never import it. Only test files may.
- Business-logic identifiers stay Indonesian, matching the surrounding file. Infra/UI stays English.
- `location_filter` supports exactly five fields — `allow`, `always_allow`, `block`, `block_hard`, `strict`. Any other name is silently ignored. Verified: `grep -oE "location_filter\??\.[a-z_]+" engine/**/*.mjs`.
- Do **not** set `strict: true`. It fails *closed* and would drop every Glints row with no location. Default (absent) passes them.
- Every task ends with a commit. Never commit `.data/` — it is gitignored (`.gitignore:47`).

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/career-ops/portals-careevo.yml` (new) | **Data only.** The Indonesian market definition: which boards, which keywords, which locations. No logic. |
| `src/lib/career-ops/portals-careevo.test.ts` (new) | Guards on that data file. Parses it and asserts the properties that caused the original zero. |
| `src/lib/career-ops/bootstrap.ts` (modify) | Resolves *which* seed to copy. One new exported pure helper, `cariSeedPortals()`. |
| `src/lib/career-ops/bootstrap.test.ts` (new) | Tests `cariSeedPortals()` preference and fallback, without touching a real data root. |
| `src/lib/career-ops/portals.test.ts` (modify) | One test rewritten to point at the Careevo seed. The other three stay. |

`cariSeedPortals()` is exported solely so it can be unit-tested in isolation. Nothing else imports it.

---

## Task 1: Discover verified Indonesian employer career URLs

No code. This produces the `tracked_companies` list that Task 3 embeds, and it exists so no career URL is ever invented.

**Files:**
- Create: `/tmp/opencode/perusahaan-id.yml` (scratch input, not committed)
- Read: `engine/discover-ats.mjs:1-30` for the invocation contract

**Interfaces:**
- Consumes: nothing.
- Produces: a verified `tracked_companies` list — 8 to 12 Indonesian tech employers, each with a `careers_url` that resolved. Task 3 embeds this list verbatim.

- [ ] **Step 1: Write the candidate input file**

`engine/discover-ats.mjs:18` documents the input shape as `companies: [{name, slug?, website?}]`. Create `/tmp/opencode/perusahaan-id.yml`:

```yaml
companies:
  - name: Gojek
    website: https://www.gojek.com
  - name: Tokopedia
    website: https://www.tokopedia.com
  - name: Bukalapak
    website: https://www.bukalapak.com
  - name: Traveloka
    website: https://www.traveloka.com
  - name: Blibli
    website: https://www.blibli.com
  - name: Shopee Indonesia
    website: https://shopee.co.id
  - name: Bank Central Asia
    website: https://www.bca.co.id
  - name: Bank Mandiri
    website: https://www.bankmandiri.co.id
  - name: Telkom Indonesia
    website: https://www.telkom.co.id
  - name: Indosat Ooredoo Hutchison
    website: https://ioh.co.id
  - name: Grab Indonesia
    website: https://www.grab.com
  - name: Ruangguru
    website: https://www.ruangguru.com
```

- [ ] **Step 2: Run the resolver in preview mode**

`engine/discover-ats.mjs:21` — `--in` without `--write` previews and writes nothing. Run:

```bash
node engine/discover-ats.mjs --in /tmp/opencode/perusahaan-id.yml --summary
```

Expected: a human-readable table of candidates with resolved `careers_url` values, and **nothing written**.

- [ ] **Step 3: Verify every resolved URL actually returns a careers page**

For each `careers_url` the summary printed, confirm it is live and is a careers page, not a 404 or the corporate homepage:

```bash
for u in "<careers_url_1>" "<careers_url_2>"; do
  printf "%s -> " "$u"
  curl -sS -o /dev/null -w "%{http_code}\n" -L --max-time 20 -A "Mozilla/5.0" "$u"
done
```

Expected: `200` for each. **Drop any URL that is not `200`.** A `404` or a redirect to the homepage is not a careers page and the scanner will follow it forever.

- [ ] **Step 4: Record the verified list for Task 3**

Write the surviving entries as a comment block at the top of `/tmp/opencode/perusahaan-id.yml`, in the exact shape Task 3 needs:

```yaml
# VERIFIED <date> — all returned HTTP 200
tracked_companies:
  - name: Gojek
    careers_url: "<verified url>"
    enabled: true
  # ... one entry per surviving company
```

Keep 8 or more. `portals.test.ts:61` requires `tracked_companies` to be non-empty, and a thin list makes the scan's company path contribute almost nothing.

- [ ] **Step 5: Note the count for the commit message**

```bash
grep -c "careers_url" /tmp/opencode/perusahaan-id.yml
```

Expected: `8` or more. Report this number in the Task 5 summary — it is the denominator for judging whether the company path earned its place.

No commit: this file is scratch, under `/tmp/opencode/`, deliberately outside the repo.

---

## Task 2: Make `bootstrap.ts` prefer the Careevo seed

Pure resolution logic. At the end of this task behaviour is **unchanged** — the new file does not exist yet, so the fallback runs and every existing test stays green.

**Files:**
- Modify: `src/lib/career-ops/bootstrap.ts:23-44`
- Create: `src/lib/career-ops/bootstrap.test.ts`

**Interfaces:**
- Consumes: `engineRoot()`, `dataRoot()` from `./data-root` (unchanged).
- Produces: `export function cariSeedPortals(): string | null` — returns the first existing seed path in preference order (Careevo file, then engine template), or `null` when neither exists. `seedPortalsFromTemplate()` consumes it internally.

- [ ] **Step 1: Write the failing test**

Create `src/lib/career-ops/bootstrap.test.ts` — complete as written, so it can
be pasted verbatim. It builds its own temp files rather than reading the real
tree, so it tests ordering and not the current state of the checkout:

```typescript
import fs from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cariSeedPortals } from "./bootstrap";

/** A real file at a real path, so existsSync is meaningful. */
function seedFile(nama: string): string {
  const p = path.join(mkdtempSync(path.join(tmpdir(), "careevo-seed-")), nama);
  fs.writeFileSync(p, "title_filter: {}\n", "utf8");
  return p;
}

/**
 * The seed is DATA, and the engine fails silently on a bad config: a missing or
 * malformed portals.yml yields zero boards with no crash
 * (engine/detect-reposts.mjs:737,741), which the scanner reports as
 * `postingsKept: 0` — identical to "a correct scan that matched nothing".
 * So the fallback is not defensive noise; it is the thing that keeps a typo in
 * the Careevo config from becoming another invisible zero.
 *
 * Temp files, not the real tree: the Careevo config does not exist until Task 3,
 * and this test must pass before and after it does.
 */
describe("cariSeedPortals", () => {
  it("prefers the first candidate when both exist", () => {
    const careevo = seedFile("portals-careevo.yml");
    const engine = seedFile("portals.example.yml");
    expect(cariSeedPortals([careevo, engine])).toBe(careevo);
  });

  it("falls back to the engine template when the Careevo config is absent", () => {
    const engine = seedFile("portals.example.yml");
    expect(cariSeedPortals([path.join(tmpdir(), "tidak-ada.yml"), engine])).toBe(
      engine,
    );
  });

  it("returns null when no seed exists at all", () => {
    expect(cariSeedPortals([path.join(tmpdir(), "tidak-ada-1.yml")])).toBeNull();
  });
});
```

**Note the signature:** `cariSeedPortals` takes an explicit candidate list rather
than reading `process.cwd()` itself. That is what makes it testable without
stubbing the filesystem or the environment, and it keeps the preference order
visible at every call site.

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/lib/career-ops/bootstrap.test.ts
```

Expected: FAIL — `cariSeedPortals` is not exported.

- [ ] **Step 3: Implement the resolver**

In `bootstrap.ts`, replace the whole `seedPortalsFromTemplate` block (currently lines 23-44, the doc comment plus the function) with:

```typescript
/**
 * The seed is chosen in preference order: Careevo's own Indonesian config
 * first, then the engine's shipped example.
 *
 * Why a Careevo-owned seed exists at all: the engine template seeds 97 Western
 * employers and one Polish board, with both Indonesian boards (Jobstreet ID,
 * Glints ID) present but `enabled: false`. Scanning it returns ~14,000 European
 * and American postings and about one in Indonesia. See the spec's T1.
 *
 * `engine/**` stays byte-identical — it is vendored source, and editing it would
 * break the boundary recorded in AGENTS.md and the two attribution skills. We
 * change only WHICH file gets copied, never the copy itself.
 *
 * The candidate list is a parameter so the preference order is testable without
 * stubbing the filesystem or the environment.
 */
export function cariSeedPortals(
  candidates: string[] = [
    path.join(process.cwd(), "src", "lib", "career-ops", "portals-careevo.yml"),
    path.join(engineRoot(), "templates", "portals.example.yml"),
  ],
): string | null {
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function seedPortalsFromTemplate(): boolean {
  const target = path.join(dataRoot(), "portals.yml");
  // Write-once, like everything else here: a user who has edited their portals
  // config must never have it replaced by the shipped example.
  if (fs.existsSync(target)) return false;
  const seed = cariSeedPortals();
  if (!seed) return false;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(seed, target);
  return true;
}
```

`fs.copyFileSync` replaces the old read-then-write pair: it cannot half-write, and it never leaves a truncated `portals.yml` if the process dies mid-seed.

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/lib/career-ops/bootstrap.test.ts
```

Expected: 3 passed.

- [ ] **Step 5: Run the existing portals test to prove behaviour is unchanged**

```bash
npx vitest run src/lib/career-ops/portals.test.ts
```

Expected: 4 passed. The Careevo file does not exist yet, so `cariSeedPortals` returns the engine template and the byte-identity assertion at `portals.test.ts:39` still holds. **If this fails, stop — the fallback is broken.**

- [ ] **Step 6: Commit**

```bash
git add src/lib/career-ops/bootstrap.ts src/lib/career-ops/bootstrap.test.ts
git commit -m "feat(career-ops): seed portals.yml dari config Careevo, bukan hanya template engine

seedPortalsFromTemplate() kini memilih candidate pertama yang ada:
config Careevo dulu, lalu template engine. Perilaku belum berubah karena
file Careevo belum ada, jadi fallback masih yang berjalan.

Mencari lewat helper murni cariSeedPortals(seeds) supaya urutan
preferensi bisa diuji tanpa stubbing filesystem.
"
```

---

## Task 3: Ship the Indonesian market config

**Files:**
- Create: `src/lib/career-ops/portals-careevo.yml`
- Modify: `src/lib/career-ops/portals.test.ts:33-40`

**Interfaces:**
- Consumes: the verified `tracked_companies` list from Task 1; `cariSeedPortals()` from Task 2.
- Produces: the seeded `.data/career-ops/portals.yml` content that Task 4 guards and Task 5 scans against.

- [ ] **Step 1: Rewrite the byte-identity test to expect the Careevo config**

In `portals.test.ts`, replace lines 33-40 — the `describe` opening plus the first `it` — with:

```typescript
describe("seeded portals.yml", () => {
  it("is seeded from the Careevo config, not the engine template", () => {
    const nyata = readFileSync(
      path.join(process.cwd(), "src", "lib", "career-ops", "portals-careevo.yml"),
      "utf8",
    );
    expect(readFileSync(path.join(AKAR, "portals.yml"), "utf8")).toBe(nyata);
  });
```

The intent of the original test is preserved: a hand-written 15-line stub must never come back. Only the source of truth moved, from the vendored engine template to the Careevo config.

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/lib/career-ops/portals.test.ts
```

Expected: FAIL — `ENOENT: no such file or directory ... portals-careevo.yml`.

- [ ] **Step 3: Write the config**

Create `src/lib/career-ops/portals-careevo.yml`:

```yaml
# portals-careevo.yml — Careevo's own scan seed.
#
# The engine ships engine/templates/portals.example.yml, which seeds 97 Western
# employers and one Polish board. Both Indonesian boards are present in it but
# disabled, so a scan returns ~14,000 European and American postings and about
# one in Indonesia. This file is the market we actually mean.
#
# engine/** stays byte-identical; bootstrap.ts only changes WHICH file is copied.
# Write-once: an existing .data/career-ops/portals.yml is never replaced.
#
# Field names verified against the engine: location_filter supports exactly
# allow / always_allow / block / block_hard / strict. Anything else is ignored.

title_filter:
  # Deliberately broad. The title filter is a SWEEP filter; Sentinel and the A-H
  # evaluation make the real judgement downstream. Over-broad is safe, over-narrow
  # is the failure this file exists to stop.
  positive:
    - developer
    - engineer
    - software
    - data scientist
    - data analyst
    - data engineer
    - machine learning
    - artificial intelligence
    - devops
    - site reliability
    - cloud
    - platform engineer
    - security engineer
    - quality assurance
    - test engineer
    - mobile
    - android
    - ios
    - flutter
    - react native
    - frontend
    - front-end
    - backend
    - back-end
    - fullstack
    - full stack
    - product manager
    - product designer
    - ux designer
    - ui designer
  # Non-tech roles only. "engineer" and "developer" are broad enough to pull in
  # sales-engineering and account-management postings, so those are vetoed here.
  #
  # Java, PHP, Ruby and .NET are NOT vetoed. The engine template excluded them
  # because its market was European AI/automation roles; in Indonesia they are
  # mainstream backend languages, and excluding them removes most entry-level
  # postings. The German degree-thesis terms (Werkstudent, Praktikum, Masterarbeit)
  # are dropped for the same reason.
  #
  # An empty or absent negative list is safe: engine/title-keywords.mjs:230 and
  # :243 normalise a non-array to [] and veto only on a match, so `negative: []`
  # behaves as "no veto".
  negative:
    - sales engineer
    - account executive
    - business development
    - marketing
    - finance
    - accounting
    - human resources
    - legal
    - customer service

location_filter:
  # `strict` is deliberately ABSENT. It fails CLOSED, so a Glints row with no
  # location field would be rejected. The default passes those instead.
  #
  # `always_allow` rescues multi-location postings that name Indonesia, so
  # "Remote, Indonesia or Singapore" passes while "Remote, India" does not.
  always_allow:
    - Indonesia
  # 14 real Indonesian metros. Substring matching is case-insensitive, so
  # "Jakarta" already covers "Jakarta Selatan", "Jakarta Pusat" and the rest.
  # 14 clears the >=10 guard at portals.test.ts:47 honestly, not as padding.
  #
  # A posting that says only "Remote" with no country is REJECTED: on a board for
  # Indonesian roles, an unresolvable location is not one of them. Task 5 reads
  # filtered_location from the receipt to price this decision.
  allow:
    - Indonesia
    - Jakarta
    - Bekasi
    - Tangerang
    - Depok
    - Bogor
    - Bandung
    - Surabaya
    - Medan
    - Yogyakarta
    - Semarang
    - Denpasar
    - Makassar
    - Palembang

# Six entries, three per provider, following the SolidJobs precedent already in
# the engine template (8 entries: IT, Engineering, Marketing, ...). One entry per
# role family, because a single searchKeywords string cannot cover them.
#
# Ceiling is entries x pageSize x maxPages = 6 x 30 x 3 = 540 per scan. That is a
# provider limit, not national coverage — do not let UI copy imply otherwise.
job_boards:
  - name: Jobstreet Indonesia — software engineer
    provider: jobstreet
    api: https://id.jobstreet.com/api/jobsearch/v5/search
    siteKey: ID-Main
    searchKeywords: software engineer
    pageSize: 30
    maxPages: 3
    enabled: true
    notes: SEEK v5 REST, no auth token. searchLocation intentionally omitted so location_filter does the narrowing and non-Jabodetabek roles are not lost.

  - name: Jobstreet Indonesia — mobile developer
    provider: jobstreet
    api: https://id.jobstreet.com/api/jobsearch/v5/search
    siteKey: ID-Main
    searchKeywords: mobile developer
    pageSize: 30
    maxPages: 3
    enabled: true
    notes: Android/iOS/Flutter is one of the largest Indonesian tech categories.

  - name: Jobstreet Indonesia — data
    provider: jobstreet
    api: https://id.jobstreet.com/api/jobsearch/v5/search
    siteKey: ID-Main
    searchKeywords: data analyst
    pageSize: 30
    maxPages: 3
    enabled: true
    notes: Data roles for learners coming from non-CS backgrounds.

  - name: Glints Indonesia — software engineer
    provider: glints
    api: https://glints.com/api/v2-alc/graphql
    countryCode: ID
    searchKeywords: software engineer
    pageSize: 30
    maxPages: 3
    enabled: true
    notes: GraphQL v2-alc. Provider notes WAF blocks non-browser requests, so this entry may return 0 over plain HTTP. Jobstreet is the reliable path; an empty Glints is the first hypothesis, not a conclusion.

  - name: Glints Indonesia — mobile developer
    provider: glints
    api: https://glints.com/api/v2-alc/graphql
    countryCode: ID
    searchKeywords: mobile developer
    pageSize: 30
    maxPages: 3
    enabled: true
    notes: Same WAF caveat as the entry above.

  - name: Glints Indonesia — data
    provider: glints
    api: https://glints.com/api/v2-alc/graphql
    countryCode: ID
    searchKeywords: data analyst
    pageSize: 30
    maxPages: 3
    enabled: true
    notes: Same WAF caveat as the entry above.

# VERIFIED by Task 1 — every careers_url below returned HTTP 200.
tracked_companies:
  # <paste the Task 1 verified list here, 8 or more entries>
```

Replace the final placeholder comment with the real entries from Task 1 Step 4. **Do not** keep the comment as the value — `portals.test.ts:61` requires a non-empty array, and an empty `tracked_companies:` parses to `null`, which fails that test.

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/lib/career-ops/portals.test.ts
```

Expected: 4 passed.

- [ ] **Step 5: Run the full career-ops suite**

```bash
npx vitest run src/lib/career-ops/
```

Expected: all pass, including the new `bootstrap.test.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/career-ops/portals-careevo.yml src/lib/career-ops/portals.test.ts
git commit -m "feat(career-ops): config pindai Indonesia sebagai benih Careevo

Mengaktifkan Jobstreet Indonesia (siteKey ID-Main) dan Glints Indonesia
(countryCode ID) yang sudah terkonfigurasi benar tapi enabled: false di
template engine. Scan sebelumnya berjalan dengan boards=1 dan papan itu
SolidJobs (Polandia).

location_filter memakai 14 metro Indonesia nyata plus always_allow
Indonesia, sehingga multi-lokasi yang menyebut Indonesia lolos.
strict sengaja tidak dipakai: gagal tertutup akan membuang baris Glints
tanpa field lokasi.

title_filter negatif tidak lagi menyingkirkan Java/PHP/Ruby/.NET, yang
mainstream di Indonesia, dan istilah tesis Jerman dibuang.

portals.test.ts byte-identity ditulis ulang menunjuk config Careevo.
"
```

---

## Task 4: Add the regression guards

These are guards on a data file, not behavioural tests. Every one of them stays green on a config that returns **zero** Indonesian postings — that is exactly how the previous attempt failed while its own test was green. They exist to catch the specific, cheap mistakes; only Task 5 proves the scan works.

**Files:**
- Create: `src/lib/career-ops/portals-careevo.test.ts`

**Interfaces:**
- Consumes: `src/lib/career-ops/portals-careevo.yml` (Task 3).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Write the guards**

Create `src/lib/career-ops/portals-careevo.test.ts`:

```typescript
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
    for (const role of ["developer", "engineer", "data", "mobile", "backend"]) {
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
```

- [ ] **Step 2: Run the tests**

```bash
npx vitest run src/lib/career-ops/portals-careevo.test.ts
```

Expected: 7 passed.

- [ ] **Step 3: Prove the guards actually bite**

A guard that cannot fail is decoration. Temporarily flip the Glints entries to `enabled: false` and confirm the suite goes red:

```bash
sed -i 's/^    enabled: true$/    enabled: false/' src/lib/career-ops/portals-careevo.yml
npx vitest run src/lib/career-ops/portals-careevo.test.ts
```

Expected: FAIL on "punya minimal satu papan Indonesia yang AKTIF" — the `sed` flips **every** `enabled: true`, so all six boards go inactive and the count drops to 0. That is the correct failure, and it is exactly the original bug reproduced. Restore immediately:

```bash
sed -i 's/^    enabled: false$/    enabled: true/' src/lib/career-ops/portals-careevo.yml
npx vitest run src/lib/career-ops/portals-careevo.test.ts
```

Expected: 7 passed again. Confirm the file is clean with `git diff --stat src/lib/career-ops/portals-careevo.yml` — it must print nothing.

- [ ] **Step 4: Commit**

```bash
git add src/lib/career-ops/portals-careevo.test.ts
git commit -m "test(career-ops): Penjaga regresi untuk config pindai Indonesia

Tujuh penjaga atas portals-careevo.yml: bisa di-parse, punya papan
Indonesia aktif, location_filter dipicu allow (bukan hanya always_allow),
negative tidak menyingkirkan Java/PHP/Ruby, positive memuat istilah peran
Indonesia, strict tidak dipakai, dan tracked_companies cukup.

Penjaga ini tidak membuktikan pindai mengembalikan lowongan Indonesia.
Semua akan hijau pada config yang mengembalikan nol — persis cara
percobaan sebelumnya gagal sementara test-nya sendiri hijau. Scan sungguhan
di task verifikasi adalah bukti sebenarnya.
"
```

---

## Task 5: Prove it with a live scan

The only task whose output is evidence. Everything before it is a hypothesis.

**Files:**
- Delete: `.data/career-ops/portals.yml` (gitignored, local only)
- Read: `.data/career-ops/data/scan-runs.tsv`, `.data/career-ops/data/pipeline.md`
- Modify: `docs/local-db.md` (Task 6)

**Interfaces:**
- Consumes: everything from Tasks 1-4.
- Produces: the acceptance evidence and the `docs/local-db.md` text for Task 6.

- [ ] **Step 1: Back up the current data root**

```bash
mkdir -p /tmp/opencode/data-root-backup
cp -a .data/career-ops/. /tmp/opencode/data-root-backup/
ls /tmp/opencode/data-root-backup/
```

Expected: `data/`, `portals.yml`, and the empty dirs. This is the 443-posting corpus; the cleanup in Step 6 is destructive without it.

- [ ] **Step 2: Delete the stale seed so write-once does not block the new one**

`seedPortalsFromTemplate` is write-once by design, so the existing Western config will never be replaced. Delete it:

```bash
rm .data/career-ops/portals.yml
```

Confirm the shipped file is byte-identical to the Careevo config, which is what the new seed must produce:

```bash
ls -la .data/career-ops/portals.yml 2>/dev/null || echo "absent, as expected — bootstrap will recreate it on next page load"
```

- [ ] **Step 3: Reload the inbox page so bootstrap re-seeds**

The `/loker/inbox` server component calls `bootstrapCareerOps()` on every request. With a running dev server:

```bash
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:3000/loker/inbox
```

Expected: `200` (or `307` to `/masuk` if not signed in — either way the server component ran and re-seeded). Verify:

```bash
diff <(md5sum < src/lib/career-ops/portals-careevo.yml) <(md5sum < .data/career-ops/portals.yml) && echo "SEEDED FROM CAREEVO"
```

Expected: `SEEDED FROM CAREEVO`. **If this prints nothing, stop** — the seed did not land and the scan will measure the old config.

- [ ] **Step 4: Run a scan and read the receipt**

Click **"Pindai lowongan baru"** on `/loker/inbox` while signed in. That button
calls `jalankanScanAction()` in `src/actions/inbox.ts`, which spawns
`engine/scan.mjs` — use the real path, not a hand-rolled command, so the receipt
is the one the app produces. Wait for the button to leave its pending state, then
read the receipt the run appended:

```bash
tail -2 .data/career-ops/data/scan-runs.tsv
```

Expected on the header's column order:
- `boards` is `6`, not `1` — this is the single most important number in the task
- `new_added` is greater than `0`
- `errors` is `0`

**If `boards` is still `1`, the Careevo config was not read.** Re-check Step 3. If `new_added` is `0` with `boards: 6`, work the failure table in the spec's "Kegagalan dan penanganannya" — G2 (Glints WAF) is the first hypothesis, and Jobstreet's entries alone should still yield rows.

- [ ] **Step 5: Confirm the rows are actually Indonesian**

```bash
grep -ciE "jakarta|bandung|surabaya|indonesia|bekasi|tangerang|depok|yogyakarta|semarang|denpasar|makassar|medan|palembang" .data/career-ops/data/pipeline.md
```

Expected: a count far above `1`. The pre-change corpus had exactly one Indonesian row out of 486.

Sample ten rows to read them:

```bash
grep "^- \[ \]" .data/career-ops/data/pipeline.md | tail -10
```

- [ ] **Step 6: Clear the Western corpus, keeping the backup**

Only after Step 5 proves the new scan yields Indonesian rows:

```bash
printf '# Pipeline — Pending URLs\n\nPaste job URLs below as `- [ ] {url}` then run `/career-ops pipeline`.\n\n## Pending\n\n## Processed\n' > .data/career-ops/data/pipeline.md
printf 'url\tfirst_seen\tportal\ttitle\tcompany\tstatus\tlocation\tfingerprint\tposted_at\ttrust_score\ttrust_flags\tnormalized_company\n' > .data/career-ops/data/scan-history.tsv
```

Then scan again so the Indonesian rows are re-added against a clean history:

Trigger "Pindai lowongan baru" on `/loker/inbox`, wait for it to finish, then:

```bash
grep -c "^- \[ \]" .data/career-ops/data/pipeline.md
tail -1 .data/career-ops/data/scan-runs.tsv
```

Expected: a count in the Indonesian hundreds at most, and a receipt whose `new_added` matches.

**If Step 5's yield was thin, skip this step.** Keeping the 443 rows is the safer default when the new scan underperforms; the backup in Step 1 is the only copy, so do not delete it either way.

- [ ] **Step 7: Verify in a real browser, not just the receipt**

Per `careevo-browser-verify`: a green test and a good receipt do not mean the page is right. Sign in, open `/loker/inbox`, and confirm the list shows Indonesian companies and locations, the company filter chips are Indonesian names, and no row still reads Allianz, ByteDance, or Anthropic.

```bash
npx playwright screenshot --full-page "http://localhost:3000/loker/inbox" /tmp/opencode/inbox-setelah-pindai.png 2>/dev/null || echo "use the browser harness if the CLI is unavailable"
```

Read the screenshot. Report what it actually shows.

- [ ] **Step 8: Commit**

Nothing to commit — every path touched here is gitignored. Record the receipt numbers in the Task 5 summary instead, and carry them into Task 6's docs.

---

## Task 6: Document the write-once trap

**Files:**
- Modify: `docs/local-db.md` (append a section; find the existing troubleshooting section and add after it)

**Interfaces:**
- Consumes: the measured numbers from Task 5.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Append the section**

Add to `docs/local-db.md`. The outer fence below is **four** backticks on purpose:
the content being appended contains its own three-backtick blocks, and a
three-backtick outer fence would terminate at the first one and turn the rest of
`docs/local-db.md` into a code block.

````markdown
## Pindai loker memakai config Careevo, bukan template engine

`/loker/inbox` menyemai `.data/career-ops/portals.yml` dari
`src/lib/career-ops/portals-careevo.yml` (pasar Indonesia: Jobstreet ID dan
Glints ID aktif), dengan fallback ke `engine/templates/portals.example.yml`
bila berkas Careevo tidak ada. `engine/` sendiri tidak pernah diubah.

Seed ini **tulis-sekali**. Kalau `portals.yml` sudah ada, ia tidak pernah
diganti — ini disengaja agar suntingan lokal pengguna tidak tertimpa. Konsekuensinya:

```bash
# Ingin memakai config yang baru? Hapus yang lama, lalu muat ulang halaman.
rm .data/career-ops/portals.yml
```

Untuk memastikan seed yang dipakai:

```bash
diff <(md5sum < src/lib/career-ops/portals-careevo.yml) \
     <(md5sum < .data/career-ops/portals.yml) && echo "CAREEVO"
```

Kalau differensinya kosong, pindai masih memakai config lama.

### Membaca hasil pindai

`.data/career-ops/data/scan-runs.tsv` menambah satu baris per pindai. Kolom
penting: `boards` dan `new_added`.

`boards` menghitung entri yang AKTIF, bukan entri yang menjawab. Nilai yang
benar adalah `6` — tiga entri Jobstreet dan tiga entri Glints. Tapi hanya tiga
yang menjawab: ketiga entri Glints mengembalikan `HTTP 403` dari halaman
`Glints - Firewall`, jadi `boards: 6` dengan kontribusi nol dari Glints adalah
bentuk keberhasilan yang diharapkan, bukan kegagalan sebagian.

`boards: 1` berarti config Careevo tidak terbaca sama sekali.

`boards: 6` dengan `new_added: 0` berarti tidak ada yang cocok: periksa
`filtered_location` dan `filtered_title` di baris yang sama. `filtered_title`
yang mendekati `found` bisa berarti `title_filter` terlalu sempit — atau berarti
filter bekerja dengan benar, karena banyak papan Indonesia bukan perusahaan
teknologi. Amartha, misalnya, punya 530 lowongan dan hanya 6 di antaranya
peran teknis.

**Batas atas yang jujur:** 9 perusahaan memberi sekitar 175 lowongan tech, dan
6 entri papan memberi batas teoretis 6 x `pageSize` 30 x `maxPages` 3 = 540.
Karena Glints tidak menjawab, yang benar-benar menyumbang adalah 3 x 90 = 270
dari Jobstreet. Angka terukur pada 2026-09-27: 201 baris, 150 perusahaan
berbeda, seluruhnya Indonesia. Itu bukan cakupan nasional, dan copy UI tidak
boleh menjanjikan sebaliknya.
````

- [ ] **Step 2: Verify the fences render**

After appending, confirm the section did not swallow the rest of the file:

```bash
awk '/^## Pindai loker memakai config Careevo/{f=1} f&&/^```/{c++} END{print c" fence markers after the heading"}' docs/local-db.md
```

Expected: an even number, and the sections that follow `docs/local-db.md` still
render as prose. Read the rendered page — `docs/local-db.md` is read as plain
markdown, and a broken fence makes everything after it render as code.

- [ ] **Step 3: Commit**

```bash
git add docs/local-db.md
git commit -m "docs(local-db): config pindai Careevo dan jebakan tulis-sekali

Mencatat bahwa portals.yml disemai dari config Careevo dengan fallback ke
template engine, bahwa seed bersifat tulis-sekali sehingga berkas lama
harus dihapus manual untuk memakai config baru, cara memastikan seed mana
yang terpakai, cara membaca scan-runs.tsv, dan batas 540 lowongan per
pindai sebagai batas provider bukan cakupan nasional.
"
```

---

## Self-Review

**Spec coverage**

| Spec section | Task |
|---|---|
| K1 Careevo-owned tracked seed, 3 options weighed | Task 2 (`cariSeedPortals`), Task 3 (the file) |
| K2 general Indonesian tech roles | Task 3 (`title_filter`) |
| K3 `strict` off | Task 3 (omitted), Task 4 (guard asserts `undefined`) |
| New file `portals-careevo.yml` | Task 3 |
| `bootstrap.ts:36-44` change | Task 2 |
| `portals.test.ts:34` rewrite | Task 3 |
| `engine/**` untouched | Global Constraints; nothing in any task edits it |
| T1 two dead boards | Task 3 (`enabled: true`), Task 4 (guard) |
| T3 silent failure | Task 4 (parse guard), Task 5 (read the receipt) |
| T4 `location_filter` semantics | Task 3, Task 4 (`allow` guard) |
| T5 keyword mismatch | Task 3, Task 4 (language guard) |
| T6 `>=10` guard stays | Task 3 (14 entries), `portals.test.ts:47` untouched |
| G1 bad config | Task 4 |
| G2 Glints WAF | Task 5 (Jobstreet is the fallback path) |
| G3 `allow` too tight | Task 3 (Jabodetabek included) |
| G4 `title_filter` too tight | Task 3 (broad `positive`) |
| G5 write-once | Task 5 Step 2, Task 6 |
| `pipeline.md` cleanup decision | Task 5 Step 6, with the skip condition |
| Tests cannot prove it | Task 4 docstring, Task 5 preamble |
| Slices B/C/D out of scope | Not in this plan |

No gaps.

**Placeholder scan** — one intentional: Task 3 Step 3 ends with a comment marking where Task 1's verified list is pasted. It is called out in bold as *not* to be left as the value, with the reason (`portals.test.ts:61` fails on `null`). Every other code block is complete and runnable.

**Type consistency**

- `cariSeedPortals(candidates?: string[]): string | null` — declared in Task 2 Step 3, called with an explicit array in all three tests. Default parameter supplies the production paths. Consistent.
- `seedPortalsFromTemplate(): boolean` — signature unchanged from the original; only its body changed. `bootstrapCareerOps()` at `bootstrap.ts:92` still calls it and still pushes `"portals.yml"`. No call site changed.
- `config()` in Task 4 returns a structural type; `papanIndonesia()` filters on `Papan`. `yaml.load(...) as never` is cast through the declared return type, matching the existing `portals.test.ts:19-23` pattern.
- Task 4's Step 3 `sed` round-trip restores the file; Step 3 ends with `git diff --stat` to prove it.

One naming check worth recording: the spec used `G1`-`G5` for failure modes and the plan uses the same ids, so the two documents cross-reference correctly.
