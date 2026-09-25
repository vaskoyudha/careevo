# ADR 0002 — Database dan ORM: PostgreSQL + Drizzle (dev: Docker Postgres)

- **Status:** Diusulkan — belum disetujui
- **Tanggal:** 2026-09-25
- **Konteks rencana:** `docs/backend-production-plan.md` §2.3 (keputusan sebelum Fase 1) dan §5 (Fase 1)
- **Pengambil keputusan:** `[OWNER]`
- **Menggantikan:** —
- **Melengkapi:** ADR 0001 (`docs/adr/0001-topologi-deployment-produksi.md`), yang di §1.2 sengaja
  meninggalkan ORM/migration sebagai keputusan terbuka. ADR ini menutup dua baris tabel §2.3
  rencana: **Database** dan **ORM/migration**.

Masuknya PostgreSQL sebagai source of truth adalah prasyarat keras Fase 1 (identity, autentikasi,
RBAC, session), dan menjadi prasyarat Fase 1A sampai Fase 6. Implementasi data production tidak
dimulai sebelum ADR ini disetujui.

---

## 0. Konvensi placeholder

Dokumen ini memakai penanda yang sama dengan ADR 0001 dan sengaja memuat keputusan yang
**belum diambil**. Semua ditandai supaya bisa di-`grep` dan tidak terbaca sebagai keputusan final:

| Penanda | Arti |
|---|---|
| `[OWNER]` | Pemilik tanggung jawab yang belum ditunjuk |
| `[REGION]` | Keputusan region yang belum dipilih |
| `[TBD]` | Angka, kebijakan, atau biaya yang belum ditetapkan |
| **Perlu diratifikasi** | Usulan penulis dokumen; butuh persetujuan sebelum Fase 1 dimulai |

ADR ini **tidak boleh** dipakai untuk menyimpulkan hal yang belum diputuskan. Bila sebuah nilai
belum ada di sini, ia `[TBD]`, bukan "implisit".

---

## 1. Konteks

Fase 1 (rencana §5) menciptakan principal stabil bagi seluruh domain lain: `users`,
`user_profiles`, `user_credentials`, `user_roles`, `sessions`, token verifikasi/reset,
`staff_invitations`, dan `audit_events`. Rencana §2.1 menetapkan PostgreSQL sebagai source of
truth untuk state bisnis dan audit, dan §2.3 mensyaratkan **satu** ORM, bukan dua.

Dua keputusan sudah dikunci sebelum ADR ini ditulis, dan keduanya dicatat di sini sebagai
keputusan, bukan usulan:

1. **ORM = Drizzle.** Bukan Prisma. Satu ORM saja untuk seluruh repo.
2. **Database = PostgreSQL.** Untuk development dipakai **Docker Postgres lokal**. Production
   tetap **placeholder**, karena VPS belum dibeli dan belum diprovision — konsisten dengan
   ADR 0001 §1.0 dan §5.

Kondisi repo yang relevan saat ADR ini ditulis:

- Dependensi Drizzle sudah ditambahkan ke working tree: `drizzle-orm ^0.45.3` (dependencies),
  `drizzle-kit ^0.31.11` (devDependencies), dan driver `postgres ^3.4.9` (postgres.js).
  Tidak ada dependensi Prisma di `package.json` maupun di `src/`.
- Belum ada `drizzle.config.ts`, belum ada direktori schema, dan belum ada script migrate.
  Keduanya bagian dari pekerjaan Fase 1, bukan bagian dari ADR ini.
- `.env.example` sudah ada, tetapi **belum memuat** `DATABASE_URL`. Penambahannya adalah
  pekerjaan Fase 1 yang ditangani berkas lain; ADR ini hanya menetapkan bentuknya.

---

## 2. Keputusan

### 2.1 ORM = Drizzle

