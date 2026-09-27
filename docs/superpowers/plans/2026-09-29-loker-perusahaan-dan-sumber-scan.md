# Perusahaan di Inbox Loker & Perluasan Sumber Pindai — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface how many distinct employers the inbox covers, let a learner filter by employer, and widen the scanner's Indonesian sources so the same inbox returns materially more relevant postings.

**Architecture:** Part A is a pure, client-side UI slice on `/loker/inbox`: a `daftarPerusahaan` facet derived from the already-loaded rows, a company `<select>` beside the existing city/category selects, and a third tile in the summary bar. Part B is a data-only change to the single tracked scan config `src/lib/career-ops/portals-careevo.yml` — more keyword families in `job_boards` and more verified employers in `tracked_companies` — plus one live scan to measure the result. No engine code, no schema, no migration.

**Tech Stack:** TypeScript, React 19 (client components), Vitest, `js-yaml` (devDependency, tests only), the vendored `engine/*.mjs` scanner driven through `engine/discover-ats.mjs` and `src/actions/inbox.ts`.

**Spec:** `docs/superpowers/specs/2026-09-27-papan-loker-pasar-indonesia-design.md` (the config Part B extends; its §"Batas atas per pindai" is the ceiling arithmetic this plan pushes on). Part A has no prior spec — its basis is the measured dev data root (257 rows, 181 employers) recorded in `docs/local-db.md` §8.

## Global Constraints

