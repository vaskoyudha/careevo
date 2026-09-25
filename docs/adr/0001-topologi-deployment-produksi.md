# ADR 0001 — Topologi deployment produksi: Vercel + VPS + Upstash Redis

- **Status:** Diusulkan — belum disetujui
- **Tanggal:** 2026-09-25
- **Konteks rencana:** `docs/backend-production-plan.md` §2.3 (keputusan sebelum Fase 1) dan §4 (Fase 0)
- **Pengambil keputusan:** `[OWNER]`
- **Menggantikan:** —

ADR ini memenuhi exit criteria §2.3: provider, region, retention, owner, biaya awal,
strategi backup, dan prosedur local development dalam satu dokumen. Implementasi data
production tidak dimulai sebelum ADR ini disetujui.

---

## 0. Konvensi placeholder

Dokumen ini sengaja memuat keputusan yang **belum diambil**. Semua ditandai supaya bisa
di-`grep` dan tidak terbaca sebagai keputusan final:

| Penanda | Arti |
|---|---|
| `[OWNER]` | Pemilik tanggung jawab yang belum ditunjuk |
| `[REGION]` | Keputusan region yang belum dipilih |
| `[TBD]` | Angka, kebijakan, atau biaya yang belum ditetapkan |
| **Perlu diratifikasi** | Usulan penulis dokumen; butuh persetujuan sebelum M0 selesai |

---

## 1. Keputusan

| Lapisan | Provider | Isi |
|---|---|---|
| Frontend, RSC, Server Actions, Route Handler | **Vercel** | Aplikasi Next.js 16 App Router. Stateless: tanpa state bisnis di filesystem. |
| API, worker, PostgreSQL | **VPS** | Endpoint internal yang dipanggil Vercel, worker outbox, dan database. |
| Counter rate limit | **Upstash Redis** | Penghitung `shared`/lintas-instance lewat REST. |

### 1.0 Cakupan M0 — topologi sementara, mengikat

VPS **belum dibeli** dan belum diprovision. Karena itu topologi yang berlaku sampai
amandemen ADR berikutnya adalah:

- **Vercel memiliki seluruh permukaan Next.js yang menghadap browser** untuk M0: halaman,
  Server Component, Server Action, Route Handler, dan aset. Semuanya.
- **API VPS tidak diaktifkan dan tidak dapat dialamatkan browser** selama M0. Tidak ada
  subdomain, tidak ada reverse proxy publik, tidak ada DNS yang menunjuk ke sana. VPS,
  bila nanti ada, tidak menjadi bagian dari jalur request pengguna pada M0.
- Jalur Vercel → VPS (§8) karena itu **belum live**. Ia dirancang di sini supaya tidak
  diimprovisasi nanti, dan diaktifkan hanya setelah amandemen ADR.

**Amandemen yang dibutuhkan sebelum VPS melayani trafik.** Pilih salah satu dan catat di
ADR ini sebagai amandemen bernomor:

| Opsi | Bentuk | Yang harus diputuskan bersamanya |
|---|---|---|
| A. Same-host proxy | Vercel (atau edge) menjadi satu-satunya host yang dilihat browser; VPS di belakangnya | Bagaimana browser tidak pernah mengetahui VPS |
| B. Subdomain terpisah | API di subdomain sendiri | Cookie domain, CORS, dan allowed origin |

`domain` cookie, CORS, dan allowed origin **sengaja belum ditetapkan** di ADR ini. Ketiganya
bergantung pada pilihan A atau B di atas, dan menetapkannya sekarang berarti menebak lalu
mempertahankannya setelah pilihan berubah. Jangan menambahkan konfigurasi itu ke kode
sebelum amandemen.

Selama M0, batasan §1.1 butir 2 tetap berlaku penuh: fitur yang menulis ke disk tidak dapat
dilayani dari Vercel. Tanpa VPS, satu-satunya jalur aman untuk fitur itu adalah menundanya,
bukan menjalankannya di Vercel.

### 1.1 Konsekuensi yang mengikat

1. **Vercel tidak menyimpan state.** Instance Vercel tidak boleh menjadi sumber kebenaran
   apa pun. Filesystem Vercel read-only kecuali `/tmp`, dan `/tmp` bersifat per-instance
   serta hilang saat instance didaur ulang. Semua state bersama hidup di PostgreSQL,
   Upstash, atau object storage — bukan di disk instance.
2. **Boundary yang ada sekarang belum siap untuk Vercel.** Hari ini aplikasi menulis ke
   disk: `data/courses.json`, `data/kuis.json`, `.data/` (resume, performa, sesi belajar),
   dan `public/uploads/courses/...`. Lihat `src/lib/resume/store.ts` (komentarnya sendiri
   mencatat kegagalan tulis di serverless). Selama migrasi Fase 2/Fase 4 belum mendarat,
   fitur yang menulis ke disk **tidak boleh** dilayani dari Vercel. Pilihannya: tunda
   cutover fitur itu, atau jalankan di VPS. Ini batasan nyata, bukan catatan kaki.
3. **VPS adalah satu titik kegagalan.** Satu node tanpa HA berarti downtime node = downtime
   API, worker, dan database sekaligus. Mitigasinya ada di §6 (backup) dan §7 (RTO);
   HA penuh berada di luar lingkup ADR ini dan dicatat sebagai risiko yang diterima `[OWNER]`.
4. **Upstash hanya untuk counter, bukan state bisnis.** Kehilangan data Upstash menurunkan
   kualitas rate limit, bukan menghilangkan data pengguna.

### 1.2 Yang tidak diputuskan di sini