| Aspek | Keputusan |
|---|---|
| ORM | **Drizzle** — `drizzle-orm` |
| Driver | **`postgres`** (postgres.js) |
| Migration | **`drizzle-kit`** — SQL migration yang di-commit dan di-review |
| Validasi skema | `drizzle-zod` bila perlu; **Perlu diratifikasi** — Zod sudah dipakai di repo ini (`zod ^4.6.5`), jadi integrasinya opsional dan tidak diwajibkan oleh ADR ini |
| Jumlah ORM | **Satu.** Tidak ada ORM kedua di repo ini |

Alasan singkat:

- **Satu ORM, tanpa pengecualian.** Dua ORM yang hidup bersamaan berarti dua definisi skema,
  dua jalur migration, dan divergensi yang tidak terdeteksi sampai produksi. Rencana §2.3
  melarangnya secara eksplisit ("jangan gunakan dua ORM").
- **Migration berupa SQL yang dapat di-review.** `drizzle-kit generate` menghasilkan berkas SQL
  yang masuk ke Git dan dibaca manusia sebelum dijalankan. Perubahan skema identity dan audit
  adalah perubahan yang perlu terlihat di diff, bukan efek samping dari tool.
- **Boundary repository tetap terjaga.** Drizzle adalah query builder, bukan ORM yang memaksa
  model di seluruh aplikasi. Ini cocok dengan rencana §5 langkah 2: query database hanya boleh
  hidup di repository, dan tidak boleh ada query langsung dari component/UI.
- **Type safety tanpa codegen yang berat.** Tipe diturunkan dari definisi skema, sehingga tidak
  ada langkah generate klien yang harus disinkronkan sebelum `npm run typecheck` bermakna.

**Prisma ditolak.** Alasan yang dicatat, bukan sekadar preferensi:

- Prisma membawa langkah codegen dan runtime klien sendiri; itu satu toolchain tambahan yang
  harus dijaga konsisten dengan `tsc` dan dengan siklus build Next.js.
- Prisma mendorong satu model data global, yang berlawanan dengan batas repository yang
  diminta rencana §5 langkah 2 dan §11 peta modul target.
- Memilih Prisma berarti menambahkan dependensi baru sekaligus membuang dependensi Drizzle yang
  sudah ada di `package.json`. Tidak ada alasan untuk membayar biaya itu.

**Konsekuensi yang mengikat:** kontribusi apa pun yang memperkenalkan Prisma, TypeORM, Sequelize,
Kysely sebagai ORM paralel, atau query `pg` mentah di luar driver yang ditetapkan, **ditolak**
sampai ADR ini diamandemen. `postgres` (postgres.js) dipakai sebagai driver Drizzle, bukan sebagai
jalur query alternatif.

### 2.2 Database = PostgreSQL

| Aspek | Keputusan |
|---|---|
| Mesin | **PostgreSQL** |
| Versi development | `postgres:16-alpine` (image Docker) |
| Development | **Docker Postgres lokal** |
| Production | **Placeholder** — VPS belum dibeli (ADR 0001 §1.0) |
| Provider production | `[TBD]` — self-hosted di VPS, atau managed PostgreSQL; **belum diputuskan** |

PostgreSQL dipilih karena Fase 1 sampai Fase 6 bergantung pada hal yang tidak disediakan store
berbasis berkas hari ini: transaksi, foreign key, unique constraint (mis. `email_normalized`
unik case-insensitive), index, `JSONB` untuk payload audit ter-redact, dan akses aman dari
worker multi-instance.

Sub-keputusan **self-hosted vs managed** sengaja **tidak** diambil di sini. Ia bergantung pada
RTO/RPO yang masih `[TBD]` (ADR 0001 §7) dan pada apakah VPS jadi dibeli. ADR 0001 §5 sudah
mencatat baris biaya PostgreSQL sebagai `[TBD]` untuk alasan yang sama; ADR ini tidak
mengubahnya.

### 2.3 Hubungan dengan ADR 0001

