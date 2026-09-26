# Plan: job search & CV matching di Careevo

Status: plan, belum diimplementasikan. Analisis upstream selesai (3 subagent:
scanner, web read layer, provider system).

## Masalah yang harus diperbaiki

Tiga hal, diverifikasi bukan dikira:

1. **Tidak ada search yang terlihat.** `engine/scan-ats-full.mjs` benar-benar
   menembak internet (50.170 perusahaan, 6 dataset ATS), tapi hasilnya ditulis
   ke `data/pipeline.md` dan **tidak ada kode pun di `src/` yang membacanya**.
   Tombol di dashboard melaporkan angka ke void.
2. **Scanner yang dipakai salah.** `scan-ats-full.mjs` adalah *reverse*-ATS
   (menggayur 50k perusahaan, didesain untuk pasar AS). Careevo butuh
   *forward* scanner `scan.mjs` — 99 provider termasuk **glints** dan
   **jobstreet** (Indonesia), 202 entry portal preset, dan diagnostik
   `data/scan-runs.tsv` dengan **19 kolom counter per-filter**.
3. **Matching berjalan tapi salah orang.** `src/actions/evaluasi.ts:21`
   mengimpor `profile` dari `@/lib/fixtures` → skor dihitung terhadap
   "Budi Santoso" hardcoded. CV user asli tidak pernah masuk prompt. Ini
   satu-satunya fitur berbasis-model di repo yang tidak memanggil
   `getProfile(session.email)`; 5 fitur lain sudah benar.

## Temuan yang menentukan desain

Dari `career-ops/web/AGENTS.md`:

> Orchestrate the core; never reimplement it. … A second implementation of the
> same rule is how the two halves start disagreeing, and the disagreement is
> always silent.

> A missing file is not a malformed file.

Dari `career-ops/AGENTS.md`:
- TSV tracker addition **wajib** menulis header row (`#3517`) — sudah kita
  lakukan di `src/lib/career-ops/report.ts`.
- `applications.md` **tidak boleh** diedit untuk menambah baris — harus lewat
  `merge-tracker.mjs`. Sudah kita lakukan.
- Status hanya lewat `set-status.mjs`. Sudah kita lakukan.
- Tidak ada yang pernah di-submit otomatis. Sudah kita lakukan.

Artinya: **write path sudah benar dan tidak boleh diubah.** Yang hilang murni
read path + UI. Jadi fase pertama adalah menyalin reader upstream, bukan
menulis ulang.

## Fase

### Fase 1 — Read layer (copy verbatim, tanpa adaptasi)

Salin apa adanya, hanya ganti ekstensi ke `.ts` dan hapus JSDoc yang menyebut
`node --test`:

| Dari | Ke | Lines |
|---|---|---|
| `career-ops/web/src/lib/pipeline-table.mjs` | `src/lib/career-ops/pipeline-table.ts` | 77 |
| `career-ops/web/src/lib/pipeline-sort.mjs` | ikut di file yang sama | 10 |

`pipeline-table.mjs` sudah murni (teks masuk, baris keluar; tanpa fs, tanpa
Next) dan **sudah ditulis untuk situations yang persis kita hadapi**:
- `splitLines` toleran CRLF — komentar di sana menjelaskan bahwa `.data/`
  gitignored sehingga policy `eol=lf` tidak menjangkau `pipeline.md` milik user.
- `LABELED_SEGMENT` — segmen `posted:` / `trust:` / `note:` hanya dibaca dari
  index ≥ 3, supaya tidak tertukar dengan `location`/`compensation`.

Lalu tambah di `src/lib/career-ops/`:

- `bacaInbox()` — `parseInbox(readFileSync(pipeline.md))`
- `bacaTanggalScan()` — `url → first_seen` dari `data/scan-history.tsv`,
  mengikuti `readScanDates()` upstream: simpan `first_seen` **paling awal**,
  file hilang = map kosong (bukan error), baris rusak = di-skip.
- Tambah `PIPELINE_SKELETON` dan header `scan-history.tsv` ke `bootstrap.ts`
  (keduanya hanya ditulis bila belum ada, seperti sekarang).

Tambah `bacaInbox` ke `index.ts`. Test: fixture `pipeline.md` yang memuat semua
bentuk kolom (3/4/5 kolom, label, `[!]` error, CRLF) + parity test yang
menjalankan `.mjs` asli dan hasil `.ts` dibandingkan byte.

**Selesai kalau:** scan → `bacaInbox()` mengembalikan baris yang sama. Ini
sudah bisa dibuktikan sekarang, karena `pipeline.md` yang saya hasilkan
sebelumnya berisi 3 lowongan asli.

### Fase 2 — Halaman inbox (potongan terkecil yang terlihat user)

`src/app/(app)/loker/inbox/page.tsx` — server component, auth-gated oleh
`(app)` layout, konsisten dengan `AppShell` seperti `/loker/[id]`.

- `InboxJob` type dari upstream: `{ url, company, role, location?,
  compensation?, done, postedAt? }`
- Urutkan `postedAt` terbaru dulu ( Client-side, seperti `inbox-triage.tsx`
  upstream yang melakukan facet/filter di client)