ORM/migration (Drizzle atau Prisma), provider queue terpisah, provider transactional email,
object storage, dan key management. Semua tetap terbuka di §2.3 rencana; masing-masing
butuh ADR sendiri sebelum fase yang memakainya. **Jangan** menyimpulkan dari ADR ini bahwa
queue eksternal diperlukan — worker Fase 1A direncanakan berjalan di VPS yang sama.

---

## 2. Region — `[REGION]` belum dipilih

**Status: BELUM DIPILIH.** Bagian ini mencatat batasan yang harus memandu pilihan, bukan
mengambil pilihan.

Fakta yang mengikat pilihan:

- Vercel Functions default ke `iad1` (Washington, D.C., USA) untuk proyek baru. Region
  diubah lewat Settings → Functions, atau `"regions"` di `vercel.json`, atau per-function.
- Runtime Edge berjalan di region terdekat dengan request; runtime Node (default di repo
  ini) berjalan di region yang dipilih, bukan yang terdekat.
- Latensi yang menentukan adalah **Vercel → VPS → PostgreSQL**, bukan sekadar pengguna →
  Vercel. Pilih region Vercel dan region VPS yang berdekatan; satu hop lintas benua per
  query adalah biaya yang dibayar di setiap request.
- Region Upstash harus dipilih yang terdekat dengan **VPS**, karena panggilan rate limit
  terjadi di jalur kritis login/upload. Tambahan read region di Upstash berbiaya 50% dari
  harga tier per region, dan setiap write direplikasi ke read region dihitung sebagai
  command tersendiri. Verifikasi daftar region yang tersedia di konsol saat provisioning.

Kandidat region Vercel yang relevan untuk basis pengguna Indonesia: `sin1` (Singapore),
`hnd1` (Tokyo), `bom1` (Mumbai). Default `iad1` bukan kandidat yang baik untuk pengguna
Indonesia, dan **tidak boleh dibiarkan sebagai default yang tidak disadari**.

Keputusan yang dibutuhkan, sebagai satu kesatuan (jangan dipisah):

| Yang harus ditetapkan | Nilai |
|---|---|
| Region Vercel Functions | `[REGION]` |
| Region VPS + PostgreSQL | `[REGION]` |
| Region utama Upstash | `[REGION]` |
| Region read Upstash (bila ada) | `[REGION]` atau "tidak ada" |

---

## 3. Owner — placeholder

Tidak ada satu pun peran di bawah ini yang sudah ditunjuk. Setiap baris butuh nama orang,
bukan nama tim, karena tanggung jawab tanpa nama tidak dapat dieksekusi.

| Peran | Tanggung jawab | Pemilik |
|---|---|---|
| Decision owner | Menyetujui ADR ini dan perubahannya | `[OWNER]` |
| Incident owner | On-call, memutuskan failover/rollback saat insiden | `[OWNER]` |
| Backup & restore owner | Menjalankan dan mencatat drill restore | `[OWNER]` |
| Secret rotation owner | Menjalankan rotasi + rencana invalidasi cookie | `[OWNER]` |
| Security gate owner | Menyetujui M0 dan menandatangani `docs/security-release-checklist.md` | `[OWNER]` |
| Biaya | Menjaga realisasi biaya di bawah pagar §5 | `[OWNER]` |

Aturan proses yang sudah berlaku di repo dan tidak berubah: **penulis tidak boleh
self-approve** (`docs/backend-production-plan.md` §12). Checklist M0 ditandatangani orang
selain yang mengerjakan.

---

## 4. Retention

Retensi runtime yang berlaku hari ini, sebagai titik awal migrasi. Angka ini berasal dari
kode, bukan dari asumsi.

| Data | Retensi hari ini | Sumber |
|---|---|---|
| Cookie sesi `ls_session` | 8 jam | `SESSION_MAX_AGE` di `src/lib/auth/session.ts` |
| Cookie user `ls_users` | 30 hari, maksimum 20 entri | `src/lib/auth/user-store.ts` |
| Cookie enrollment `ls_enroll` | 90 hari | `src/lib/courses/enrollment.ts` |
| Cookie profil onboarding `ls_profile` | 180 hari | `src/lib/onboarding/store.ts` |
| Cookie profil publik `ls_public_profile` | 180 hari | `src/lib/profile/store.ts` |
| Sesi belajar (berkas `.data/sessions/`) | per run, dibatasi `batas_waktu_menit` | `src/lib/learning/session.ts` |
| Attestation | 365 hari masa berlaku | `ATTESTATION_MAX_AGE_DAYS` di `src/lib/attestation/token.ts` |
| Berkas CV/portofolio | sampai diganti/dihapus pemilik, maksimum 5 MB | `validasiBerkas` di `src/lib/resume/types.ts` |

Target retensi setelah migrasi database. Nilai `[TBD]` wajib diisi sebelum fase yang
menyentuhnya; jangan dibiarkan kosong saat fase itu dimulai.

| Kelas data | Retensi target | Dasar |
|---|---|---|
| Cookie legacy saat migrasi | selama jendela migrasi saja, dihapus setelah cutover | Rencana §5 cutover |
| `sessions` | sampai `expires_at`, atau lebih cepat saat direvoke | Rencana §5 |
| `audit_events` | `[TBD]` — usulan ≥ 12 bulan | Chain of custody credential |
| `attestations` + `attestation_events` | selama sertifikat masih dapat diverifikasi | Rencana §7 |
| `quiz_attempts` + assessment snapshot | selama credential terkait hidup + masa sanggah `[TBD]` | Rencana §7 prasyarat |
| `learning_events` | `[TBD]` | Rencana §7 |
| `outbox_events` | setelah `processed_at` + jeda pendek `[TBD]`; DLQ lebih lama | Rencana §6 |
| `uploaded_files` | soft-delete → hard-delete oleh worker | Rencana §8 |
| Log & telemetry | `[TBD]` — **tanpa IP mentah, tanpa secret** | Rencana §4 butir 8, §9 butir 3 |