ADR ini **tidak** mengubah topologi ADR 0001 (Vercel + VPS + Upstash Redis) dan tidak
mengaktifkan VPS. PostgreSQL production tetap berada di VPS yang belum ada.

| Aturan ADR 0001 yang mengikat ADR ini | Rujukan |
|---|---|
| Instance Vercel tidak menyimpan state; semua state bersama hidup di PostgreSQL, Upstash, atau object storage | ADR 0001 §1.1 butir 1 |
| Fitur yang menulis ke disk tidak boleh dilayani dari Vercel sampai Fase 2/Fase 4 mendarat | ADR 0001 §1.1 butir 2 |
| PostgreSQL adalah satu titik kegagalan pada satu node VPS; mitigasinya ada di backup dan RTO | ADR 0001 §1.1 butir 3, §6, §7 |
| Region PostgreSQL belum dipilih | ADR 0001 §2 |
| Backup PostgreSQL wajib keluar dari VPS | ADR 0001 §6.1, §6.3 butir 1 |

Selama ADR 0001 §1.0 masih berlaku, **database production belum ada**, jadi tidak ada database
production yang dapat dihubungi dari Vercel. Yang ada hanyalah database development lokal.

---

## 3. Provider, region, retention, owner

### 3.1 Provider

| Environment | Provider | Catatan |
|---|---|---|
| Development | **Docker `postgres:16-alpine`** | Dijalankan lewat Docker Compose; tanpa data production |
| Test | Database ephemeral per run | Mengikuti pola pengalihan direktori yang sudah ada di repo; test tidak boleh menyentuh database developer |
| Staging | `[TBD]` | Belum ada. Bergantung pada keputusan provider production |
| Production | `[TBD]` — **self-hosted di VPS atau managed, belum diputuskan** | VPS belum dibeli (ADR 0001 §1.0) |

**Perlu diratifikasi.** Versi mesin di development dipin ke `postgres:16-alpine` supaya
perilaku lokal dapat direproduksi. Versi PostgreSQL production **harus selaras atau lebih baru**
dari versi development; menjalankan versi production yang lebih tua dari development adalah
cara paling mudah mendapatkan fitur SQL yang bekerja di lokal lalu gagal di produksi. Versi
production dicatat sebagai `[TBD]` sampai provider ditetapkan.

### 3.2 Region — `[REGION]` belum dipilih

**Status: BELUM DIPILIH.** Konsisten dengan ADR 0001 §2, bagian ini mencatat batasan, bukan
mengambil pilihan.

- Latensi yang menentukan adalah **Vercel → VPS → PostgreSQL**. Region PostgreSQL harus
  berdekatan dengan region VPS, bukan dengan pengguna secara langsung.
- Selama M0, VPS tidak melayani trafik dan tidak dapat dialamatkan browser (ADR 0001 §1.0),
  sehingga pilihan region belum punya konsekuensi operasional. Ia menjadi mengikat begitu
  amandemen ADR 0001 mengaktifkan VPS.
- Kandidat yang relevan untuk basis pengguna Indonesia: `sin1` (Singapore), `hnd1` (Tokyo).
  Ini kandidat yang sama dengan ADR 0001, bukan daftar baru.
- Bila provider production nanti adalah managed PostgreSQL, region database adalah keputusan
  tersendiri dan harus dicatat bersama region VPS dalam satu amandemen.

| Yang harus ditetapkan | Nilai |
|---|---|
| Region PostgreSQL production | `[REGION]` |
| Provider managed (bila bukan self-hosted) | `[TBD]` |

### 3.3 Owner — placeholder

Owner untuk database merujuk tabel owner ADR 0001 §3. ADR ini **tidak membuat tabel owner
kedua**; ia menambahkan dua tanggung jawab yang tidak tercakup di sana.

