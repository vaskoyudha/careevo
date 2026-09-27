# Materi Reader — desain

**Tanggal:** 2026-09-30
**Status:** draft untuk implementasi
**Konteks:** `src/components/features/learning/detail-kursus.tsx`,
`src/components/features/learning/course-session.tsx`,
`src/lib/learning/{akses,session}.ts`, `src/app/(focus)/`, `docs/adr/0003`.

---

## 1. Masalah

Halaman `/belajar/[slug]` hari ini mengerjakan **tiga pekerjaan sekaligus** dalam
satu dokumen 894 baris: hero pemasaran, silabus, dan permukaan baca yang
sesungguhnya. Tombol **"Buka materi"** (`detail-kursus.tsx:579`) membuka isi modul
*inline* lewat state `modulTerbuka`, sehingga membaca satu kursus 5 modul berarti
menggulir dokumen yang juga memuat kotak sertifikat, tabel integritas, panel
Project, dan daftar kursus terkait.

Akibatnya:

- **Tidak ada permukaan baca yang fokus.** Prosa halaman (`HalamanView`) bersaing
  dengan empat panel lain di dokumen yang sama.
- **Satu modul terbuka pada satu waktu.** Membandingkan modul 2 dan modul 4 berarti
  membuka-tutup-buka.
- **Tidak ada URL per modul.** Modul tidak bisa ditautkan, di-bookmark, atau
  dilanjutkan dari tempat terakhir; "Lanjutkan belajar" hanya melompat ke
  `#kurikulum` (`detail-kursus.tsx:726`, `kursus-subnav.tsx:78`).
- **Tidak ada peta kemajuan yang menetap.** Saat membaca, daftar modul tidak
  terlihat.

Platform acuan (Coursera, Codecademy, Dicoding) memisahkan dua hal ini: halaman
kursus adalah **silabus**, dan menekan satu modul membuka **pemutar dengan
outline yang menetap di sisi kiri**.

## 2. Yang sudah ada dan dipakai ulang

Desain ini **tidak menyentuh mesin akses**. Semua keputusan otoritatif tetap di
tempatnya; yang berubah hanya rumah bagi komponennya.

| Yang dipakai ulang | Lokasi | Peran di reader |
|---|---|---|
| `putuskanAkses` / `boleh()` | `src/lib/learning/akses.ts` | Gerbang `materi`, `kuis`, `bantuan_akademik` |
| `CourseSessionGate` / `Indicator` / `Prompt` | `course-session.tsx` | Gerbang, indikator, ajakan sesi |
| `HalamanView` | `halaman-view.tsx` | Prosa + pager `?halaman=` |
| `MateriView` | `materi-view.tsx` | Lampiran video/PDF |
| `KuisView` | `kuis-view.tsx` | Asesmen (dinilai server) |
| `KejadianPanel` | `kejadian-panel.tsx` | Penjelasan + pelaporan kejadian |
| `selesaikanMateriAction` | `src/actions/learning.ts:228` | Satu-satunya jalur penyelesaian terverifikasi |
| `tandaiModulAction` | `src/actions/enrollment.ts:169` | Jalur penyelesaian informal |
| `modulUntukSumber` | `modul-resolver.ts` | Resolver modul tunggal |
| `(focus)/layout.tsx` | `src/app/(focus)/layout.tsx` | Gerbang sesi + onboarding |

`HalamanView`'s pager sudah memakai tautan **relatif** (`?halaman=<id>`,
`halaman-view.tsx:217`), jadi ia bekerja di route reader tanpa perubahan.

## 3. Keputusan

### 3.1 Route dan shell

```
src/app/(focus)/belajar/[slug]/materi/[modulId]/page.tsx
```

- Berada di grup **`(focus)`**, sehingga `(focus)/layout.tsx` menyediakan gerbang
  sesi + onboarding. Halaman hanya membaca data. Ini **bukan preseden baru**:
  `/belajar/mastery`, `/belajar/buku`, `/belajar/latihan` sudah memakai pengecualian
  yang sama, dan AGENTS.md mencatatnya sebagai pengecualian yang disengaja.
