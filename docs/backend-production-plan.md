# Rencana Eksekusi Backend Produksi Careevo

**Status:** usulan implementasi — belum dieksekusi  
**Dibuat:** 2026-09-25  
**Tujuan:** mematangkan Careevo dari prototype lokal berbasis cookie/file/fixture menjadi layanan yang memiliki identity otoritatif, state belajar lintas perangkat, workflow verifikasi yang dapat diaudit, serta penyimpanan file yang aman dan durable.

> **Batas rencana:** ini bukan rewrite Next.js. App Router, Server Actions untuk mutasi UI internal, domain logic di `src/lib`, validasi Zod, model kursus/modul/halaman/kuis yang ada, dan pemisahan utilitas course yang client-safe harus dipertahankan. Perubahan dilakukan sebagai vertical-slice migration dengan adapter dan cutover terukur.

---

## 1. Ringkasan masalah dan sasaran

### Kondisi awal yang harus ditangani

| Domain | Sumber state sekarang | Risiko produksi |
|---|---|---|
| Identity, user, session | Cookie HMAC (`ls_users`, `ls_session`) | Kapasitas terbatas, tidak lintas perangkat, tidak ada revocation terpusat |
| Role staff | Claim role di cookie | Authorization harus diperkuat dan staff provisioning tidak boleh berasal dari input publik |
| Enrollment/progress | Cookie HMAC `ls_enroll` | Tidak transactional, maksimum entri, dan tidak dapat diaudit |
| Course dan kuis | `data/courses.json` / `data/kuis.json`, cache per-proses | Split-brain antar-instance dan lost update |
| Resume, performa, sesi belajar | File JSON di `.data/` | Tidak sesuai serverless/horizontal scale; banyak operasi scan direktori O(N) |
| Course/resume upload | `public/uploads/` atau filesystem lokal | Tidak durable pada filesystem read-only; unggahan produksi dapat tidak tersedia setelah deploy |
| Review, audit, agent run | Fixture dan stub | Tidak memiliki chain of custody untuk credential |
| AI evaluation | Panggilan sinkron on-demand | Risiko timeout, retry tak terkendali, dan biaya tanpa quota |

### Hasil akhir

Pada akhir rencana ini, backend harus memenuhi hal berikut:

1. Identity global dan role berbasis database dengan session yang bisa dirotasi dan dicabut.
2. Enrollment, completion, verified learning evidence, dan attempt assessment tersimpan secara transactional.
3. Review dan attestation hanya diterbitkan dari record server-side yang authorized, traceable, dan dapat direvoke.
4. Semua file bisnis disimpan di object storage; database menyimpan metadata, ownership, dan lifecycle.
5. Course/CMS dan quiz dapat diakses lewat repository database tanpa mematahkan resolver/modul client-safe yang sekarang.
6. Efek samping (email, file scan, evaluasi AI, notifikasi) diproses idempoten melalui outbox/worker.
7. CI, telemetry, backup/restore, dan E2E menyediakan bukti bahwa sistem siap dioperasikan.

---

## 2. Keputusan arsitektur dan batas yang dikunci

### 2.1 Target arsitektur

```text
Server Component / Server Action / Route Handler
  → principal terautentikasi + authorization + Zod validation
  → application service
  → repository + transaksi PostgreSQL
  → audit event + transactional outbox
  → revalidatePath / response mapping

Outbox worker
  → email / scan file / thumbnail / certificate / AI / notification / ingestion

Object storage
  → CV, portofolio, attachment kursus, bukti submission
```

- **PostgreSQL** menjadi source of truth untuk state bisnis dan audit.
- **Server Actions** tetap dipakai untuk mutasi dari UI Next.js internal; Route Handler dipakai untuk upload, endpoint publik, webhook, operational endpoint, dan API eksternal ter-versioning bila memang diperlukan.
- **Object storage S3-compatible** menjadi target file production. Adapter filesystem lokal tetap tersedia khusus development/test sehingga transisi tidak memblokir workflow saat ini.
- **HMAC attestation** tetap dipertahankan untuk portabilitas, tetapi issuance, key version, status aktif/revoked, dan audit lifecycle harus authoritative di database.
- Application service tidak boleh menerima claim bisnis yang menentukan eligibility dari browser (misalnya score lulus, username target, course completion, atau role).

### 2.2 Yang tidak boleh diregresikan

- Jangan menyatukan persistence cookie, course, resume, dan performa secara prematur selama cutover. Mereka sekarang berbeda untuk alasan produk dan harus dimigrasikan per domain.
- `src/lib/courses/kurikulum.ts`, `blok.ts`, `halaman.ts`, dan `kuis.ts` tetap murni/client-safe. Import database/Node filesystem hanya tinggal di repository atau resolver server-only.
- `modulUntuk()` / `modulUntukSumber()` tetap menjadi satu-satunya resolver modul. Jangan panggil `modulKursus()` langsung dari page/action baru.
- Blok halaman tetap data terstruktur; jangan memasukkan HTML mentah atau `dangerouslySetInnerHTML`.
- Quiz practice boleh memberi feedback lokal, tetapi score yang memengaruhi verified completion atau credential wajib dihitung/diotorisasi di server.
- Verdict loker tetap derived dan kontrak `flags` versus `fee_flags` tetap berlaku.

### 2.3 Keputusan yang harus selesai sebelum Fase 1

| Keputusan | Rekomendasi default | Dampak |
|---|---|---|
| Hosting | Runtime Node yang mendukung worker terpisah; staging dan production terpisah | Menentukan platform queue, network, dan deployment |
| Database | Managed PostgreSQL | Mendukung transaksi, relasi, index, audit, dan worker multi-instance |
| ORM/migration | Pilih satu setelah proof-of-concept: Drizzle atau Prisma | Semua schema dan migration harus konsisten; jangan gunakan dua ORM |
| Object storage | Bucket S3-compatible dengan environment bucket terpisah | Presigned upload, lifecycle, dan URL file |
| Queue/worker | Provider yang cocok dengan host (managed queue atau worker runner) | Outbox retry, dead-letter queue, dan observability |
| Auth email | Provider transactional email | Verifikasi email, password reset, invite staff |
| Key management | Secret manager platform + key rotation runbook | Session, attestation, webhook, dan storage credential |