| Peran | Tanggung jawab | Pemilik |
|---|---|---|
| Decision owner | Menyetujui ADR ini dan amandemennya | `[OWNER]` — merujuk ADR 0001 §3 |
| Backup & restore owner | Menjalankan dan mencatat drill restore database | `[OWNER]` — merujuk ADR 0001 §3 |
| Secret rotation owner | Merotasi kredensial database, termasuk rencana invalidasi | `[OWNER]` — merujuk ADR 0001 §3 |
| **Migration owner** (baru) | Menyetujui dan menjalankan migration production; memegang runbook rollback | `[OWNER]` |
| **Kredensial database development** (baru) | Menjaga `.env.example` tanpa secret dan kredensial lokal tidak pernah dipakai di luar lokal | `[OWNER]` |

Aturan proses yang sudah berlaku dan tidak berubah: **penulis tidak boleh self-approve**
(rencana §12). Migration production disetujui orang selain yang menulisnya.

### 3.4 Retention

Retention database **tidak** ditetapkan ulang di sini. Tabel retention target ada di
**ADR 0001 §4** dan tetap berlaku untuk kelas data yang sama (`sessions`, `audit_events`,
`attestations`, `quiz_attempts`, `learning_events`, `outbox_events`, `uploaded_files`, log).

Dua hal yang perlu ditegaskan tanpa menduplikasi tabel itu:

- **`audit_events`**: `[TBD]` — usulan ≥ 12 bulan, sebagaimana tercatat di ADR 0001 §4. Usulan
  ini **belum diratifikasi** dan tetap milik `[OWNER]`.
- **Kelas data lain**: nilainya tetap `[TBD]` dan tetap merujuk tabel ADR 0001 §4. Jangan
  menyalin angka dari sana ke sini; satu tabel retention saja, supaya tidak ada dua nilai yang
  bisa saling menyimpang.

Aturan yang tidak berubah: **tidak ada penghapusan yang menghapus bukti yang masih
direferensikan credential.** Foreign key dan policy restrict adalah penegaknya, bukan disiplin
manual (ADR 0001 §4). Retention adalah kebijakan, bukan lisensi untuk menghapus.

---

## 4. Strategi backup

Backup database **tidak** dirancang ulang di sini. Strategi backup ada di **ADR 0001 §6** dan
tetap berlaku: PostgreSQL full backup terjadwal + WAL archiving untuk PITR bila opsi managed
mendukung, harian `[TBD]`, WAL berkelanjutan, dengan salinan di **provider/region berbeda** dari
VPS.

Yang perlu dicatat khusus untuk ADR ini:

| Environment | Backup |
|---|---|
| Development lokal (Docker) | **Tidak relevan.** Isinya data developer, dapat dihapus dan dibuat ulang. Jangan pernah menjadikannya target backup, dan jangan pernah menjadikannya sumber restore. |
| Staging | `[TBD]` — belum ada environment |
| Production | `[TBD]` — belum ada database production |

Aturan ADR 0001 yang mengikat dan tidak boleh dilanggar di sini:

1. **Backup yang berada di host atau disk yang sama dengan sumbernya bukan backup** (ADR 0001
   §6.3 butir 1). Untuk PostgreSQL yang berjalan di VPS yang sama dengan API dan worker, ini
   berarti salinan wajib keluar dari VPS.
2. **Restore drill terjadwal di environment non-production** adalah bukti keberadaan backup.
   Backup yang belum pernah di-restore dianggap tidak ada (ADR 0001 §6.3 butir 2, rencana §9).
3. **Backup tidak memuat secret mentah** (ADR 0001 §6.3 butir 3).
4. **RPO/RTO belum ditetapkan** — `[TBD]`, milik `[OWNER]`, wajib diisi sebelum M5
   (ADR 0001 §7). Angka ini juga yang menentukan pilihan self-hosted vs managed di §2.2, jadi
   ia adalah penghambat keputusan, bukan sekadar target operasional.

---

## 5. Prosedur local development