- Reader memakai **shell-nya sendiri**, bukan `LearnerShell`: `min-h-dvh flex
  flex-col`, tanpa `.chrome`. Ini pola yang sudah ada di `latihan-view.tsx:133` dan
  `book-library.tsx:33`.
- Bar fokus: `sticky top-0`, `border-b`, memuat **← Silabus · judul kursus · pil
  sesi · "Tandai selesai"**. Karena bar ini di `top-0` (bukan di bawah navbar
  mengambang), ia **tidak** membutuhkan offset `--chrome-h` dan tidak boleh
  memperkenalkan `-mt-[Npx]` — `chrome-offset.test.ts` akan gagal kalau begitu.
- Rail kiri: kolom `w-72` di `lg:`, berisi **seluruh** modul kursus beserta
  sub-itemnya (halaman, lampiran, kuis) dan tanda centang per modul. Di bawah `lg`
  rail runtuh menjadi panel "Daftar modul" yang bisa dibuka.
- Pane utama: satu modul — halaman (dengan pager), lalu lampiran, lalu kuis, lalu
  panel tutor AI, masing-masing di belakang gerbangnya sendiri.

**Id modul** aman di URL: modul tersimpan punya id sendiri, modul turunan memakai
`${courseId}-m1`…`-m5` (`kurikulum.ts:124`). `modulId` yang tidak ada di kurikulum
kursus itu → `notFound()`.

**Kursus tanpa modul tersimpan** (tanpa `materi`/`halaman`/`kuis`) tidak berpura-pura
punya isi: reader menampilkan ringkasan modul + CTA tautan eksternal (`m.url`),
persis perilaku lama.

### 3.2 Kontinuitas sesi — risiko utama

`CourseSessionProvider` menyimpan `bukti`/`runId` **di state React**
(`course-session.tsx:166–170`), dan provider itu di-mount di dalam `DetailKursus`
— yaitu **per halaman**. Berpindah dari silabus ke route reader akan meng-unmount
provider dan **kehilangan sesi terverifikasi yang sedang berjalan**. Peserta yang
sedang di tengah sesi akan mendarat di reader tanpa bukti, gerbang menutup lagi,
dan modul tampak mustahil diselesaikan.

Perbaikannya murah karena **`buktiBaru` adalah tanda tangan murni atas
`(courseId, owner, policyVersion)`** (`session.ts:119`), bukan token acak:

```
server reader: cariRunAktif({ courseId, owner })   → session.ts:336
               ambilRun(id)                        → session.ts:213
               kedaluwarsa(run)?                   → session.ts:185
                 ya  → tidak ada sesi (gerbang tampil)
                 tidak → buktiBaru({ courseId, owner, policyVersion })
```

Karena `policyVersion` diambil dari kebijakan kursus yang sama, tanda tangan yang
dihasilkan **identik** dengan yang dikeluarkan `mulaiSesiAction`. Reader lalu
men-seed provider dengan `bukti` + `runId` itu, sehingga navigasi silabus ↔ reader
mempertahankan **satu** sesi alih-alih bercabang.

Perubahan pada `CourseSessionProvider`: dua prop opsional `buktiAwal` /
`runIdAwal` (dan `kejadianAwal`), dipakai sebagai nilai awal `useState`. Tanpa prop
itu perilakunya persis seperti sekarang, jadi pemanggil lama tidak berubah.

**Yang tidak berubah:** `putuskanAkses` tetap satu-satunya mesin keputusan, tetap
murni, tetap dipakai klien dan server. Gerbang di reader **tidak lebih lemah**
daripada di silabus — ia memakai keputusan yang sama, hanya dirender di tempat
yang lebih terlihat.

### 3.3 Isi reader dan gerbangnya