**Exit criteria keputusan:** satu ADR singkat di `docs/adr/` yang memuat provider, region, retention, owner, biaya awal, strategi backup, dan prosedur local development. Implementasi data production tidak dimulai sebelum keputusan ini disetujui.

---

## 3. Urutan eksekusi

```text
Fase 0   Security containment dan release gate
  ↓
Fase 1   Identity, authentication, RBAC, dan session PostgreSQL
  ↓
Fase 1A  Fondasi transactional outbox dan worker
  ↓
Fase 2   Learning evidence: enrollment, progress, assessment
  ↓
Fase 3   Submission, review, badge, attestation, dan revocation
  ↓
Fase 4   Migrasi CMS/file dan object storage
  ↓
Fase 5   Observability, backup/restore, dan CI production
  ↓
Fase 6   AI dan live loker terukur
```

Fase berikutnya hanya mulai setelah exit criteria fase sebelumnya terpenuhi. Fase 1A adalah prasyarat keras bagi Fase 3 (attestation/outbox) dan Fase 4 (file scan/cleanup). Fase 4 dapat dikerjakan sebagian paralel dengan Fase 3 **hanya setelah** Fase 1 membuat identity/role database tersedia dan Fase 1A lulus uji duplicate-delivery dan pemulihan lease (simulasi crash).

---

## 4. Fase 0 — Security containment dan release gate

**Prioritas:** P0. Tidak ada deployment publik yang mempercayai staff action atau attestation sebelum fase ini selesai.

### Pekerjaan

1. Buat helper konfigurasi server-only untuk membaca secret dan fail-fast ketika `NODE_ENV=production` memakai secret kosong, known/default, atau di bawah panjang minimum.
   - Pisahkan secret minimal: session/auth, attestation, cookie state legacy selama migrasi, webhook, dan storage.
   - Jangan mengganti secret lama tanpa rencana invalidasi: rotasi harus mencabut semua signed cookie legacy yang memakai secret sebelumnya.
2. Hilangkan fallback secret untuk production dari session, user store, enrollment, profile/onboarding, learning session/chat, dan attestation.
3. Jadikan registrasi publik selalu menghasilkan role `learner`.
   - Hapus role staff dari form/schema/action publik.
   - Rancang provisioning `verifikator`/`admin` sebagai invitation/admin-only workflow yang mencatat actor, expiry, one-time redemption, dan approval.
4. Nonaktifkan demo account pada staging/production.
   - Demo hanya boleh hidup di environment demo terisolasi dengan data demo.
5. Perbaiki `decideReview()` dan action credential lain.
   - Sebelum database review siap, nonaktifkan issuance attestation pada environment publik atau return error eksplisit.
   - Tambahkan auth principal dan staff authorization secara independen pada action; layout tidak dihitung sebagai authorization boundary.
   - Jangan menerima username, task, score, eligibility, atau identity target yang menentukan issuance dari `FormData`.
6. Audit semua Server Action dan Route Handler yang melakukan mutasi.
   - Setiap mutasi wajib: authentication, role/ownership authorization, Zod validation, error yang tidak membocorkan secret, dan audit event setelah Fase 3.
7. Tambahkan baseline security headers pada konfigurasi/deployment: `X-Content-Type-Options: nosniff`, frame policy, referrer policy, permissions policy; CSP menyusul setelah compatibility test; HSTS di HTTPS edge.
8. Implementasikan rate limit **aktif** sebelum M0 selesai untuk login, signup, password reset, upload, endpoint public verify, dan action AI.
   - Limiter harus shared/edge dan lintas-instance, dengan key gabungan IP serta account/principal bila tersedia; jangan memakai memory per-proses sebagai kontrol production.
   - Balas `429` dengan retry metadata, catat telemetry tanpa PII mentah, dan batasi concurrency/request body upload sebelum handler mahal atau provider AI dipanggil.
   - Fase 5 hanya memperluas dashboard/alert dan tuning policy; enforcement bukan pekerjaan yang ditunda.

### Berkas awal yang kemungkinan terdampak

```text
src/lib/auth/session.ts
src/lib/auth/user-store.ts
src/lib/attestation/token.ts
src/lib/courses/enrollment.ts
src/lib/onboarding/**
src/lib/profile/**
src/lib/learning/session.ts
src/lib/learning/chat-store.ts
src/lib/validation/auth.ts
src/actions/auth.ts
src/actions/review.ts
src/lib/actions-common.ts
src/app/api/**/route.ts
next.config.ts
.env.example                    (baru; tanpa nilai rahasia)
docs/security-release-checklist.md  (baru)
```

### Acceptance criteria dan verifikasi

- `NODE_ENV=production` tanpa secret valid gagal start sebelum server menerima request.
- Nilai secret default/known ditolak pada production; development/test tetap eksplisit dan terdokumentasi.
- Signup publik tidak dapat menghasilkan role staff melalui field HTML, request yang dimodifikasi, atau pemanggilan action langsung.
- Akun demo tidak dapat login di staging/production.
- Pemanggilan review/attestation tanpa principal staff valid ditolak; claim score/target dari browser tidak dapat menerbitkan credential.
- Limiter shared menolak request ke-N dengan `429` untuk seluruh endpoint publik yang dicakup, sebelum upload dibuffer penuh atau provider AI dipanggil.
- Tambah unit/integration test adversarial untuk setiap kasus di atas.
- Jalankan `npm run check`, `npm run build`, lalu `npm run smoke -- <baseUrl>` dan `npm run e2e:onboarding -- <baseUrl>` pada server dengan secret non-default.

---

## 5. Fase 1 — Identity, authentication, RBAC, dan session PostgreSQL

**Prioritas:** P0. Fase ini menciptakan principal stabil bagi semua domain lain.

### Schema minimum

```text
users
  id (UUID/ULID), email_normalized unique, username_normalized unique,
  display_name, status, created_at, updated_at
user_profiles
  user_id unique, public_bio nullable, avatar_file_id nullable, cover_file_id nullable,
  username_changed_at nullable, updated_at
user_credentials
  user_id unique, password_hash, password_changed_at
user_roles
  user_id, role, granted_by_user_id nullable, granted_at, revoked_at nullable
sessions
  id, user_id, token_hash, created_at, expires_at, rotated_at nullable,
  revoked_at nullable, user_agent nullable, ip_prefix nullable
email_verification_tokens
  id, user_id, token_hash, expires_at, consumed_at nullable
password_reset_tokens
  id, user_id, token_hash, expires_at, consumed_at nullable
staff_invitations
  id, email_normalized, role, invited_by_user_id, token_hash, expires_at,
  consumed_at nullable, revoked_at nullable
audit_events (buat schema sekarang; isi penuh dimulai Fase 3)
  id, actor_user_id nullable, action, entity_type, entity_id, payload_redacted,
  request_id, created_at
```

