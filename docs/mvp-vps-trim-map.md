# Peta Overengineering → Deploy MVP ke VPS

Tujuan: **satu VPS, satu proses `next start`, satu PostgreSQL, disk persisten** — cukup untuk demo lomba, bukan peluncuran SaaS. Dokumen ini memetakan bagian yang berlebihan untuk target itu, beserta solusinya, supaya kode yang tersisa **tidak jadi deadcode atau "kode parkir"**.

Referensi jalur kritikal MVP: **registrasi/login → onboarding → enroll/belajar/completion → buat & kirim karya → review → approve/reject → attestation → public verify.** Segala yang di luar jalur itu bersifat opsional dan dinilai di sini satu per satu.

---

## Prinsip keputusan

| Kategori | Arti | Contoh di repo |
|---|---|---|
| **Pertahankan** | Dipakai jalur kritikal atau melindungi integritas credential | secrets gate, attestation HMAC, CAS review, audit inline |
| **Parkir** | Kode valid, tapi tidak diaktifkan di MVP; biarkan utuh + diberi tanda, jangan dihapus sembarangan | Gemini/AI, loker, resume |
| **Buang/lepas** | Tidak ada pemakai nyata (deadcode), atau memaksa dependensi produksi yang tidak dibutuhkan MVP | dependency/adapter Upstash, worker outbox dari jalur request |

Kaidah utama: **jangan menambah kode baru untuk "memperbaiki" overengineering.** Solusinya hampir selalu *mengurangi* atau *mematikan*, bukan membangun lapisan lagi.

---

## Peta per bagian

| # | Bagian | Lokasi | Kenapa overengineering untuk VPS satu proses | Solusi | Status |
|---|---|---|---|---|---|
| 1 | **Upstash Redis rate limiter** | `src/lib/rate-limit/{upstash,index}.ts`, `src/instrumentation.ts` | Counter lintas-instance tidak diperlukan untuk MVP VPS satu proses. | Gunakan `buatPembatasMemori` di semua environment, hapus adapter Upstash dan dependency-nya, hapus startup gate. Limit dan kebijakan tidak berubah. Batasan: hanya antar-request di satu proses; deployment harus satu proses, restart menghapus bucket, dan ini bukan proteksi distributed. | **Selesai: memori satu proses** |
| 2 | **Transactional outbox + worker + replay + DLQ** | `src/lib/outbox/*`, `scripts/{worker,replay-outbox}.ts`, `docs/outbox-worker.md` | Sink audit satu database dapat ditulis dalam transaksi request; tidak ada sink eksternal aktif di jalur inti. | Submission/review/revoke dan registrasi menulis audit inline dalam transaksi bisnis; worker/outbox/scripts tetap tersedia untuk event lama dan kebutuhan berikutnya, tetapi tidak dipanggil oleh jalur request inti. | **Selesai: outbox terlepas dari jalur inti** |
| 3 | **`assertRateLimitSiapProduksi` + gate Upstash di `register()`** | `src/instrumentation.ts` | Gate rate limit tak lagi diperlukan. | `register()` hanya menjalankan `verifikasiKonfigurasiSecret()`. | **Selesai** |
| 4 | **Gemini / AI pipeline** | `@google/genai`, `src/lib/agents/{evaluasi,study-chat}`, `src/actions/{evaluasi,learning-chat}.ts` | Fitur skor-kecocokan loker & chat belajar. Sudah **fail-open** (tanpa `GEMINI_API_KEY` → fitur mati, tidak merusak jalur). Bukan bagian jalur MVP submission. | Biarkan fail-open; jangan deploy dengan `GEMINI_API_KEY`. Jangan hapus (nilai plus jika juri menilai), tapi jangan aktifkan. | **Parkir** |
| 5 | **Loker + scoring + jobs + sentinel** | `src/lib/{jobs,scoring}`, `src/lib/agents/{sentinel,navigator,socrates}.ts`, `src/app/**/loker/**` | Fitur job-board dengan audit A–H dan LLM. `navigator`/`socrates` adalah fallback deterministik murni. Di luar jalur MVP. | Parkir utuh. Tidak menyentuh. Hanya pastikan tidak ikut jadi gerbang startup. | **Parkir** |
| 6 | **Resume store (file-based), profile cookie, onboarding cookie** | `src/lib/{resume,profile,onboarding}` | Sistem penyimpanan paralel (`.data/`, cookie). Onboarding **dipakai jalur login**; resume/profile di luar jalur MVP. | Onboarding: pertahankan. Resume/profile: parkir — tidak di-deploy fiturnya, tidak dihapus. | **Pertahankan (onboarding)** / **Parkir (resume, profile)** |
| 7 | **Tabel DB deadcode / write-only** | `src/lib/db/schema.ts` | Beberapa tabel tidak punya pembaca di jalur request. Ini "kode parkir" di level schema. | Tidak mengubah schema atau migrasi dalam eksekusi MVP ini; menghapus tabel memerlukan keputusan migrasi terpisah agar schema dan database tidak menyimpang. | **Ditunda** |
| 8 | **Fixtures vs DB dual-source** | `src/lib/fixtures.ts`, `src/fixtures/profile.json` | Banyak halaman masih baca fixtures sementara jalur inti sudah DB. Menimbulkan dua sumber kebenaran (mis. `badges` ditulis ke DB tapi UI baca fixtures). | Untuk MVP: kunci jalur kritikal (auth/submission/review/verify) **DB-only**; halaman non-jalur boleh tetap fixtures. Dokumentasikan mana yang fixtures supaya tidak salah baca. | **Parkir** (dokumentasikan, jangan unifikasi) |
| 9 | **Undangan & RBAC staff penuh** | `src/lib/auth/invitation.ts`, `src/actions/staff.ts`, `staff_invitations` | Alur undang/redeem/cabut role staff lengkap. Untuk MVP, `bootstrap-admin.ts` sudah cukup menaikkan role. | Parkir. Gunakan `scripts/bootstrap-admin.ts --role verifikator`. Jangan bangun UI undangan. | **Parkir** |
| 10 | **Security headers, origin check, proxy** | `src/lib/security/headers.ts`, `src/lib/http/origin.ts`, `src/proxy.ts` | Kecil, bukan overengineering; melindungi credential dan mencegah SSRF/CSRF. | Pertahankan. | **Pertahankan** |