| Isi | Komponen | Gerbang |
|---|---|---|
| Prosa halaman | `HalamanView` | **bebas** — membaca bukan penyelesaian |
| Lampiran | `MateriView` | `boleh("materi")` |
| Kuis | `KuisView` | `boleh("kuis")` |
| Tutor AI | `KursusAiPanel` | `boleh("bantuan_akademik")` |

Ketiga keputusan dihitung **saat render**, bukan disimpan di state — alasan yang
sama yang sudah ditulis di `detail-kursus.tsx:231`: keputusannya bergantung pada
bukti sesi yang bisa berubah kapan saja, dan menyalinnya ke state membuat gerbang
tertinggal. Pesan gerbang diambil apa adanya dari `putuskanAkses` supaya copy tidak
menyimpang dari mesin akses.

Panel tutor AI hanya dirender untuk peserta yang **sudah terdaftar**, sama seperti
sekarang (`detail-kursus.tsx:785`), dan `aiCourseId` di-resolve server lewat
`selaraskanKursusAi` seperti di `belajar/[slug]/page.tsx`.

#### Tutor AI — letaknya per modul, aturannya tetap per kursus

Panel tutor **pindah ke dalam pane modul**, sehingga ia tampil bersama materi yang
sedang dibaca alih-alih sebagai satu kotak di sidebar kursus. Yang menentukan boleh
atau tidaknya **tetap kebijakan kursus**, lewat `boleh("bantuan_akademik")`:

| `kebijakan.aturan_bantuan` | Tampilan di pane modul |
|---|---|
| `bebas` | Panel aktif |
| `bertutor` | Panel aktif |
| `tanpa_ai` | Panel tampil **nonaktif** + alasan |

**Tidak ada aturan AI per modul, dan desain ini tidak menambahkannya.**
`aturan_bantuan` hidup di `KebijakanCourse` (`types/course.ts:377`);
`CheckpointMateri` — record per modul (`types/course.ts:386`) — hanya punya
`batas_waktu_menit`, `mode`, dan `ref`, **tanpa field AI**. `putuskanAkses` untuk
`bantuan_akademik` membaca kebijakan kursus saja dan tidak pernah melihat modul
(`akses.ts:123`). Jadi "modul yang mengizinkan AI" = **kursus yang mengizinkan
AI**; reader hanya memindahkan tempat panelnya, bukan memecah aturannya.

Konsekuensi yang harus disadari: **tutor tidak disembunyikan di modul asesmen.**
Modul dengan checkpoint `kuis`/`proyek` di kursus `bertutor` tetap menampilkan
panel aktif, persis seperti hari ini. Menutupnya berdasarkan `mode` checkpoint akan
mengubah mesin akses yang dikunci dan diam-diam mencabut fitur di kursus
`bertutor` — itu perubahan perilaku, bukan pemindahan UI, jadi **di luar lingkup**
(lihat §4).

Panel tetap dirender saat `tanpa_ai` — **nonaktif**, dengan pesan dari
`putuskanAkses` dipakai apa adanya. Alasan yang sudah ditulis di
`kursus-ai-panel.tsx:15` tetap berlaku: peserta berhak tahu fitur itu ada dan kenapa
ia tidak bisa dipakai. Karena reader menampilkan **satu modul pada satu waktu**,
ini tetap satu panel per layar — bukan pengulangan.

**Konteks yang dikirim ke tutor tetap lingkup kursus.** `tautanTutorAi(courseId)`
hanya mengikat id kursus (`tutor-ai.ts`); posisi baca modul **tidak** ikut dikirim.
Karena itu copy panel tidak boleh mengklaim tutor tahu modul yang sedang dibaca —
ia tetap menyebut kursus ("konteks utuh kursus ini"), bukan "modul ini".

### 3.4 Penyelesaian modul

Logika dua jalur disalin **apa adanya** dari `tandai()`
(`detail-kursus.tsx:336–376`); tidak ada aturan baru:

- `wajibSesiTerverifikasi(kebijakan) && checkpointTerverifikasi(checkpointEfektif(m))`
  → `selesaikanMateriAction({ courseId, modulId, bukti })`. **Bukti kosong bukan
  alasan mengganti jalur** — server yang menolak, dan pesannya dipakai apa adanya.
  Tidak ada penulisan optimistis di jalur ini.
- Sisanya (kursus `opsional`, checkpoint `kuis`/`proyek`, atau pembatalan
  `sudah === true`) → `tandaiModulAction`.

Klien **tidak** memeriksa ada/tidaknya bukti sebelum memilih jalur — itu justru
bug yang dikomentari di `detail-kursus.tsx:319`. Server tetap otoritatif.

### 3.5 Halaman kursus menjadi silabus

- Baris modul berubah dari tombol expand menjadi `<Link href={/belajar/[slug]/materi/[id]}>`,
  menampilkan durasi, jumlah halaman/lampiran/kuis, tanda centang, dan penanda
  "Lanjutkan" pada modul pertama yang belum selesai.
- State `modulTerbuka` dan `halamanTerpilih` **dihapus**, beserta render inline
  `HalamanView`/`MateriView`/`KuisView`/`CourseSessionGate` di dalam daftar modul.
- Impor yang menjadi mati ikut dihapus (`MateriView`, `HalamanView`, `KuisView`,
  `KejadianPanel`) — `eslint` akan menandainya.
- Hero, `SertifikatPanel`, panel Project, `TabelPelanggaran`, kursus terkait:
  **tidak berubah**.
- `KursusSubNav` dan CTA sidebar "Lanjutkan belajar" berpindah dari `#kurikulum`
  ke URL reader modul pertama yang belum selesai. Kalau semua sudah selesai,
  tetap ke modul pertama ("Ulas kembali modul").

### 3.6 Revalidasi

`selesaikanMateriAction` dan `tandaiModulAction` hari ini me-revalidate
`/belajar` dan `/belajar/${slug}` (`learning.ts:392`, `enrollment.ts:254`). Route
reader adalah halaman **lain**, jadi tanpa revalidasi tambahan tanda centang di
rail bisa basi pada navigasi lunak. Kedua action ditambah
`safeRevalidate('/belajar/${slug}/materi/${modulId}')`.

Ini aditif dan aman: `safeRevalidate` sudah menelan kegagalan di luar lifecycle
request (dipakai unit test).

## 4. Yang **tidak** dilakukan

- **Tidak** mengubah `putuskanAkses`, `wajibSesiTerverifikasi`,
  `checkpointEfektif`, atau `putuskanAkses`' pesan.
- **Tidak** memindahkan penyelesaian modul ke klien, dan **tidak** menambah jalur
  penyelesaian ketiga.
- **Tidak** menyentuh `assessment_snapshot` (ADR 0003): kuis tetap dinilai server
  dari snapshot.
- **Tidak** mengubah rantai kredensial. "Selesai kursus" tetap bukan sertifikat;
  kotak sertifikat tetap punya tiga keadaan (`terkunci`/`siap`/`terbit`).
- **Tidak** menambah pencarian di bar fokus (navbar memang tidak punya search).
- **Tidak** memigrasikan modul turunan menjadi modul tersimpan.
- **Tidak** mengubah `--chrome-h` atau `.under-chrome`.
- **Tidak** menambah aturan AI **per modul**. `aturan_bantuan` tetap milik
  `KebijakanCourse`, dan `putuskanAkses` tetap tidak membaca modul. Tutor AI hanya
  **dipindahkan** ke pane modul (§3.3); ia tidak digerbangi per checkpoint, dan
  tidak dicabut di modul `kuis`/`proyek` kursus `bertutor`.
- **Tidak** mengirim posisi baca/modul ke AI Mastery — kontrak `tautanTutorAi`
  tetap hanya `courseId`.

## 5. Berkas

**Baru**

- `src/app/(focus)/belajar/[slug]/materi/[modulId]/page.tsx` — server component:
  gerbang sesi/onboarding dari layout, resolusi modul, seed sesi, gerbang kursus.