Aturan yang tidak boleh dilanggar: **tidak ada penghapusan yang menghapus bukti yang masih
direferensikan credential.** Foreign key dan policy restrict (rencana §7) adalah
penegaknya, bukan disiplin manual.

---

## 5. Biaya awal — `[TBD]`

Struktur biaya, bukan angka final. Angka yang sudah terverifikasi dicantumkan apa adanya;
sisanya `[TBD]` dengan gerbang waktu.

| Pos | Nilai | Catatan |
|---|---|---|
| Upstash Redis, free tier | 500K command/bulan, 256 MB, 10 GB bandwidth, $0 | Cukup untuk validasi dan staging awal. |
| Upstash Redis, pay-as-you-go | $0.20 / 100K command; storage $0.25/GB-bulan (1 GB pertama gratis) | Bisa diberi pagar budget bulanan; database di-rate-limit bila pagar tercapai. |
| Upstash Redis, Fixed | mulai $10/bulan (250 MB); +50% harga tier per read region | Pilih bila jumlah command sudah stabil dan tinggi. |
| Upstash, replikasi global | setiap write yang direplikasi dihitung sebagai command tambahan | Satu primary + satu read region ≈ 2× biaya command untuk write. |
| Vercel | `[TBD]` | Bergantung tier. **Trusted Proxy / static egress IP / Secure Compute adalah fitur Enterprise** — pilihan mekanisme di §8 bisa memaksa tier Enterprise. Ini penggerak biaya terbesar yang belum dihitung. |
| VPS (compute + disk) | `[TBD]` — **belum dibeli** | Satu node menjalankan API + worker + PostgreSQL. Tidak ada biaya berjalan pada M0 karena VPS belum diprovision (§1.0). |
| PostgreSQL | `[TBD]` | Self-hosted di VPS (masuk biaya compute/disk) atau managed (baris biaya sendiri). Lihat §1.2 — sub-keputusan ini belum diambil. |
| Backup off-site | `[TBD]` | Wajib berada di provider/region berbeda dari VPS (§6). |
| Transactional email, object storage, error tracking | `[TBD]` | Belum diputuskan (§1.2). |

**Pagar:** tetapkan budget Upstash dan Vercel sebelum M0, supaya kesalahan konfigurasi
rate limit atau loop worker tidak menjadi tagihan tak terbatas. Isi angka `[TBD]` sebelum
Fase 1 dimulai.

---

## 6. Strategi backup

### 6.1 Yang di-backup

| Sumber | Metode | Frekuensi | Lokasi salinan |
|---|---|---|---|
| PostgreSQL | Full backup terjadwal + WAL archiving untuk PITR bila opsi managed mendukung | Harian `[TBD]`, WAL berkelanjutan | Provider/region **berbeda** dari VPS |
| Object storage | Versioning + lifecycle | Berkelanjutan | Bucket terpisah `[TBD]` |
| Konfigurasi infra (compose/systemd/env non-secret) | Repositori Git privat | per perubahan | Remote Git |
| Secret | Secret manager + runbook rotasi | per rotasi | Hanya di secret manager |

### 6.2 Yang tidak di-backup, dan alasannya

**Upstash Redis tidak di-backup.** Isinya hanya counter rate limit, yang merupakan state
dengan nilai pendek. Kehilangannya menurunkan akurasi pembatasan selama satu jendela,
bukan kehilangan data pengguna. Memulihkannya ke kondisi lama justru salah: counter yang
basi akan menolak request yang sah. Setelah restore, counter dimulai dari nol.

### 6.3 Aturan yang tidak boleh dilanggar

1. **Backup yang berada di host atau disk yang sama dengan sumbernya bukan backup.**
   Salinan wajib keluar dari VPS.
2. **Restore drill terjadwal di environment non-production** adalah bukti keberadaan
   backup. Backup yang belum pernah di-restore dianggap tidak ada (rencana §9).
3. **Backup tidak memuat secret mentah.** Payload yang di-backup harus sudah ter-redact
   sesuai rencana §6.
4. **RPO/RTO belum ditetapkan** — `[TBD]`, milik `[OWNER]`. Wajib diisi sebelum M5
   (rencana §9).
5. **Rotasi `SESSION_SECRET` dan `ATTESTATION_SECRET` mencabut semua cookie dan attestation
   bertanda tangan lama.** Rotasi wajib disertai rencana invalidasi, bukan hanya penggantian
   nilai (rencana §4 butir 1). Untuk `ATTESTATION_SECRET`, rotasi berarti token lama gagal
   verifikasi kecuali ada `key_version` dan kunci lama dipertahankan untuk verifikasi.
   **Runbook ini belum ada dan dicatat sebagai blocker (B11), bukan pekerjaan yang selesai.**
   Yang berlaku sekarang: satu `SESSION_SECRET` menandatangani tujuh permukaan sekaligus
   (§11.2, checklist A2), jadi rotasinya memutus semuanya serentak — keputusan sadar untuk
   M0, sekaligus blast radius yang harus disadari sebelum menyentuh nilainya.

---

## 7. RTO/RPO — `[TBD]`

Belum ditetapkan. Angka ini menentukan pilihan antara self-hosted dan managed PostgreSQL,
dan menentukan apakah satu node VPS cukup. Tetapkan sebelum M5.

| Target | Nilai |
|---|---|
| RPO (data yang hilang maksimum) | `[TBD]` |
| RTO (waktu pemulihan maksimum) | `[TBD]` |

---

## 8. Trust boundary Vercel → VPS