---

## Rincian bagian yang perlu disentuh

### 1–3. Rate limit & startup gate (satukan jadi satu perubahan)

Sekarang `src/instrumentation.ts` gagalkan `next start` bila Upstash belum diset. Ini sengaja untuk topologi multi-instance (ADR 0001), tapi salah untuk MVP satu proses.

**Implementasi minimum (tanpa membangun ulang):**

1. `resolvePembatas` memakai `buatPembatasMemori` pada semua `NODE_ENV`; kebijakan, limit, identifier, dan fail-open/closed tetap.
2. `assertRateLimitSiapProduksi` dan state/config gate dihapus.
3. `src/instrumentation.ts` hanya menjalankan `verifikasiKonfigurasiSecret()`.
4. Adapter `upstash.ts` dan dependency `@upstash/ratelimit` + `@upstash/redis` dihapus.

Batas deploy: satu proses server saja; bucket hanya berlaku antar-request dalam proses, restart menghapusnya, dan tidak melindungi deployment multi-instance secara distributed. Reverse proxy VPS harus menyediakan IP header tepercaya (`x-real-ip` hanya bila `CAREEVO_TRUST_REAL_IP_HEADER=1`). `next start` tidak memerlukan Redis.

### 2. Outbox → audit inline

Fakta: satu-satunya handler outbox yang terdaftar adalah **fanout audit** (`src/lib/outbox/handlers.ts:418-424`), semua sink = `SINK.audit`. Tidak ada email/scan/webhook nyata (sudah dicek — tidak ada `nodemailer`/`resend`/`clamav`/`s3` di src).

`src/lib/auth/audit.ts` menyediakan `catatAudit(tx, ...)` untuk menulis `audit_events` dalam transaksi yang sama. Koreksi temuan: sebelum perubahan ini, registrasi **belum** menggunakan audit inline; `daftarPengguna` menerbitkan `auth.registered` ke outbox, dan handler worker membuat `user.registered`. Registrasi kini menulis `user.registered` langsung di transaksi. Jalur request inti review kini mencatat audit inline setelah mutasi berhasil: submission create/submit/assign, review decision (+ event audit attestation terpisah saat approve), dan attestation revoke hanya saat compare-and-set menghasilkan baris.

