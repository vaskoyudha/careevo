# Sub-modul (bab) — desain

Tanggal: 2026-10-02
Status: **dieksekusi** — model, store, action, admin editor, panel silabus, dan
migrasi data nyata (202 halaman) terverifikasi. `typecheck` bersih,
`185/185` berkas test lulus (`2408` test), lint bersih untuk berkas yang disentuh.

> Catatan gate: `npm run build` **gagal di mesin ini**, tetapi bukan karena
> perubahan ini — ia gagal identik pada HEAD tanpa perubahan apa pun, dengan
> `TurbopackInternalError: Symlink [project]/backend/venv/bin/python is invalid,
> it points out of the filesystem root` (symlink vendored `backend/venv`, dibuat
> 2026-09-27). Sudah dibuktikan dengan `git stash` + build ulang.

## 1. Masalah

Reader (`/belajar/[slug]/materi/[modulId]`) punya dua tingkat: **modul → halaman**.
Satu modul yang panjang ("Eloquent, Migrasi, dan Validasi") berisi belasan halaman
dalam satu daftar datar, sehingga silabus tidak bisa menjawab pertanyaan yang
justru ditanyakan peserta saat membaca: *"saya sedang di bagian mana?"*.

Yang diminta: satu tingkat **sub-modul** di antaranya — modul → sub-modul →
halaman — dan panel silabus menyempit ke modul yang sedang dibuka (judulnya
berubah menjadi nama modul itu), menampilkan daftar sub-modulnya, di mana tiap
sub-modul bisa dibentangkan menampilkan halamannya.

## 2. Keputusan yang mengikat

| Keputusan | Pilihan | Konsekuensi |
|---|---|---|
| Kepemilikan halaman | `Submodul.halaman[]` — halaman **bersarang** di dalam bab | `Modul.halaman` **dihapus**; 202 halaman katalog lama dimigrasikan jadi satu bab per modul |
| Progres | Milik **modul**, bukan bab | `module_progress`, checkpoint, kuis terverifikasi tetap keyed `modul_id`. Bab murni navigasi |
| Panel | Menyempit ke modul yang dibuka + pintu "Semua modul" | Peta kemajuan seluruh kursus tetap terjangkau, tapi bukan default |

### 2.1 Kenapa `Modul.halaman` dihapus, bukan dipertahankan

Dua tempat menyimpan halaman akan menyimpang tanpa error, dan pertanyaan "halaman
ini milik bab mana" menjadi tidak terjawab. Karena itu satu sumber saja:
`Modul.submodul[].halaman`. Kursus lama dimigrasikan **malas dan idempoten** saat
dibaca (`normalisasiSubmodulLama()`), dengan pola yang sama seperti
`normalisasiHalamanLama()` dan `promosiKuisLama()`.

### 2.2 Kenapa progres tetap di tingkat modul