Ini bagian paling berisiko dari topologi ini. Vercel adalah edge publik dan satu-satunya
tempat TLS pengguna diterminasi. VPS menjalankan API dan database.

> **Status: belum live.** Sesuai §1.0, VPS tidak melayani trafik pada M0 dan tidak dapat
> dialamatkan browser. Seluruh bagian ini adalah syarat yang harus dipenuhi **sebelum**
> boundary diaktifkan, bukan deskripsi sistem yang sedang berjalan. Butir 1 sampai 7 di
> bawah mengikat begitu VPS menyentuh trafik; butir 3, 5, dan 7 menjadi blocker rilis yang
> tercatat di `docs/security-release-checklist.md`.

### 8.1 Aturan yang ditetapkan

1. **VPS tidak boleh terbuka langsung ke internet untuk trafik aplikasi.** Port API dan
   PostgreSQL hanya menerima koneksi dari jalur terverifikasi.
2. **VPS tidak boleh memercayai klaim identitas yang diteruskan Vercel tanpa bukti
   asal-usul request.** Tanpa verifikasi, header apa pun dapat dipalsukan oleh siapa pun
   yang bisa mencapai endpoint, dan boundary ini hilang sepenuhnya.
3. **VPS harus memverifikasi asal request sebelum membaca header apa pun dari Vercel**,
   termasuk header IP. Urutannya wajib: verifikasi asal → baru baca header.
4. **VPS memuat ulang otorisasi dari database, bukan dari claim yang dikirim frontend.**
   Role, eligibility, skor, dan target tidak boleh datang sebagai nilai yang dipercaya dari
   pemanggil (rencana §2.1 dan §4 butir 5).
5. **Semua panggilan Vercel → VPS memakai idempotency key** untuk mutasi, dan timeout
   eksplisit. Vercel Function punya batas durasi; panggilan VPS yang menggantung akan
   mematikan Server Action tanpa pesan yang berguna.
6. **Galat dari VPS tidak boleh bocor ke klien.** Petakan ke pesan generik; detail hanya ke
   log internal.
7. **Replay ditolak.** Bila memakai HMAC antar-layanan: sertakan timestamp dan nonce, tolak
   request di luar jendela waktu `[TBD]` detik, dan simpan nonce sampai jendela itu lewat.

### 8.2 Mekanisme — belum dipilih

| Opsi | Cara kerja | Biaya | Catatan |
|---|---|---|---|
| A. Static egress IP + firewall allow-list | Vercel memakai egress IP tetap; firewall VPS hanya menerima IP itu | Fitur Enterprise | Paling sederhana untuk dioperasikan. Bergantung pada Vercel, bukan kode. |
| B. HMAC antar-layanan | Vercel menandatangani request (timestamp + nonce + body); VPS memverifikasi | Tanpa biaya tambahan | Tidak bergantung pada IP, jadi tetap benar bila egress berubah. Butuh manajemen kunci dan proteksi replay. |
| C. mTLS / konektivitas privat | Sertifikat klien atau jalur privat | `[TBD]` | Paling kuat; menambah kompleksitas provisioning dan rotasi sertifikat. |

**Perlu diratifikasi.** Bila opsi A dipilih, mekanisme ini **bukan** pengganti verifikasi
asal di aplikasi: allow-list IP adalah kontrol jaringan, dan aplikasi tetap harus menolak
request yang tidak lolos. Bila VPS sampai terbuka, satu-satunya pertahanan yang tersisa
adalah opsi B/C.

### 8.3 Yang tidak boleh dilakukan

- Membaca `x-forwarded-for` di VPS dari request yang belum diverifikasi asalnya.
- Membiarkan VPS menjawab publik lalu mengandalkan "tidak ada yang tahu URL-nya".
- Meneruskan token sesi mentah ke VPS dan mempercayai role yang menyertainya.

---

## 9. IP headers

### 9.1 Di sisi Vercel

- `x-forwarded-for` diisi ulang oleh Vercel. Dokumentasi Vercel menyatakan Vercel
  meng-overwrite header ini dan **tidak** meneruskan IP eksternal, justru untuk mencegah
  spoofing. Artinya klien tidak dapat menyuntikkan nilai palsu ke header ini **selama
  aplikasi berjalan langsung di Vercel tanpa proxy tambahan.**
- `x-vercel-forwarded-for` identik isinya, tetapi **tidak** di-overwrite bila ada proxy di
  depan Vercel. Ini pilihan yang lebih tepat bila ada proxy/CDN di depan.
- Custom `X-Forwarded-For` dari proxy sendiri hanya didukung lewat fitur Trusted Proxy
  (Enterprise). Tanpa itu, IP pengguna asli hilang di belakang proxy.
- `x-forwarded-for` adalah **daftar**; IP klien adalah entri **pertama**. Entri terakhir
  adalah proxy terdekat dan bukan IP pengguna.

**Aturan:** baca IP klien dengan urutan `x-vercel-forwarded-for` → `x-forwarded-for` →
`x-real-ip`, ambil entri pertama, dan hanya di Vercel hari ini. Jangan menulis helper IP di
VPS yang membaca header-header ini tanpa verifikasi §8.

### 9.2 Di sisi VPS

IP klien hanya dapat dipercaya bila request terbukti berasal dari Vercel (§8.1 butir 3).
Bila tidak, gunakan IP socket koneksi. Header `x-forwarded-for` yang tiba di VPS tanpa
verifikasi asal adalah **input dari penyerang**.

Bagian ini belum berlaku pada M0 karena VPS tidak menerima trafik (§1.0). Sebelum VPS
mengekspos trafik, konfigurasi reverse proxy di VPS — termasuk penanganan header trusted
proxy dan rate limit di lapisan proxy — harus ditetapkan dan diuji. Itu tercatat sebagai
blocker rilis bernama di `docs/security-release-checklist.md`.