Payload audit review kosong/redacted, tanpa konten submission, rubrik, rationale, signature, token, atau secret. Actor create/submit adalah learner; assign/review/revoke adalah staff. Outbox dan worker tetap ada untuk event lama/kebutuhan berikutnya; event `auth.registered` historis tidak dimigrasikan atau diubah.

### 7. Tabel DB yang bisa dilepas/dipertahankan

Dicek dari pemakaian nyata (bukan test):

| Tabel | Pemakaian non-test | Keputusan |
|---|---|---|
| `email_verification_tokens` | **hanya** `schema.ts` | **Deadcode** — lepas dari schema (atau parkir dengan catatan "belum ada fitur verifikasi email") |
| `password_reset_tokens` | **hanya** `schema.ts` | **Deadcode** — lepas |
| `attestation_events` | `repository.ts` hanya `.insert`, **tidak ada SELECT** | **Write-only** — untuk MVP cukup tabel `attestations` (read path verify). Parkir/lepas; jangan simpan data yang tidak pernah dibaca |
| `badges` | `repository.ts:255` insert; UI baca **fixtures**, bukan DB | **Kode parkir** — badge ditulis tapi tidak pernah tampil dari DB. Untuk MVP: biarkan tulis badge DB (bagian transaksi review) tapi sadari UI belum membacanya; catat sebagai gap, jangan buat reader baru |
| `staff_invitations` + `invitation.ts` | dipakai `actions/staff.ts` | Pertahankan (jalur staff) atau parkir; `bootstrap-admin.ts` cukup untuk demo |
| `learning_runs`, `learning_events`, `quiz_attempts*` | dipakai `actions/learning.ts`, `assessment.ts`, halaman integritas | Pertahankan — bagian completion terverifikasi & performa staf |

### 8. Fixtures vs DB

Jangan coba "unifikasi" sekarang (itu pekerjaan besar). Untuk MVP cukup **dokumentasikan peta sumber** di runbook:

- DB-only (jalur kritikal): `users`, `sessions`, `enrollments`, `module_progress`, `course_completions`, `submissions*`, `reviews`, `attestations`.
- Masih fixtures: `loker`, `dashboard` statistik, `belajar` katalog awal, `p/[username]` publik.
- Yang bahaya: `badges` (tulis DB, baca fixtures) — tandai agar tidak dikira sinkron.

---

## Prioritas eksekusi

1. **Selesai:** rate limiter in-memory untuk satu proses dan startup gate Upstash dihapus.
2. **Selesai:** audit registrasi/review inline di transaksi bisnis.
3. **Tidak dikerjakan dalam scope ini:** tabel schema (termasuk tabel yang tampak belum dipakai), runbook deploy lengkap, fixture/DB unifikasi. Tidak ada migrasi atau tabel yang dihapus.

---

## Yang **tidak** disentuh (bukan overengineering, atau justru wajib)

- `src/lib/config/secrets.ts` — melindungi credential dari secret default/placeholder. Wajib.
- `src/lib/security/headers.ts` + `origin.ts` — kecil dan melindungi verify/credential.
- CAS transisi review + `partial unique index attestations` — inti integritas credential, bukan overengineering.
- `docker-compose.yml` — hanya dev; untuk VPS bisa pakai managed PG atau `docker compose` sebagai cara deploy, tidak perlu diubah.
- `drizzle/` migration — jangan rollback/generate ulang.

---

## Hasil akhir yang diharapkan

- Rate limit tanpa Redis, dengan batasan satu proses; restart membersihkan bucket. Bukan proteksi distributed.
- `register()` memeriksa konfigurasi secret; rate limit tidak punya startup gate.
- Jalur `draft → submit → review → approve/reject → verify` tetap berbasis DB dan menulis audit inline untuk mutasi inti.
- Outbox/worker/skema tetap ada, tetapi tidak dipakai jalur request inti yang dimigrasikan; event lama tetap bisa diproses.
- AI/loker/resume tetap tidak disentuh. Tabel, migrasi, dan skrip outbox tidak dihapus atau diubah.
- Reverse proxy VPS perlu mengirim header IP tepercaya; `x-real-ip` memerlukan `CAREEVO_TRUST_REAL_IP_HEADER=1`, sementara `x-vercel-forwarded-for` tetap didukung bila memang tersedia.