Ringkasan di bawah cukup untuk menjalankan Fase 1 di mesin developer. **Dokumentasi lengkap ada
di `docs/local-db.md`** (ditulis sebagai bagian pekerjaan Fase 1); bagian ini tidak
menduplikasinya dan tidak boleh dijadikan sumber tunggal saat keduanya berbeda.

1. **Jalankan database.** `docker compose up -d postgres`. Compose menjalankan
   `postgres:16-alpine` untuk development. Service ini **bukan** bagian dari build Next.js dan
   tidak boleh dianggap tersedia di production.
2. **Set `DATABASE_URL`.** Ambil bentuknya dari `.env.example` — berkas itu memuat nama variabel
   dan connection string **tanpa nilai rahasia**, sesuai konvensi yang sudah berlaku di repo.
   Salin ke `.env.local`. Jangan menaruh nilai asli di `.env.example`.
3. **Jalankan migration** lewat `drizzle-kit`, atau lewat script migrate yang dibungkus
   `package.json` (`[TBD]` — nama script belum ditetapkan dan ditentukan di Fase 1). Migration
   yang dihasilkan di-commit sebagai SQL yang dapat di-review.
4. **Database test ephemeral.** Test integrasi memakai database sementara, mengikuti pola
   pengalihan direktori yang sudah ada di repo (mis. `CAREERS_DATA_DIR`, `CAREEVO_PERFORMA_DIR`,
   dan `CAREEVO_PERFORMA_DIR` di `vitest.config.mts`): environment variable diarahkan ke lokasi
   sementara **sebelum** modul store dimuat. Test tidak boleh menyentuh database development.
   Rencana §5 acceptance criteria mensyaratkan migration fresh install dan upgrade diuji di CI.
5. **Seed developer** harus eksplisit dan **tidak aktif di production** (rencana §5 langkah 8).
   Jangan membuat seed yang berjalan otomatis saat server start.
6. **Migration rollback/runbook** adalah bagian dari Fase 1 (rencana §5 langkah 8) dan belum
   ada. Sampai runbook itu ada, migration production dianggap kerja berisiko dan harus
   disetujui migration owner (§3.3).

Yang **tidak** berubah dari ADR 0001 §11 dan tetap berlaku: `npm run dev` untuk dev server,
`npm run check` sebagai gerbang sebelum menutup satu langkah, dan `npm run build` sebagai
gerbang tambahan yang menangkap pelanggaran boundary client/server — termasuk menarik `node:fs`
atau modul koneksi database ke komponen klien.

Jebakan yang perlu diketahui sejak sekarang: `src/lib/courses/kurikulum.ts`, `blok.ts`,
`halaman.ts`, dan `kuis.ts` **tetap murni dan client-safe**. Import database hanya boleh tinggal
di repository atau resolver server-only (rencana §2.2). `npm run build` adalah gerbang yang
menangkap pelanggaran ini; `npm run check` tidak.

---

## 6. Keputusan vocabulary role canonical

Ini keputusan tersendiri, dan sengaja dicatat eksplisit karena rencana §5 langkah 3
membiarkannya terbuka: *"data legacy `user` dipetakan ke `learner` pada adapter/cutover
(**atau pertahankan `user` end-to-end bila dipilih ADR**)"*. ADR ini **memilih opsi kedua**.

### 6.1 Keputusan

**Token role kanonik di database adalah `"user"`, `"verifikator"`, dan `"admin"`.**

| Token kanonik | Arti |
|---|---|
| `"user"` | **Learner** — peserta didik, role default registrasi publik |
| `"verifikator"` | Staff verifikator |
| `"admin"` | Staff admin |

**`user` ≡ `learner`.** Keduanya menunjuk peran yang sama; perbedaannya hanya penamaan.
Tidak ada dua makna yang hidup berdampingan, dan tidak ada tabel mapping yang perlu dirawat,
karena hanya ada **satu** token: `"user"`.

