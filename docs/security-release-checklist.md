# Checklist Rilis Keamanan — M0

**Milestone:** M0 "Aman untuk staging" (`docs/backend-production-plan.md` §13)
**Sumber pekerjaan:** rencana §4 Fase 0, §12 (gate), §13 (DoD)
**Konteks topologi:** `docs/adr/0001-topologi-deployment-produksi.md` (topologi sementara M0: Vercel memiliki seluruh permukaan browser; VPS belum ada)
**Status:** BELUM DIMULAI — tidak ada kotak yang boleh dicentang sebelum dikerjakan

---

## Cara memakai checklist ini

- Setiap baris punya **aksi**, **berkas**, dan **bukti**. Baris tanpa bukti dianggap belum
  selesai, walaupun kodenya sudah ditulis.
- **Bukti** berarti perintah yang dijalankan beserta hasilnya, atau path test yang gagal
  sebelum perbaikan. Bukan "sudah dicek".
- **Penulis tidak boleh self-approve.** Bagian D ditandatangani orang selain yang
  mengerjakan (rencana §12 butir 5). Ini aturan proses repo, bukan saran.
- Jangan mencentang baris **Grup T** (topologi) untuk melewatkan M0. Grup T berjalan paralel
  dan baru menjadi wajib saat VPS melayani trafik.

### Dua gerbang yang berbeda

| Gerbang | Blokir apa | Grup |
|---|---|---|
| **Gerbang M0** | Deployment publik yang memercayai staff action atau attestation | A, B, C, D |
| **Gerbang VPS** | Saat VPS mulai menerima trafik pengguna | T |

Grup T **tidak** boleh dijadikan alasan menunda Grup A/B. Rate limit shared, misalnya,
dikerjakan di Vercel dan tidak menunggu VPS (ADR §10.1).

---

## Grup A — Containment kredensial dan secret

### A1. Helper konfigurasi server-only dan fail-fast

- [ ] Buat modul konfigurasi server-only (target: `src/lib/config/`) yang membaca secret
      dan **menghentikan proses** bila `NODE_ENV=production` dan secret kosong, bernilai
      default yang dikenal, atau di bawah panjang minimum.
- [ ] Pisahkan secret minimal: session/auth, attestation, cookie state legacy selama
      migrasi, webhook, dan storage. Jangan satu variabel untuk semua.
- [ ] Validasi berjalan **sebelum** modul lain membacanya. Ingat: `const SECRET =
      process.env.X ?? ...` di top level modul dievaluasi saat modul dimuat, bukan saat
      request — validasi harus mendahului titik itu (ADR §11.4).
- [ ] Jangan hapus jalur dev/test. Development dan test tetap harus jalan tanpa `.env`;
      yang berubah adalah production menolak nilai default.

**Berkas:** `src/lib/config/**` (baru), `src/lib/auth/session.ts`, `src/lib/auth/user-store.ts`,
`src/lib/courses/enrollment.ts`, `src/lib/onboarding/store.ts`, `src/lib/profile/store.ts`,
`src/lib/learning/session.ts`, `src/lib/learning/chat-store.ts`, `src/lib/attestation/token.ts`

**Bukti:** perintah yang menjalankan server dengan `NODE_ENV=production` tanpa secret, dan
menunjukkan proses gagal start sebelum menerima request. Test negatif untuk setiap varian:
kosong, nilai default lama, terlalu pendek.

### A2. Hilangkan fallback secret untuk production

Saat ini **setiap** modul di bawah memakai pola `process.env.X ?? "<default dev>"`. Default
dev harus tetap ada untuk development, tetapi tidak boleh berlaku di production.

| Modul | Variabel | Default dev yang harus ditolak di production |
|---|---|---|
| `src/lib/auth/session.ts` | `SESSION_SECRET` | `dev-session-secret-careevo` |
| `src/lib/auth/user-store.ts` | `SESSION_SECRET` | `dev-session-secret-careevo` |
| `src/lib/courses/enrollment.ts` | `SESSION_SECRET` | `dev-session-secret-careevo` |
| `src/lib/onboarding/store.ts` | `SESSION_SECRET` | `dev-session-secret-careevo` |
| `src/lib/profile/store.ts` | `SESSION_SECRET` | `dev-session-secret-careevo` |
| `src/lib/learning/session.ts` | `SESSION_SECRET` | `dev-session-secret-careevo` |
| `src/lib/learning/chat-store.ts` | `SESSION_SECRET` | `dev-session-secret-careevo` |
| `src/lib/attestation/token.ts` | `ATTESTATION_SECRET` | `dev-attestation-secret` |