- `engine/**` is vendored and must stay **byte-identical**. Never edit anything under `engine/`. This preserves the "Verbatim vendored core of career-ops" boundary in `AGENTS.md` plus the `career-ops-port` and `careevo-attribution` skills.
- `portals.yml` seeding stays **write-once**. An existing `.data/career-ops/portals.yml` is never replaced, so adopting the new config requires deleting it by hand. That is Task 4 Step 2, not a code change.
- **No** database schema change, no migration, no `drizzle/` file in this plan.
- `js-yaml` is a **devDependency** (`package.json`). Production code under `src/` must never import it. Only `*.test.ts` may.
- Business-logic identifiers stay Indonesian (matching `faset-inbox.ts`, `inbox-list.tsx`). Infra/UI stays English.
- `location_filter` supports exactly five fields — `allow`, `always_allow`, `block`, `block_hard`, `strict`. Any other name is silently ignored by `engine/scan.mjs`.
- Do **not** set `strict: true` on `location_filter`. It fails *closed* and would drop every Glints row that carries no location. The existing guard in `portals-careevo.test.ts` asserts `strict` is `undefined`; keep it.
- **Never commit `.data/`.** It is gitignored (`.gitignore:47`). Every path Task 4 touches lives there.
- The scan has a **hard 5-minute timeout** (`src/lib/career-ops/tracker.ts:126`, `timeoutMs: 5 * 60_000`). Adding board entries multiplies requests: `entries × pageSize × maxPages`. This plan keeps `pageSize: 30` and `maxPages: 3` exactly as they are — no depth change — so the added work is linear in entries only.
- Each task ends with a commit. The working tree already contains unrelated edits; stage only the files a task names.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/jobs/faset-inbox.ts` | Facet derivation. Part A adds `company` to `BarisFaset` and a new pure `daftarPerusahaan()`. |
| `src/lib/jobs/faset-inbox.test.ts` | Guards the facet. Part A adds two `it` blocks for `daftarPerusahaan`. |
| `src/components/features/jobs/permukaan-cari-loker.tsx` | Presentation. Part A adds the company `<select>` to `PanelCariLoker` and a third tile to `RingkasanLoker`. |
| `src/components/features/jobs/inbox-list.tsx` | Wires state to the two components above. Part A adds the `perusahaan` filter state and its predicate. |
| `src/lib/career-ops/portals-careevo.yml` | **Data only.** Part B adds 15 `job_boards` entries (Task 2) and N verified `tracked_companies` (Task 3). |
| `src/lib/career-ops/portals-careevo.test.ts` | Guards on that data file. Part B adds board-shape and company-floor guards. |
| `docs/local-db.md` | Operator runbook. Part B's Task 5 records the new measured numbers. |

**Part A is already written but uncommitted.** `git diff --stat` shows `faset-inbox.ts`, `faset-inbox.test.ts`, `inbox-list.tsx`, and `permukaan-cari-loker.tsx` as modified. Task 1 verifies that work and commits it; it does not re-implement it. Parts A and B are independent — a reviewer can accept Part A and reject Part B without conflict.

---

## Task 1: Commit the employer count and the employer filter

The code for this task is already in the working tree (written this session, verified by `tsc` + `eslint` + 244 passing tests). This task confirms it against the current file contents, then commits **only those four files**.

**Files:**
- Modify (already modified, uncommitted): `src/lib/jobs/faset-inbox.ts`
- Modify (already modified, uncommitted): `src/lib/jobs/faset-inbox.test.ts`
- Modify (already modified, uncommitted): `src/components/features/jobs/inbox-list.tsx`
- Modify (already modified, uncommitted): `src/components/features/jobs/permukaan-cari-loker.tsx`

**Interfaces:**
- Consumes: `InboxJob` from `@/lib/career-ops` (unchanged), `verdictBadge` from `./cari-lowongan-ui` (unchanged).
- Produces: `daftarPerusahaan(baris: BarisFaset[]): string[]`; `BarisFaset` gains `company`; `RingkasanLoker` gains a required `jumlahPerusahaan: number` prop; `PanelCariLoker` gains `perusahaan`, `onPerusahaan`, `pilihanPerusahaan` props. Task 2-5 do not touch these, but they must stay compilable.

- [ ] **Step 1: Confirm the facet function exists exactly as specified**

Run:

```bash
grep -n "export function daftarPerusahaan" src/lib/jobs/faset-inbox.ts
grep -n 'Pick<InboxJob, "url" | "role" | "location" | "company">' src/lib/jobs/faset-inbox.ts
```

Expected: both lines print. The second is the `BarisFaset` declaration. If either is missing, the working tree was reverted — re-apply the two edits described in this task's Interfaces block before continuing.

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

- [ ] **Step 6: Commit only the four files**

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

## Task 3: Widen the verified employer list

Nine `tracked_companies` ship today. `engine/discover-ats.mjs` resolves a company name to a scannable ATS board by probing the public APIs the engine already supports, with zero tokens. This task uses it to grow the list to at least 20 verified Indonesian employers.

**Files:**
- Create: `/tmp/opencode/perusahaan-id.yml` (scratch input, not committed)
- Create: `/tmp/opencode/portals-scratch.yml` (scratch copy, not committed)
- Modify: `src/lib/career-ops/portals-careevo.yml` (append to `tracked_companies:`)
- Modify: `src/lib/career-ops/portals-careevo.test.ts` (raise the company floor)

**Interfaces:**
- Consumes: `engine/discover-ats.mjs` (invocation contract in its header, lines 1-30), `CAREER_OPS_PORTALS` env var (the script's own portals-path override).
- Produces: nothing consumed by later tasks; the shipped config is the deliverable.

- [ ] **Step 1: Write the candidate input file**

`engine/discover-ats.mjs:18` documents the input shape as `companies: [{name, slug?, website?}]`. Create `/tmp/opencode/perusahaan-id.yml`:

```yaml
companies:
  - name: Sirclo
    website: https://www.sirclo.com
  - name: Mekari
    website: https://mekari.com
  - name: Xendit
    website: https://www.xendit.co
  - name: KoinWorks
    website: https://koinworks.com
  - name: Privy
    website: https://privy.id
  - name: Bibit
    website: https://bibit.id
  - name: Flip
    website: https://flip.id
  - name: Bareksa
    website: https://www.bareksa.com
  - name: Pintu
    website: https://pintu.co.id
  - name: Ruangguru
    website: https://www.ruangguru.com
  - name: Zenius
    website: https://www.zenius.net
  - name: Alodokter
    website: https://www.alodokter.com
  - name: eFishery
    website: https://efishery.com
  - name: Sayurbox
    website: https://www.sayurbox.com
  - name: Qoala
    website: https://www.qoala.app
  - name: PasarPolis
    website: https://pasarpolis.io
  - name: Lemonilo
    website: https://lemonilo.com
  - name: Ninja Xpress
    website: https://www.ninjaxpress.co
  - name: Waresix
    website: https://waresix.com
  - name: Shipper
    website: https://shipper.id
  - name: Deliveree
    website: https://www.deliveree.com
  - name: Paper.id
    website: https://www.paper.id
  - name: Majoo
    website: https://majoo.id
  - name: Talenta
    website: https://www.talenta.co
  - name: Jurnal
    website: https://www.jurnal.id
  - name: GajiGesa
    website: https://gajigesa.com
  - name: Wagely
    website: https://wagely.io
  - name: Lifepal
    website: https://lifepal.co.id
  - name: Rey
    website: https://www.rey.id
  - name: Fuse
    website: https://fuse.co.id
  - name: Igloo
    website: https://www.iglooinsure.com
  - name: Super
    website: https://superapp.id
  - name: Fore
    website: https://fore.coffee
  - name: Dagangan
    website: https://dagangan.co.id
  - name: TaniHub
    website: https://www.tanihub.com
  - name: Aruna
    website: https://aruna.id
  - name: SIRCLO Store
    website: https://www.sirclostore.com
  - name: Midtrans
    website: https://midtrans.com
  - name: Bank Jago
    website: https://www.jago.com
  - name: Amar Bank
    website: https://www.amarbank.co.id
