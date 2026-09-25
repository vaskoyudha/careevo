# Prompt Eksekusi Fase 1A — Fondasi transactional outbox & worker (M1A)

> Salin blok di bawah `---` ke sesi Claude Code baru untuk melanjutkan.
> File ini referensi; bukan kode.

---

Lanjutkan eksekusi `docs/backend-production-plan.md` di repo careevo (Next.js 16, TypeScript, Tailwind v4, Vitest node-only). Target: **Fase 1A — Fondasi transactional outbox dan worker** (milestone M1A), sesuai §6 plan.

## Konteks (SUDAH selesai — jangan dikerjakan ulang)
- **Fase 0 (M0)** dan **Fase 1 (M1)** selesai dan ter-merge ke `origin/main` (PR #12).
- `docs/backend-production-plan.md` sudah di `main`; baca §6 (Fase 1A), §3 (urutan), §2.2 (batasan).
- **ADR 0001** (`docs/adr/0001-topologi-deployment-produksi.md`): Vercel + VPS + Upstash; worker Fase 1A direncanakan berjalan **di VPS yang sama** — VPS belum ada, jadi production tetap placeholder.
- **ADR 0002** (`docs/adr/0002-database-orm-postgres.md`): Drizzle + local Docker Postgres (satu ORM saja, tidak boleh dua).
- Fondasi DB sudah ada: `docker-compose.yml` (Postgres 16 dev), `src/lib/db/{schema,client,migrate}.ts`, `drizzle/` (migration ter-commit), `npm run db:migrate` / `db:generate` / `test:db`, `vitest.integration.config.mts`.
- Kontrak identity Fase 1 sudah ada: `SessionPrincipal` (`src/lib/auth/principal.ts`), `gateStaff()`/`gateAdmin()` dari principal DB (`src/lib/auth/authorization.ts`), `getSession()` adapter database.
- `src/lib/db/client.ts` menyediakan `getDb()`, `denganTransaksi(fn)` (helper transaksi), dan tipe `KoneksiDb` / `TransaksiDb`. `src/lib/auth/audit.ts` punya `catatAudit(tx, {...})` untuk menulis `audit_events`.

## Tugas
Bangun fondasi outbox/worker per §6. Target: perubahan bisnis + event outbox ditulis **dalam satu transaksi PostgreSQL**; worker minimal dengan claim/lease aman, retry, dead-letter, replay; idempotensi per sink; payload ter-redact.

**PLUS — tutup utang review Fase 1** (sudah dicatat di `docs/backend-production-plan.md` §6 "Utang dari review Fase 1"). Ini pekerjaan terpisah dari outbox dan boleh dikerjakan paralel oleh subagent lain:
1. **Rotasi sesi saat login** — teruskan `sessionLamaId` dari sesi aktif ke `masukPengguna`; tandai `rotated_at`; buat `cariSessionAktifByTokenHash` menolak sesi yang sudah `rotated_at`.
2. **Hapus penerbit-sesi tanpa verifikasi** — `terbitkanSessionUntukPrincipal` (`auth-service.ts`) dan `createSession` (`session.ts`) nol pemanggil; hapus sampai ada call site terverifikasi.
3. **Patok parameter Argon2id** — tambah `password.test.ts` yang menegaskan algoritma `$argon2id$` + parameter OWASP.
4. **Bootstrap admin terdokumentasi** — seed/CLI operator untuk provisioning admin pertama (tidak aktif otomatis di produksi).
5. (minor, opsional) migrasikan 3 call site `isStaffRole(session.role)` → `gateStaff()` berbasis `roles`; selaraskan normalisasi `z.email`; runbook rollback migration di `docs/local-db.md`.

## Keputusan yang sudah terkunci (JANGAN ditanyakan lagi, langsung pakai)
- **ORM: Drizzle** (lanjut). Jangan tambah ORM kedua, queue eksternal, atau broker baru.
- **PostgreSQL: local Docker Postgres** untuk development. Production tetap placeholder (VPS belum ada).
- **Worker untuk dev/local = script CLI** yang bisa dijalankan manual (mis. `npm run worker` via `tsx scripts/worker.ts`), BUKAN service eksternal/daemon. Catat bahwa di production worker berjalan di VPS yang sama (ADR 0001 §1.2), sebagai placeholder.
- **Idempotensi per sink tujuan** (email/audit/attestation/file-scan/notification), bukan hanya per event — event boleh retry, side effect tidak boleh dobel.
- Nama fungsi business-logic tetap Indonesia, kode infra English (ikuti idiom file sekitar).

## Schema minimum (§6) — tambahkan lewat migration baru, jangan ubah tabel yang ada di tempat
```
outbox_events
  id (uuid/bigserial), type, aggregate_type, aggregate_id,
  payload_redacted (jsonb), occurred_at, available_at,
  attempts (int, default 0), lease_owner nullable, lease_expires_at nullable,
  processed_at nullable, last_error_code nullable, idempotency_key unique
```

## Cara kerja (WAJIB diikuti)
- **Buat branch baru** dari `origin/main` (mis. `backend-production-fase1a`), jangan commit/push ke `main`. Jaga worktree bersih.
- **Fan out subagent** (WAJIB) untuk task paralel independen; HANYA `model: "sonnet"` (standar) dan `model: "haiku"` (lookup/perubahan kecil). JANGAN `opus`.
- **Eksekusi bertahap**, urutan saran: (a) schema outbox + migration + helper writer transaksional (`tulisOutbox` / service yang menulis bisnis + event dalam `denganTransaksi`); (b) worker claim/lease aman (claim via `UPDATE ... WHERE lease_expires_at IS NULL OR < now() RETURNING`, release saat selesai, recover lease kedaluwarsa); (c) registry handler per type + idempotency per sink + exponential backoff + max retry + dead-letter; (d) CLI replay/dead-letter ber-audit + redaction payload; (e) integration test.
- **Verifikasi di akhir saja**, setelah semua task selesai (bukan per task).

## Batasan non-negosiasi (plan §2.2 + AGENTS.md — jangan regresi)
- Event outbox wajib ditulis dalam transaksi yang **sama** dengan perubahan bisnis (pakai `denganTransaksi` / writer tunggal); jangan ada commit bisnis tanpa event yang diwajibkan, dan jangan ada event tanpa commit.
- Payload outbox/log **ter-redact** dari secret dan PII yang tidak dibutuhkan handler — redact **sebelum** insert, bukan belakangan.
- Jangan import DB/`node:fs` ke komponen client atau ke `src/lib/courses/{kurikulum,blok,halaman,kuis}.ts`.
- Jangan `dangerouslySetInnerHTML` / HTML mentah.
- Baca skill area relevan di `.agents/skills/` (`careevo-review` minimal, sebelum commit).

## Acceptance criteria (§6)
- Duplicate delivery, worker crash **setelah** claim, dan retry setelah timeout **tidak** menggandakan side effect (attestation/email/audit).
- Event yang gagal terminal dapat ditemukan dan direplay dengan actor/reason tercatat.
- Integration test membuktikan: transaksi gagal tidak meninggalkan event; business commit selalu punya event yang diwajibkan.
- Uji worker/claim membuktikan lease kedaluwarsa dapat dipulihkan aman oleh worker lain (tidak ada double-claim).

## Verifikasi akhir (setelah semua task selesai)
Jalankan `npm run check`, `npm run build`, lalu test integration/migration (`npm run test:db` dengan Postgres dev menyala via `docker compose up -d postgres`). Laporkan hasil nyata (jumlah test, pass/fail, error teks jika gagal). Jangan klaim selesai tanpa evidence; jangan tinggalkan `test.skip`/`.only`/stub/TODO. Jika ada blocker (mis. Docker tidak bisa dijalankan), hentikan dan laporkan blocker eksplisit.

**Catatan atribusi:** commit & PR tanpa co-author Claude — hanya nama user.