- [ ] Setiap baris di atas ditangani dan punya test negatif production.
- [ ] **Rotasi tidak dilakukan tanpa rencana invalidasi.** Mengganti `SESSION_SECRET`
      mencabut semua cookie bertanda tangan lama; mengganti `ATTESTATION_SECRET` membuat
      token lama gagal verifikasi. Untuk attestation, rotasi menuntut `key_version` dan
      kunci lama yang tetap dipertahankan untuk verifikasi (ADR §6.3 butir 5). Tulis rencana
      itu sebelum menyentuh nilai di production.

**Bukti:** test negatif per variabel; catatan rencana rotasi.

---

## Grup B — Otorisasi dan penutupan jalur credential

### B1. Registrasi publik selalu `learner`

Hari ini `registerRoleSchema` menerima `"verifikator"` (`src/lib/validation/auth.ts`), dan
`registerAction` membaca `role` langsung dari `FormData` (`src/actions/auth.ts`). Artinya
siapa pun dapat mendaftar sebagai staff.

- [ ] Hapus role staff dari schema, form, dan action publik. `registerSchema` tidak lagi
      menerima `role` dari klien — role ditetapkan server.
- [ ] Uji dengan request yang dimodifikasi (field `role=verifikator` disuntikkan ke
      `FormData`) dan dengan pemanggilan action langsung; keduanya harus tetap menghasilkan
      `learner`.
- [ ] Provisioning `verifikator`/`admin` dirancang sebagai alur invitation/admin-only yang
      mencatat actor, expiry, redemption sekali pakai, dan approval. Implementasinya milik
      Fase 1; yang wajib di M0 adalah **jalur publiknya tertutup**.

**Berkas:** `src/lib/validation/auth.ts`, `src/actions/auth.ts`, `src/components/features/auth/**`

**Bukti:** test adversarial yang gagal sebelum perbaikan dan lulus sesudahnya.

### B2. Akun demo mati di staging/production

`authenticate()` mencocokkan `DEMO_ACCOUNTS` **sebelum** menyentuh user store, tanpa melihat
`NODE_ENV` (`src/lib/auth/session.ts`). Halaman `/masuk` juga mencetak email dan password
demo ke UI (`src/app/(public)/masuk/page.tsx`). Di staging/production ini berarti login
terbuka.

- [ ] `authenticate()` menolak akun demo kecuali di environment demo terisolasi.
- [ ] Petunjuk demo (email dan password) hanya dirender di environment demo, termasuk
      prefill `?email=`.
- [ ] Demo hanya hidup di environment demo dengan data demo — bukan di staging yang memakai
      data nyata.
- [ ] Hapus `DEMO_PASSWORD` dari bundle publik; nilai itu tidak boleh dapat dibaca dari
      HTML halaman.
- [ ] Uji: login dengan `user@careevo.test` / `careevo` (atau `verifikator@`, `admin@`) pada
      server `NODE_ENV=production` harus **gagal**.

**Berkas:** `src/lib/auth/session.ts`, `src/app/(public)/masuk/page.tsx`,
`src/components/features/auth/**`

**Bukti:** test login demo ditolak di production; tangkapan halaman `/masuk` yang tidak lagi
memuat password demo.

### B3. `decideReview()` diperbaiki atau dimatikan

`src/actions/review.ts` tidak memanggil `getSession()` sama sekali, dan menerima `username`,
`total`, serta `task_title` dari `FormData` — lalu menandatangani attestation dari nilai
yang dikirim klien. Siapa pun yang dapat memanggil action ini dapat menerbitkan credential
untuk identitas dan skor pilihannya sendiri.

- [ ] Sebelum database review siap: **nonaktifkan** issuance attestation di environment
      publik atau kembalikan galat eksplisit. Jangan biarkan jalur ini hidup.
- [ ] Tambahkan auth principal dan otorisasi staff secara independen di dalam action.
      Layout **bukan** boundary otorisasi — action dapat dipanggil tanpa melewatinya.