```

- [ ] **Step 2: Run the resolver in preview mode**

`engine/discover-ats.mjs:21` — `--in` without `--write` previews and writes nothing. Run:

```bash
node engine/discover-ats.mjs --in /tmp/opencode/perusahaan-id.yml --summary
```

Expected: a human-readable table. Companies whose board resolves print a `careers_url`; the rest are flagged unresolved (JS-rendered careers pages, non-standard slugs, or Workday without a hint). **Nothing is written.** Note the resolved count — that is the denominator for Step 5.

- [ ] **Step 3: Verify every resolved URL actually answers**

For each `careers_url` the summary printed, confirm it is live:

```bash
for u in "<careers_url_1>" "<careers_url_2>"; do
  printf "%s -> " "$u"
  curl -sS -o /dev/null -w "%{http_code}\n" -L --max-time 20 -A "Mozilla/5.0" "$u"
done
```

Expected: `200` for each. **Drop any URL that is not `200`** — a `404` or a redirect to the homepage is not a board and the scanner will follow it forever.

- [ ] **Step 4: Resolve into a scratch copy, then diff**

`discover-ats.mjs --write` splices entries into the portals file named by `CAREER_OPS_PORTALS`. Point it at a scratch copy so the tracked file is only changed by hand:

```bash
cp src/lib/career-ops/portals-careevo.yml /tmp/opencode/portals-scratch.yml
CAREER_OPS_PORTALS=/tmp/opencode/portals-scratch.yml node engine/discover-ats.mjs --in /tmp/opencode/perusahaan-id.yml --write
diff src/lib/career-ops/portals-careevo.yml /tmp/opencode/portals-scratch.yml
```

Expected: a unified diff whose added lines are `- name:`, `careers_url:`, and `enabled: true` triples under `tracked_companies:`. Comments and formatting of the rest are preserved (the script does a text splice, not a re-serialize).

- [ ] **Step 5: Paste the resolved entries into the tracked config**

In `src/lib/career-ops/portals-careevo.yml`, append the new triples to the end of the `tracked_companies:` list — after the last existing entry, whose `name` is `Julo` and whose `careers_url` is `https://careers.smartrecruiters.com/Julo`. Keep the same shape as the existing entries:

```yaml
  - name: <company name from the diff>
    careers_url: <verified url from the diff>
    enabled: true
```

Also extend the `# VERIFIED` comment block above the list with one line recording this pass:

```yaml
# VERIFIED 2026-09-29 — second discovery pass; every careers_url below was
# produced by `node engine/discover-ats.mjs --in perusahaan-id.yml --summary`
# and independently re-checked with curl -L (HTTP 200, no redirect away from
# the board). Companies whose careers page is bespoke (no engine provider)
# were dropped by the resolver, not by hand.
```

Keep every existing entry. The list must end with **at least 20 enabled companies** (9 today + at least 11 resolved). If discovery resolves fewer than 11, the task is **incomplete** — report the resolved count and stop; do not pad the list with invented URLs.

- [ ] **Step 6: Write the failing company-floor guard**

In `src/lib/career-ops/portals-careevo.test.ts`, replace the existing guard:

```typescript
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
```

with:

```typescript
  it("membawa perusahaan yang bisa dipindai", () => {
    // ENABLED companies, not merely present ones — scan.mjs walks `enabled`
    // entries, so switched-off companies are the same zero as none, which is
    // the mirror image of the board guard above. The floor rose from 8 to 15
    // when the second discovery pass shipped at least 20; five entries of
    // headroom means a regression that drops a handful is caught, while a
    // deliberate single removal is not.
    const aktif = daftarPapan(config().tracked_companies).filter(
      (c) => c.enabled === true,
    );
    expect(aktif.length).toBeGreaterThanOrEqual(15);
  });
```

- [ ] **Step 7: Run the tests**

Run: `npx vitest run src/lib/career-ops/portals-careevo.test.ts src/lib/career-ops/portals.test.ts`