### 6.2 Yang tidak berubah

- **Registrasi publik tetap menghasilkan learner secara semantik.** Ini constraint yang
  mengikat dan sudah berlaku hari ini: `registerRoleSchema` di `src/lib/validation/auth.ts`
  adalah `z.literal("user")`, sehingga field `role` dari form publik hanya dapat bernilai
  `"user"` — `"verifikator"` dan `"admin"` ditolak. Fase 0 (rencana §4 butir 3) mempertahankan
  semantik ini; yang berubah hanyalah cara nilainya sampai ke database.
- **`ROLES` di `src/lib/auth/types.ts` adalah `["user", "verifikator", "admin"]`,** dan itu
  tetap menjadi daftar role kanonik. Tipe `Role` tidak berubah isinya.
- Token `"user"` **bukan** role staff. `isStaffRole()` di `src/lib/auth/roles.ts` tetap
  mengembalikan `true` hanya untuk `"verifikator"` dan `"admin"`; perilaku ini tidak boleh
  melebar akibat ADR ini.
- Provisioning `verifikator`/`admin` tetap lewat invitation/admin-only workflow ber-audit
  (rencana §5 langkah 6), bukan lewat registrasi publik.

### 6.3 Mengapa rename massal ditolak

Alternatifnya adalah memetakan `"user"` → `"learner"` di adapter/cutover, atau melakukan rename
massal sekarang. Keduanya **ditolak**, karena:

- **Churn yang luas dan tersebar.** Token role `"user"` muncul sebagai nilai di enam situs
  sumber non-test — `src/lib/auth/types.ts` (`ROLES`), `src/types/domain.ts` (tipe `Role` dan
  `ActorType`), `src/lib/validation/auth.ts` (`registerRoleSchema`), `src/actions/auth.ts`
  (`registerAction`), dan `src/lib/auth/demo-accounts.ts` — lalu menyebar lewat tipe `Role`,
  `SessionUser`, dan `SessionPayload` ke **24 berkas `src/`**. Di atas itu ada **17 pemanggil
  `isStaffRole()`** (14 di antaranya non-test) yang harus diverifikasi satu per satu untuk
  memastikan tidak ada yang diam-diam berubah perilaku.
- **Seluruh test ikut bergerak.** **13 berkas test** memuat token role `"user"` secara langsung,
  dan totalnya **19 berkas test** menyentuh role. Setiap berkas harus disesuaikan, dan test yang
  menegakkan constraint registrasi publik (`src/lib/validation/auth.test.ts`, yang secara
  eksplisit menolak `"verifikator"`, `"admin"`, `"ADMIN"`, dan `"staff"`) harus tetap
  membuktikan hal yang sama setelahnya.
- **Nilainya tidak sepadan.** Rename ini tidak memperbaiki bug, tidak menambah kemampuan, dan
  tidak menghilangkan satu pun makna ganda — karena memang tidak ada makna ganda selama
  `user` ≡ `learner` dipegang secara eksplisit. Yang ditukar adalah risiko regresi pada seluruh
  permukaan auth dengan keuntungan kosmetik.
- **Legacy tidak menciptakan dua arti.** Data legacy dari cookie user store tidak dapat menjadi
  import database yang trusted (rencana §5 langkah 7), jadi ia tidak menciptakan kelas user
  kedua yang butuh token berbeda. Satu token sudah cukup.

### 6.4 Aturan yang tidak boleh dilanggar

1. **Tidak ada dua arti role yang hidup tanpa mapping.** Karena keputusannya adalah "satu
   token", aturannya menjadi: jangan memperkenalkan `"learner"` sebagai token role di database,
   di cookie, di sesi, atau di policy authorization. Bila kelak token itu memang dibutuhkan,
   ia hanya boleh muncul sebagai label tampilan, bukan sebagai nilai yang disimpan atau
   dibandingkan.