- Tiap baris: perusahaan · role · lokasi · kompensasi · umur posting · tombol
  "Buka lowongan" (eksternal, `rel="noopener"`)
- Empty state: "Belum ada hasil scan. Jalankan scan dulu." + tombol scan
- **Tidak** ada aksi tulis di fase ini. Read-only on purpose, sesuai aturan
  web/AGENTS.md.

Styling: bukan copy komponen upstream (740 lines `inbox-triage.tsx` +
`shortlist-tray.tsx` + `facet-chips.tsx` itu Next Router + shadcn miliknya).
Copy **konsep** dan tulis ulang dengan `card` / `list-app` / `StatusBadge` yang
sudah ada di `globals.css`. Yang dicopy verbatim hanya logika murni.

### Fase 3 — Ganti scanner ke `scan.mjs`

- `jalankanScan()` di `src/lib/career-ops/tracker.ts` diarahkan ke
  `scan.mjs --json`, bukan `scan-ats-full.mjs`.
- Flag: `--since <days>`, `--json`, `--dry-run`, `--quiet`, `--company`.
  (`--verify` / `--headed-fallback` butuh Playwright — **tidak** kita wired.)
- `portals.yml` di `bootstrap.ts` diganti: seed dari
  `engine/templates/portals.example.yml` (202 entry), bukan filter lokasi
  Indonesia buatan saya yang menghasilkan 0 hasil.
  - Yang wajib dihapus: `location_filter.allow` yang mengunci Indonesia —
    itu yang membuat scan 0.
  - Yang ditambahkan: `job_boards` entry untuk glints + jobstreet.
- `data/scan-runs.tsv` dibaca untuk menampilkan **kenapa 0**: 19 counter
  (`filtered_title`, `filtered_location`, `filtered_posting_age`,
  `filtered_salary`, `filtered_content`, `dupes`, …). Tanpa ini user hanya
  lihat "0 lowongan" dan tidak tahu penyebabnya.

**Selesai kalau:** `node engine/scan.mjs --json` dengan config kita
menghasilkan `postingsKept > 0` ke `pipeline.md`, dan halaman Fase 2
menampilkannya.

### Fase 4 — Promosi inbox → tracker

Tombol "Nilai & lacak" pada baris inbox:
1. `archive-posting.mjs` / tulis TSV `batch/tracker-additions/` dengan header
2. `merge-tracker.mjs`
3. evaluasi A–H (Fase 5) → report
4. baris tracker muncul di `/loker/[id]`

Status write tetap `set-status.mjs`. Tidak ada apply otomatis — link eksternal
dibuka manual, sama seperti sekarang.

### Fase 5 — Matching pakai CV user (jalur terpisah, independent)

Tidak bergantung Fase 1–4, bisa dikerjakan kapan saja. Ini yang bikin
skor sekarang tidak bisa dipercaya.

- `src/lib/career-ops/profil-user.ts`: bangun `ProfileFixture` dari
  `Resume` (`src/lib/resume`) + `OnboardingProfile`
  (`getProfile(session.email)`) + badge verifikated.
  - `pengalaman` → `works`
  - `skill` → masuk ke blok `bukti` / prompt keywords
  - `badges` → `badges` (boleh kosong, dan itu jujur)
- `src/actions/evaluasi.ts`: `profile` fixture → data user, dengan fixture
  hanya sebagai fallback kalau user belum punya resume.
- `prompt.ts`: tampilkan sumber mana yang dipakai, supaya panel tidak
  mengklaim "Kecocokan dengan CV" kalau yang dinilai cuma badge.
- Test: `profile` user A tidak lagi bocor ke prompt user B.

**Keputusan yang perlu diambil user:** sumber kebenaran skor —
resume (real, self-reported) atau badge (HMAC-verified, tapi cuma untuk yang
sudah aktif di platform). Rekomendasi: resume sebagai dasar, badge sebagai
bukti tambahan, dan panel menyatakan keduanya.

## Yang sengaja tidak dikerjakan

- `--verify` / `--headed-fallback` (butuh Playwright, sudah ada di SiJago
  mungkin — tapi itu pekerjaan sendiri).
- 99 provider. glints + jobstreet dulu; sisanya pakai preset 202 entry.
- `discover-ats.mjs`, `scan-hn.mjs`, `scan-interamt.mjs`, `stats.mjs`,
  `funding discovery`, SerpApi.
- Menyalin komponen UI upstream apa adanya ( Next Router + shadcn theirs).

## Risiko

| Risiko | Mitigasi |
|---|---|
| Parser `.ts` melenceng dari `.mjs` | parity test yang menjalankan kedua implementasi pada fixture yang sama |
| `scan.mjs` 4012 bars, contract bisa berubah | orphan test: `--json` receipt di-assert di test; upgrade engine jadi failure yang terlihat, bukan senyap |
| glints/jobstreet breakpoint (endpoint undocumented) | `scan-runs.tsv` counter `errors` + `portal-health.tsv` ditampilkan; provider gagal = 0 baris, bukan crash |
| Data root `.data/career-ops` tidak writable di serverless | sudah ada `CAREERS_DATA_DIR`-style escape lewat `dataRoot()` env override |