### 9.3 Privasi

- **Jangan mencatat IP mentah.** Rencana §4 butir 8 mensyaratkan telemetry tanpa PII mentah,
  dan skema `sessions.ip_prefix` di rencana §5 sudah menyiratkan bentuk yang benar.
- Simpan prefix (mis. `/24` atau `/48`) atau hash berkunci untuk kebutuhan rate limit dan
  audit. Simpan sekecil mungkin untuk kebutuhan itu saja.
- Nilai yang dipakai sebagai key rate limit harus stabil untuk pengguna yang sama dan tidak
  dapat dipalsukan. Bila `[x-vercel-forwarded-for]` dapat dipengaruhi proxy, keynya menjadi
  dapat dihindari penyerang — dan itulah alasan §8 harus selesai lebih dulu.

---

## 10. Batas rate limit

### 10.1 Mekanisme yang ditetapkan

| Aspek | Keputusan |
|---|---|
| Penyimpanan counter | Upstash Redis lewat REST (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) |
| Sifat | Shared lintas instance. **Memory per-proses bukan kontrol production** (rencana §4 butir 8) |
| Algoritma | *Perlu diratifikasi* — sliding window sebagai default; fixed window hanya bila beban command menjadi masalah |
| Key | Gabungan dimensi IP **dan** principal/akun bila tersedia. Jangan hanya salah satu |
| Prefix | Satu prefix per kebijakan, mis. `ratelimit:login`, supaya kebijakan tidak saling menimpa |
| Isolasi environment | Database/prefix terpisah antara staging dan production |

Pada M0, limiter berjalan di **Vercel** — bukan di VPS — karena Vercel yang menangani seluruh
trafik (§1.0). Panggilan `ratelimit.limit()` dari Vercel Function ke Upstash REST bersifat
lintas-instance, sehingga memenuhi syarat "shared" di rencana §4 butir 8 tanpa VPS. Ini
penting: enforcement rate limit **tidak** menjadi blocker yang menunggu VPS.

`ephemeralCache` Upstash boleh dipakai sebagai peredam per-instance, tetapi **bukan** sumber
kebenaran: isinya hilang saat instance didaur ulang. Hitung `ratelimit.limit(key)` dan
putuskan dari respons Redis, bukan dari cache.

### 10.2 Semantik respons — jangan salah mengklaim

Ini menentukan bentuk implementasi, dan mudah salah:

- **Route Handler dapat mengembalikan HTTP 429 sungguhan** beserta header `Retry-After`:
  `Response.json(body, { status: 429, headers: { "Retry-After": ... } })`.
- **Server Action tidak dapat menetapkan kode status atau header respons.** React sudah
  mengirim header sebelum action selesai (streaming). Karena itu, rate limit di dalam
  Server Action **tidak** menghasilkan HTTP 429 — transportnya tetap 200. Yang benar:
  kembalikan state terserialisasi (`{ ok: false, error, retryAfterSeconds }`) yang dirender
  klien. Jangan menulis "mengembalikan 429" untuk sebuah Server Action.
- **Halaman RSC tidak dapat mengembalikan 429** karena alasan yang sama. Ini berlaku untuk
  `GET /verify/[token]`, yang hari ini adalah halaman RSC.
- **Middleware bukan boundary otorisasi.** Request Server Action adalah POST ke route
  halaman dengan header `Next-Action`; pembatasan berbasis middleware bersifat per-route,
  kasar, dan route itu tidak divalidasi Next.js sebagai bagian dari kontrak action. Middleware
  boleh menjadi lapisan tambahan, tidak boleh menjadi satu-satunya gerbang.

Konsekuensi yang perlu diratifikasi: endpoint publik yang wajib membalas 429 sungguhan
(login, daftar, upload, verify publik, aksi AI) dipindahkan ke Route Handler, atau menerima
kontrak state terserialisasi. Rencana §11 sudah menempatkan upload/verify publik/webhook di
Route Handler; login dan daftar masih Server Action dan perlu keputusan eksplisit.

### 10.3 Endpoint yang dicakup (rencana §4 butir 8)

| Endpoint | Bentuk hari ini | Lokasi | Butuh 429 sungguhan? |
|---|---|---|---|
| Login | Server Action | `src/actions/auth.ts` `loginAction` | **Perlu diratifikasi** |
| Daftar | Server Action | `src/actions/auth.ts` `registerAction` | **Perlu diratifikasi** |
| Reset password | **Belum ada** | — | Kebijakan dibuat bersama fiturnya |
| Upload materi/kursus | Route Handler | `POST /api/unggah` `src/app/api/unggah/route.ts` | Ya |
| Upload CV/portofolio | Server Action | `src/actions/resume.ts` `unggahBerkasAction` | **Perlu diratifikasi** |
| Verify publik | Halaman RSC (GET) | `src/app/(public)/verify/[token]/page.tsx` | Ya, dan butuh perpindahan bentuk |
| Aksi AI | Server Action | `src/actions/evaluasi.ts`, `src/actions/learning-chat.ts` | **Perlu diratifikasi** |
| Health/readiness | Belum ada | — | Tidak |

### 10.4 Angka ambang — `[TBD]`, wajib diratifikasi sebelum M0

Angka di bawah adalah **usulan penulis, bukan keputusan**. Jangan menganggapnya final;
uji terhadap perilaku nyata sebelum mengunci.

