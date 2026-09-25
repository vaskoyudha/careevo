# Checklist Rilis Keamanan — M0

**Milestone:** M0 "Aman untuk staging" (`docs/backend-production-plan.md` §13)
**Sumber pekerjaan:** rencana §4 Fase 0, §12 (gate), §13 (DoD)
**Konteks topologi:** `docs/adr/0001-topologi-deployment-produksi.md` (topologi sementara M0: Vercel memiliki seluruh permukaan browser; VPS belum ada)
**Status:** SEBAGIAN — sebagian Grup A dan B dikerjakan dan buktinya ada di berkas ini; grup
lain belum, dan **belum ada bagian yang ditandatangani** (D3). Kotak hanya dicentang bila
pernyataannya didukung bukti di bawahnya, bukan karena kodenya sudah ditulis.

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

- [x] Buat modul konfigurasi server-only (target: `src/lib/config/`) yang membaca secret
      dan **menolak melayani** bila `NODE_ENV=production` dan secret kosong, bernilai
      default yang dikenal, atau di bawah panjang minimum.
- [ ] Pisahkan secret minimal: session/auth, attestation, cookie state legacy selama
      migrasi, webhook, dan storage. Jangan satu variabel untuk semua. **Sengaja belum
      dikerjakan** — `SESSION_SECRET` masih satu kunci untuk sesi, store user, enrollment,
      onboarding, profil publik, learning session, dan learning chat. Lihat catatan blast
      radius di bawah.
- [x] Validasi berjalan **sebelum** modul lain membacanya. `src/instrumentation.ts`
      memanggil `verifikasiKonfigurasiSecret()` sekali saat server start, sebelum server
      siap menerima request.
- [x] Jangan hapus jalur dev/test. Development dan test tetap harus jalan tanpa `.env`;
      yang berubah adalah production menolak nilai default.

**Berkas:** `src/lib/config/**` (baru), `src/lib/auth/session.ts`, `src/lib/auth/user-store.ts`,
`src/lib/courses/enrollment.ts`, `src/lib/onboarding/store.ts`, `src/lib/profile/store.ts`,
`src/lib/learning/session.ts`, `src/lib/learning/chat-store.ts`, `src/lib/attestation/token.ts`

**Bukti:** perintah yang menjalankan server dengan `NODE_ENV=production` tanpa secret, dan
menunjukkan **setiap route membalas HTTP 500** dan tidak ada halaman yang dilayani. Test
negatif untuk setiap varian: kosong, nilai default lama, terlalu pendek.

#### Yang sebenarnya terjadi saat secret produksi salah — bukan process exit

Istilah "gagal start" mudah dibaca sebagai "proses keluar". Itu **tidak** yang terjadi.
Diverifikasi terhadap `next start` (Next 16.3.5) dengan `NODE_ENV=production` dan kedua
secret kosong:

- Proses **tetap hidup**: `next start` mencetak `✓ Ready in …` lalu
  `Failed to prepare server Error [SecretConfigError] …` dan sebuah `unhandledRejection`.
  Tidak ada `process.exit`.
- Setiap route menjawab **HTTP 500 `Internal Server Error`**, termasuk `/`, `/masuk`,
  `/kerja`, `/loker`, `/verify/<token>`, dan `POST /api/unggah`. Route statis
  (`/_next/static/…`) tetap 404 biasa karena tidak menyentuh kode aplikasi.
- Alasannya ada di sumber Next: `ensureInstrumentationRegistered()` di
  `node_modules/next/dist/server/lib/router-utils/instrumentation-globals.external.js`
  menyimpan promise yang **reject**; `next-server.js` menangkapnya dua kali hanya untuk
  `console.error`, lalu melemparnya lagi per request sehingga request handler membalas 500.
  Jalur render server juga meng-`await` inisialisasi, tetapi observasi deployment salah
  secret menunjukkan jalur ini tidak menghentikan proses; perilaku yang dapat dijadikan
  kontrak operasional adalah penolakan HTTP 500 pada seluruh route aplikasi.

Konsekuensinya untuk operasi: kelas kegagalan ini adalah **fail-closed (500/no routes
served)**, bukan fail-fast process-exit. Artinya (a) platform yang mengharapkan exit-code
untuk menandai deployment buruk **tidak akan melihatnya** — health-check harus memeriksa
status HTTP, bukan liveness proses; (b) orchestrator bisa terus menganggap instance itu
hidup; dan (c) halaman `/500` bawaan tetap terkirim, jadi jangan berharap stack trace atau
pesan `SecretConfigError` sampai ke pengguna (pesan hanya di log server).

Dengan secret sah, server melayani `200` seperti biasa. Kedua hasil ini diuji langsung,
bukan disimpulkan dari kode.

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

- [x] Setiap baris di atas ditangani dan punya test negatif production.
- [ ] **Rotasi tidak dilakukan tanpa rencana invalidasi.** Mengganti `SESSION_SECRET`
      mencabut semua cookie bertanda tangan lama; mengganti `ATTESTATION_SECRET` membuat
      token lama gagal verifikasi. Untuk attestation, rotasi menuntut `key_version` dan
      kunci lama yang tetap dipertahankan untuk verifikasi (ADR §6.3 butir 5). Tulis rencana
      itu sebelum menyentuh nilai di production.