Expected: `11 passed` and `4 passed`. If the company guard fails, the paste in Step 5 did not land — re-check it.

- [ ] **Step 8: Prove the company guard bites**

Same rule as Task 2 Step 7: the Task 3 edits are **not committed yet**, so back up with `cp` rather than `git checkout`. Flip every `enabled: true` to `false` so both the company floor and the board floor lose their entries:

```bash
cp src/lib/career-ops/portals-careevo.yml /tmp/opencode/portals-careevo.bak.yml
sed -i 's/^    enabled: true$/    enabled: false/' src/lib/career-ops/portals-careevo.yml
npx vitest run src/lib/career-ops/portals-careevo.test.ts
```

Expected: FAIL on `"membawa perusahaan yang bisa dipindai"` (enabled companies drop from 20+ to 0) and on `"punya minimal 27 papan aktif"` (the same `sed` clears the boards). Restore and confirm green:

```bash
cp /tmp/opencode/portals-careevo.bak.yml src/lib/career-ops/portals-careevo.yml
rm -f /tmp/opencode/portals-careevo.bak.yml
npx vitest run src/lib/career-ops/portals-careevo.test.ts
```

Expected: `11 passed`. Confirm the restore is byte-exact — the count of `enabled: true` lines must be back to boards plus companies:

```bash
grep -c '^    enabled: true$' src/lib/career-ops/portals-careevo.yml
```

Expected: `27 + <jumlah perusahaan>`, where `<jumlah perusahaan>` is the number Step 5 pasted (at least 20). So on a full 20-company paste that is `47`. If the count is lower, the restore failed; re-run Step 5's paste before committing.

- [ ] **Step 9: Commit**

```bash
git add src/lib/career-ops/portals-careevo.yml src/lib/career-ops/portals-careevo.test.ts
git commit -m "feat(career-ops): perluas daftar perusahaan Indonesia jadi 20+

Pass discovery kedua lewat engine/discover-ats.mjs, yang mencoba board ATS
publik (Greenhouse, Ashby, Lever, Workable, SmartRecruiters, Recruitee,
BambooHR, Breezy, Pinpoint, Rippling, Join) tanpa token. Setiap careers_url
yang lolos diverifikasi curl -L HTTP 200 sebelum masuk.

Perusahaan dengan careers page bespoke (tanpa provider engine) dibuang oleh
resolver, bukan oleh tangan: scan.mjs akan melewatinya diam-diam sebagai
no-provider.

Penjaga lantai perusahaan dinaikkan dari 8 ke 15, dengan 20+ yang dikirim.
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

- `boards` is **27** (was 12) — the single most important number in this task
- `companies` is **20 or more** (was 9)
- `errors` is low; Glints contributes `auth` failures and that is expected
- `new_added` is greater than `0`

**If `boards` is still `12`, the new config was not read.** Re-check Step 3. If the action reported a timeout, the 5-minute ceiling was hit — report it and revert Task 2's extra entries rather than shipping a scan that cannot finish.

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

Expected: an Indonesian-location count far above `1` (the pre-change corpus had exactly one Indonesian row out of 486), a total row count above the pre-change `257`, and a distinct-employer count above the pre-change `181`.

Record all three numbers plus the `boards`/`companies`/`new_added` receipt values — Task 5 quotes them verbatim.

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
`src/lib/career-ops/portals-careevo.yml`: 27 entri papan aktif (Jobstreet,
Kalibrr, dan Dealls — masing-masing delapan keluarga peran — plus tiga Glints
yang diblokir WAF), 20+ perusahaan terlacak, dan 14 kota dalam
`location_filter`. Bila berkas Careevo tidak ada, ia jatuh ke
`engine/templates/portals.example.yml`. `engine/` sendiri tidak pernah diubah —
hanya berkas mana yang disalin yang berubah.
```

- [ ] **Step 2: Replace the ceiling arithmetic with the measured numbers**

Find the section headed `### Batasnya, dan mengapa itu bukan cakupan nasional` and replace its bullet list with the Task 4 measurements. Use the real numbers, in this shape:

```markdown
### Batasnya, dan mengapa itu bukan cakupan nasional

Batas-batas ini harus dibaca apa adanya, bukan sebagai jangkauan pasar:

- Pindai bersih terakhir menambah **<new_added>** baris — angka hasil ukur,
  bukan perkiraan, dan sudah sesudah `title_filter` serta `location_filter`
  menyisir. Korpus di disk: **<total>** baris, **<perusahaan>** perusahaan
  berbeda, seluruhnya Indonesia.
- Dua puluh tujuh entri papan memberi batas mentah `27 x pageSize 30 x maxPages 3
  = 2.430`. Karena Glints tidak menjawab, yang benar-benar menyumbang paling
  banyak `24 x 90 = 2.160`.
- `pageSize` dan `maxPages` sengaja tidak dinaikkan. Batas per pindai naik
  secara linear terhadap jumlah entri, dan pindai punya timeout 5 menit di
  `src/lib/career-ops/tracker.ts`. Menaikkan kedalaman halaman akan
  mengalikannya lagi di atas itu.
- Angka terukur pada <tanggal>: **<total> baris, <perusahaan> perusahaan
  berbeda** — naik dari 257 baris / 181 perusahaan. Jadi ini **bukan cakupan
  nasional**, dan copy UI tidak boleh menjanjikan sebegitu. Frasa seperti
  "ribuan lowongan tech Indonesia" tidak didukung bukti yang ada sekarang.
```

Replace every `<placeholder>` with the Task 4 number. Do not leave an angle-bracket placeholder in the committed file.

- [ ] **Step 3: Verify no placeholder survived**

```bash
grep -nE "<[a-z_]+>" docs/local-db.md && echo "PLACEHOLDER LEFT" || echo "clean"
```

Expected: `clean`.

- [ ] **Step 4: Commit**

```bash
git add docs/local-db.md
git commit -m "docs(local-db): angka pindai setelah perluasan sumber

Memperbarui §8 dengan jumlah papan aktif (27), perusahaan terlacak (20+),
dan batas mentah per pindai (2.430 teoretis, 2.160 efektif karena Glints
diblokir WAF), plus angka terukur dari pindai bersih terakhir.
"
```

---

## Self-Review

**Spec coverage**

| Spec / request item | Task |
|---|---|
| "tampilkan jumlah perusahaan" (summary tile) | Task 1 (`RingkasanLoker` third tile) |
| "tambah button filtering" (employer select) | Task 1 (`PanelCariLoker` company select) |
| "perbanyak sumber scan" — more keyword families | Task 2 |
| "perbanyak sumber scan" — more employers | Task 3 |
| Evidence the widening worked | Task 4 |
| Recorded ceiling, not a national-coverage claim | Task 5 |
| `engine/**` untouched | Global Constraints; no task edits it |
| `location_filter` five-field limit; no `strict` | Global Constraints; existing guard kept |
| Write-once seed trap | Task 4 Step 2-3, documented in Task 5 |
| 5-minute scan timeout | Global Constraints; Task 2 Step 5 keeps page depth fixed |

No gaps.

**Placeholder scan** — one intentional, in Task 5 Step 2: the `<new_added>` / `<total>` / `<perusahaan>` / `<tanggal>` tokens are filled from Task 4's measurements, and Step 3 is a hard gate that fails if any survive. Task 3 Step 5 names the exact paste shape and its `enabled: true` requirement, and states the incompleteness condition rather than leaving a "paste here" comment. Every other code and YAML block is complete and runnable.

**Type consistency**

- `daftarPerusahaan(baris: BarisFaset[]): string[]` — declared in Task 1, consumed by `inbox-list.tsx`'s `pilihanPerusahaan` memo and `jumlahPerusahaan`. Consistent.
- `BarisFaset` gains `company` in Task 1; `Pick<InboxJob, "url" | "role" | "location" | "company">` matches `InboxJobShape.company` (`string`, required) in `src/lib/career-ops/pipeline-table.ts:19`. The test helper `baris()` in `faset-inbox.test.ts` supplies `company: "Contoh Perusahaan"` so the required field is satisfied.
- `RingkasanLoker` gains required `jumlahPerusahaan: number`; its only call site is `inbox-list.tsx:213`, updated in the same task.
- `PanelCariLoker` gains `perusahaan: string`, `onPerusahaan: (next: string) => void`, `pilihanPerusahaan: readonly string[]`; its only call site is `inbox-list.tsx:193-202`, updated in the same task.
- `papanAktif(): Papan[]` — declared in Task 2 Step 2, used by all four new guards in Steps 3. Consistent.
- `Papan` fields added in Task 2 Step 1 (`name`, `provider`, `pageSize`, `maxPages`, `searchKeywords`) are exactly the fields the Step 3 guards read. `daftarPapan` already exists and returns `Papan[]`.

One cross-document check worth recording: the spec used `T1`-`T6` and `G1`-`G5` for findings and failure modes; this plan references `T1` (two dead boards) and the `G2`-style Glints WAF failure by name, so the two documents cross-reference correctly.