| Kebijakan | Dimensi | Usulan awal | Jendela |
|---|---|---|---|
| `login` | IP + akun | 10 / 15 menit | Per akun dicek terpisah dari per IP |
| `daftar` | IP | 5 / jam | |
| `upload` | principal | 20 / jam | Plus batas body sebelum handler |
| `verify` | IP | 120 / menit | Endpoint baca |
| `ai` | principal + IP | `[TBD]` | Selaras dengan kuota Fase 6 |
| Global per-IP | IP | `[TBD]` | Pagar anti-abuse menyeluruh |

### 10.5 Perilaku saat Upstash gagal

Respons Upstash menyertakan `reason: "timeout"` ketika Redis tidak terjangkau. Kebijakan
yang dipilih harus eksplisit, dan **Perlu diratifikasi**:

- **Fail-closed** (tolak request) untuk endpoint auth, kredensial, dan upload.
- **Fail-open** (loloskan request) untuk endpoint baca non-sensitif.

Fail-open pada login berarti rate limit dapat dimatikan dengan membuat Upstash timeout.
Itu sebabnya endpoint auth diusulkan fail-closed. Bila fail-closed dipilih, siapkan pesan
galat yang tidak menyalahkan pengguna dan alert untuk kondisi ini.

### 10.6 Urutan sebelum handler mahal

Batas ukuran dan konkurensi diperiksa **sebelum** body dibuffer penuh dan **sebelum**
provider AI dipanggil. Pola ini sudah ada di `POST /api/unggah`, yang memeriksa
`Content-Length` sebelum `formData()` dengan alasan yang terdokumentasi di berkas itu.
Jadikan pola itu standar; batas `bodySizeLimit` di `next.config.ts` hanya berlaku untuk
Server Action, bukan Route Handler.

---

## 11. Local development

### 11.1 Prasyarat

- Node sesuai `package.json` (Vitest 5 mensyaratkan Node `^22.12.0 || ^24.0.0 || >=26.0.0`;
  Next menyatakan `>=20.9.0`).
- `npm ci` untuk checkout bersih — `node_modules` tidak di-commit.
- PostgreSQL lokal (container atau instalasi lokal) dan Redis lokal atau database Upstash
  khusus development.

### 11.2 Environment

Hari ini repo berjalan **tanpa `.env`** karena semua secret punya fallback dev. Setelah
Fase 0, production **menolak melayani** bila secret kosong/known/terlalu pendek, sementara
development dan test tetap eksplisit. Perhatikan bentuk kegagalannya: lihat §11.6 — **bukan**
process exit.

Variabel yang dibutuhkan (nama saja — ADR ini tidak membuat `.env.example`; berkas itu
bagian dari pekerjaan Fase 0):

| Variabel | Kegunaan | Wajib di dev? |
|---|---|---|
| `SESSION_SECRET` | Sesi, cookie legacy, store user/onboarding/profil | Ya, eksplisit |
| `ATTESTATION_SECRET` | Tanda tangan attestation | Ya, eksplisit |
| `DEMO_MODE` | Opt-in akun demo (harus `1` **dan** `NODE_ENV=development`); jangan pernah diisi di deployment publik | Tidak |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Counter rate limit | Ya, bila rate limit aktif |
| `CAREEVO_TRUST_PROXY_HEADERS` | Percayai `X-Forwarded-Host` untuk cek Origin; **hanya** di belakang reverse proxy tepercaya yang menimpanya — jangan pernah diaktifkan bila app dijangkau langsung | Tidak |
| `CAREEVO_ALLOW_MISSING_ORIGIN` | Izinkan POST tanpa header `Origin` (klien non-browser/dev); jangan diaktifkan di deployment publik | Tidak |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Evaluasi AI opsional | Tidak; ketiadaannya adalah state yang sah |
| `CAREEVO_DATA_DIR`, `CAREERS_DATA_DIR`, `CAREERS_SESSION_DIR`, `CAREEVO_PERFORMA_DIR` | Pengalihan direktori data | Hanya di test |

Dev default tidak dihapus dari kode; yang berubah adalah production menolaknya. Jangan
menghapus fallback tanpa memastikan dev dan test masih bisa dijalankan.

**Akun demo fail-closed.** Gate demo adalah `NODE_ENV === "development"` **dan**
`DEMO_MODE === "1"`, bukan `!production`. Konsekuensi yang disengaja: `npm run dev` biasa
**tidak** lagi menampilkan atau menerima akun demo; set `DEMO_MODE=1` untuk memakainya.
`DEMO_MODE` tidak boleh diisi di staging/production dalam kondisi apa pun
(`docs/security-release-checklist.md` B2).

### 11.3 Menjalankan

1. `npm run dev` — Next 16 dev server (Turbopack default).
2. **Tidak ada proses VPS yang perlu dijalankan untuk M0.** Worker dan API VPS (§1.0) belum
   ada dan tidak menjadi bagian dari jalur pengguna. Saat amandemen ADR mengaktifkannya,
   prosesnya dijalankan terpisah (perlu keputusan: `tsx`, `node`, atau container) — `[TBD]`.
3. `npm run check` sebelum setiap commit yang menutup satu langkah.
4. `npm run build` adalah gerbang tambahan yang **tidak** dicakup `npm run check`. Ia yang
   menangkap pelanggaran boundary client/server (mis. `node:fs` tertarik ke komponen klien).
5. `npm run smoke -- <baseUrl>` dan `npm run e2e:onboarding -- <baseUrl>` memerlukan server
   yang berjalan. Catatan penting: `scripts/e2e-onboarding.mjs` memakai
   `SESSION_SECRET ?? "dev-session-secret-careevo"` untuk mencetak cookie. Terhadap server
   dengan secret nyata, skrip itu **gagal** kecuali `SESSION_SECRET` diberikan ke lingkungan
   skrip. Dokumentasikan ini di runbook, jangan biarkan menjadi kejutan di CI.

