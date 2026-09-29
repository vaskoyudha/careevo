# Perusahaan di Inbox Loker & Perluasan Sumber Pindai — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface how many distinct employers the inbox covers, let a learner filter by employer, and widen the scanner's Indonesian sources so the same inbox returns materially more relevant postings.

**Architecture:** Part A is a pure, client-side UI slice on `/loker/inbox`: a `daftarPerusahaan` facet derived from the already-loaded rows, a company `<select>` beside the existing city/category selects, and a third tile in the summary bar. Part B is a data-only change to the single tracked scan config `src/lib/career-ops/portals-careevo.yml` — more keyword families in `job_boards` (Task 2) and more scan depth on the two boards that answer (Task 3) — plus one live scan to measure the result. No engine code, no schema, no migration.

**Tech Stack:** TypeScript, React 19 (client components), Vitest, `js-yaml` (devDependency, tests only), the vendored `engine/*.mjs` scanner driven through `src/actions/inbox.ts`.

**Spec:** `docs/superpowers/specs/2026-09-27-papan-loker-pasar-indonesia-design.md` (the config Part B extends; its §"Batas atas per pindai — koreksi terhadap presentasi sebelumnya" is the ceiling arithmetic this plan pushes on). Part A has no prior spec — its basis is the measured dev data root (257 rows, 181 employers) recorded in `docs/local-db.md` §8.

## Global Constraints

- `engine/**` is vendored and must stay **byte-identical**. Never edit anything under `engine/`. This preserves the "Verbatim vendored core of career-ops" boundary in `AGENTS.md` plus the `career-ops-port` and `careevo-attribution` skills.
- `portals.yml` seeding stays **write-once**. An existing `.data/career-ops/portals.yml` is never replaced, so adopting the new config requires deleting it by hand. That is Task 4 Step 2, not a code change.
- **No** database schema change, no migration, no `drizzle/` file in this plan.
- `js-yaml` is a **devDependency** (`package.json`). Production code under `src/` must never import it. Only `*.test.ts` may.
- Business-logic identifiers stay Indonesian (matching `faset-inbox.ts`, `inbox-list.tsx`). Infra/UI stays English.
- `location_filter` supports exactly five fields — `allow`, `always_allow`, `block`, `block_hard`, `strict`. Any other name is silently ignored by `engine/scan.mjs`.
- Do **not** set `strict: true` on `location_filter`. It fails *closed* and would drop every Glints row that carries no location. The existing guard in `portals-careevo.test.ts` asserts `strict` is `undefined`; keep it.
- **Never commit `.data/`.** It is gitignored (`.gitignore:47`). Every path Task 4 touches lives there.
- The scan has a **hard 5-minute timeout** (`src/lib/career-ops/tracker.ts:126`, `timeoutMs: 5 * 60_000`). The work per scan is `sum(maxPages over enabled boards) × pageSize`. Task 2 raises the entry count (12 → 27) at `maxPages: 3`; Task 3 then raises `maxPages` to 12 on the sixteen Jobstreet and Kalibrr entries, taking the page budget from `27 × 3 = 81` to `16 × 12 + 11 × 3 = 225`. Task 3's measured wall time (~58s) is the evidence this stays well inside the ceiling; do not raise `pageSize` or add depth beyond 12 without a fresh measurement.
- `pageSize: 30` is fixed throughout this plan. Only `maxPages` moves, and only on Jobstreet and Kalibrr.
- Commits: Task 1 is **verification only** (its code is already committed in `5d6d257`), Task 4 is **measurement only** (every path it touches is gitignored), and Tasks 2, 3, and 5 each end with a commit. The working tree already contains unrelated edits; stage only the files a task names.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/jobs/faset-inbox.ts` | Facet derivation. Part A added `company` to `BarisFaset` and the pure `daftarPerusahaan()` — committed in `5d6d257`. |
| `src/lib/jobs/faset-inbox.test.ts` | Guards the facet. Part A added two `it` blocks for `daftarPerusahaan` — committed in `5d6d257`. |
| `src/components/features/jobs/permukaan-cari-loker.tsx` | Presentation. Part A added the company `<select>` to `PanelCariLoker` and a third tile to `RingkasanLoker` — committed in `5d6d257`. |
| `src/components/features/jobs/inbox-list.tsx` | Wires state to the two components above. Part A added the `perusahaan` filter state and its predicate — committed in `5d6d257`. |
| `src/lib/career-ops/portals-careevo.yml` | **Data only.** Part B adds 15 `job_boards` entries at `maxPages: 3` (Task 2), then raises `maxPages` to 12 on the sixteen Jobstreet and Kalibrr entries (Task 3). `tracked_companies` is unchanged. |
| `src/lib/career-ops/portals-careevo.test.ts` | Guards on that data file. Part B adds four board-shape guards (Task 2) and two depth guards (Task 3). The existing company-floor guard is left at its floor of 8. |
| `docs/local-db.md` | Operator runbook. Part B's Task 5 records the new measured numbers and the depth rationale. |

**Part A is already written and committed** in `5d6d257` ("feat(konten): seed materi katalog, faset inbox loker, dan copy dashboard"). `git log -S "export function daftarPerusahaan"` names that commit, and `git diff HEAD --` on the four files is empty. Task 1 therefore **verifies** the committed work against the current file contents; it neither re-implements nor re-commits it. Parts A and B are independent — a reviewer can accept Part A and reject Part B without conflict, and a rejection of Part B needs no revert of Part A.

---

## Task 1: Verify the employer count and the employer filter

The code for this task is already committed in `5d6d257` (written in a prior session, verified by `tsc` + `eslint` + 244 passing tests). This task re-confirms it against the current file contents. There is **no commit step** — running it on an up-to-date checkout changes nothing on disk, which is the point: it is a verification gate, not an edit.

**Files:**
- Verify (committed in `5d6d257`): `src/lib/jobs/faset-inbox.ts`
- Verify (committed in `5d6d257`): `src/lib/jobs/faset-inbox.test.ts`
- Verify (committed in `5d6d257`): `src/components/features/jobs/inbox-list.tsx`
- Verify (committed in `5d6d257`): `src/components/features/jobs/permukaan-cari-loker.tsx`

**Interfaces:**
- Consumes: `InboxJob` from `@/lib/career-ops` (unchanged), `verdictBadge` from `./cari-lowongan-ui` (unchanged).
- Produces (all already on `HEAD`): `daftarPerusahaan(baris: BarisFaset[]): string[]`; `BarisFaset` carries `company`; `RingkasanLoker` requires a `jumlahPerusahaan: number` prop; `PanelCariLoker` takes `perusahaan`, `onPerusahaan`, `pilihanPerusahaan` props. Tasks 2-5 do not touch these, but they must stay compilable.

- [ ] **Step 1: Confirm the facet function exists exactly as specified**

Run:

```bash
grep -n "export function daftarPerusahaan" src/lib/jobs/faset-inbox.ts
grep -n 'Pick<InboxJob, "url" | "role" | "location" | "company">' src/lib/jobs/faset-inbox.ts
```

Expected: both lines print. The second is the `BarisFaset` declaration. If either is missing, the checkout predates `5d6d257` — check out that commit or re-apply the two edits described in this task's Interfaces block before continuing.

- [ ] **Step 2: Confirm the two guards exist**

Run:

```bash
grep -n "perusahaan unik, terurut, dan tanpa duplikat" src/lib/jobs/faset-inbox.test.ts
grep -n "perusahaan kosong tidak menjadi opsi filter" src/lib/jobs/faset-inbox.test.ts
```

Expected: both lines print.

- [ ] **Step 3: Run the facet tests**

Run: `npx vitest run src/lib/jobs/faset-inbox.test.ts`

Expected: `19 passed`. The two new guards assert:

```typescript
  it("perusahaan unik, terurut, dan tanpa duplikat", () => {
    const perusahaan = daftarPerusahaan([
      baris({ company: "Kredivo Group" }),
      baris({ company: "GudangAda" }),
      baris({ company: "Kredivo Group" }),
      baris({ company: "  Amartha  " }),
    ]);
    expect(perusahaan).toEqual(["Amartha", "GudangAda", "Kredivo Group"]);
  });

  it("perusahaan kosong tidak menjadi opsi filter", () => {
    const perusahaan = daftarPerusahaan([
      baris({ company: "" }),
      baris({ company: "   " }),
      baris({ company: "Julo" }),
    ]);
    expect(perusahaan).toEqual(["Julo"]);
  });
