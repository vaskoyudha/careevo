# Careevo

**Careevo** adalah prototipe platform belajar-ke-kerja dengan prinsip **Learn. Verify. Earn.** Platform ini menghubungkan pembelajaran terarah, bukti kompetensi, proyek atau submission, proses review, dan verifikasi publik dalam satu alur.

> **Deployment publik:** [careevo.my.id](https://careevo.my.id/)
>
> Status proyek saat ini adalah MVP/prototipe yang terus dikembangkan. Beberapa domain masih memakai penyimpanan file lokal atau fixture dan belum siap untuk deployment multi-instance tanpa migrasi lanjutan.

## Daftar isi

- [Tentang Careevo](#tentang-careevo)
- [Tujuan](#tujuan)
- [Fitur utama](#fitur-utama)
- [Alur pengguna](#alur-pengguna)
- [Arsitektur singkat](#arsitektur-singkat)
- [Struktur direktori](#struktur-direktori)
- [Penyimpanan data](#penyimpanan-data)
- [Prasyarat](#prasyarat)
- [Menjalankan secara lokal](#menjalankan-secara-lokal)
- [Konfigurasi environment](#konfigurasi-environment)
- [PostgreSQL dan migrasi](#postgresql-dan-migrasi)
- [Akun demo dan bootstrap admin](#akun-demo-dan-bootstrap-admin)
- [Menjalankan production build](#menjalankan-production-build)
- [Worker outbox](#worker-outbox)
- [Pengujian](#pengujian)
- [Dokumentasi lanjutan](#dokumentasi-lanjutan)
- [Batasan yang perlu diketahui](#batasan-yang-perlu-diketahui)
- [Kontribusi](#kontribusi)

## Tentang Careevo

Careevo dibangun sebagai jembatan antara proses belajar dan kesiapan kerja. Pengguna dapat:

1. membuat akun dan menyelesaikan onboarding;
2. menemukan kursus, modul, materi, dan kuis;
3. mengikuti pembelajaran serta merekam bukti penyelesaian;
4. mengerjakan latihan atau mengirimkan hasil kerja;
5. menerima review dari verifikator;
6. memperoleh attestation yang dapat diverifikasi melalui halaman publik; dan
7. menelusuri lowongan kerja dengan sinyal kepercayaan serta audit yang transparan.

Selain aplikasi utama, repository ini memuat integrasi dan komponen pendukung untuk **AI Mastery**, yaitu aplikasi pembelajaran AI yang dibingkai di route `/ai-mastery`. Kode pendukungnya berada di `features/sijago/` dan `backend/`; keduanya memiliki dokumentasi serta runtime sendiri.

## Tujuan

Careevo bertujuan untuk:

- membantu pengguna belajar berdasarkan tujuan karier, bukan hanya mengumpulkan materi;
- mengubah aktivitas belajar menjadi bukti yang dapat ditinjau;
- memisahkan klaim dari browser dengan hasil yang dihitung dan diotorisasi server;
- menyediakan proses review yang memiliki state machine dan jejak audit;
- menerbitkan bukti kompetensi yang dapat diverifikasi tanpa login; dan
- membantu pengguna menemukan lowongan dengan informasi risiko yang lebih jujur.

Proyek ini tidak mengklaim bahwa seluruh penilaian otomatis atau audit lowongan sudah sempurna. Jika data tidak cukup untuk menyimpulkan sesuatu, sistem dirancang untuk menampilkan keadaan seperti **Belum diperiksa** atau **Perlu ditinjau**, bukan memberikan kepastian palsu.

## Fitur utama

### Pembelajaran dan katalog kursus

- katalog kursus dan halaman eksplorasi;
- kursus, spesialisasi, career academy, dan professional certificate;
- modul dengan materi video/PDF;
- halaman prosa berbasis blok terstruktur, bukan HTML mentah;
- kuis yang disimpan sebagai bank terpisah dan dapat dipakai ulang di beberapa modul;
- jalur belajar dan rekomendasi berbasis onboarding; serta
- mode latihan dan mastery untuk pembelajaran yang lebih fokus.

### Assessment dan bukti belajar

- attempt kuis dibuka dan dinilai di server;
- assessment menggunakan snapshot yang tidak berubah setelah attempt dimulai;
- progress modul dan bukti penyelesaian disimpan melalui layanan learning;
- dashboard performa untuk learner dan verifikator; serta
- dukungan sesi belajar dan bukti kamera sesuai kebijakan kursus.

### Submission, review, dan attestation

- learner mengirimkan pekerjaan untuk ditinjau;
- verifikator mengikuti alur review yang terkontrol;
- transisi submission menggunakan state machine dan compare-and-set;
- attestation ditandatangani dengan HMAC-SHA256;
- status attestation aktif atau dicabut authoritative di database; dan
- token publik dapat diperiksa melalui `/verify/[token]`.

### Job board dan audit lowongan

- inbox lowongan kerja;
- pencarian dan filter lowongan;
- audit deterministik melalui Sentinel;
- sinyal seperti nama perusahaan yang tidak dapat diverifikasi atau bahasa biaya;
- verdict yang diturunkan saat data dibaca, bukan disimpan sebagai fakta permanen; dan
- rekomendasi kursus atau jalur belajar yang berkaitan dengan lowongan.

### Profil dan kesiapan kerja

- onboarding berbasis tujuan, latar belakang, minat, dan preferensi kerja;
- profil publik di `/p/[username]`;
- resume bergaya LinkedIn dengan pengalaman, proyek, pendidikan, keahlian, sertifikasi, dan berkas CV/portofolio PDF; serta
- halaman publik untuk membagikan berkas yang memang dipilih untuk dibagikan.

### Evaluasi AI opsional

Gemini digunakan secara on-demand untuk beberapa panel evaluasi dan rekomendasi. Fitur ini tidak wajib untuk menjalankan aplikasi dasar. Tanpa `GEMINI_API_KEY`, bagian yang memerlukan model akan menggunakan kebijakan kegagalan yang sesuai dan tidak melakukan panggilan jaringan.

## Alur pengguna

### Learner

1. Buka `/daftar` atau `/masuk`.
2. Selesaikan `/onboarding`.
3. Jelajahi kursus melalui `/belajar`, `/courses`, atau katalog terkait.
4. Ikuti modul, materi, dan kuis.
5. Gunakan `/dashboard`, `/progres`, atau halaman fokus untuk melihat kemajuan.
6. Kirim pekerjaan dari area submission bila alur tersebut tersedia.
7. Lihat hasil review dan bagikan token verifikasi jika attestation diterbitkan.

### Verifikator atau admin

1. Masuk dengan akun yang memiliki role sesuai.
2. Buka area `/review`, `/audit`, `/performa`, atau `/admin`.
3. Tinjau submission, performa, integritas, kursus, atau kuis.
4. Jalankan perubahan melalui action yang memeriksa principal dan authorization di server.
5. Gunakan audit trail untuk menelusuri perubahan penting.

## Arsitektur singkat

Aplikasi utama memakai Next.js App Router dengan pembagian tanggung jawab berikut:

```text
UI / Server Component / Server Action / Route Handler
                         |
                         v
       principal + authorization + validasi Zod
                         |
                         v
                  application service
                         |
                         v
              repository + transaksi PostgreSQL
                         |
             +-----------+-----------+
             v                       v
       audit event             transactional outbox
                                         |
                                         v
                              worker dan sink idempoten
```

Prinsip arsitektur yang penting:

- PostgreSQL adalah sumber kebenaran untuk identity, RBAC, session, audit, outbox, learning evidence, review, dan attestation yang sudah dimigrasikan.
- Data yang menentukan eligibility tidak boleh dipercaya dari input browser. Score, completion, target identity, role, dan payload credential dibangun atau diverifikasi di server.
- Assessment yang berpengaruh pada verified completion memakai snapshot immutable.
- Konten halaman disimpan sebagai blok terstruktur; aplikasi tidak merender HTML admin menggunakan `dangerouslySetInnerHTML`.
- `modulUntuk()` dan `modulUntukSumber()` di `src/lib/courses/modul-resolver.ts` adalah resolver modul tunggal untuk data stored/derived.
- Kode client-safe pada `src/lib/courses/{kurikulum,blok,halaman,kuis}.ts` tidak boleh menarik dependency server seperti filesystem atau database.
- Persistence cookie, file store, JSON course store, dan PostgreSQL sengaja belum disatukan seluruhnya karena batasan domainnya berbeda.

Topologi deployment produksi masih memiliki bagian yang berstatus usulan. Baca [ADR 0001](docs/adr/0001-topologi-deployment-produksi.md) sebelum menyimpulkan bahwa VPS, worker, atau provider tertentu sudah menjadi keputusan final.

## Struktur direktori

```text
src/app/                  Route Next.js, route group, halaman, API
src/actions/              Server Action untuk mutasi aplikasi
src/components/           Komponen UI dan feature component
src/lib/                  Domain logic, service, repository, validasi, dan utilitas
src/lib/auth/             Identity, session, role, authorization, audit
src/lib/courses/          Katalog, kurikulum, modul, halaman, materi, kuis
src/lib/learning/         Session belajar, progress, assessment, dashboard
src/lib/review/           Submission, review, badge, dan attestation lifecycle
src/lib/jobs/             Cache, filter, trust, ingest, dan rekomendasi lowongan
src/lib/career-ops/       Adapter Careevo ke engine career-ops
src/lib/db/               Client, schema, dan migrasi database
src/lib/outbox/           Writer, worker, replay, handler, dan delivery ledger
src/components/ui/        Komponen UI bersama
scripts/                  Migrasi, worker, smoke check, E2E, dan utilitas operator
drizzle/                  SQL migrasi Drizzle yang di-commit
data/                     Data course/kuis lokal; sebagian di-gitignore
.data/                    Penyimpanan file runtime lokal; di-gitignore
docs/                     Runbook, ADR, rencana, dan dokumentasi teknis
features/sijago/          Aplikasi AI Mastery yang dibingkai di /ai-mastery
backend/                  Backend FastAPI untuk AI Mastery
engine/                   Vendored engine career-ops
mockup/                   Referensi HTML/CSS statis, bukan bagian build utama
```

`backend/`, `engine/`, dan `features/sijago/` bukan source tree biasa dari aplikasi Careevo. Masing-masing memiliki runtime atau provenance tersendiri. Jangan menjalankan lint/typecheck root dengan asumsi semua file vendored adalah source Careevo.

## Penyimpanan data

Careevo saat ini memiliki beberapa jalur penyimpanan yang berbeda:

| Penyimpanan | Isi utama | Catatan |
|---|---|---|
| PostgreSQL + Drizzle | identity, user role, session, audit, outbox, learning evidence, assessment, review, badge, attestation | Sumber kebenaran untuk domain yang sudah dimigrasikan |
| `data/courses.json` dan `data/kuis.json` | course, modul, halaman, materi, bank kuis | Cache per proses; restart server bila proses lain menulis data |
| `.data/` | resume, performa legacy/operasional, sesi belajar, mastery, job cache, career-ops inbox | File store lokal; tidak cocok sebagai state bersama multi-instance |
| Cookie bertanda tangan | Sebagian state legacy atau state kecil selama migrasi | Kapasitas terbatas dan tidak menggantikan database |
| `public/uploads/` | Upload lokal tertentu, terutama attachment kursus saat development | Pada deployment serverless, filesystem lokal tidak durable |

Aturan penting:

- Jangan memasukkan secret atau data produksi ke `data/`, `.data/`, `.env.example`, atau commit.
- Jangan memakai kredensial PostgreSQL dev yang dipublikasikan untuk produksi.
- Fitur yang menulis ke filesystem memerlukan host dengan filesystem writable dan durable, atau harus menunggu migrasi ke object storage/database.

## Prasyarat

- Node.js yang memenuhi kebutuhan Vitest 5: `^22.12.0`, `^24.0.0`, atau `>=26.0.0`.
- npm dan Git.
- PostgreSQL 16 atau lebih baru untuk aplikasi lokal dan test integrasi.
- Docker/ Docker Compose **atau** PostgreSQL native yang berjalan di `127.0.0.1:5432`.
- Opsional: `GEMINI_API_KEY` untuk evaluasi AI.
- Opsional: runtime AI Mastery jika ingin menggunakan `/ai-mastery` secara penuh.

Repository ini tidak mengunci `engines` atau `packageManager` di `package.json`; gunakan versi Node yang kompatibel dan konsisten di seluruh tim.

## Menjalankan secara lokal

### 1. Instal dependency

```bash
npm ci
```

### 2. Siapkan environment

Untuk development dasar, aplikasi memiliki fallback dev yang terdokumentasi. Jika ingin mengatur nilai sendiri:

```bash
cp .env.example .env.local
```

Isi `.env.local` sesuai kebutuhan. Jangan commit `.env.local`.

### 3. Nyalakan PostgreSQL

Dengan Docker Compose:

```bash
docker compose up -d postgres
docker compose ps
```

Tunggu service berstatus `healthy`. Kredensial dev pada `docker-compose.yml` adalah:

```text
Host:     127.0.0.1
Port:     5432
Database: careevo
User:     careevo
Password: careevo_dev
```

Jika Docker tidak tersedia, jalankan PostgreSQL native dan pastikan database serta user tersebut tersedia. Prosedur yang lebih lengkap, termasuk masalah port, reset, migrasi, dan test database ephemeral, ada di [docs/local-db.md](docs/local-db.md).

### 4. Terapkan migrasi

```bash
npm run db:migrate
```

### 5. Jalankan server development

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000).

Server development memakai Turbopack secara default. Route seperti `/belajar` atau `/ai-mastery` yang mengarahkan pengguna belum login ke `/masuk` merupakan perilaku auth yang diharapkan.

### Menjalankan seluruh stack AI Mastery

Careevo utama berjalan di `:3000`. AI Mastery dapat memerlukan beberapa proses tambahan:

| Port | Komponen |
|---|---|
| `3000` | Careevo |
| `3790` | aplikasi web AI Mastery |
| `8011` | backend FastAPI AI Mastery |
| `5432` | PostgreSQL |

Detail cara membangun dan menjalankan AI Mastery harus mengikuti dokumentasi di `features/sijago/` dan `backend/`. Jangan menganggap `npm run dev` root menyalakan seluruh stack tersebut.

## Konfigurasi environment

Salin `.env.example` menjadi `.env.local` lalu baca komentar di dalamnya. Variabel utama:

### Secret

- `SESSION_SECRET` — tanda tangan session dan state auth.
- `ATTESTATION_SECRET` — tanda tangan attestation.

Dalam `NODE_ENV=production`, kedua secret wajib diisi, berbeda antar-environment, memiliki panjang yang cukup, dan bukan nilai default. Contoh membuat secret lokal:

```bash
openssl rand -base64 48
```

Jangan memakai hasil contoh yang sama di deployment publik.

### Database

- `DATABASE_URL` — koneksi PostgreSQL aplikasi.
- `TEST_DATABASE_URL` — override koneksi test; biasanya tidak perlu diisi karena test integrasi membuat database ephemeral.

Di production, `DATABASE_URL` kosong akan membuat server menolak start. Fallback kredensial dev hanya untuk development dan test lokal.

### Demo, rate limit, dan AI

- `DEMO_MODE=1` — hanya boleh dipakai bersama `NODE_ENV=development`; mengaktifkan akun demo lokal.
- `UPSTASH_REDIS_REST_URL` dan `UPSTASH_REDIS_REST_TOKEN` — konfigurasi rate limit shared untuk environment production.
- `GEMINI_API_KEY` — mengaktifkan evaluasi AI on-demand.
- `AI_MASTERY_API_URL` — basis URL API FastAPI AI Mastery, biasanya `http://127.0.0.1:8011` lokal.
- `AI_MASTERY_WEB_URL` — basis URL aplikasi web yang di-frame pada `/ai-mastery`.

Variabel `CAREEVO_TRUST_PROXY_HEADERS`, `CAREEVO_TRUST_REAL_IP_HEADER`, dan `CAREEVO_ALLOW_MISSING_ORIGIN` hanya boleh diaktifkan bila topologi proxy dan threat model-nya sudah dipahami. Jangan mengaktifkan pengaturan tersebut sekadar untuk menghilangkan error lokal.

## PostgreSQL dan migrasi

Schema utama berada di `src/lib/db/schema.ts`; SQL hasil generate berada di `drizzle/` dan harus ikut direview serta di-commit ketika ada perubahan schema.

```bash
# Menghasilkan SQL migrasi dari perubahan schema.
# Perintah ini tidak menyentuh database.
npm run db:generate

# Baca SQL yang dihasilkan, lalu terapkan ke DATABASE_URL.
npm run db:migrate
```

Aturan migrasi:

- migrasi yang sudah diterapkan tidak boleh diedit;
- rollback dilakukan sebagai migrasi baru yang mengoreksi keadaan sebelumnya;
- `db:generate` tidak sama dengan `db:migrate`;
- test integrasi menjalankan migrasi yang sama pada database ephemeral; dan
- reset database lokal dapat menghapus data secara permanen.

Untuk runbook lengkap, bootstrap admin pertama, melihat tabel, reset, dan troubleshooting, baca [docs/local-db.md](docs/local-db.md).

### Bootstrap admin pertama

Database baru tidak otomatis memiliki admin. Setelah akun didaftarkan melalui alur normal dan identitasnya diverifikasi oleh operator di luar aplikasi, admin pertama dapat diberikan melalui:

```bash
npx tsx scripts/bootstrap-admin.ts --list-candidates
npx tsx scripts/bootstrap-admin.ts admin@contoh.test
```

Perintah ini adalah utilitas operator dan sengaja tidak dibuat sebagai script `npm` biasa agar tidak ikut terpanggil oleh proses build/deploy tanpa dibaca terlebih dahulu.

## Akun demo dan bootstrap admin

Akun demo hanya boleh digunakan di development lokal dengan opt-in eksplisit:

```bash
NODE_ENV=development DEMO_MODE=1 npm run dev
```

Akun demo yang tersedia saat ini didefinisikan di `src/lib/auth/demo-accounts.ts`. Password demo bersifat publik dan **tidak boleh** dipakai pada deployment yang dapat diakses umum.

Untuk production, gunakan akun normal dan jalur bootstrap/invitation yang terdokumentasi. Jangan menyalin cookie demo atau secret development ke lingkungan lain.

## Menjalankan production build

Build dan server production dijalankan terpisah:

```bash
npm run build
npm start
```

`npm start` menyajikan hasil build `.next`; perubahan source setelah build tidak akan terlihat sampai build dijalankan kembali. Sebelum deployment publik, isi secret production, `DATABASE_URL`, rate limit production, dan konfigurasi filesystem/object storage sesuai topologi yang disetujui.

Catatan penting: [ADR 0001](docs/adr/0001-topologi-deployment-produksi.md) masih berstatus usulan untuk sebagian topologi. Aplikasi saat ini masih memiliki domain yang menulis ke filesystem sehingga tidak boleh diasumsikan aman untuk horizontal scaling atau filesystem read-only.

## Worker outbox

Outbox menyimpan efek samping transaksional setelah perubahan bisnis. Worker dapat dijalankan dengan:

```bash
npm run worker
```

Untuk replay dead-letter secara manual:

```bash
npm run outbox:replay
```

Baca [docs/outbox-worker.md](docs/outbox-worker.md) sebelum menjalankan worker di environment bersama. Worker tidak menjanjikan exactly-once untuk semua sink. Replay adalah operasi teraudit dan memerlukan actor admin serta alasan yang sesuai.

## Pengujian

### Test unit

```bash
npm test
```

Test unit tidak memerlukan PostgreSQL. Satu file test atau satu test name dapat dijalankan dengan:

```bash
npx vitest run src/lib/scoring/scoring.test.ts
npx vitest run -t "A1:"
```

### Test integrasi database

```bash
npm run test:db
```

Test ini memerlukan PostgreSQL aktif. Setup membuat database `careevo_test_<seed>` baru, menjalankan migrasi, lalu menghapusnya saat teardown. Test integrasi harus menggunakan suffix `*.integration.test.ts` agar tidak ikut suite unit.

Jangan menjalankan beberapa proses integration test yang memakai database server yang sama secara bersamaan; test dapat melakukan `TRUNCATE ... CASCADE` antar file.

### Pemeriksaan manual utama

```bash
npm run typecheck
npm run lint
npm run skills:check
npm test
```

Atau gunakan gate yang sama melalui:

```bash
npm run check
```

`npm run check` tidak menjalankan `npm run build` dan `npm run test:db`. Untuk verifikasi yang lebih lengkap, jalankan keduanya secara terpisah.

### Smoke check dan E2E onboarding

Keduanya memerlukan server yang sedang berjalan:

```bash
npm run smoke -- http://localhost:3000
npm run e2e:onboarding -- http://localhost:3000
```

Smoke check memperoleh daftar route dari array di script, jadi jangan mengandalkan jumlah route yang ditulis di komentar lama.

## Dokumentasi lanjutan

- [AGENTS.md](AGENTS.md) — kontrak kerja, arsitektur, batasan vendored tree, dan jebakan runtime.
- [docs/local-db.md](docs/local-db.md) — PostgreSQL lokal, migrasi, bootstrap admin, reset, dan troubleshooting.
- [docs/outbox-worker.md](docs/outbox-worker.md) — lease, retry, dead-letter, replay, dan batas idempotensi.
- [docs/backend-production-plan.md](docs/backend-production-plan.md) — rencana migrasi backend Fase 0–6.
- [docs/backend-mvp-plan.md](docs/backend-mvp-plan.md) — batas MVP backend dan alur review.
- [docs/adr/0001-topologi-deployment-produksi.md](docs/adr/0001-topologi-deployment-produksi.md) — usulan topologi deployment.
- [docs/adr/0002-database-orm-postgres.md](docs/adr/0002-database-orm-postgres.md) — keputusan Drizzle dan PostgreSQL.
- [docs/adr/0003-assessment-immutable-snapshot.md](docs/adr/0003-assessment-immutable-snapshot.md) — snapshot assessment immutable.
- [docs/adr/0004-review-state-machine-attestation.md](docs/adr/0004-review-state-machine-attestation.md) — state machine review dan lifecycle attestation.
- [docs/security-release-checklist.md](docs/security-release-checklist.md) — checklist bukti release dan hardening keamanan.
- [DESIGN.md](DESIGN.md) — bahasa visual dan token desain.
- `.agents/skills/` — pengetahuan khusus untuk area loker, evaluasi, browser verification, career-ops, dan self-review.

## Batasan yang perlu diketahui

- Sebagian persistence masih berupa cookie atau file lokal dan belum durable untuk deployment serverless/multi-instance.
- Data kursus dan kuis memakai cache per proses; perubahan dari proses lain dapat memerlukan restart server.
- Evaluasi Gemini bersifat opsional dan on-demand, sehingga hasil serta biaya bergantung pada konfigurasi provider.
- Kuis adalah practice tool, bukan ujian anti-cheat penuh: answer key masih dapat dikirim ke renderer untuk feedback lokal.
- Audit lowongan bergantung pada data yang berhasil diambil. Detail lowongan yang client-rendered atau diblokir dapat mengurangi cakupan sinyal.
- Topologi production, retention, owner operasional, dan beberapa provider masih memerlukan keputusan atau ratifikasi ADR.
- Tidak ada workflow CI repository yang menjadi gate otomatis; `npm run check` adalah gate manual saat ini.

## Kontribusi

Sebelum mengubah kode:

1. baca `AGENTS.md` dan skill yang relevan di `.agents/skills/`;
2. ikuti pola domain dan bahasa identifier yang sudah ada;
3. tambahkan atau perbarui test untuk perubahan perilaku;
4. jangan menambahkan HTML mentah atau `dangerouslySetInnerHTML` untuk konten halaman;
5. jalankan `npm run check`, serta `npm run build` bila menyentuh boundary client/server atau dependency Next.js; dan
6. tinjau [careevo-review skill](.agents/skills/careevo-review/SKILL.md) sebelum membuat commit.

Perubahan dokumentasi seperti README ini tidak otomatis di-commit atau di-push oleh instruksi ini. Tinjau diff terlebih dahulu, lalu buat commit dan push secara terpisah sesuai proses maintainer.