### 11.4 Jebakan yang harus diketahui

- **Cache kursus bersifat per-proses.** Sebuah proses kedua yang menulis `data/courses.json`
  tidak terlihat oleh server yang sudah berjalan sampai restart. Saat worker ditambahkan,
  ini menjadi sumber kebingungan yang nyata.
- **Test tidak boleh menyentuh `data/` atau `.data/` milik repo.** Pola pengalihan direktori
  sudah ada di beberapa test; ikuti, jangan menambah pengecualian baru.
- **Vitest `include` persis `src/**/*.test.ts`.** Tidak ada `.test.tsx`, tidak ada jsdom.
  Invarian UI diuji lewat pemeriksaan sumber statis, bukan render.
- **Environment variable yang dibaca di top level modul** (`const SESSION_SECRET =
  process.env.SESSION_SECRET ?? ...`) dievaluasi saat modul dimuat, bukan saat request.
  Validasi harus berjalan sebelum titik itu, bukan di dalam handler. Validasi yang ada
  dipanggil dari `src/instrumentation.ts` (`register()`), yang dijalankan Next sekali saat
  instance server dibuat dan diselesaikan sebelum server siap menerima request.

### 11.5 Paritas instance Next.js di VPS

Ini hanya berlaku **bila** amandemen §1.0 menjalankan instance Next.js **yang sama** di VPS
(opsi "Vercel sebagai edge + VPS sebagai origin aplikasi"). Bila VPS ternyata hanya
menjalankan API dan worker non-Next, tiga butir di bawah tidak berlaku — tetapi boundary
§8 tetap berlaku penuh. Bentuk mana yang dipilih adalah bagian dari amandemen, bukan
keputusan yang boleh diambil sambil jalan.

Bila instance Next.js memang berjalan di dua tempat, tiga hal berikut wajib dipenuhi.
Ketiganya adalah penyebab kegagalan yang terdokumentasi di Next.js, bukan kehati-hatian
teoretis:

1. **`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` harus sama di semua instance, dan di-set saat
   build.** Next.js mengenkripsi variabel closure Server Function sebelum dikirim ke klien,
   dan secara default membuat kunci unik **per build**. Dua instance dengan kunci berbeda
   tidak dapat mendekripsi action satu sama lain, dan gejalanya adalah galat
   **"Failed to find Server Action"** — bukan galat konfigurasi yang jelas. Kunci harus
   base64 dengan panjang AES yang sah (16/24/32 byte); Next membuat kunci 32 byte secara
   default. Hasilkan dengan `openssl rand -base64 32`. Kunci ini **tertanam di output build**,
   jadi ia bukan sekadar environment variable runtime.
2. **`deploymentId` harus di-set konsisten** untuk version skew protection saat rolling
   deployment. Tanpa itu, klien yang masih memegang aset dari build sebelumnya akan memanggil
   Server Action dengan ID yang tidak dikenal server. Bila `deploymentId` di-set, Next
   memakai build ID konstan dan `generateBuildId` tidak lagi berpengaruh.
3. **Dua instance harus melayani build yang sama.** Menggunakan output build berbeda dengan
   `deploymentId` yang sama tetap memutus kecocokan action.

Catatan: di Vercel ketiganya ditangani platform. Yang menjadi blocker adalah saat instance
kedua muncul di luar Vercel. Ini sebabnya butir ini masuk checklist rilis sebagai gerbang
sebelum VPS melayani trafik — bukan sekarang, dan bukan sebagai pekerjaan opsional.

### 11.6 Bentuk kegagalan secret produksi: fail-closed, bukan process exit

Ini dikoreksi terhadap perilaku nyata `next start` (Next 16.3.5), bukan disimpulkan dari
niat kode. Selama ini "production gagal start" ditulis seolah proses akan keluar dengan
kode galat. Yang terjadi dengan `NODE_ENV=production` dan kedua secret kosong:

- Proses **tetap hidup** dan mencetak `✓ Ready in …`, lalu
  `Failed to prepare server Error [SecretConfigError] …` dan satu `unhandledRejection`.
  Tidak ada `process.exit`.
- **Setiap route membalas HTTP 500 `Internal Server Error`**: `/`, `/masuk`, `/kerja`,
  `/loker`, `/verify/<token>`, `POST /api/unggah`. Halaman aplikasi tidak ada yang dilayani.
  Route statis `/_next/static/…` tetap 404 biasa karena tidak memasuki kode aplikasi.
- Dengan secret yang sah, server melayani `200` seperti biasa.

Sebabnya ada di Next: `ensureInstrumentationRegistered()`
(`node_modules/next/dist/server/lib/router-utils/instrumentation-globals.external.js`)
menyimpan promise yang reject; `next-server.js` menangkapnya dua kali hanya untuk
`console.error` lalu melemparnya lagi per request, sehingga request handler membalas 500.
Jalur `process.exit(1)` di `router-server.js` hanya berlaku bila initialize render server
gagal secara langsung — pada deployment salah secret, jalur itu tidak tercapai.

Konsekuensi operasional yang harus dipegang:

1. **Health-check memeriksa status HTTP, bukan liveness proses.** Instance salah secret
   tampak "hidup" bagi orchestrator, jadi probe yang hanya memeriksa port/pid akan
   melaporkannya sehat sementara semua halaman 500.
2. **Platform yang menandai deployment buruk dari exit-code tidak akan melihatnya.**
   Deployment itu tidak pernah "gagal"; ia hanya melayani 500 sampai dihentikan manual.
3. **Pesan `SecretConfigError` hanya ada di log server**, tidak sampai ke pengguna — yang
   terkirim adalah halaman 500 bawaan. Debug dari log, bukan dari respons.