- [ ] Jangan menerima username, task, score, eligibility, atau identity target yang
      menentukan issuance dari `FormData`.
- [ ] Audit action credential lain dengan pola yang sama. `decideReview` bukan satu-satunya
      tempat skor atau identitas mengalir dari klien; `src/actions/performa.ts`
      (`simpanNilaiKuisAction`) menyimpan skor yang dilaporkan klien — pastikan ia tidak
      dipakai untuk eligibility sampai Fase 2 memberi penilaian server-side.

**Berkas:** `src/actions/review.ts`, `src/lib/actions-common.ts`

**Bukti:** test yang memanggil `decideReview` tanpa principal staff → ditolak; dan test yang
memanggilnya dengan `FormData` berisi `score`/`username` palsu → payload credential tidak
berubah. Jalankan juga `npm run smoke` terhadap `/verify/<token>` untuk memastikan halaman
verifikasi masih berperilaku benar.

### B4. Audit mutasi: authentication, authorization, validation

- [ ] Setiap Server Action dan Route Handler yang melakukan mutasi diperiksa satu per satu.
      Minimal yang perlu dilihat: `src/actions/*.ts` (auth, courses, enrollment, evaluasi,
      halaman, kuis, learning, learning-chat, materi, modul, onboarding, performa, profile,
      resume, review) dan `src/app/api/unggah/route.ts`.
- [ ] Setiap mutasi punya: authentication, role/ownership authorization, validasi Zod, galat
      yang tidak membocorkan secret, dan audit event (audit event menyusul Fase 3 — catat
      yang belum ada, jangan diamkan).
- [ ] Ownership check oleh `user_id`, bukan hanya "ada sesi". Pola bergate-staff saja tidak
      cukup untuk data learner.
- [ ] Catat temuan sebagai daftar terbuka. Item yang tidak dapat diperbaiki di M0 ditulis
      eksplisit beserta alasannya; jangan ditandai selesai.

**Bukti:** tabel audit yang terisi: action/route, ada-tidaknya auth, authorization,
validation. Ini bukti, bukan ringkasan naratif.

---

## Grup C — Pertahanan runtime dan gate rilis

### C1. Security headers baseline

`next.config.ts` saat ini tidak punya `headers()`, dan repo tidak punya `middleware.ts`.

- [ ] Tambahkan header baseline: `X-Content-Type-Options: nosniff`, frame policy,
      referrer policy, permissions policy. HSTS di edge HTTPS.
- [ ] **CSP menyusul** setelah uji kompatibilitas. Jangan pasang CSP yang belum diuji ke
      halaman yang dirender; CSP yang salah mematikan UI tanpa terlihat di test.
- [ ] Verifikasi dengan `curl -I` terhadap server yang berjalan, bukan dengan membaca kode.

**Berkas:** `next.config.ts`

**Bukti:** keluaran `curl -I <baseUrl>/` yang menunjukkan setiap header.

### C2. Rate limit shared — **aktif sebelum M0 selesai**