```

- [ ] **Step 4: Run typecheck and lint on the four files**

Run:

```bash
npx tsc --noEmit
npx eslint src/lib/jobs/faset-inbox.ts src/lib/jobs/faset-inbox.test.ts src/components/features/jobs/inbox-list.tsx src/components/features/jobs/permukaan-cari-loker.tsx
```

Expected: both print nothing and exit `0`.

- [ ] **Step 5: Verify the derivation against the real dev data root**

The facet must be read off the rows, not `portals.yml`. Confirm it yields the employer count a signed-in learner sees. Run:

```bash
cat > ./_probe-perusahaan.ts <<'EOF'
import { bacaInboxDenganTanggal } from "@/lib/career-ops/inbox";
import { daftarPerusahaan } from "@/lib/jobs/faset-inbox";

const rows = bacaInboxDenganTanggal().filter((r) => !r.done);
console.log("lowongan:", rows.length);
console.log("perusahaan:", daftarPerusahaan(rows).length);
EOF
npx tsx ./_probe-perusahaan.ts
rm -f ./_probe-perusahaan.ts
```

Expected (on the current dev root): `lowongan: 257` and `perusahaan: 181`. The exact numbers may drift as the data root changes; what matters is that `perusahaan` is greater than `0` and less than or equal to `lowongan`.

- [ ] **Step 6: Confirm the committed state matches — no commit needed**

The work is already on `HEAD`. Confirm nothing is staged or unstaged for these four files:

```bash
git diff --stat HEAD -- src/lib/jobs/faset-inbox.ts src/lib/jobs/faset-inbox.test.ts src/components/features/jobs/inbox-list.tsx src/components/features/jobs/permukaan-cari-loker.tsx
git log --oneline -1 -S "export function daftarPerusahaan" -- src/lib/jobs/faset-inbox.ts
```

Expected: the first prints nothing (no diff against `HEAD`), and the second prints a commit line — `5d6d257 feat(konten): …`. **If the first command prints a diff**, the checkout is not the one this plan was written against; commit those four files with the message below before continuing, then move to Task 2.

```bash
git add src/lib/jobs/faset-inbox.ts src/lib/jobs/faset-inbox.test.ts src/components/features/jobs/inbox-list.tsx src/components/features/jobs/permukaan-cari-loker.tsx
git commit -m "feat(loker): jumlah perusahaan dan filter perusahaan di inbox

Kartu ringkasan kini punya tile ketiga: berapa perusahaan berbeda yang
membuka lowongan, bukan berapa lowongannya. Panel cari dapat select
\"Semua Perusahaan\" sejajar dengan lokasi dan kategori.

Daftar perusahaan dibaca dari baris hasil pindai, bukan dari portals.yml,
seperti daftarKota: config menamai SUMBER, facet ini menamai PEMBERI KERJA
yang benar-benar menghasilkan baris. Papan yang mengembalikan nol karena
itu tidak pernah menjadi opsi filter yang mengembalikan nol.
"
```

---

## Task 2: Widen the board keyword families

The config scans three role families (`software engineer`, `mobile developer`, `data analyst`) across four providers. Five large Indonesian tech families are missing: backend, frontend, full stack, DevOps, and QA. This task adds one entry per missing family for each of the **three providers that answer** (Jobstreet, Kalibrr, Dealls) — Glints is deliberately left at three entries because its board is WAF-blocked and more entries there buy nothing (see `docs/local-db.md` §8, "Membaca hasil pindai").

**Files:**
- Modify: `src/lib/career-ops/portals-careevo.yml` (append 15 entries at the end of the `job_boards` list, before the `# VERIFIED` comment that precedes `tracked_companies:`)
- Modify: `src/lib/career-ops/portals-careevo.test.ts` (extend the `Papan` interface, add a `papanAktif()` helper, add four guards)

**Interfaces:**
- Consumes: `daftarPapan`, `config` (already in `portals-careevo.test.ts`).
- Produces: nothing consumed by later tasks; the shipped config is the deliverable.