Istilah yang dipakai di dokumen lain dan di sini: **fail-closed (500/no routes served)**.
Kata "fail-fast" hanya boleh dipakai untuk waktu validasinya (sebelum request pertama),
bukan untuk bentuk kegagalannya. Mengubahnya menjadi process-exit sungguhan adalah
pekerjaan terpisah yang belum dilakukan — bila diinginkan, ia butuh memanggil
`verifikasiKonfigurasiSecret()` di bin/entrypoint startup, bukan hanya di instrumentation.

---

## 12. Konsekuensi

**Positif**

- Frontend stateless dapat diskalakan dan dideploy tanpa memikirkan disk.
- Satu node VPS menyederhanakan operasi pada tahap ini: API, worker, dan database berada di
  satu tempat yang bisa di-debug.
- Counter rate limit shared lintas instance, dengan free tier yang cukup untuk staging.

**Negatif**

- Pada M0 topologi ini **tidak** memberikan apa yang dijanjikan judulnya: VPS tidak
  melayani trafik, jadi keuntungan "API dan worker di satu tempat yang bisa di-debug" belum
  diperoleh. Yang diperoleh M0 hanyalah keputusan yang tercatat, bukan sistemnya. Itu
  memang tujuan penulisan ADR ini, tetapi jangan salah membacanya sebagai kemajuan teknis.
- Dua sistem yang harus dijaga konsisten, plus satu boundary kepercayaan yang harus
  diverifikasi dengan benar — ini permukaan serang baru, bukan sekadar biaya operasional.
- Fitur yang menulis ke disk tidak dapat pindah ke Vercel sampai Fase 2/Fase 4 selesai. Tanpa
  VPS, fitur itu harus ditunda, bukan dijalankan setengah jalan.
- Satu node VPS adalah `[SPOF]` yang diterima secara sadar, saat nanti diprovision.
- Opsi trust boundary terkuat kemungkinan menuntut tier Enterprise Vercel — biaya yang
  belum dihitung.

**Blocker rilis — bernama, sehingga dapat ditutup satu per satu**

Belum ada satu pun yang selesai. Semuanya harus ditutup **sebelum VPS mengekspos trafik
apa pun**, kecuali yang ditandai (M0), yang harus selesai sebelum M0 dinyatakan lulus.
Daftar yang dapat dicentang ada di `docs/security-release-checklist.md`.

| # | Blocker | Cakupan |
|---|---|---|
| B1 | **Keputusan topologi** antara same-host proxy dan subdomain terpisah (§1.0), sebagai amandemen ADR bernomor | Sebelum VPS melayani trafik |
| B2 | **`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`** di-set konsisten, dibuat saat build, kunci base64 32 byte (§11.5) | Sebelum instance Next kedua muncul |
| B3 | **`deploymentId`** di-set untuk version skew protection (§11.5) | Sebelum rolling deployment multi-instance |
| B4 | **VPS nginx: header trusted proxy** — asal request diverifikasi sebelum header IP dibaca (§8.1, §9.2) | Sebelum VPS melayani trafik |
| B5 | **VPS nginx: rate limit di lapisan proxy** sebagai pertahanan berlapis, selaras kebijakan §10.4 | Sebelum VPS melayani trafik |
| B6 | **Mekanisme trust boundary** §8.2 dipilih dan diimplementasikan | Sebelum VPS melayani trafik |
| B7 | **Semua secret production di-set eksplisit**; server menolak melayani (500/no routes) bila kosong/known/pendek (§11.6) | (M0) |
| B8 | **Rate limit shared Upstash aktif** untuk login, daftar, upload, verify publik, dan aksi AI (§10) | (M0) |
| B9 | **Bentuk respons 429** untuk login/daftar diputuskan dan diimplementasikan (§10.2) | (M0) |
| B10 | **`docs/security-release-checklist.md` ditandatangani** oleh owner selain pengerjanya | (M0) |
| B11 | **Runbook rotasi + invalidasi secret** ditulis, termasuk `key_version` attestation dan perlakuan cookie berumur panjang. Satu `SESSION_SECRET` masih dipakai tujuh permukaan; ini keputusan sementara, bukan yang sudah selesai (checklist A2) | Sebelum rotasi pertama di production |

**Yang harus terjadi berikutnya**

1. Isi `[REGION]`, `[OWNER]`, `[TBD]`, dan RPO/RTO.
2. Ratifikasi §8.2 (mekanisme trust boundary) dan §10.2 (bentuk 429 untuk login/daftar).
3. Selesaikan `docs/security-release-checklist.md` untuk M0 dan tanda tangani.
4. Setujui ADR ini sebelum Fase 1 dimulai.
5. Saat VPS dibeli: tutup B1, B4, B5, B6 lebih dulu, lalu perbarui ADR dengan amandemen
   bernomor. Jangan mengaktifkan trafik VPS sebelum itu.

---

## Referensi

- `docs/backend-production-plan.md` §2.3, §4, §5, §6, §8, §9, §11
- Next.js — Self-Hosting (`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, build ID, version skew)
- Next.js — `deploymentId` (`next.config.js`)
- Next.js — "Failed to find Server Action" (gejala kunci enkripsi tidak konsisten)
- Vercel — Request headers (`x-forwarded-for`, `x-vercel-forwarded-for`)
- Vercel — Functions: region dan default `iad1`
- Vercel — Reverse proxy dan Trusted Proxy
- Upstash Redis — Pricing dan dokumentasi `@upstash/ratelimit`

Nama berkas yang dirujuk ADR ini: `docs/security-release-checklist.md` dibuat bersama ADR
ini; `.env.example` **belum ada** dan tidak dibuat di sini — ia bagian dari pekerjaan Fase 0
yang menyentuh konfigurasi.