**Bukti:** test negatif per variabel; catatan rencana rotasi.

#### Keputusan sementara: satu kunci `SESSION_SECRET` untuk tujuh permukaan

Pemisahan secret (butir kedua di A1) **belum dikerjakan**. Yang berlaku sekarang: **satu
kunci `SESSION_SECRET`** menandatangani/memverifikasi tujuh permukaan sekaligus —

| Pemakai | Artefak |
|---|---|
| `src/lib/auth/session.ts` | cookie sesi `ls_session` |
| `src/lib/auth/user-store.ts` | cookie `ls_users` (kredensial terdaftar) |
| `src/lib/courses/enrollment.ts` | cookie `ls_enroll` (progres belajar) |
| `src/lib/onboarding/store.ts` | cookie `ls_profile` (profil onboarding) |
| `src/lib/profile/store.ts` | cookie `ls_public_profile` (profil publik) |
| `src/lib/learning/session.ts` | berkas sesi belajar |
| `src/lib/learning/chat-store.ts` | store chat belajar |

**Ini keputusan sadar untuk M0, bukan kelalaian.** Satu kunci berarti satu nilai untuk
dikelola dan dirotasi, dan M0 belum punya secret manager per-permukaan. Menggantinya
sekarang menuntut memisahkan tujuh jalur sekaligus tanpa database untuk migrasi bertahap.

**Blast radius — apa yang terjadi hari ini bila kunci ini bocor atau dirotasi:**

- **Kebocoran bersifat menyeluruh, bukan terbatas.** Siapa pun yang memegang
  `SESSION_SECRET` dapat memalsukan cookie sesi staff, membangkitkan entri `ls_users`,
  menaikkan progres `ls_enroll`, dan menulis ulang profil publik mana pun. Tidak ada
  lapisan kedua yang membatasi dampaknya ke satu permukaan.
- **Rotasi = pemutusan massal.** Mengganti nilai membuat **semua** cookie di tabel di atas
  gagal verifikasi sekaligus: setiap pengguna ter-logout, dan progres enrollment, status
  onboarding, serta profil publik yang belum dimigrasi hilang dari sisi pengguna. Ini
  diterima hanya karena semuanya cookie yang bisa dibuat ulang, bukan data berharga yang
  tidak dapat dipulihkan.
- **Tidak ada periode transisi.** `bacaSecret()` menerima satu nilai, jadi tidak ada cara
  memverifikasi dengan kunci lama sambil menandatangani dengan kunci baru. Rotasi tanpa
  jendela kedaluwarsa cookie adalah pemutusan langsung.

**Ditunda — bukan selesai.** Yang wajib ada sebelum kunci ini dirotasi di production
adalah **runbook rotasi** yang memuat, minimal: urutan langkah, jendela pemutusan yang
diumumkan, perlakuan cookie berumur panjang (`ls_enroll` 90 hari, `ls_profile`/
`ls_public_profile` 180 hari), dan prosedur invalidasi/regenerasi tiap permukaan. Untuk
attestation, tambahkan `key_version` + retensi kunci lama (ADR §6.3 butir 5). Runbook ini
dicatat sebagai **blocker rilis yang belum ditutup**, bukan sebagai pekerjaan yang sudah
selesai; memisahkan kunci per permukaan tetap terbuka sebagai keputusan berikutnya, dan
**tidak dipaksakan pada M0**.

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

- [x] `authenticate()` menolak akun demo kecuali di environment demo terisolasi.
- [x] Petunjuk demo (email dan password) hanya dirender di environment demo, termasuk
      prefill `?email=`.
- [x] Demo hanya hidup di environment demo dengan data demo — bukan di staging yang memakai
      data nyata.
- [x] Tidak menampilkan `DEMO_PASSWORD` dari halaman mana pun kecuali gate demo terbuka.
- [x] Uji: login dengan `user@careevo.test` / `careevo` (atau `verifikator@`, `admin@`) pada
      server `NODE_ENV=production` harus **gagal**.

**Berkas:** `src/lib/config/environment.ts`, `src/lib/auth/demo-accounts.ts`,
`src/lib/auth/session.ts`, `src/app/(public)/masuk/page.tsx`, `src/actions/auth.ts`,
`src/components/features/auth/**`

**Bukti:** test login demo ditolak di production; test yang menunjukkan dev tanpa flag juga
tidak menampilkan/menerima demo.

#### Gate demo sekarang fail-closed: butuh `NODE_ENV === "development"` **dan** `DEMO_MODE=1`

Versi pertama gate ini adalah `!isProductionRuntime(env)` — fail-**open**. Apa pun yang bukan
persis `"production"` (`"test"`, `"staging"`, atau `NODE_ENV` yang tidak diset) menyajikan
akun demo berpassword publik, dan `npm run dev` biasa selalu membukanya. Gate sekarang
membalik defaultnya menjadi "tidak ada demo" kecuali dua kondisi terpenuhi:

1. `NODE_ENV` **persis** `"development"` — dicek positif, bukan `!== "production"`, sehingga
   `"test"`, `"staging"`, string kosong, atau nama kustom apa pun ditolak.
2. `DEMO_MODE` **persis** `"1"` — opt-in eksplisit. Tidak ada nilainya (atau nilai lain)
   berarti tidak ada demo.

Yang paling penting untuk diingat: **`npm run dev` biasa, tanpa flag, sekarang tidak lagi
menampilkan atau menerima akun demo.** Untuk memakai demo, set `DEMO_MODE=1` (dokumentasikan
di runbook dev, jangan set di deployment yang dapat dijangkau publik). `DEMO_MODE` tidak
boleh diisi di staging/production dalam kondisi apa pun.

### B3. `decideReview()` diperbaiki atau dimatikan

`src/actions/review.ts` tidak memanggil `getSession()` sama sekali, dan menerima `username`,
`total`, serta `task_title` dari `FormData` — lalu menandatangani attestation dari nilai
yang dikirim klien. Siapa pun yang dapat memanggil action ini dapat menerbitkan credential
untuk identitas dan skor pilihannya sendiri.

- [x] Sebelum database review siap: **nonaktifkan** issuance attestation di environment
      publik atau kembalikan galat eksplisit. Jangan biarkan jalur ini hidup.
- [x] Tambahkan auth principal dan otorisasi staff secara independen di dalam action.
      Layout **bukan** boundary otorisasi — action dapat dipanggil tanpa melewatinya.
- [x] Jangan menerima username, task, score, eligibility, atau identity target yang
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

#### Copy keputusan harus jujur: tidak ada audit log yang tercatat

Isu yang ditutup di sini bukan kode otorisasi, melainkan **klaim**. `decideReview` dulu
membalas `"… Alasan tercatat di audit log."` padahal ia tidak menulis apa pun:
`logAudit` (`src/lib/audit/logger.ts`) masih stub yang melempar, dan belum ada review store
sebelum Fase 3. Seorang verifikator membaca kalimat itu sebagai "keputusan sudah tercatat",
padahal bila proses restart tidak ada jejaknya sama sekali — klaim yang lebih berbahaya
daripada tidak ada pesan, karena ia menghentikan orang memeriksa.

Pesan sekarang menyebut keadaan sebenarnya untuk kedua cabang:

- approve → penerbitan attestation belum aktif, **dan** belum ada yang tersimpan;
- revisi/tolak → keputusan diterima, tetapi **belum tersimpan** (tidak masuk audit log
  maupun database).

Test menahannya: pesan tidak boleh lagi memuat `/tercatat di audit log/i` dan harus memuat
`/belum tersimpan/i`. Ini tidak menggantikan pekerjaan Fase 3 — ia hanya berhenti
mengklaimnya.

**Blocker yang masih terbuka:** audit event dan store keputusan review (Fase 3). Sampai itu
ada, `decideReview` menerima keputusan tetapi tidak menyimpan apa pun; jangan pakai respons
ini sebagai bukti keputusan pernah diambil.

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
- Memisahkan satu `SESSION_SECRET` menjadi kunci per permukaan — keputusan sementara M0,
  bukan kelalaian; blast radius dan runbook rotasi dicatat di A2 dan ADR §11.2/§6.3.

### D3. Tanda tangan

Penulis tidak boleh menandatangani pekerjaannya sendiri (rencana §12 butir 5).

| Peran | Nama | Tanggal | Catatan |
|---|---|---|---|
| Pelaksana | | | |
| Peninjau independen | | | Tidak boleh orang yang sama dengan pelaksana |
| Security gate owner | `[OWNER]` | | Belum ditunjuk — ADR §3 |

**Bukti yang dilampirkan pada hand-off/PR:** migration ID (bila ada), rencana rollback,
perintah gate beserta keluarannya, dan daftar test adversarial yang ditambahkan.

### D4. Blocker yang masih terbuka setelah pekerjaan ini

Dicatat supaya tidak terbaca sebagai selesai:

| # | Blocker | Di mana |
|---|---|---|
| 1 | Runbook rotasi + invalidasi secret (termasuk `key_version` attestation) | A2, ADR §6.3 butir 5, B11 |
| 2 | Pemisahan `SESSION_SECRET` per permukaan (7 pemakai) | A2 |
| 3 | Audit event dan store keputusan review (Fase 3) — `decideReview` menerima keputusan tetapi tidak menyimpan apa pun | B3 |
| 4 | Rate limit shared, header trusted proxy, gate otomatis, tanda tangan D3 | C2, C3, Grup T, D3 |

---

## Referensi

- `docs/backend-production-plan.md` §4, §12, §13
- `docs/adr/0001-topologi-deployment-produksi.md` §1.0, §6.3, §8, §9, §10, §11.2, §11.5,
  §11.6, §12