- [ ] **Step 1: Extend the test's `Papan` interface**

In `src/lib/career-ops/portals-careevo.test.ts`, replace the existing `Papan` interface:

```typescript
/**
 * Only the fields a guard actually reads. `name` and `provider` are absent on
 * purpose: nothing here consults them, and a declared-but-unread field reads
 * like a promise the file is not keeping. A future guard that needs one adds it
 * in the same commit that uses it.
 */
interface Papan {
  enabled?: boolean;
  siteKey?: string;
  countryCode?: string;
}
```

with:

```typescript
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
```

- [ ] **Step 2: Add the `papanAktif()` helper**

In the same file, immediately after the existing `papanIndonesia()` helper, add:

```typescript
/** Enabled boards only — scan.mjs skips a disabled entry without a message. */
function papanAktif(): Papan[] {
  return daftarPapan(config().job_boards).filter((b) => b.enabled === true);
}
```

- [ ] **Step 3: Write the failing guards**

In the same file, inside `describe("config pindai Indonesia", ...)`, add these four `it` blocks immediately before the closing `});` of the `describe`:

```typescript
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
```

- [ ] **Step 4: Run the guards to verify they fail**

Run: `npx vitest run src/lib/career-ops/portals-careevo.test.ts`

Expected: FAIL on `"menyapu minimal delapan keluarga peran"` (the config ships 3 distinct `searchKeywords`) and on `"punya minimal 27 papan aktif"` (the config ships 12). The other two new guards PASS — the existing 12 entries are well-shaped. That is the correct starting state.

- [ ] **Step 5: Add the 15 board entries**

In `src/lib/career-ops/portals-careevo.yml`, find the last existing `job_boards` entry — the one whose `name` is `Dealls Indonesia — data` and whose `notes` ends `Data analyst and science roles in Indonesia.` Insert this block **immediately after it** (before the `# VERIFIED 2026-09-27` comment that precedes `tracked_companies:`):

```yaml
  # --- Keluarga peran yang ditambahkan 2026-09-29 -------------------------
  #
  # Lima keluarga peran tech besar yang belum disapu, masing-masing untuk tiga
  # provider yang MENJAWAB (Jobstreet, Kalibrr, Dealls). Glints sengaja tidak
  # ditambah: papannya diblokir WAF dan mengembalikan nol, jadi entri Glints
  # ekstra hanya menambah waktu pindai tanpa menambah baris.
  #
  # pageSize dan maxPages TIDAK dinaikkan. Batas per pindai tetap
  # entries x 30 x 3, dan pindai punya timeout 5 menit di jalur aplikasi
  # (src/lib/career-ops/tracker.ts). Menambah entri menambah permintaan secara
  # linear; menaikkan kedalaman halaman akan mengalikannya lagi.
  #
  # title_filter.positive sudah memuat istilah untuk kelima keluarga ini
  # ("backend", "frontend", "full stack", "devops", "quality assurance"), jadi
  # tidak ada perubahan di sana.

  - name: Jobstreet Indonesia — backend developer
    provider: jobstreet
    api: https://id.jobstreet.com/api/jobsearch/v5/search
    siteKey: ID-Main
    searchKeywords: backend developer
    pageSize: 30
    maxPages: 3
    enabled: true
    notes: Backend adalah keluarga terbesar setelah software engineer di pasar Indonesia.

  - name: Jobstreet Indonesia — frontend developer
    provider: jobstreet
    api: https://id.jobstreet.com/api/jobsearch/v5/search
    siteKey: ID-Main
    searchKeywords: frontend developer
    pageSize: 30
    maxPages: 3
    enabled: true
    notes: React/Vue/Angular; audiens utama jalur Fullstack & Frontend Careevo.

  - name: Jobstreet Indonesia — full stack developer
    provider: jobstreet
    api: https://id.jobstreet.com/api/jobsearch/v5/search
    siteKey: ID-Main
    searchKeywords: full stack developer
    pageSize: 30
    maxPages: 3
    enabled: true
    notes: Judul fullstack sering tidak menyebut "backend" maupun "frontend", jadi tidak tertangkap dua entri di atas.

  - name: Jobstreet Indonesia — devops engineer
    provider: jobstreet
    api: https://id.jobstreet.com/api/jobsearch/v5/search
    siteKey: ID-Main
    searchKeywords: devops engineer
    pageSize: 30
    maxPages: 3
    enabled: true
    notes: DevOps, SRE, dan cloud; kategori "DevOps & Infrastruktur" di facet.

  - name: Jobstreet Indonesia — quality assurance
    provider: jobstreet
    api: https://id.jobstreet.com/api/jobsearch/v5/search
    siteKey: ID-Main
    searchKeywords: quality assurance
    pageSize: 30
    maxPages: 3
    enabled: true
    notes: QA manual dan otomasi; kategori "QA & Pengujian" di facet.

  - name: Kalibrr Indonesia — backend developer
    provider: kalibrr
    api: https://www.kalibrr.com/api/job_board/search
    countryCode: ID
    searchKeywords: backend developer
    pageSize: 30
    maxPages: 3
    enabled: true
    notes: REST publik tanpa token; mencakup sektor perbankan dan korporat Indonesia.

  - name: Kalibrr Indonesia — frontend developer
    provider: kalibrr
    api: https://www.kalibrr.com/api/job_board/search
    countryCode: ID
    searchKeywords: frontend developer
    pageSize: 30
    maxPages: 3
    enabled: true
    notes: Posting frontend di papan Kalibrr Indonesia.

  - name: Kalibrr Indonesia — full stack developer
    provider: kalibrr
    api: https://www.kalibrr.com/api/job_board/search
    countryCode: ID
    searchKeywords: full stack developer
    pageSize: 30
    maxPages: 3
    enabled: true
    notes: Peran fullstack di startup dan korporat Indonesia.

  - name: Kalibrr Indonesia — devops engineer
    provider: kalibrr
    api: https://www.kalibrr.com/api/job_board/search
    countryCode: ID
    searchKeywords: devops engineer
    pageSize: 30
    maxPages: 3
    enabled: true
    notes: DevOps dan SRE di papan Kalibrr Indonesia.

  - name: Kalibrr Indonesia — quality assurance
    provider: kalibrr
    api: https://www.kalibrr.com/api/job_board/search
    countryCode: ID
    searchKeywords: quality assurance
    pageSize: 30
    maxPages: 3
    enabled: true
    notes: QA manual dan otomasi di papan Kalibrr Indonesia.

  - name: Dealls Indonesia — backend developer
    provider: dealls
    api: https://api.sejutacita.id/v1/explore-job/job
    searchKeywords: backend developer
    pageSize: 30
    maxPages: 3
    enabled: true
    notes: REST publik tanpa token; marketplace talenta startup Indonesia.

  - name: Dealls Indonesia — frontend developer
    provider: dealls
    api: https://api.sejutacita.id/v1/explore-job/job
    searchKeywords: frontend developer
    pageSize: 30
    maxPages: 3
    enabled: true
    notes: Posting frontend di papan Dealls Indonesia.

  - name: Dealls Indonesia — full stack developer
    provider: dealls
    api: https://api.sejutacita.id/v1/explore-job/job
    searchKeywords: full stack developer
    pageSize: 30
    maxPages: 3
    enabled: true
    notes: Peran fullstack di startup Indonesia.

  - name: Dealls Indonesia — devops engineer
    provider: dealls
    api: https://api.sejutacita.id/v1/explore-job/job
    searchKeywords: devops engineer
    pageSize: 30
    maxPages: 3
    enabled: true
    notes: DevOps dan SRE di papan Dealls Indonesia.

  - name: Dealls Indonesia — quality assurance
    provider: dealls
    api: https://api.sejutacita.id/v1/explore-job/job
    searchKeywords: quality assurance
    pageSize: 30
    maxPages: 3
    enabled: true
    notes: QA manual dan otomasi di papan Dealls Indonesia.
```

