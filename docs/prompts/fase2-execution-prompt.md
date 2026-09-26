# Prompt Eksekusi Fase 2 — Learning evidence: enrollment, progress, dan assessment (M2)

> Salin blok di bawah `---` ke sesi Claude Code baru untuk melanjutkan.
> File ini referensi; bukan kode.

---

Lanjutkan eksekusi `docs/backend-production-plan.md` di repo careevo (Next.js 16, TypeScript, Tailwind v4, Vitest node-only). Target: **Fase 2 — Learning evidence: enrollment, progress, dan assessment** (milestone M2), sesuai §7 (Fase 2) plan.

## Konteks (SUDAH selesai — jangan dikerjakan ulang)

- **Fase 0 (M0)**, **Fase 1 (M1)**, dan **Fase 1A (M1A)** selesai dan ter-merge ke `origin/main`.
- `docs/backend-production-plan.md` sudah di `main`; baca §7 (Fase 2), §3 (urutan), §2.2 (batasan).
- **ADR 0001** (`docs/adr/0001-topologi-deployment-produksi.md`): Vercel + VPS + Upstash.
- **ADR 0002** (`docs/adr/0002-database-orm-postgres.md`): Drizzle + local Docker Postgres.
- Fondasi DB sudah ada: `docker-compose.yml` (Postgres 16 dev), `src/lib/db/{schema,client,migrate}.ts`, `drizzle/` (migration 0000 + 0001), `npm run db:migrate` / `db:generate` / `test:db`, `vitest.integration.config.mts`.
- Kontrak identity Fase 1: `SessionPrincipal` (`src/lib/auth/principal.ts`), `gateStaff()`/`gateAdmin()`, `getSession()` adapter database.
- Transactional outbox Fase 1A: `tulisOutbox(tx, ...)` / `jalankanDenganOutbox`, worker claim/lease, handler registry (`auth.registered → audit`), replay ber-audit, dead-letter fail-closed (`handler_tidak_terdaftar`). Lihat `src/lib/outbox/` dan `docs/outbox-worker.md`.
- Sistem kursus saat ini: course catalog dari `data/courses.json` + fixtures, modul derived (`modulKursus()` — 5 modul positional) vs stored (`Course.modul`), resolver tunggal `modulUntuk()`/`modulUntukSumber()` di `src/lib/courses/modul-resolver.ts`, quiz bank reusable di `data/kuis.json`, enrollment cookie `ls_enroll`.
- **`kurikulum.ts`, `blok.ts`, `halaman.ts`, `kuis.ts`** adalah client-safe dan HARUS tetap murni — jangan import DB/`node:fs` ke situ.

## Tugas

Bangun learning evidence per §7 plan. Lingkup utama:

### A. Prasyarat — ADR assessment immutable (WAJIB sebelum verified grading)

Pilih satu dari dua opsi di plan §7 (publication version vs snapshot per attempt), tulis ADR singkat di `docs/adr/`, lalu implementasikan. Kuncinya: edit/delete quiz setelah attempt tidak boleh mengubah outcome historis.

### B. Schema dan migration

Buat schema PostgreSQL untuk `enrollments`, `module_progress`, `learning_runs`, `learning_events`, `quiz_attempts`, `quiz_attempt_answers`, dan `course_completions` sesuai §7. Tambahkan lewat migration baru (jangan ubah migration yang ada di tempat). Pertahankan adapter agar derived module ID dan stored module ID dapat dipakai bersama tanpa menyimpang dari `modulUntuk()`.

### C. LearningService dan repository transactional

- Route/action hanya mengurai input, mengambil principal, dan mendelegasikan ke service.
- Enrollment: migrasikan `ls_enroll` → `enrollments` + `module_progress`. Unique constraint/upsert untuk klik berulang dan request paralel.
- Learning run: migrasikan learning session file → `learning_runs` + `learning_events`. Preservasi invariant proof/session: sequence, expiry, checkpoint, pencegahan replay. Hindari scan direktori; query terindeks.
- Completion: policy completion per course/module, version policy, jalur completion `terverifikasi`/`informal`.

### D. Assessment verified vs practice

- Practice: tetap kirim result UI non-authoritative (seperti sekarang).
- Verified flow: server menerima jawaban, memuat quiz/question authoritative, hitung score server-side, simpan attempt/evidence dalam transaksi. Assessment definition snapshot/version immutable (ADR di atas).