Menjadikan bab sebagai unit yang bisa diselesaikan menyentuh invariant yang
dikunci di `AGENTS.md`: `module_progress` PK `(enrollment_id, module_id)`,
`putuskanAkses`, `selesaikanModulKuisVerified`, dan jalur kredensial. Pertanyaan
produk yang dijawab fitur ini adalah navigasi ("bagian mana yang sedang saya
baca"), dan itu tidak membutuhkan bab menjadi unit penilaian.

## 3. Bentuk data

```ts
interface Submodul {
  id: string; modul_id: string; course_id: string;
  judul: string; ringkasan: string; urutan: number;
  halaman: Halaman[];            // bersarang — bab memiliki halamannya
  created_at: string; updated_at: string;
}

interface Halaman {
  // ... field lama ...
  submodul_id: string;           // diduplikasi, bukan hanya diturunkan
}

interface Modul {
  submodul?: Submodul[];         // menggantikan `halaman?: Halaman[]`
}
```

`Halaman.submodul_id` diduplikasi meski posisinya sudah menyiratkan induknya:
halaman punya alamat sendiri (`?halaman=<id>`) dan renderer perlu tahu induknya
tanpa menelusuri seluruh pohon.

## 4. Perata tunggal

`lib/courses/submodul.ts` adalah **satu-satunya** tempat yang tahu cara meratakan
pohon jadi daftar halaman berurutan (`halamanModul`). Penomoran "Halaman N",
prakiraan menit baca, pemilihan halaman aktif, dan pager "halaman berikutnya"
semuanya lewat sana. Kalau masing-masing meratakan sendiri, urutannya akan
menyimpang tanpa error.

`ModulKursus` (bentuk yang dilihat UI learner) membawa **keduanya**: `submodul[]`
(pohon asli, untuk panel) dan `halaman[]` (hasil rata, untuk penomoran). Keduanya
dibangun dari satu pohon di `modul-resolver.ts`, jadi tidak bisa berbeda.

## 5. Panel silabus — dua tampilan

1. **"Semua modul"** — daftar setiap modul, tautan ke reader-nya. Ini janji rail
   lama (peta kemajuan menetap).
2. **"Modul dibuka"** (default) — judul panel = nama modul, isi = daftar babnya,
   tiap bab membentang menampilkan halamannya.

Pintu **"Semua modul" tinggal di baris kontrol teratas panel**, sebagai tombol
biru (ramp `--brand-grad`, sama dengan CTA kaki panel dan `.btn-primary`).
Sudutnya `--radius-md` (14px), **bukan pil**: DESIGN.md memisahkan dua bentuk —
"rounded pill for focused marketing actions, 14px radius for product controls" —
dan ini kontrol produk di dalam panel, bersebelahan dengan tombol navbar yang
terukur 13px/12px. Ia satu-satunya kontrol yang mengubah **seluruh** isi panel,
jadi tempatnya di kepala — bukan di dalam daftar, tempat ia terbaca sebagai
bagian dari daftar yang sedang ditampilkan. Ia hanya dirender di tampilan modul:
saat daftar kursus yang tampil, menawarkan "kembali ke daftar kursus" berarti
menawarkan halaman yang sedang dibaca.

**Tombol tutup panel ada di baris yang sama**, rata kanan. Keduanya **kontrol
panel**, bukan bagian dari isi: satu mengganti seluruh isi, satu menutupnya.
Judul kursus karena itu **keluar** dari baris itu — ia nama isi panel, dan
menaruhnya sebaris dengan dua kontrol membuat judul terpotong lebih cepat di
panel sempit.

Yang menahan tombol tutup di kanan adalah `margin-left: auto` miliknya sendiri,
**bukan** `justify-content: space-between` pada barisnya: baris itu juga dirender
tanpa pintu "Semua modul" (tampilan daftar kursus), dan `space-between` akan
menaruh tombol tunggal itu di kiri. Diukur di peramban: kedua pusatnya berada di
y yang sama (62px) di 1440px maupun 390px, dan jarak tepi kanan panel→glif 10px.

State tampilannya **dimiliki kepala panel** (`IsiPanelSilabus`), bukan rail:
kepala yang merender tombolnya, jadi kepala yang harus tahu tampilan mana yang
berlaku. Rail menerimanya sebagai prop (`tampilan` + `onTampilan`) — state yang
tinggal di rail akan membuat kepala dan isi panel bisa berbeda pendapat tanpa
error apa pun.

Kuis dan lampiran tetap di tingkat modul (bukan per bab) karena penilaian dan
checkpoint berhenti di sana. Ia ditampilkan setelah daftar bab, mengikuti urutan
baca pane: prosa → asesmen → lampiran.

Bab yang memuat `?halaman=` dibentangkan sejak awal; tanpa itu deep link
mendaratkan peserta pada bab yang tertutup — halaman benar, peta salah. Akordeon
itu **juga diselaraskan saat modulnya berganti**, karena peserta bisa berpindah
modul dari dalam panel: akordeon yang menunjuk bab modul lama akan mendaratkan
mereka di modul baru tanpa bab terbuka (panel tampak kosong padahal isinya ada).

### 5.1 Memilih modul **tidak** menutup panel

Perilaku yang diminta pengguna, dan alasan panel tidak lagi menutup atas
perpindahan modul:

- **Memilih halaman** = "saya mau membaca yang ini" → panel menutup (ia menutupi
  seluruh layar; halaman yang dipilih harus terlihat).
- **Memilih modul dari daftar "Semua modul"** = langkah menelusuri → panel
  **tetap terbuka** dan beralih ke tampilan modul itu. Menutupnya di situ
  melewati langkah yang paling berguna: memperlihatkan bab modul yang baru
  dipilih.

Konsekuensinya pemicu penutupan di `materi-shell.tsx` dipersempit: yang menutup
hanya perpindahan yang **pathname-nya sama** tetapi `?halaman`-nya berubah.
`pathname` saja tidak cukup (pindah halaman dalam satu modul tidak mengubahnya),
dan `?halaman` saja juga tidak (pindah modul menghapus query itu, sehingga
terlihat seperti perpindahan halaman).

Tautan yang berarti "saya mau membaca" — sub-item halaman, "Buka materi", CTA
kaki panel — tetap menutup panel lewat `onNavigasi`/`onTutup` masing-masing, jadi
penutupan itu tidak bergantung pada shell menebak maksud navigasinya.

## 6. Yang TIDAK dikerjakan

- **Memindahkan halaman antar bab.** `geserHalaman` sengaja dibatasi dalam satu
  bab; memindahkan lintas bab adalah keputusan berbeda dan belum dibutuhkan.
- **Sub-modul di `ModulKursus` turunan.** Modul turunan (kursus tanpa modul
  tersimpan) tidak punya bab; panel menampilkan daftar halamannya seperti bentuk
  lama, bukan bab kosong.

## 6a. Insiden: `data/courses.json` sempat terkotori skrip verifikasi

Dicatat karena biayanya nyata dan cara menemuinya tidak sepele.

Skrip verifikasi round-trip memakai nama env yang **salah** — `CAREVEO_DATA_DIR`,
sedangkan yang dibaca `storage.ts:18` adalah `CAREEVO_DATA_DIR`. Akibatnya
`direktoriData()` jatuh ke `data/` milik repo, dan tiga modul uji ("Modul
Round-Trip") tertulis ke kursus nyata `r12` dan `crs-1`: 130 modul / 205 halaman,
bukan 127 / 202.

Gejala di UI persis seperti bug produk: modul asing muncul di daftar modul
(Lampiran 1 pengguna). Ditemukan dari screenshot itu, bukan dari gate mana pun —
tidak ada test yang membaca `data/courses.json` milik mesin pengembang.

Dibersihkan lewat `deleteModul()` (store yang menulis atomik, bukan sunting JSON
langsung), lalu diverifikasi kembali ke **38 kursus / 127 modul / 202 halaman**.
Pelajaran untuk skrip sekali-jalan: **periksa langsung ke direktori tujuannya**
(`berkasCourses()`) sebelum menulis, jangan percaya nama env yang kita tulis
sendiri.

## 7. Verifikasi

- Migrasi diuji terhadap `data/courses.json` yang sebenarnya: **202 halaman sebelum
  dan sesudah**, 0 id hilang, 127 modul → 127 bab (satu per modul), dan idempoten
  (dijalankan dua kali tidak menggandakan bab).
- `submodul.test.ts` mengunci perataan lintas bab, penomoran menerus, dan
  idempotensi migrasi.
- `materi-rail.test.ts` mengunci kontrak baru: judul = nama modul yang dibuka,
  modul lain tidak dirender di tampilan itu, bab bisa dibentangkan, bab yang
  memuat halaman aktif terbuka sejak awal, dan baris modul **tidak** menutup
  panel.
- `reader-silabus.test.ts` mengunci bahwa pintu "Semua modul" berada **di atas**
  judul kursus (urutan DOM) dan tidak dirender saat daftar kursus yang tampil.
- `materi-shell.test.ts` mengunci aturan penutupan yang dipersempit: hanya
  perpindahan **di dalam modul yang sama** yang menutup panel.
- Perilaku nyata diverifikasi di peramban (Playwright, 1440px dan 390px):
  memilih modul dari "Semua modul" membiarkan panel terbuka dan pane ikut
  berpindah (`nav` panel berganti ke nama modul baru, satu bab terbuka, tanpa
  error konsol); memilih **halaman** menutup panel.
- Posisi kontrol diukur dari kotak sungguhan, bukan dari kelas CSS: pusat tombol
  "Semua modul" dan tombol tutup berada di y yang sama (62px) di 1440px dan
  390px, tombol tutup di kanan "Semua modul" dan rata tepi kanan panel (10px
  dari tepi ke glif), dan tetap rata kanan saat pintu "Semua modul" tidak ada
  (tampilan daftar kursus).
- Radius juga diukur, bukan disalin dari sumber: tombol "Semua modul" terukur
  **14px** (dari `--radius-md`), sementara navbar `Masuk` terukur 13px. Nilai
  tokennya dibaca dari `getComputedStyle` karena dua daftar token saling menimpa
  untuk nama yang sama (`--radius-md: 14px` vs turunan `--radius: 0.75rem`).

### Utang yang tersisa

- **`npm run build` tidak bisa dijalankan di mesin ini** (lihat catatan status di
  atas). Karena `build` adalah satu-satunya gate yang menangkap pelanggaran impor
  klien/server, klaim "tidak ada `node:*` yang bocor ke bundel klien" belum
  terbukti di sini — meski berkas murni baru (`submodul.ts`) tidak mengimpor
  apa pun kecuali `@/types/course`.
- **Memindahkan halaman antar-bab** belum ada (lihat §6).
- **`halaman-editor.tsx`** belum memakai `actions/submodul.ts` di test — action
  bab belum punya test sendiri. Yang menguji perilakunya saat ini adalah
  `store-halaman.test.ts` dan `submodul.test.ts` (lapisan store/murni).