2. **Token role dibandingkan secara eksak, bukan secara semantik.** `"user"` bukan `"User"`,
   bukan `"learner"`, dan tidak boleh dicocokkan dengan pencocokan longgar. Normalisasi
   (trim/lowercase) di boundary input tetap seperti yang sudah ada, bukan sebagai pengganti
   vocabulary yang eksplisit.
3. **Role tetap dimuat ulang dari database, bukan dari claim frontend.** Ini berlaku untuk
   semua role termasuk `"user"` (ADR 0001 §8.1 butir 4; rencana §2.1 dan §4 butir 5).
4. **Keputusan ini dicatat di kode, bukan hanya di ADR.** Fase 1 perlu menulis komentar singkat
   di tempat token role didefinisikan bahwa `"user"` berarti learner secara sengaja, supaya
   keputusan ini tidak dibaca ulang sebagai kelalaian lalu "diperbaiki" oleh orang berikutnya.
5. **Vocabulary ini saat ini punya dua definisi independen, dan itu harus disadari.** Tipe
   `Role` dideklarasikan ulang di `src/types/domain.ts` (`"user" | "verifikator" | "admin"`)
   terpisah dari `ROLES` di `src/lib/auth/types.ts`. Keduanya kebetulan sepakat hari ini, jadi
   tidak ada bug — tetapi ini persis bentuk divergensi yang ADR ini larang. Fase 1 harus
   memutuskan satu sumber (kemungkinan `src/lib/auth/types.ts`, dengan `domain.ts` mengimpornya)
   sebelum menambah role baru. Mengubah salah satu tanpa yang lain akan menghasilkan dua
   daftar role yang berbeda tanpa galat kompilasi.

---

## 7. Konsekuensi dan yang belum diputuskan

### 7.1 Konsekuensi

**Positif**

- Satu ORM dan satu definisi skema, sehingga tidak ada divergensi yang tersembunyi.
- Migration berupa SQL yang dapat di-review sebelum menyentuh production.
- Development dapat dijalankan tanpa langganan apa pun: Docker Postgres lokal, tanpa data
  production, tanpa biaya berjalan.
- Boundary repository yang diminta rencana §5 langkah 2 dapat ditegakkan karena Drizzle tidak
  memaksa query di luar repository.

**Negatif**

- **Tidak ada database production pada M0.** Sama seperti ADR 0001 §1.0, yang diperoleh di sini
  adalah keputusan yang tercatat, bukan sistem yang berjalan. Pembaca tidak boleh membacanya
  sebagai kemajuan teknis.
- Database development lokal tidak membuktikan apa pun tentang perilaku production: latensi,
  konkurensi, batas koneksi, dan konfigurasi TLS semuanya berbeda. Test integrasi terhadap
  Docker lokal **bukan** bukti bahwa alur yang sama aman di production.
- Pilihan self-hosted vs managed belum diambil, sehingga pekerjaan provisioning belum dapat
  dimulai dan biaya production tetap tidak diketahui (ADR 0001 §5).
- Drizzle adalah dependensi baru yang harus dipelajari tim; kesalahan pemakaian (mis. query di
  luar repository, atau relasi yang tidak terindeks) baru terlihat sebagai bug, bukan galat
  kompilasi.

**Blocker yang tercatat, bukan pekerjaan yang selesai**

| # | Blocker | Cakupan |
|---|---|---|
| D1 | `DATABASE_URL` dan kredensial database ditambahkan ke `.env.example` **tanpa nilai rahasia** | Sebelum Fase 1 dinyatakan lulus |
| D2 | `docker-compose.yml` untuk Postgres dev tersedia dan dapat dijalankan dari checkout bersih | Sebelum Fase 1 dinyatakan lulus |
| D3 | `docs/local-db.md` ditulis | Sebelum Fase 1 dinyatakan lulus |
| D4 | Script migrate dan runbook rollback migration ditetapkan | Sebelum migration pertama dijalankan di environment bersama |
| D5 | Provider, region, dan versi PostgreSQL production ditetapkan (`[TBD]`/`[REGION]`) | Sebelum database production dibuat |
| D6 | RPO/RTO ditetapkan (ADR 0001 §7) | Sebelum M5, dan sebelum provider production dipilih |
| D7 | Keputusan `"user"` ≡ `learner` ditulis sebagai komentar di kode tempat token role didefinisikan (§6.4 butir 4) | Sebelum Fase 1 dinyatakan lulus |