### Pekerjaan

1. Tambah database package, migration runner, koneksi server-only, dan test database ephemeral.
2. Definisikan repository identity dan application service auth. Tidak ada query database langsung dari component/UI.
3. Migrasikan registrasi:
   - email dinormalisasi dan unique secara case-insensitive;
   - password memakai Argon2id atau bcrypt dengan parameter yang diuji;
   - role default hanya `learner`;
   - tetapkan vocabulary canonical secara eksplisit: data legacy `user` dipetakan ke `learner` pada adapter/cutover (atau pertahankan `user` end-to-end bila dipilih ADR); tidak boleh ada dua arti role yang hidup tanpa mapping;
   - buat `username_normalized` unik dan `display_name`; tetapkan aturan collision, rename, redirect/404 public-profile lama, dan cooldown rename sebelum mengaktifkan `/p/[username]` dari database;
   - verification email diaktifkan sebelum policy staff/sensitive flow mengizinkan akses. Sebelum alur email itu diaktifkan, pilih provider lewat ADR, tulis token dan event pengiriman dalam transaksi yang sama, lalu buktikan kunci idempotensi deterministik dihormati provider saat timeout, retry, dan crash setelah pengiriman. Tanpa provider dan bukti tersebut, verifikasi email belum aktif dan akses sensitif tetap diblokir.
4. Migrasikan login dan session:
   - cookie hanya membawa opaque session token;
   - database menyimpan hash token, expiry, revocation, dan metadata minimal;
   - rotasi token pada login/privilege change dan revoke untuk logout/reset password;
   - `getSession()` menjadi adapter yang mengembalikan principal `{ userId, email, roles, nama, username }` dari database;
   - sediakan `SessionPrincipal` compatibility adapter sampai layout onboarding, enrollment, resume, profile publik, dan route `/p/[username]` selesai dimigrasikan; jangan memaksa refactor semua call site dalam satu release.
5. Tambahkan policy authorization terpusat untuk `learner`, `verifikator`, dan `admin`.
   - `gateStaff()` migrasi menggunakan principal database, bukan claim role dari cookie.
   - Tambahkan check ownership (`user_id`) di domain learner/file/submission.
6. Implementasikan staff invitation/redeem dan admin role grant/revoke ber-audit.
7. Siapkan migrasi user legacy hanya jika benar-benar ada user data yang harus dipertahankan.
   - Cookie user tidak dapat dijadikan database import otomatis yang trusted.
   - Sediakan forced re-registration/password reset atau import terkendali yang dibuktikan ownership-nya.
8. Tambahkan `.env.example`, dokumentasi local DB, seed developer yang **bukan** aktif di production, dan migration rollback/runbook.

### Cutover

1. Deploy schema dan code read-only compatibility.
2. Register/login baru menulis identity database; legacy cookie hanya dibaca selama jendela migrasi terbatas.
3. Release opaque session database; legacy `ls_session` ditolak/invalidated pada cutover final.
4. Hapus fallback/demo/legacy user-store setelah telemetry tidak menunjukkan pembaca legacy.

### Acceptance criteria dan verifikasi

- Session dari satu device dapat direvoke dan device lain tidak ikut keluar kecuali reset global.
- User yang role-nya dicabut langsung gagal staff action pada request berikutnya.
- Password hash tidak pernah tampil dalam cookie, response, log, atau client bundle.
- Constraint email/role/session diuji dengan database integration test dan concurrent signup test.
- Semua gated layout/action/route mengandalkan principal terpusat.
- Compatibility/cutover test meliputi layout bergate, onboarding, enrollment, resume, profile publik, dan `/p/[username]`, termasuk collision serta rename username.
- Migration fresh install dan upgrade database diuji di CI.

---

## 6. Fase 1A — Fondasi transactional outbox dan worker

**Prioritas:** P0. Ini harus selesai sebelum Fase 3 menerbitkan attestation atau Fase 4 menerima file production; Fase 5 hanya melengkapi operasi dan observability menyeluruh.

### Utang dari review Fase 1 — wajib ditutup sebelum deploy produksi