- `src/components/features/learning/materi-reader.tsx` — komposisi shell + rail + pane.
- `src/components/features/learning/materi-rail.tsx` — daftar seluruh modul + sub-item.
- `src/components/features/learning/materi-focus-bar.tsx` — bar fokus (judul, pil sesi, selesai).
- `src/components/features/learning/materi-pane.tsx` — isi satu modul (halaman → lampiran →
  kuis → tutor AI), tiap bagian di belakang gerbangnya.

**Diubah**

- `detail-kursus.tsx` — menjadi silabus; buang akordeon dan impor mati.
- `course-session.tsx` — prop opsional `buktiAwal`/`runIdAwal`/`kejadianAwal`.
- `kursus-subnav.tsx` — target CTA ke reader.
- `src/actions/learning.ts`, `src/actions/enrollment.ts` — revalidate route reader.
- `scripts/smoke.mjs` — tambah route reader ke array `routes`.
- `kursus-ai-panel.tsx` — **tidak diubah logikanya** (menerima `akses` sebagai prop
  yang sama); hanya pemanggilnya yang berpindah dari sidebar ke pane modul.

## 6. Gerbang dan pengujian

- `scripts/smoke.mjs` — route reader ditambahkan ke array `routes` (jumlahnya
  diturunkan dari array, bukan ditulis tangan).
- `chrome-offset.test.ts` — mengembara seluruh `.tsx`; reader **tidak boleh**
  memuat `-mt-[Npx]`.
- `npm run check` **dan** `npm run build` — reader menyentuh `src/app`, jadi
  `check` saja tidak menangkap pelanggaran impor client-safe/server-only
  (`modul-resolver`, `session.ts` server-only).
- `npx next typegen` — route baru.

**Test baru (unit, murni):**

1. Rail memuat **setiap** modul kursus, dengan sub-item yang benar per modul.
2. `modulId` yang tidak ada di kurikulum → `notFound` (bukan render modul kosong).
3. Run yang **kedaluwarsa** atau **tidak aktif** → tidak ada bukti → gerbang
   `perlu_sesi` tetap tampil. (Fail-closed: `kedaluwarsa()` sudah menangani batas
   waktu; test mengunci bahwa reader tidak pernah memakai run non-aktif.)
4. Penyelesaian modul `materi` di kursus `wajib` **selalu** lewat
   `selesaikanMateriAction`, dan jalur informal hanya untuk `opsional` /
   checkpoint `kuis`/`proyek` / pembatalan.
5. Modul turunan (tanpa isi) merender CTA eksternal, bukan pane kosong.
6. Tutor AI mengikuti **kebijakan kursus**, bukan checkpoint modul: kursus
   `tanpa_ai` merender panel nonaktif di modul `materi` **maupun** `kuis`; kursus
   `bertutor` merender panel aktif di modul `kuis`. Test ini mengunci §3.3 supaya
   tidak ada yang diam-diam menambahkan gerbang per checkpoint.

## 7. Risiko

| Risiko | Mitigasi |
|---|---|
| Sesi hilang saat navigasi silabus → reader | Seed `bukti` dari `cariRunAktif` (§3.2); test #3 |
| Tanda centang basi di rail | `revalidatePath` route reader (§3.6) |
| Gerbang diam-diam lebih lemah | Mesin akses tidak disentuh; test #4 mengunci jalur |
| Rail + pane berdesakan di mobile | Rail runtuh jadi panel di bawah `lg` |
| Dua sumber "modul" (silabus vs reader) menyimpang | Keduanya membaca `modulUntukSumber` yang sama |
| Tutor AI diam-diam jadi gerbang per modul | §3.3 mengunci aturannya di kursus; test #6 |
| Copy panel tutor mengklaim tahu modul aktif | Kontrak `tautanTutorAi` hanya kirim `courseId`; copy menyebut kursus (§3.3) |