### 7.2 Yang belum diputuskan

Semuanya `[TBD]`, dan semuanya merujuk ADR 0001 alih-alih dijawab di sini:

| Keputusan terbuka | Status | Rujukan |
|---|---|---|
| Provider production (self-hosted vs managed) | `[TBD]` | §2.2 ADR ini; ADR 0001 §5 |
| Region PostgreSQL | `[REGION]` | §3.2 ADR ini; ADR 0001 §2 |
| Versi PostgreSQL production | `[TBD]` | §3.1 ADR ini |
| Retention kelas data | `[TBD]` | ADR 0001 §4 |
| Backup production dan drill restore | `[TBD]` | ADR 0001 §6 |
| RPO/RTO | `[TBD]` | ADR 0001 §7 |
| Key management | `[TBD]` | ADR 0001 §1.2, §5 |
| Object storage | `[TBD]` | ADR 0001 §1.2, §5 |
| Transactional email | `[TBD]` | ADR 0001 §1.2, §5 |
| Queue/worker provider | `[TBD]` | ADR 0001 §1.2 |
| `drizzle-zod` dipakai atau tidak | **Perlu diratifikasi** | §2.1 ADR ini |
| Nama script migrate di `package.json` | `[TBD]` | §5 ADR ini |

**Jangan** menyimpulkan dari ADR ini bahwa queue eksternal diperlukan, bahwa object storage
sudah dipilih, atau bahwa provider production adalah managed. Ketiganya tetap terbuka, sama
seperti sebelum ADR ini ditulis.

### 7.3 Yang harus terjadi berikutnya

1. Isi `[OWNER]`, `[REGION]`, dan `[TBD]` di §3, §4, dan §7.
2. Ratifikasi §6 (vocabulary role canonical) bersama pemilik policy authorization, lalu tulis
   komentarnya di kode (D7).
3. Selesaikan D1, D2, dan D3 sebelum Fase 1 dimulai.
4. Setujui ADR ini sebelum Fase 1 dimulai, bersama ADR 0001.
5. Saat VPS dibeli: tetapkan provider dan region production (D5), lalu perbarui ADR ini dengan
   amandemen bernomor — bukan dengan menyunting keputusan §2 secara diam-diam.

---

## Referensi

- `docs/backend-production-plan.md` §2.1, §2.2, §2.3, §5, §9, §11, §12
- `docs/adr/0001-topologi-deployment-produksi.md` §1.0, §1.1, §1.2, §2, §3, §4, §5, §6, §7, §11
- `src/lib/auth/types.ts` — `ROLES = ["user", "verifikator", "admin"]`
- `src/lib/auth/roles.ts` — `isStaffRole()`
- `src/lib/validation/auth.ts` — `registerRoleSchema = z.literal("user")`
- `src/lib/auth/user-store.ts`, `src/lib/auth/session.ts`, `src/lib/auth/demo-accounts.ts`
- Drizzle ORM — dokumentasi `drizzle-orm`, `drizzle-kit`, dan driver `postgres` (postgres.js)

Nama berkas yang dirujuk ADR ini: `docs/local-db.md`, `docker-compose.yml`, dan penambahan
`DATABASE_URL` pada `.env.example` **belum ada** dan tidak dibuat di sini — ketiganya bagian
dari pekerjaan Fase 1 yang menyentuh konfigurasi dan kode.