Review independen Fase 1 (PR #12) menemukan empat utang **important** yang bukan
blocker merge, tetapi harus ditutup sebelum deployment produksi pertama — sebagian
di antaranya (rotasi sesi, penerbit-sesi tanpa verifikasi) menjadi celah otorisasi
bila dibiarkan. Tutup di Fase 1A (atau PR perbaikan terpisah) sebelum Fase 3
menerbitkan attestation.

1. **Rotasi sesi saat login belum jalan.** `loginAction` memanggil
   `authenticatePengguna` tanpa `sessionLamaId`, sehingga `rotasiSession`
   (`src/lib/auth/session-repository.ts`) tidak pernah menandai `rotated_at` dan
   token perangkat lama tetap sah sampai `expires_at`. Ini tidak memenuhi plan
   §5 butir 4 ("rotasi token pada login"). Perbaikan: teruskan `sessionLamaId`
   dari sesi aktif ke `masukPengguna`, dan buat `cariSessionAktifByTokenHash`
   menolak sesi yang `rotated_at`-nya sudah terisi (lihat utang #5).
2. **Hapus penerbit-sesi tanpa verifikasi.** `terbitkanSessionUntukPrincipal`
   (`auth-service.ts`) dan `createSession` (`session.ts`) menerbitkan sesi tanpa
   membuktikan verifikasi apa pun dan kini nol pemanggil. Signature-nya hanya
   meminta `userId` biasa, sehingga pemanggil fase berikutnya bisa tanpa sengaja
   menerbitkan sesi untuk user mana pun. Hapus keduanya sampai ada call site yang
   benar-benar terverifikasi (login/registrasi/redeem sudah lewat `terbitkanSesi`).
3. **Patok parameter Argon2id dengan test.** `password.ts` mengklaim nilai
   `Algorithm.Argon2id` + parameter OWASP "dipatok `npm test`", tetapi
   `password.test.ts` tidak ada. Tambahkan test yang menegaskan algoritma
   (`$argon2id$`) dan parameter hash, supaya perubahan tak sengaja (Argon2i, atau
   memory/time yang lebih lemah) menggagalkan suite.
4. **Bootstrap admin terdokumentasi.** Tidak ada jalur provisioning admin pertama
   pada database produksi yang baru dimigrasikan — `gateAdmin()` tidak pernah bisa
   lulus, sehingga `buatUndanganAction`/`beriRoleAction` unreachable dan staff
   tidak bisa di-provisioning lewat produk. Tambahkan seed/CLI terdokumentasi
   (INSERT SQL atau script operator) yang tidak aktif otomatis di produksi
   (plan §5 butir 8).

Utang **minor** (tutup saat menyentuh area terkait; bukan prasyarat M1A):

5. Filter `rotated_at` di `cariSessionAktifByTokenHash` — sekali rotasi #1 jalan.
6. Pembaca `password_changed_at` belum ada — sesi lama tetap sah setelah ganti
   password; tambahkan pencabutan saat alur reset password dibuat.
7. `z.email().trim().toLowerCase()` di `src/actions/staff.ts` menormalkan (bukan
   menolak) masukan berspasi; selaraskan dengan `z.email()` polos di
   `src/lib/validation/auth.ts`.
8. Tiga call site otorisasi masih memakai `isStaffRole(session.role)` (field
   kompatibilitas): `(verifikator)/layout.tsx`, `api/unggah/route.ts`,
   `actions/review.ts` — migrasikan ke `gateStaff()` berbasis `roles`.
9. `test-principal.ts` memakai `iat` dalam detik; produksi milidetik.
10. Sisa cutover: `user-store.ts` mati (`ls_users` tidak lagi dibaca/ditulis),
    `roleSchema` nol pemanggil, normalisasi email tidak seragam.
11. Tidak ada rollback migration (plan §5 butir 8 memintanya) — tambahkan
    runbook rollback/forward di `docs/local-db.md`.

### Schema dan kontrak minimum

```text
outbox_events
  id, type, aggregate_type, aggregate_id, payload_redacted, occurred_at,
  available_at, attempts, lease_owner nullable, lease_expires_at nullable,
  processed_at nullable, last_error_code nullable, idempotency_key unique
```

1. Sediakan helper transaksi yang menulis perubahan bisnis dan `outbox_events` dalam transaksi PostgreSQL yang sama.
2. Buat worker minimal yang melakukan claim/lease aman, handler per event type, idempotency per sink, exponential backoff, maksimum retry, serta dead-letter state/queue.
3. Daftarkan event/handler yang punya sumber kebenaran di Fase 1A: `auth.registered` → sink audit internal. Lifecycle attestation diimplementasikan pada Fase 3; handler scan/cleanup disiapkan dan diaktifkan pada Fase 4 sebelum upload production dibuka. Tipe tanpa handler harus gagal terminal, bukan dilaporkan sukses.
4. Sediakan operasi replay dan dead-letter yang ber-audit. Payload outbox/log harus ter-redact dari secret dan PII yang tidak dibutuhkan handler.

### Acceptance criteria dan verifikasi

- Untuk sink audit internal yang ada di Fase 1A, duplicate delivery, simulasi worker mati sesudah claim (lease kedaluwarsa), retry sesudah handler gagal sementara, dan pemulihan lease tidak menggandakan baris audit. Test ini tidak mematikan proses OS atau mensimulasikan timeout provider; bukti ini tidak menjamin efek samping provider eksternal tidak terduplikasi.
- Event yang gagal terminal dapat ditemukan dan direplay dengan actor/reason tercatat; tipe tanpa handler berakhir sebagai kegagalan terminal `handler_tidak_terdaftar`, bukan sukses semu.
- Uji integration membuktikan transaksi gagal tidak meninggalkan event, dan alur yang sudah memakai writer (`daftarPengguna`) selalu meninggalkan event yang diwajibkan. Alur bisnis lain baru mendapat jaminan ini setelah diintegrasikan dengan writer.
- Uji worker/claim memverifikasi lease kedaluwarsa dapat dipulihkan aman oleh worker lain.
- **Gerbang lintas fase, bukan syarat kelulusan M1A:** handler attestation, email, dan file scan/cleanup baru boleh didaftarkan saat sumber bisnis dan transisi status otoritatif tersedia; payload disaring dari secret/PII yang tidak dibutuhkan **sebelum insert**; kunci idempotensi deterministik diteruskan dan benar-benar dihormati tujuan efek samping; serta uji integrasi membuktikan timeout/retry, replay, dan crash **sesudah efek samping berhasil tetapi sebelum commit status delivery** tidak menggandakan efek. Jika tujuan tidak mendukung deduplikasi, jangan mengklaim jaminan itu: rilis fitur yang memerlukannya diblokir sampai ada mekanisme setara yang terbukti atau keputusan risiko tersendiri. Gerbang attestation berada di Fase 3, file scan/cleanup di Fase 4, dan email sebelum alur pengiriman terkait diaktifkan.

---

## 7. Fase 2 — Learning evidence: enrollment, progress, dan assessment

**Prioritas:** P0 untuk credential tepercaya.

### Prasyarat definisi assessment immutable

Sebelum satu verified assessment dipakai untuk completion, review, atau credential, definition yang dinilai harus dapat direkonstruksi walaupun admin kemudian mengubah/hapus quiz bank yang reusable. Pilih satu opsi melalui ADR dan implementasikan sebelum verified grading:

1. **Migrasi subset canonical lebih awal:** buat schema PostgreSQL untuk course/module/quiz/question dan version publication minimum, lalu attempt mereferensikan version published yang immutable; atau
2. **Snapshot assessment per attempt:** simpan `assessment_definition_version`, snapshot pertanyaan/opsi, answer key atau hasil grading yang memadai, passing score, policy version, serta referensi course/module saat attempt dibuka/dikirim.

Untuk kedua opsi, edit/delete quiz tidak boleh mengubah outcome historis, eligibility, review, atau payload attestation. Tetapkan retention dan foreign key/restrict policy untuk snapshot/evidence yang dipakai credential.

### Schema minimum

```text
courses                         (referensi sementara ke id course existing)
enrollments
  id, user_id, course_id, status, enrolled_at, completed_at nullable,
  completion_path nullable, unique(user_id, course_id)
module_progress
  enrollment_id, module_id, state, completed_at nullable,
  completion_path nullable, evidence_id nullable, unique(enrollment_id, module_id)
learning_runs
  id, user_id, enrollment_id, course_id, module_id, state, started_at,
  expires_at, completed_at nullable, integrity_version, metadata_redacted
learning_events
  id, learning_run_id, kind, sequence, occurred_at, payload_redacted,
  unique(learning_run_id, sequence)
quiz_attempts
  id, user_id, enrollment_id, quiz_id nullable, assessment_definition_version,
  assessment_snapshot, status, started_at, submitted_at nullable, score nullable,
  grading_version, attempt_number
quiz_attempt_answers
  quiz_attempt_id, question_id, selected_option, is_correct nullable,
  question_snapshot_ref nullable
course_completions
  id, user_id, course_id, enrollment_id unique, completed_at, completion_path,
  policy_version
```

Pada fase ini dibuat adapter agar derived module ID dan stored module ID sama-sama dapat dipakai tanpa menyimpang dari `modulUntuk()`. Fase 4 memigrasikan CMS lengkap, tetapi verified assessment memakai publication version atau snapshot immutable yang telah ditetapkan di prasyarat di atas—bukan quiz bank mutable saat request dibaca ulang.

### Pekerjaan

1. Buat `LearningService` dan repository transactional.
   - Route/action hanya mengurai input, mengambil principal, dan mendelegasikan ke service.
2. Migrasikan `ls_enroll` menjadi `enrollments` dan `module_progress`.
   - Gunakan unique constraint/upsert/idempotency key untuk klik berulang dan request paralel.
   - Simpan timestamp serta jalur completion `terverifikasi`/`informal`, bukan boolean tunggal.
3. Migrasikan learning session file ke `learning_runs` dan `learning_events`.
   - Preservasi invariant proof/session sekarang: sequence, expiry, checkpoint policy, dan pencegahan replay.
   - Hindari scan direktori; query harus terindeks oleh `user_id`, `course_id`, status, dan waktu.
4. Pisahkan mode practice dan verified assessment.
   - Practice dapat tetap mengirim result UI non-authoritative.
   - Verified flow menerima jawaban, memuat quiz/question authoritative di server, menghitung score server-side, lalu menyimpan attempt/evidence dalam transaksi.
5. Definisikan policy completion per course/module dan version policy yang dipakai pada saat completion.
6. Tulis migration/backfill yang:
   - membaca enrollment cookie hanya dalam session pemilik setelah login;
   - memfilter module ID dengan `irisModulSelesai()`;
   - idempoten dan mencatat jumlah record migrated/ignored;
   - tidak menganggap score atau evidence client legacy sebagai proof credential.
7. Perbarui dashboard learner dan staff agar membaca repository database, bukan cookie/file performa.

### Acceptance criteria dan verifikasi

- Progress tampil konsisten lintas browser/device untuk user sama.
- Dua request completion paralel tidak menghasilkan double completion, double performance mirror, atau double credential eligibility.
- Module ID derived lama dan stored baru diselesaikan melalui resolver tunggal tanpa call `modulKursus()` langsung dari page/action.
- Nilai client tidak dapat mengubah score verified atau `course_completions` tanpa penilaian server-side.
- Expired/replayed learning run ditolak; event sequence tidak dapat dilompati.
- Edit/delete quiz, question, answer key, atau passing score setelah attempt tidak dapat mengubah snapshot, outcome, eligibility, review, atau credential historis.
- Integration test memakai Postgres; E2E mencakup enroll → module completion → quiz → completion pada dua session.

---

## 7. Fase 3 — Submission, review, badge, attestation, dan revocation

**Prioritas:** P0 untuk reputasi produk. Fase ini menggantikan fixture/stub sebagai sumber credential.

### Schema minimum

```text
submissions
  id, user_id, course_id nullable, enrollment_id nullable, status,
  current_version, submitted_at, assigned_reviewer_user_id nullable,
  created_at, updated_at
submission_versions
  id, submission_id, version, content_snapshot, evidence_file_id nullable,
  submitted_by_user_id, created_at, unique(submission_id, version)
reviews
  id, submission_id, submission_version_id, reviewer_user_id, decision,
  rubric_snapshot, score nullable, rationale, created_at, superseded_at nullable
badges
  id, user_id, type, source_submission_id nullable, issued_at, revoked_at nullable
attestations
  id, public_token unique, subject_user_id, source_review_id, badge_id nullable,
  payload_canonical, signature, key_version, status, issued_at, revoked_at nullable,
  revoked_by_user_id nullable, revocation_reason nullable
attestation_events
  id, attestation_id, kind, actor_user_id nullable, payload_redacted, created_at
```

Tambahkan foreign key, status enum/check constraint, unique constraint, index query reviewer queue, dan referential policy yang mencegah menghapus evidence/review yang sudah dipakai credential.

### State machine minimum

```text
draft → submitted → assigned → in_review → approved | rejected | changes_requested
approved → attested
attested → revoked
```

- Transition diletakkan di `ReviewService`, bukan di component atau form.
- Action menerima **`submissionId` dan input review tervalidasi**; service memuat submission/version/rubric/eligibility otoritatif dari database.
- Reviewer harus punya role staff dan assignment/policy yang valid.
- Review, badge/attestation, audit event, dan outbox event ditulis atomik dalam satu transaksi.
- Attestation public token tidak boleh memakai sequence ID database.

### Pekerjaan

1. Ganti fixture review queue/submission secara bertahap dengan repository database; fixture tersisa hanya untuk demo/test eksplisit.
2. Buat action learner untuk create/update/submit submission berdasarkan ownership dan enrollment policy.
3. Buat action staff untuk assign, claim, request changes, approve/reject, dan revoke; semua memakai service/state machine.
4. Implementasikan issuance attestation:
   - canonical payload dari database snapshot;
   - signature memakai secret/key version server-side;
   - simpan issuance record dan event audit;
   - endpoint public verify memeriksa signature **dan** status `active`/`revoked` tanpa membocorkan PII berlebihan.
5. Implementasikan revocation dan re-issuance dengan reason, actor, timestamp, dan link record pengganti bila ada.
6. Isi `logAudit` dan `runAgent` melalui repository/outbox; jangan lagi menggunakan stub untuk alur nyata.
7. Definisikan retention dan redaction untuk evidence/review/audit payload.

### Acceptance criteria dan verifikasi

- Anonim/learner tidak dapat membuat review, memilih reviewer, atau menerbitkan/revoke credential dengan request langsung.
- Reviewer tidak dapat me-review submission tanpa assignment/policy yang valid.
- Perubahan score/username/form client tidak mengubah payload credential yang diterbitkan.
- Pengiriman ulang action atau worker dua kali hanya menerbitkan satu attestation aktif.
- Sebelum credential production dibuka, issuance/revocation attestation harus memakai review, status, dan record otoritatif yang persisten; transisi bisnis dan event outbox commit atomik. Uji crash setelah klaim, retry, dan replay membuktikan tidak ada penerbitan ganda, termasuk bila ada tujuan eksternal yang sudah berhasil sebelum status delivery tersimpan (gerbang sink §6).
- Token public valid menampilkan status minimal; token revoked menunjukkan revoked tanpa mengungkap data sensitif.
- Audit menunjukkan actor, action, entity, request ID, waktu, dan alasan revocation.
- Integration/E2E: submission → review → verify public → revoke → verify public; juga test transition terlarang dan concurrent review.

---

## 8. Fase 4 — Migrasi CMS/file dan object storage

**Prioritas:** P1 setelah identity dan workflow credential stabil.

### Pekerjaan

1. Perbaiki integritas filesystem sementara:
   - ubah penulisan resume JSON menjadi temp-file + rename atomik;
   - tambah test crash/partial-write scenario pada abstraction yang dapat diuji;
   - dokumentasikan filesystem local hanya untuk development/demo.
2. Buat interface blob storage server-only, misalnya `put`, `get`, `delete`, `createUploadIntent`, dan `getReadUrl`.
   - Implementasi local filesystem untuk test/dev.
   - Implementasi production object storage untuk bucket environment.
3. Tambah metadata file database:

```text
uploaded_files
  id, owner_user_id nullable, purpose, storage_key unique, original_filename,
  mime_type, byte_size, content_hash nullable, scan_status, visibility,
  created_at, deleted_at nullable
```

4. Ganti upload course dan resume:
   - authorization berbasis owner/staff + subject yang benar;
   - ukuran dibatasi sebelum buffering bila platform mendukung;
   - validasi MIME server-side, magic bytes/decoding sesuai tipe, dan scan asynchronous;
   - nama key dibuat server, tidak dari user;
   - metadata dibuat sebelum/bersamaan upload; orphan cleanup dijadwalkan;
   - gunakan presigned intent/URL bila platform mendukung.
5. Tetapkan matriks visibility dan scan sebelum cutover:
   - `pending_scan`, `rejected`, dan `deleted` tidak dapat disajikan; compatibility endpoint merespons `404` untuk menyembunyikan existence (atau `423` untuk authenticated owner bila UX eksplisit diperlukan), dan tidak pernah membuat URL publik.
   - `private` hanya dapat dibaca owner/staff berwenang melalui signed URL pendek/route handler authorized; `public` hanya dapat dibaca bila scan `clean` dan pemilik telah memilih visibilitas publik secara eksplisit.
   - Tentukan data legacy CV/portofolio secara eksplisit: pertahankan public sebagai compatibility policy dengan privacy notice, **atau** migrasikan menjadi private dan minta consent opt-in sebelum URL publik diterbitkan. Jangan diam-diam mengubah visibility.
6. Sajikan file lewat signed URL atau route handler authorized sesuai matriks di atas.
7. Migrasikan resume/profile data dari `.data/` ke relational tables dan blob metadata; pertahankan public route `/p/[username]/berkas/[slot]` sebagai compatibility endpoint saat cutover.
   - Uji username rename/collision bersama route compatibility agar berkas tidak berpindah atau bocor ke profil lain.
8. Migrasikan course/quiz dari JSON ke repository PostgreSQL:
   - mulai dari read-through adapter di belakang boundary `src/lib/courses/storage.ts`/store;
   - one-time import kursus, modul, halaman, materi, dan kuis dengan ID/timestamp yang dipertahankan bila aman;
   - kursus dan quiz yang berubah dalam satu operasi memakai transaksi database;
   - jangan membawa `node:fs` ke `kurikulum.ts` atau component client;
   - rewrite path legacy `/uploads/...` sebagai referensi `uploaded_files`/storage URL yang tervalidasi.
9. Cutover dengan feature flag/read-compare:
   - import idempoten → shadow read/compare → dual-read terukur → database write → freeze legacy write → archival JSON/files;
   - rollback hanya sebelum legacy write dibekukan; setelah itu gunakan migration forward-only yang terdokumentasi.

### Acceptance criteria dan verifikasi

- Unggahan baru tersedia setelah restart/deploy `next start` dan pada multi-instance; tidak ada dependensi `public/` runtime.
- File path traversal, MIME spoofing, upload tanpa ownership, file oversized, dan file scan-failed ditolak/diisolasi.
- File `pending_scan`, `rejected`, dan `deleted` tidak dapat dibaca publik; E2E mencakup public, private, pending scan, rejected, deleted, legacy-visibility policy, serta username rename/collision.
- Sebelum upload production dibuka, pilih storage/scanner melalui ADR, simpan metadata serta status scan otoritatif, dan buktikan worker scan/cleanup memulihkan timeout, retry, crash, serta replay tanpa menggandakan efek atau menyajikan file sebelum status `clean` (gerbang sink §6). Jika scanner/storage tidak dapat mendukung deduplikasi yang diperlukan, upload production tetap diblokir sampai mitigasi yang setara terbukti atau risiko diputuskan tersendiri.
- Hapus/soft-delete file menghilangkan akses sesuai lifecycle dan worker cleanup tidak menghapus file yang masih direferensikan.
- Import dijalankan dua kali tanpa duplikasi; counts/hash/data sample sama dengan sumber legacy.
- Course stored/derived, page block, quiz bank, dan resolver modul yang ada terus lulus test termasuk build boundary client/server.
- Jalankan `npm run check`, `npm run build`, migration verification, upload E2E, dan smoke pada process restart.

---

## 9. Fase 5 — Observability, backup/restore, dan CI production

**Prioritas:** P1; Fase 1A sudah menyediakan outbox/worker minimum. Fase ini menyelesaikan observability, operasi, serta coverage produksi sebelum volume AI/upload/review dinaikkan.

### Pekerjaan

1. Perluas event dan handler Fase 1A untuk efek samping non-transaksional sesuai fase pemiliknya: email/notifikasi, file scan/thumbnail, certificate render, AI, dan ingestion loker. Sink audit internal sudah tersedia sejak Fase 1A; handler baru hanya masuk registry setelah gerbang lintas fase §6 terpenuhi, bukan dengan mendaftarkan no-op.
2. Selesaikan runbook operator untuk claim/lease, idempotency key, retry, dead-letter, dan replay yang sudah tersedia sejak Fase 1A.
3. Implementasikan logging terstruktur dengan `request_id`/correlation ID pada action, route, worker, dan public verify.
4. Pasang error tracking, metrics, dan tracing untuk database, storage, queue, AI, authentication failure, upload rejection, attestation issuance/revocation, serta worker lag.
5. Implementasikan health/readiness endpoint yang tidak membocorkan secret dan dibatasi sesuai kebutuhan deployment.
6. Buat strategi backup/restore:
   - backup DB otomatis + retention;
   - versioning/lifecycle object storage;
   - restore drill terjadwal pada environment non-production;
   - RPO/RTO target dan owner respons insiden.
7. Tambah CI repository-managed:
   - `npm ci`;
   - `npm run typecheck` → `npm run lint` → `npm run skills:check` → `npm test`;
   - `npm run build`;
   - start production build lalu `npm run smoke -- <baseUrl>`;
   - DB migration fresh/upgrade test;
   - E2E auth/onboarding dan critical credential path;
   - secret production test negative (startup wajib gagal jika secret salah/default).

### Acceptance criteria dan verifikasi

- Seluruh handler production memakai kontrak outbox/worker Fase 1A; worker yang mati di tengah event tidak menyebabkan data bisnis/side effect inkonsisten dan event dapat diproses ulang tanpa duplikasi.
- Dead-letter event dapat ditemukan, dievaluasi, dan direplay melalui prosedur terdokumentasi.
- Sebuah request dapat dilacak dari HTTP → service → DB/outbox → worker dalam log/traces tanpa mengekspos secret.
- Restore drill menghasilkan environment fungsional sesuai RPO/RTO yang disetujui.
- CI gagal untuk type, lint, skill, unit, build, migration, smoke, atau E2E failure.

---

## 10. Fase 6 — AI dan live loker terukur

**Prioritas:** P2. Hanya dimulai sesudah identity, outbox, rate limit, observability, serta quota control tersedia.

### AI

1. Tambah persistence request/result:

```text
ai_evaluation_requests
  id, user_id nullable, subject_type, subject_id, provider, model,
  prompt_version, status, requested_at, completed_at nullable,
  idempotency_key unique, estimated_cost nullable
ai_evaluation_results
  id, request_id unique, schema_version, result_json, failure_code nullable,
  provider_request_id nullable
ai_usage_counters
  scope_type, scope_id, period_start, request_count, token_count nullable,
  cost_estimate nullable
```

2. Terapkan per-user/per-IP rate limit, quota/budget, timeout, redact key, dan cache key berdasarkan subject + prompt/schema version.
3. Fast interaction boleh sinkron hanya jika bounded timeout dan UI fallback tersedia; tugas lama/mahal dipindah ke worker.
4. AI memberi rekomendasi/schema-constrained output; keputusan verification/certification final tetap human/policy service.
5. Pertahankan failure policy saat key tidak tersedia: status eksplisit `tanpa_kunci`/gagal, tanpa mengarang skor.

### Loker

1. Sebelum live ingestion, baca dan ikuti skill `loker-sentinel`, `loker-evaluasi`, `careevo-attribution`, serta `career-ops-port`.
2. Pertahankan `ingestLoker` sebagai satu-satunya titik masuk data mentah.
3. Tambah source, snapshot/evidence, timestamp, cache, rate limit, ToS/legal review, dan ingestion worker yang idempoten.
4. Simpan data/facts audit; derive verdict dari flags saat dibaca, bukan sebagai field mutable yang bisa drift.
5. Tambah moderation/rule untuk community report sebelum hasil memengaruhi verdict publik.

### Acceptance criteria dan verifikasi

- Permintaan AI ke-N melampaui policy ditolak tanpa memanggil provider.
- Request identik dengan cache key sama tidak menghasilkan biaya/provider call kedua.
- Key tidak pernah hadir pada log/response; key kosong/palsu memiliki failure state yang bersih.
- Loker ingestion ulang tidak membuat duplikasi; verdict berubah hanya karena facts/flags berubah dan dapat dijelaskan.
- Evaluasi provider hidup hanya diklaim verified setelah integration test menggunakan environment secret yang authorized.

---

## 11. Kontrak API dan boundaries implementasi

### Server Action dan Route Handler

| Kebutuhan | Transport |
|---|---|
| Form UI internal (course, enrollment, submission, review) | Server Action → application service |
| Upload, public verify, webhook, health | Route Handler |
| Mobile/partner di masa depan | `/api/v1/...` versioned setelah contract disepakati |
| Email, AI, scan, notification, ingestion | Outbox worker |

Setiap mutasi harus menerapkan urutan berikut:

```text
parse input → authenticate principal → authorize role/ownership
→ application service → database transaction
→ audit/outbox → revalidate/response
```

Tidak boleh ada mutasi bisnis yang hanya terlindungi oleh layout, UI visibility, atau client-supplied ID tanpa ownership check.

### Peta modul target

```text
src/lib/config/                 Secret and environment validation (server-only)
src/lib/db/                     Connection, schema, migrations, transaction helpers
src/lib/auth/                   Identity repositories, password/session services, authorization
src/lib/<domain>/service.ts     Application service and state machine
src/lib/<domain>/repository.ts  Database access only
src/lib/storage/                Blob storage interface and implementations
src/lib/outbox/                 Outbox writer, worker handler registry, retry/idempotency
src/lib/audit/                  Append-only event repository and redaction
src/actions/                    Thin UI adapters only
src/app/api/                    Thin HTTP adapters only
```

Nama Indonesia untuk domain/business logic tetap mengikuti konvensi proyek apabila modul sekitarnya memakai Indonesia; infrastructure/UI mengikuti idiom file di sekitarnya.

---

## 12. Strategi test dan release

### Lapisan test

| Lapisan | Bukti minimum |
|---|---|
| Unit | Validasi, policy, canonicalization, state transition, redaction, resolver compatibility |
| Database integration | Constraint, transaction, authorization, idempotency, concurrent request, migration |
| Worker integration | Retry, duplicate delivery, dead-letter, recovery lease kedaluwarsa (simulasi crash) |
| HTTP/E2E | Login, role boundary, upload, cross-device progress, submit-review-attest-revoke, public verify |
| Build/deploy | `npm run build`, production start, smoke, secret validation, migration upgrade |
| Operasional | Backup/restore drill, alert exercise, credential revocation drill |

### Required gates setiap fase

1. Baca skill area yang relevan sebelum menyentuh domain (`loker-*`, `careevo-review`, `careevo-attribution`, atau `career-ops-port` bila berlaku).
2. Tambah test yang akan gagal pada regression sebelum mengklaim fix/feature selesai.
3. Jalankan minimal `npm run check` dan `npm run build`; untuk route/mutasi juga jalankan smoke/E2E yang sesuai.
4. Periksa diff terhadap placeholder, `TODO` yang menyembunyikan implementasi, `test.skip`, dan `test.only`.
5. Minta review/verifikasi terpisah; author tidak self-approve.
6. Catat migration ID, rollback/forward plan, dashboard/alert baru, serta evidence test pada PR/hand-off.

---

## 13. Milestone dan definition of done

| Milestone | Definition of done |
|---|---|
| M0 — Aman untuk staging | Secret production enforced, public staff signup/demo blocked, credential action authorized/disabled, **rate limit shared aktif**, dan gates berjalan |
| M1 — Identity otoritatif | Login/session/RBAC database, canonical role/username compatibility, staff invitation audited, cookie legacy tidak lagi authority |
| M1A — Async foundation | Outbox/worker dengan lease, idempotensi sink audit internal, retry/DLQ, replay ber-audit, dan bukti pemulihan claim/lease; sink attestation/email/file scan belum aktif dan wajib melewati gerbang fase pemiliknya sebelum credential, email, atau file production dibuka (§6, Fase 3, Fase 4) |
| M2 — Belajar lintas perangkat | Enrollment/progress/run/verified grade transactional dengan assessment version/snapshot immutable, cross-device E2E hijau |
| M3 — Credential tepercaya | Submission/review/attestation/revoke persistent, public verification dan audit lifecycle hijau dengan outbox Fase 1A |
| M4 — Storage production | File dan CMS DB/object storage, visibility/scan/legacy-consent policy, migration idempoten, tidak ada business write ke local filesystem production |
| M5 — Operable | Semua handler memakai outbox Fase 1A, telemetry, CI, restore drill evidence |
| M6 — Scale feature | AI quota/cache/async dan live loker compliant/observable |

---

## 14. Risiko, mitigasi, dan urutan rollback

| Risiko | Mitigasi |
|---|---|
| Data legacy cookie/file tidak dapat dipercaya atau terlalu besar | Migrasikan sebagai convenience state yang disaring; jangan jadikan evidence/credential authoritative; sediakan user recovery flow |
| Migrasi course mengubah ID modul dan menghilangkan progress | Pertahankan resolver dan `irisModulSelesai()`; import/cutover dengan report affected enrollment; jangan memetakan paksa ID lama |
| Dual-write membuat data divergen | Hindari dual-write lama; gunakan import idempoten, read-compare, lalu single-writer cutover dan audit count/hash |
| Worker delivery duplikat | Fase 1A transactional outbox, lease, idempotency key, retry backoff, DLQ (sink audit internal); provider timeout mitigasinya di gerbang §6 fase sink pemilik; Fase 5 menambah dashboard lag/error |
| Object storage memperluas akses file | Storage key opaque, owner/purpose metadata, signed read/upload, `pending_scan` blocked, lifecycle cleanup, dan explicit public visibility/legacy consent policy |
| ORM/provider lock-in | Repository boundary, ADR provider, migration SQL yang ter-review, dan export/restore test |
| Credential invalid terbit selama transisi | Fase 0 menonaktifkan/menolak issuance publik sampai Fase 3 service/state machine siap |
| Scope terlalu besar | Selesaikan vertical slice per milestone; jangan memigrasikan loker/AI sebelum M5 |

Rollback ideal dilakukan sebelum cutover write: matikan feature flag dan kembali ke reader lama. Setelah database menjadi single writer, gunakan migration forward-only/recovery script yang teruji; jangan menulis balik manual ke JSON/cookie.

---

## 15. Urutan kerja pertama yang siap dieksekusi

1. Buat ADR provider/hosting/database/storage/queue dan `.env.example` tanpa secret.
2. Implementasikan Fase 0 sebagai PR kecil terpisah: production-secret fail-fast, public role fix, demo account environment guard, review issuance lockdown, **rate limit shared aktif**, dan test adversarial.
3. Tambah Postgres + migration harness + schema identity/profile dalam PR terpisah.
4. Cut over auth/session/RBAC, canonical role/username adapter, dan staff invitation; selesaikan M1 sepenuhnya.
5. Implementasikan Fase 1A: transactional outbox/worker minimum, lease/idempotency/retry/DLQ/replay, serta uji duplicate-delivery dan crash recovery.
6. Implementasikan `LearningService` + enrollment/progress database dahulu; pilih dan implementasikan publication version atau snapshot assessment immutable sebelum verified run/server-side grading.
7. Implementasikan submission/review state machine dan attestation lifecycle di atas outbox Fase 1A; selesaikan M3.
8. Buat storage adapter + metadata + scan/visibility/legacy-consent policy, kemudian migrasikan resume/upload dan CMS data bertahap.
9. Selesaikan observability, CI, backup/restore drill, serta perluas worker handler di Fase 5.
10. Aktifkan AI/loker production dengan policy, cache, quota, dan worker setelah M5.

Setiap langkah dipisahkan menjadi PR yang kecil, memiliki migration plan, test evidence, dan reviewer/verifier terpisah.