### E. Migration/backfill cookie → database

- Baca enrollment cookie hanya dalam session pemilik setelah login.
- Filter module ID dengan `irisModulSelesai()`.
- Idempoten, catat jumlah record migrated/ignored.
- **Jangan** anggap score/evidence client legacy sebagai proof credential.

### F. Dashboard update

- Dashboard learner dan staff membaca repository database, bukan cookie/file performa.

## Keputusan yang sudah terkunci (JANGAN ditanyakan lagi)

- **ORM: Drizzle** (lanjut). Jangan tambah ORM kedua.
- **PostgreSQL: local Docker Postgres** untuk development.
- **`modulUntuk()`/`modulUntukSumber()`** tetap satu-satunya resolver modul. Jangan panggil `modulKursus()` langsung dari page/action baru.
- **`kurikulum.ts`, `blok.ts`, `halaman.ts`, `kuis.ts`** tetap client-safe — jangan import DB/`node:fs`.
- **Outbox**: alur bisnis baru yang membutuhkan event outbox wajib memakai `tulisOutbox`/`jalankanDenganOutbox` dalam transaksi yang sama.
- Nama fungsi business-logic tetap Indonesia, kode infra English (ikuti idiom file sekitar).

## Cara kerja (WAJIB diikuti)

- **Lanjutkan di branch `backend-production`** (sudah ada, tracking `origin/backend-production`). Jangan commit/push ke `main`.
- Commit per milestone/subtask yang selesai ke branch ini dan push sebagai checkpoint. PR ke `main` dibuat satu kali setelah **semua** fase selesai, bukan per fase.
- **Fan out subagent** (WAJIB) untuk task paralel independen; HANYA `model: "sonnet"` dan `model: "haiku"`. JANGAN `opus`.
- **Eksekusi bertahap**, urutan saran: (a) ADR assessment immutable; (b) schema + migration; (c) LearningService + enrollment repository; (d) learning run repository; (e) verified assessment + snapshot; (f) completion policy; (g) migration/backfill cookie; (h) dashboard update; (i) integration test.
- **Verifikasi di akhir saja**, setelah semua task selesai.

## Batasan non-negosiasi (plan §2.2 + AGENTS.md — jangan regresi)

- Setiap alur yang memakai writer transaksional wajib menulis event outbox dalam transaksi yang sama dengan perubahan bisnis. Untuk alur yang belum diintegrasikan, jangan commit bisnis lalu mengklaim event-nya ada.
- Payload outbox/log **ter-redact** dari secret dan PII yang tidak dibutuhkan handler — redact **sebelum** insert.
- Jangan import DB/`node:fs` ke komponen client atau ke `src/lib/courses/{kurikulum,blok,halaman,kuis}.ts`.
- Jangan `dangerouslySetInnerHTML` / HTML mentah.
- Score yang memengaruhi verified completion atau credential wajib dihitung/diotorisasi di server. Score client tidak boleh mengubah `course_completions` atau attestation.
- Baca skill area relevan di `.agents/skills/` (`careevo-review` minimal, sebelum commit).

## Acceptance criteria (§7 plan)

- Progress tampil konsisten lintas browser/device untuk user sama.
- Dua request completion paralel tidak menghasilkan double completion, double performance mirror, atau double credential eligibility.
- Module ID derived lama dan stored baru diselesaikan melalui resolver tunggal tanpa call `modulKursus()` langsung dari page/action.
- Nilai client tidak dapat mengubah score verified atau `course_completions` tanpa penilaian server-side.
- Expired/replayed learning run ditolak; event sequence tidak dapat dilompati.
- Edit/delete quiz, question, answer key, atau passing score setelah attempt tidak dapat mengubah snapshot, outcome, eligibility, review, atau credential historis.
- Integration test memakai Postgres; E2E mencakup enroll → module completion → quiz → completion pada dua session.

## Verifikasi akhir (setelah semua task selesai)

Jalankan `npm run check`, `npm run build`, lalu test integration (`npm run test:db` dengan Postgres dev menyala via `docker compose up -d postgres`). Laporkan hasil nyata (jumlah test, pass/fail, error teks jika gagal). Jangan klaim selesai tanpa evidence; jangan tinggalkan `test.skip`/`.only`/stub/TODO. Jika ada blocker, hentikan dan laporkan blocker eksplisit.

**Catatan atribusi:** commit tanpa co-author Claude — hanya nama user.