- [ ] Pasang limiter berbasis Upstash Redis lewat REST
      (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`). **Memory per-proses bukan
      kontrol production** (rencana §4 butir 8).
- [ ] Key gabungan **IP dan principal/akun** bila tersedia. Jangan hanya salah satu.
- [ ] Cakup minimal: login, daftar, reset password (kebijakan dibuat bersama fiturnya),
      upload, verify publik, dan aksi AI. Lihat tabel lengkap di ADR §10.3.
- [ ] Isolasi environment: database/prefix Upstash terpisah antara staging dan production.
- [ ] Tetapkan angka ambang dan catat di ADR §10.4. Angka di sana masih **usulan**, bukan
      keputusan.
- [ ] Tetapkan perilaku saat Upstash gagal (fail-closed vs fail-open) secara eksplisit.
      Uji dengan mensimulasikan Upstash tidak terjangkau.
- [ ] Batasi ukuran dan konkurensi body **sebelum** handler mahal dijalankan dan sebelum
      provider AI dipanggil. Pola ini sudah ada di `POST /api/unggah`, yang memeriksa
      `Content-Length` sebelum `formData()` — jadikan standar. `bodySizeLimit` di
      `next.config.ts` hanya berlaku untuk Server Action, bukan Route Handler.

#### Bentuk respons 429 — baca sebelum menulis kode

Ini mudah diklaim salah, dan salah klaim di sini menghasilkan test yang menguji hal yang
tidak ada:

- **Route Handler** dapat membalas `Response.json(body, { status: 429, headers: {
  "Retry-After": ... } })`. Ini 429 sungguhan.
- **Server Action tidak dapat menetapkan kode status atau header.** Header sudah dikirim
  sebelum action selesai. Rate limit di dalam Server Action **tidak** menghasilkan 429 —
  transportnya tetap 200. Yang benar: kembalikan state terserialisasi
  (`{ ok: false, error, retryAfterSeconds }`) yang dirender klien.
- **Halaman RSC tidak dapat membalas 429.** `GET /verify/[token]` hari ini adalah halaman
  RSC, jadi endpoint verify publik butuh keputusan bentuk: pindah ke Route Handler, atau
  terima kontrak state terserialisasi.
- **Middleware bukan boundary otorisasi.** Request Server Action adalah POST ke route
  halaman dengan header `Next-Action`; pembatasannya kasar dan route itu tidak divalidasi
  Next.js sebagai bagian dari kontrak action. Middleware boleh jadi lapisan tambahan, bukan
  satu-satunya gerbang.

- [ ] Keputusan bentuk respons untuk login dan daftar dicatat di ADR §10.2 dan
      diimplementasikan. Keduanya masih Server Action hari ini.
- [ ] Test menolak request ke-N dengan hasil yang **sesuai transportnya**: 429 untuk Route
      Handler, state terserialisasi untuk Server Action. Jangan menulis test yang mengharapkan
      429 dari Server Action.

**Bukti:** test yang gagal sebelum limiter dipasang; bukti request ke-N ditolak pada setiap
endpoint yang dicakup; telemetry tanpa PII mentah (tanpa IP mentah — ADR §9.3).

### C3. Gate otomatis

- [ ] `npm run check` (typecheck → lint → skills:check → test) lulus. Ini gate manual; repo
      tidak punya CI atau pre-commit hook.
- [ ] `npm run build` lulus. Ini gerbang yang menangkap pelanggaran boundary client/server —
      `npm run check` **tidak** menangkapnya.
- [ ] `npm run smoke -- <baseUrl>` lulus terhadap server dengan secret **non-default**.
- [ ] `npm run e2e:onboarding -- <baseUrl>` lulus dengan `SESSION_SECRET` diberikan ke
      lingkungan skrip. Tanpa itu, skrip memakai default dev dan gagal terhadap server
      bersekret nyata (ADR §11.3).
- [ ] Test adversarial untuk setiap kasus di Grup A dan B ditambahkan dan benar-benar merah
      sebelum perbaikan.
- [ ] Periksa diff terhadap placeholder, `TODO` yang menyembunyikan implementasi,
      `test.skip`, dan `test.only`. Keempatnya blocker, bukan bukti.

**Bukti:** tempel perintah dan hasilnya apa adanya. Jangan menulis "semua lulus" tanpa
keluaran.

---

## Grup T — Gerbang VPS (hanya sebelum VPS melayani trafik)

Jangan centang grup ini untuk melewatkan M0. Grup T menjadi wajib saat VPS mulai menerima
trafik pengguna, dan setiap baris adalah blocker yang dinamai di ADR §12.

- [ ] **T1 — Keputusan topologi.** Pilih **same-host proxy** atau **subdomain terpisah** dan
      catat sebagai amandemen ADR bernomor. ADR §1.0 sengaja belum memilih. Jangan
      menetapkan konfigurasi `domain` cookie, CORS, atau allowed origin sebelum pilihan ini
      diambil — ketiganya bergantung pada pilihan tersebut, dan menebak sekarang berarti
      mempertahankannya setelah pilihan berubah.
- [ ] **T2 — `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`.** Di-set konsisten di semua instance,
      dibuat saat build, base64 32 byte (`openssl rand -base64 32`). Tanpa ini, instance
      dengan kunci berbeda tidak dapat mendekripsi Server Action satu sama lain dan gejalanya
      adalah **"Failed to find Server Action"**, bukan galat konfigurasi yang jelas. Kunci
      tertanam di output build. Berlaku bila VPS menjalankan instance Next.js yang sama
      (ADR §11.5).
- [ ] **T3 — `deploymentId`.** Di-set konsisten untuk version skew protection saat rolling
      deployment, supaya klien tidak memanggil Server Action dari build lama. Bila
      `deploymentId` di-set, `generateBuildId` tidak lagi berpengaruh (ADR §11.5).
- [ ] **T4 — VPS nginx: header trusted proxy.** Verifikasi asal request **sebelum** membaca
      header apa pun, termasuk header IP. `x-forwarded-for` yang tiba di VPS tanpa
      verifikasi asal adalah input dari penyerang (ADR §8.1 butir 3, §9.2). Middleware
      Vercel memiliki mekanisme tersendiri untuk menulis header terpercaya; nginx harus
      dikonfigurasi eksplisit agar tidak meneruskan klaim mentah.
- [ ] **T5 — VPS nginx: rate limit di lapisan proxy** sebagai pertahanan berlapis, selaras
      kebijakan ADR §10.4. Limiter aplikasi tetap berlaku; ini lapisan tambahan, bukan
      pengganti.
- [ ] **T6 — Mekanisme trust boundary** ADR §8.2 dipilih (static egress IP + allow-list,
      HMAC antar-layanan, atau mTLS) dan diimplementasikan. Bila memilih HMAC: sertakan
      timestamp dan nonce, tolak request di luar jendela waktu, dan simpan nonce sampai
      jendela itu lewat.
- [ ] **T7 — VPS tidak terbuka langsung.** Port API dan PostgreSQL hanya menerima koneksi
      dari jalur terverifikasi. PostgreSQL tidak pernah menghadap publik.
- [ ] **T8 — VPS memuat ulang otorisasi dari database**, bukan dari claim yang diteruskan
      frontend. Role, eligibility, skor, dan target tidak boleh datang sebagai nilai yang
      dipercaya dari pemanggil.
- [ ] **T9 — Idempotency key dan timeout eksplisit** untuk semua mutasi Vercel → VPS. Bila
      instance Next.js ada di VPS, perhatikan bahwa permintaan invokasi Server Action ke
      origin Vercel dapat membawa header internal `x-vercel-*` dari klien; nginx tidak boleh
      memercayainya.

---

## Grup D — Bukti dan tanda tangan

### D1. Ringkasan definition of done M0

Dari rencana §13, M0 lulus bila seluruh baris ini benar:

| Syarat M0 | Terpenuhi |
|---|---|
| Secret production enforced (A1, A2) | [ ] |
| Public staff signup diblokir (B1) | [ ] |
| Akun demo diblokir (B2) | [ ] |
| Credential action terotorisasi atau dimatikan (B3) | [ ] |
| **Rate limit shared aktif** (C2) | [ ] |
| Audit mutasi tercatat (B4) | [ ] |
| Security headers baseline (C1) | [ ] |
| Gate berjalan (C3) | [ ] |

### D2. Yang secara sengaja **tidak** dikerjakan di M0

Mencatat ini mencegahnya dikira kelalaian, dan mencegah orang mengerjakannya di luar urutan:

- Menyatukan pola persistence cookie/course/resume/performa (rencana §2.2).
- Middleware route guard.
- Audit event penuh dan `logAudit` — Fase 3.
- Penilaian kuis server-side — Fase 2.
- CSP penuh — menyusul setelah uji kompatibilitas.
- Konfigurasi cookie `domain`, CORS, dan allowed origin — menunggu T1.
- `.env.example` — dibuat bersama pekerjaan Fase 0 yang menyentuh konfigurasi.

### D3. Tanda tangan

Penulis tidak boleh menandatangani pekerjaannya sendiri (rencana §12 butir 5).

| Peran | Nama | Tanggal | Catatan |
|---|---|---|---|
| Pelaksana | | | |
| Peninjau independen | | | Tidak boleh orang yang sama dengan pelaksana |
| Security gate owner | `[OWNER]` | | Belum ditunjuk — ADR §3 |

**Bukti yang dilampirkan pada hand-off/PR:** migration ID (bila ada), rencana rollback,
perintah gate beserta keluarannya, dan daftar test adversarial yang ditambahkan.

---

## Referensi

- `docs/backend-production-plan.md` §4, §12, §13
- `docs/adr/0001-topologi-deployment-produksi.md` §1.0, §8, §9, §10, §11.5, §12