- [ ] **Step 6: Run the guards to verify they pass**

Run: `npx vitest run src/lib/career-ops/portals-careevo.test.ts`

Expected: `11 passed` (7 existing + 4 new).

- [ ] **Step 7: Prove the new guards bite**

A guard that cannot fail is decoration. The Task 2 edits are **not committed yet**, so do **not** use `git checkout` to undo the mutation — it would throw away the work you just did. Back the file up with `cp` instead, mutate a copy of the live file, then restore from the backup.

Flip only the three `quality assurance` entries' `enabled` flag to `false`. The range in this `sed` starts at each `searchKeywords: quality assurance` line and stops at the first `enabled: true` after it, so it touches exactly those three entries and leaves every other line byte-identical:

```bash
cp src/lib/career-ops/portals-careevo.yml /tmp/opencode/portals-careevo.bak.yml
sed -i '/searchKeywords: quality assurance/,/enabled: true/ s/^    enabled: true$/    enabled: false/' src/lib/career-ops/portals-careevo.yml
grep -c '^    enabled: false$' src/lib/career-ops/portals-careevo.yml
npx vitest run src/lib/career-ops/portals-careevo.test.ts
```

Expected: the `grep` prints `3`, and the suite FAILS on `"menyapu minimal delapan keluarga peran"` (active families drop from 8 to 7) and on `"punya minimal 27 papan aktif"` (27 → 24). The other two new guards still PASS — they only read the surviving entries, which are untouched. Restore and confirm green:

```bash
cp /tmp/opencode/portals-careevo.bak.yml src/lib/career-ops/portals-careevo.yml
rm -f /tmp/opencode/portals-careevo.bak.yml
npx vitest run src/lib/career-ops/portals-careevo.test.ts
```

Expected: `11 passed` again. Confirm the restore is byte-exact (no leftover mutation, and Task 2's block is still present). Note that `tracked_companies` entries carry `enabled: true` at the same indentation, so the total is boards **plus** the nine companies:

```bash
grep -c '^    enabled: true$' src/lib/career-ops/portals-careevo.yml
grep -n 'punya minimal 27 papan aktif' src/lib/career-ops/portals-careevo.test.ts
```

Expected: the first prints `36` (27 boards + 9 tracked companies); the second prints the guard's line. If the first is not `36`, the restore failed — re-run Step 5's insert before continuing.

- [ ] **Step 8: Confirm the seeded copy is still byte-identical**

`portals.test.ts` asserts the seeded `.data/career-ops/portals.yml` is a byte copy of this file. The seed is write-once, so this assertion is about the *source*, not the live data root. Run:

Run: `npx vitest run src/lib/career-ops/portals.test.ts`

Expected: `4 passed`.

- [ ] **Step 9: Commit**

```bash
git add src/lib/career-ops/portals-careevo.yml src/lib/career-ops/portals-careevo.test.ts
git commit -m "feat(career-ops): lima keluarga peran tech di papan pindai Indonesia

Menambah backend, frontend, full stack, devops, dan quality assurance untuk
tiga provider yang menjawab (Jobstreet, Kalibrr, Dealls). Glints sengaja
tidak ditambah: papannya diblokir WAF dan mengembalikan nol.

pageSize dan maxPages tidak diubah, jadi batas per pindai naik secara linear
(entries x 30 x 3), bukan kuadratik, dan tetap di bawah timeout 5 menit
jalur aplikasi.

Penjaga baru: setiap papan aktif punya provider dan batas halaman, provider
hanya dari himpunan Indonesia yang dikenal engine, minimal delapan keluarga
peran, dan minimal 27 papan aktif.
"
```

---

## Task 3: Deepen the scan on the two boards that answer

The config scans each keyword family to `maxPages: 3` — 90 postings per keyword. Measured on 2026-09-29, that leaves most of Jobstreet's catalogue untouched: the board reports **61,887** postings, and the eight configured families alone match far more than 90 apiece (software engineer 2,226, quality assurance 2,876, data analyst 2,114, backend 906, full stack 611, frontend 446, DevOps 403). Kalibrr is the same shape (full-stack 995, data analyst 484). Depth, not breadth, is the lever: **breadth is already covered** — the eight families span the market, and each added page buys 30 more real postings per family, while an extra keyword family buys almost nothing.

This task raises `maxPages` from **3 to 12** on the eight Jobstreet and eight Kalibrr entries. It leaves Glints (3 entries) and Dealls (8 entries) at 3, because neither responds to depth: Glints is WAF-blocked and returns zero at any depth, and Dealls dries out at page 1 (11 results for software engineer, 0 for frontend developer).

**Measured, by the engine's own scan path, against a scratch data root:**

| Config | Rows | Distinct employers | Wall time |
|---|---:|---:|---:|
| Current (27 boards, Jobstreet + Kalibrr at 3) | 416–456 | 276–296 | 56–85s |
| This task (Jobstreet + Kalibrr at 12) | **862** | **516** | 42–58s |

That is roughly **2× the rows and 2× the employers** from one number per entry, inside a fraction of the 5-minute timeout in `src/lib/career-ops/tracker.ts:126`. Two independent runs of the proposed config agreed exactly (862 rows / 516 employers), so the gain is not run-to-run noise.

**Why not deeper than 12.** Depth 20 reached 945 rows and depth 30 reached 1,069, but the marginal returns fall off sharply (12→30 adds 207 rows for 2.5× the page count) and the timeout margin narrows. Depth 12 is the point where the config more than doubles the corpus without putting the 5-minute ceiling at risk. A future plan can raise it again with its own measurement.

**Files:**
- Modify: `src/lib/career-ops/portals-careevo.yml` (raise `maxPages` 3 → 12 on the eight Jobstreet and eight Kalibrr entries only)
- Modify: `src/lib/career-ops/portals-careevo.test.ts` (add a depth guard)

**Interfaces:**
- Consumes: `papanAktif()` (added in Task 2), `config()`.
- Produces: nothing consumed by later tasks; the shipped config is the deliverable.

**Do not use `engine/discover-ats.mjs` in this task.** It resolves company names to ATS boards, which is the *breadth* lever this task deliberately rejects. Measured on 2026-09-29, a ~5,700-probe sweep of that resolver across 11 vendors against ~100 Indonesian employers found only about nine clean Indonesian boards, nearly all listing 1–9 postings; its large hits were wrong-entity matches (Super → an Irish sports-gaming firm, Flip → Los Angeles/New York, Fuse → a US laser company). Indonesian employers mostly do not publish on Western ATS vendors, so `tracked_companies` is a weak lever for this market. The depth change below reaches far more postings from the boards that already answer. (Task 5 records this finding so the investigation is not repeated.)

- [ ] **Step 1: Write the failing depth guard**

The `Papan` interface from Task 2 already declares `provider`, `maxPages`, and `name`, and `papanAktif()` already exists — no test-harness change is needed. Add two `it` blocks inside `describe("config pindai Indonesia", ...)`, immediately before its closing `});`:

```typescript
  it("memindai lebih dalam di Jobstreet dan Kalibrr — minimal 12 halaman", () => {
    // Depth is the lever, not breadth. At maxPages 3 each keyword family stops
    // at 90 postings, while Jobstreet lists 2,226 for "software engineer" and
    // 2,876 for "quality assurance" (measured 2026-09-29). Nothing in the
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
```

- [ ] **Step 2: Run the guards to verify they fail**

Run: `npx vitest run src/lib/career-ops/portals-careevo.test.ts`

Expected: FAIL on `"memindai lebih dalam di Jobstreet dan Kalibrr — minimal 12 halaman"` (all eight Jobstreet and eight Kalibrr entries ship `maxPages: 3`) and on `"anggaran halaman total minimal 200"` (the sum is `27 × 3 = 81`). That is the correct starting state: the deepening has not been applied yet.

- [ ] **Step 3: Raise `maxPages` on the Jobstreet and Kalibrr entries**

In `src/lib/career-ops/portals-careevo.yml`, change `maxPages: 3` to `maxPages: 12` on **every** entry whose `provider` is `jobstreet` or `kalibrr`. There are 16 such entries — the eight Jobstreet families and the eight Kalibrr families added in Task 2. Do **not** touch the `maxPages` of any `glints` or `dealls` entry; those stay at 3.

The mechanical edit, scoped by each entry's own `- name:` line, is:

```bash
python3 - src/lib/career-ops/portals-careevo.yml <<'PY'
import re, sys
p = sys.argv[1]
lines = open(p).read().split("\n")
out, cur = [], ""
for l in lines:
    m = re.match(r"^  - name: (.*)$", l)
    if m:
        cur = m.group(1)
    if re.match(r"^    maxPages: 3$", l) and ("Jobstreet" in cur or "Kalibrr" in cur):
        l = "    maxPages: 12"
    out.append(l)
open(p, "w").write("\n".join(out))
PY
grep -c '^    maxPages: 12$' src/lib/career-ops/portals-careevo.yml
grep -c '^    maxPages: 3$' src/lib/career-ops/portals-careevo.yml
```

Expected: the first `grep` prints `16`, the second prints `11` (the three Glints and eight Dealls entries). The names are literal (`Jobstreet …`, `Kalibrr …`), so the scope is exact. If the counts are not `16` and `11`, stop and inspect — a wrong scope would silently deepen or shallaw a board the plan did not measure.

Also append a comment to the `job_boards` block header recording the measurement, so the next reader knows why the numbers are what they are and does not "tidy" them back to 3:

```yaml
  # --- Kedalaman 2026-09-29 -------------------------------------------------
  #
  # Jobstreet dan Kalibrr dipindai 12 halaman per keluarga peran, bukan 3.
  # Diukur lewat engine/scan.mjs terhadap data root sementara: 27 entri pada
  # maxPages 3 menghasilkan 416-456 baris / 276-296 perusahaan; dengan Jobstreet
  # dan Kalibrr di 12, hasilnya 862 baris / 516 perusahaan, dua kali lipat,
  # dalam ~58 detik (timeout jalur aplikasi 5 menit).
  #
  # Glints dan Dealls tetap 3: Glints diblokir WAF dan mengembalikan nol di
  # kedalaman berapa pun, Dealls kering di halaman 1. Menaikkan keduanya hanya
  # menambah waktu pindai tanpa menambah baris.
```

- [ ] **Step 4: Run the guards to verify they pass**

Run: `npx vitest run src/lib/career-ops/portals-careevo.test.ts`

Expected: `13 passed` (7 existing + 4 from Task 2 + 2 new).

- [ ] **Step 5: Prove the new guards bite**

Same rule as Task 2 Step 7: the Task 3 edits are **not committed yet**, so back up with `cp`, never `git checkout`. Revert the depth and confirm the suite goes red:

```bash
cp src/lib/career-ops/portals-careevo.yml /tmp/opencode/portals-careevo.bak.yml
sed -i 's/^    maxPages: 12$/    maxPages: 3$/' src/lib/career-ops/portals-careevo.yml
npx vitest run src/lib/career-ops/portals-careevo.test.ts
```

Expected: FAIL on both new guards (`maxPages` falls to 3, and the page budget falls to 81). The other eleven guards still pass — they do not read depth. Restore and confirm green:

```bash
cp /tmp/opencode/portals-careevo.bak.yml src/lib/career-ops/portals-careevo.yml
rm -f /tmp/opencode/portals-careevo.bak.yml
npx vitest run src/lib/career-ops/portals-careevo.test.ts
grep -c '^    maxPages: 12$' src/lib/career-ops/portals-careevo.yml
```

Expected: `13 passed`, then `16`. If the `grep` is not `16`, the restore failed — re-run Step 3 before continuing.

- [ ] **Step 6: Confirm the seeded copy is still byte-identical**

Run: `npx vitest run src/lib/career-ops/portals.test.ts`

Expected: `4 passed`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/career-ops/portals-careevo.yml src/lib/career-ops/portals-careevo.test.ts
git commit -m "feat(career-ops): pindai 12 halaman di Jobstreet dan Kalibrr

Kedalaman, bukan cakupan, adalah tuasnya. Pada maxPages 3 setiap keluarga
peran berhenti di 90 lowongan, sementara Jobstreet mencantumkan 2.226 untuk
software engineer dan 2.876 untuk quality assurance (terukur 2026-09-29).
Pindai bersih lewat engine/scan.mjs terhadap data root sementara: 416-456
baris / 276-296 perusahaan naik jadi 862 baris / 516 perusahaan, dalam ~58
detik.

Glints dan Dealls tetap 3: Glints diblokir WAF, Dealls kering di halaman 1.
Menaikkan keduanya hanya menambah waktu, bukan baris.

Penjaga baru: Jobstreet dan Kalibrr minimal 12 halaman, dan anggaran halaman
total minimal 200 (16x12 + 11x3 = 225).

Catatan: generator perusahaan lewat engine/discover-ats.mjs TIDAK dipakai di
sini. Sapuan 2026-09-29 menemukan ~9 papan Indonesia bersih dengan 1-9
lowongan masing-masing, dengan kekeliruan entitas pada hit besarnya; pemberi
kerja Indonesia umumnya tidak memakai ATS Barat.
"
```

---

## Task 4: Prove it with a live scan

The only task whose output is evidence. Everything before it is a hypothesis about a data file.

**Files:**
- Delete: `.data/career-ops/portals.yml` (gitignored, local only)
- Read: `.data/career-ops/data/scan-runs.tsv`, `.data/career-ops/data/pipeline.md`, `.data/career-ops/data/portal-health.tsv`

**Interfaces:**
- Consumes: everything from Tasks 1-3.
- Produces: the measured numbers Task 5 records in `docs/local-db.md`.

- [ ] **Step 1: Back up the current data root**

```bash
mkdir -p /tmp/opencode/data-root-backup
cp -a .data/career-ops/. /tmp/opencode/data-root-backup/
ls /tmp/opencode/data-root-backup/
```

Expected: `data/`, `portals.yml`, and the empty dirs. This is the 257-posting corpus; Step 6's cleanup is destructive without it.

- [ ] **Step 2: Delete the stale seed so write-once does not block the new config**

`seedPortalsFromTemplate` is write-once by design, so the existing config is never replaced. Delete it:

```bash
rm .data/career-ops/portals.yml
```

- [ ] **Step 3: Reload the inbox page so bootstrap re-seeds**

`/loker/inbox` calls `bootstrapCareerOps()` on every request, but only inside a signed-in session that has completed onboarding — `src/app/(app)/layout.tsx` redirects to `/masuk` without a session and to `/onboarding` without a profile. A `307` to either proves **nothing was seeded**, not that seeding succeeded.

Sign in, open `/loker/inbox`, then verify:

```bash
diff <(md5sum < src/lib/career-ops/portals-careevo.yml) <(md5sum < .data/career-ops/portals.yml) && echo "SEEDED FROM CAREEVO"
```

Expected: `SEEDED FROM CAREEVO`. **If this prints nothing, stop** — the scan would measure the old config.

- [ ] **Step 4: Run a scan and read the receipt**

Click **"Pindai lowongan baru"** on `/loker/inbox` while signed in. That button calls `jalankanScanAction()` in `src/actions/inbox.ts`, which spawns `engine/scan.mjs` — use the real path so the receipt is the one the app produces. Wait for the button to leave its pending state, then:

```bash
tail -2 .data/career-ops/data/scan-runs.tsv
```

Read the row against the header (`HEADER_SCAN_RUNS` in `src/lib/career-ops/scan-runs.ts`):

- `boards` is **27** (was 12) — confirms Task 2's families were read
- `found` is far above the pre-change runs' 986–1,336 — the depth change from Task 3 is the cause
- `errors` is low; Glints contributes `auth` failures and that is expected
- `new_added` is greater than `0`

**If `boards` is still `12`, the new config was not read.** Re-check Step 3. If the action reported a timeout, the 5-minute ceiling was hit — report it and lower Task 3's `maxPages` rather than shipping a scan that cannot finish. A clean run of the post-Task-3 config measured 862 rows in ~58s, so a timeout here means something else (a slow board, a cold DNS cache) and should be re-run once before concluding.

Fallback if the button is unavailable, equivalent to what `runEngine` spawns (`cwd: engine`, `CAREER_OPS_ROOT` set):

```bash
CAREER_OPS_ROOT="$(pwd)/.data/career-ops" node engine/scan.mjs --json --quiet --since 30
```

- [ ] **Step 5: Confirm the rows are Indonesian and count the employers**

```bash
grep -ciE "jakarta|bandung|surabaya|indonesia|bekasi|tangerang|depok|yogyakarta|semarang|denpasar|makassar|medan|palembang" .data/career-ops/data/pipeline.md
grep -c "^- \[ \]" .data/career-ops/data/pipeline.md
awk -F'|' '/^- \[ \]/{gsub(/^ +| +$/,"",$2); print $2}' .data/career-ops/data/pipeline.md | sort -u | wc -l
```

Expected: an Indonesian-location count far above `1` (the pre-change corpus had exactly one Indonesian row out of 486), a total row count above the pre-change `257`, and a distinct-employer count above the pre-change `181`. The post-Task-3 config measured **862 rows and 516 employers** against a scratch root; the live root will differ because it already holds rows from earlier scans, but the *distinct-employer* count is the cleanest signal and should move toward 500 or beyond.

Record all three numbers plus the `boards`/`found`/`new_added` receipt values — Task 5 quotes them verbatim.

- [ ] **Step 6: Verify in a real browser, not just the receipt**

A green test and a good receipt do not mean the page is right. In the signed-in session, open `/loker/inbox` and confirm:

- the summary bar's third tile shows a **Perusahaan** count that matches Step 5's distinct-employer number
- the **Semua Perusahaan** select lists employer names, all Indonesian
- the list renders without typing a query, and no row reads Allianz, ByteDance, or Anthropic

Capture the evidence:

```bash
npx playwright screenshot --full-page "http://localhost:3000/loker/inbox" /tmp/opencode/inbox-setelah-perluasan.png 2>/dev/null || echo "use the browser harness if the CLI is unavailable"
```

Read the screenshot. Report what it actually shows.

- [ ] **Step 7: No commit**

Every path touched here is gitignored. Record the receipt numbers in the Task 4 summary instead, and carry them into Task 5.

---

## Task 5: Document the new ceiling and the measured numbers

**Files:**
- Modify: `docs/local-db.md` (§8 — replace the stale counts and the "Batasnya" arithmetic with the measured post-change numbers)

**Interfaces:**
- Consumes: the measured numbers from Task 4.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Update the seed description**

In `docs/local-db.md`, in §8, find the sentence beginning `\`/loker/inbox\` menyemai` and replace its parenthetical counts with the shipped ones:

```markdown
`/loker/inbox` menyemai `.data/career-ops/portals.yml` dari
`src/lib/career-ops/portals-careevo.yml`: 27 entri papan aktif — Jobstreet,
Kalibrr, dan Dealls masing-masing delapan keluarga peran, plus tiga Glints yang
diblokir WAF. Jobstreet dan Kalibrr dipindai **12 halaman** per keluarga
(Glinks dan Dealls tetap 3), sembilan perusahaan terlacak, dan 14 kota dalam
`location_filter`. Bila berkas Careevo tidak ada, ia jatuh ke
`engine/templates/portals.example.yml`. `engine/` sendiri tidak pernah diubah —
hanya berkas mana yang disalin yang berubah.
```

- [ ] **Step 2: Replace the ceiling arithmetic with the measured numbers**

Find the section headed `### Batasnya, dan mengapa itu bukan cakupan nasional`. It runs from that heading down to (but not including) the next `###` heading, `### Pindai dua kali berturut-turut mengukur rate limit, bukan config`. Replace the **entire body** — the introductory line, the bullet list, and the trailing paragraph that begins `Langit-langit mentahnya sekitar 445` — with the Task 4 measurements. Leaving that paragraph would keep a stale `445`/`295` arithmetic contradicting the new counts directly above it. Use the real numbers, in this shape:

```markdown
### Batasnya, dan mengapa itu bukan cakupan nasional

Batas-batas ini harus dibaca apa adanya, bukan sebagai jangkauan pasar:

- Pindai bersih terakhir menambah **<new_added>** baris — angka hasil ukur,
  bukan perkiraan, dan sudah sesudah `title_filter` serta `location_filter`
  menyisir. Korpus di disk: **<total>** baris, **<perusahaan>** perusahaan
  berbeda, seluruhnya Indonesia.
- Anggaran halaman sekarang `16 x 12 + 11 x 3 = 225`, jadi batas mentah per
  pindai adalah `225 x pageSize 30 = 6.750`. Karena Glints tidak menjawab
  (tiga entri, sembilan halaman), yang benar-benar menyumbang paling banyak
  `216 x 30 = 6.480`. Ini naik dari `27 x 3 x 30 = 2.430` sebelum Jobstreet
  dan Kalibrr diperdalam.
- Kedalaman 12 dipilih dari pengukuran, bukan ditebak: 27 entri pada
  `maxPages 3` menghasilkan 416-456 baris / 276-296 perusahaan, sedangkan
  Jobstreet dan Kalibrr di 12 menghasilkan 862 baris / 516 perusahaan dalam
  ~58 detik. Naik lagi ke 20 memberi 945 baris, ke 30 memberi 1.069 — imbal
  hasilnya mengecil sementara margin timeout 5 menit
  (`src/lib/career-ops/tracker.ts`) menyempit.
- Angka terukur pada <tanggal>: **<total> baris, <perusahaan> perusahaan
  berbeda**. Jadi ini **bukan cakupan nasional**, dan copy UI tidak boleh
  menjanjikan sebegitu. Frasa seperti "ribuan lowongan tech Indonesia" tidak
  didukung bukti yang ada sekarang.
- Kedalaman bukan satu-satunya tuas, dan bukan yang terbesar untuk semua
  papan. Mencari perusahaan lewat `engine/discover-ats.mjs` (Greenhouse, Ashby,
  Lever, Workable, SmartRecruiters, dll.) hanya menemukan sekitar sembilan
  papan Indonesia yang bersih, hampir semuanya berisi 1-9 lowongan; hit
  besarnya salah entitas (Super ke perusahaan gim Irlandia, Flip ke Los
  Angeles, Fuse ke perusahaan laser AS). Pemberi kerja Indonesia umumnya tidak
  memakai ATS Barat, jadi `tracked_companies` adalah tuas yang lemah di pasar
  ini.
```

Replace every `<new_added>`, `<total>`, `<perusahaan>`, and `<tanggal>` with the Task 4 number. Do not leave an angle-bracket placeholder in the committed file.

- [ ] **Step 3: Verify no placeholder survived**

`docs/local-db.md` already contains one legitimate angle-bracket token at line 195 — `careevo_test_<seed>` — so a bare `grep "<[a-z_]+>"` would report a false positive. Match only the four placeholder names this step can leave behind:

```bash
grep -nE "<(new_added|total|perusahaan|tanggal)>" docs/local-db.md && echo "PLACEHOLDER LEFT" || echo "clean"
```

Expected: `clean`.

- [ ] **Step 4: Commit**

```bash
git add docs/local-db.md
git commit -m "docs(local-db): kedalaman pindai dan angka terukurnya

Memperbarui §8: 27 papan aktif dengan Jobstreet dan Kalibrr di 12 halaman,
anggaran halaman 225 (batas mentah 6.750), dan angka terukur dari pindai
bersih terakhir. Mencatat juga bahwa discover-ats.mjs adalah tuas yang lemah
untuk pasar Indonesia, supaya penyelidikan itu tidak diulang.
"
```

---

## Self-Review

**Spec coverage**

| Spec / request item | Task |
|---|---|
| "tampilkan jumlah perusahaan" (summary tile) | Task 1 verifies it (committed in `5d6d257`: `RingkasanLoker` third tile) |
| "tambah button filtering" (employer select) | Task 1 verifies it (committed in `5d6d257`: `PanelCariLoker` company select) |
| "perbanyak sumber scan" — more keyword families | Task 2 |
| "perbanyak sumber scan" — more postings per family (depth) | Task 3 |
| Evidence the widening worked | Task 4 |
| Recorded ceiling, not a national-coverage claim | Task 5 |
| `engine/**` untouched | Global Constraints; no task edits it |
| `location_filter` five-field limit; no `strict` | Global Constraints; existing guard kept |
| Write-once seed trap | Task 4 Step 2-3, documented in Task 5 |
| 5-minute scan timeout | Global Constraints; Task 3 owns the depth number and Task 4 checks the receipt |

No gaps.

**Placeholder scan** — one intentional, in Task 5 Step 2: the `<new_added>` / `<total>` / `<perusahaan>` / `<tanggal>` tokens are filled from Task 4's measurements, and Step 3 is a hard gate that matches exactly those four names (not any angle-bracket token, because `local-db.md:195` already carries a legitimate `careevo_test_<seed>`). Task 3 Step 3 states the exact `grep` counts (`16` and `11`) that prove the scope, rather than leaving a "edit the right entries" comment. Every other code and YAML block is complete and runnable.

**Type consistency**

- `daftarPerusahaan(baris: BarisFaset[]): string[]` — committed in Task 1's `5d6d257`, consumed by `inbox-list.tsx`'s `pilihanPerusahaan` memo and `jumlahPerusahaan`. Consistent.
- `BarisFaset` carries `company` (Task 1); `Pick<InboxJob, "url" | "role" | "location" | "company">` matches `InboxJobShape.company` (`string`, required) in `src/lib/career-ops/pipeline-table.ts:19`. The test helper `baris()` in `faset-inbox.test.ts` supplies `company: "Contoh Perusahaan"` so the required field is satisfied.
- `RingkasanLoker` requires `jumlahPerusahaan: number`; its only call site is `inbox-list.tsx:213`.
- `PanelCariLoker` takes `perusahaan: string`, `onPerusahaan: (next: string) => void`, `pilihanPerusahaan: readonly string[]`; its only call site is `inbox-list.tsx:193-204`.
- `papanAktif(): Papan[]` — declared in Task 2 Step 2, used by all four Task 2 guards and both Task 3 guards. Consistent.
- `Papan` fields added in Task 2 Step 1 (`name`, `provider`, `pageSize`, `maxPages`, `searchKeywords`) are exactly the fields the Task 2 and Task 3 guards read; Task 3 adds no interface field because `provider` and `maxPages` are already declared. `daftarPapan` already exists and returns `Papan[]`.
- `tracked_companies` is untouched by this plan; the existing `"membawa perusahaan yang bisa dipindai"` guard stays at its floor of 8 and its nine shipped companies.

**Measured-claim check** — every number in Part B is a value this session produced, not an estimate: `maxPages: 3` → 416–456 rows / 276–296 employers / 56–85s and `maxPages: 12` → 862 rows / 516 employers / 42–58s both come from `engine/scan.mjs` runs against scratch data roots; the per-keyword totals (software engineer 2,226; quality assurance 2,876; data analyst 2,114; backend 906; full stack 611; frontend 446; DevOps 403; board total 61,887) come from direct Jobstreet API reads; and the ATS-resolver verdict comes from a ~5,700-probe sweep. Task 4 re-measures on the live root rather than trusting these numbers, and Task 5 records what Task 4 actually saw.

**Cross-document check** — the spec numbers its findings `T1`-`T6` and its failure modes `G1`-`G5`. This plan deliberately does not cite those codes: it extends the config the spec produced rather than re-deriving the spec's diagnosis, and it names the two facts it does rely on in prose instead — the WAF-blocked Glints board (the spec's `G2`) in Task 2 Step 5's comment and Task 4 Step 4's `auth` note, and the write-once seed trap (the spec's `G5`) in the Global Constraints and Task 4 Step 2. Citing the codes without the prose would make the plan unreadable on its own; citing the prose without the codes keeps it self-contained. The spec is linked in the header for anyone who wants the full diagnosis.

**Sibling spec — `2026-09-29-enrichment-multi-papan-design.md`** (committed at `3c68f5f`). This plan is *orthogonal* to that one and neither blocks the other. That spec makes enrichment multi-board so the 77 non-Jobstreet rows stop rendering "Belum diperiksa"; it adds `src/lib/career-ops/boards/`, `job-cache.ts`, and `scripts/enrich-inbox.ts`, and its §"Tidak diubah" pins `engine/**`, the DB schema, Sentinel, and the fixtures. It never mentions `portals-careevo.yml` — because enrichment reads the description of a row the scan *already discovered*, whereas this plan changes what the scan *discovers*. Different halves of the same pipeline, and the two files sets do not overlap. Both start from the same measured 257-row / 181-employer corpus, so if the two land together the counts Task 4 measures will be *larger* than either alone — expected, not a contradiction, since Task 4 measures the tree it actually runs on. The one ordering rule: if both land in the same working tree, run this plan's Task 4 scan **after** the enrichment spec's cache migration, so the row counts it records are the final ones.
