# Plan — Halaman berformat & backlink pada modul

Status: ✅ SUDAH DIEKSEKUSI
Lanjutan dari: `docs/course-crud-plan.md` (CRUD kursus → modul → materi)

## 1. Tujuan

Modul saat ini hanya bisa menampung **materi** (video / teks / PDF / kuis).
Teks materi dirender apa adanya sebagai teks polos — tidak ada tebal, judul,
ukuran huruf, maupun tautan. Tidak ada konsep "halaman", dan tidak ada cara
menautkan satu bagian materi ke bagian lain.

Yang diminta:

1. Saat **membuat modul**, admin menentukan **jumlah halaman**.
2. Setiap halaman bisa diisi konten berformat: **tebal, miring, heading, ukuran
   teks** (paragraf/HTML `<small>`/lead), dan **heading bersarang**.
3. **Backlink** — tautan internal antar halaman/section di dalam modul.

## 2. Keputusan yang mengikat

Dua hal ini menentukan seluruh bentuk implementasi (dikonfirmasi pengguna):

| Keputusan | Pilihan | Konsekuensi |
|---|---|---|
| Letak "halaman" | `Modul.halaman[]`, bersarang di dalam modul | Halaman bukan entitas terpisah; hidup & mati bersama modulnya. Materi video/PDF/kuis tetap jadi **lampiran** modul. |
| Editor | **Editor blok buatan sendiri** | Tanpa dependency baru. Konten disimpan sebagai JSON terstruktur, dirender React — **tidak ada HTML mentah**, jadi XSS tersimpan tetap tertutup. |

### 2.1 Kenapa blok, bukan HTML

`materi-view.tsx:66-77` sengaja merender teks sebagai teks polos, dengan alasan
tertulis: repo ini **tidak punya sanitizer**, jadi merender HTML dari admin akan
mengubah lubang XSS jinak menjadi XSS tersimpan. Keputusan yang sama berlaku di
sini: format disimpan sebagai pohon blok, dan renderer memetakannya ke elemen
React. Tidak ada `dangerouslySetInnerHTML` di mana pun. (Dikonfirmasi: `grep`
tidak menemukan `dangerouslySetInnerHTML`, `DOMPurify`, `marked`, atau `remark`
di `src/`; `@tailwindcss/typography` juga tidak terpasang.)

### 2.2 Kenapa `teks` digantikan, bukan ditambah

Materi bertipe `teks` dan halaman berformat adalah **dua cara menyimpan hal yang
sama** (prosa) dengan dua renderer berbeda. Dibiarkan, admin akan terus ragu
harus memakai yang mana, dan setiap perubahan tipografi harus dikerjakan dua
kali.

Karena itu `TipeMateri` menjadi `video | pdf | kuis` — `teks` dihapus — dan
prosa pindah seluruhnya ke halaman. Data lama tidak hilang: materi `teks` yang
sudah ada di `data/courses.json` **dimigrasikan saat dibaca** menjadi satu
halaman pertama (§6).

## 3. Model data

Di `src/types/course.ts`:

```ts
export type TipeBlok = "paragraf" | "heading" | "daftar" | "kutipan" | "gambar";

/** Ukuran huruf relatif terhadap skala tema — bukan px bebas. */
export type UkuranBlok = "kecil" | "normal" | "besar" | "lead";

/** Potongan teks sebaris, dengan penanda inline. */
export interface SegmenTeks {
  teks: string;
  tebal?: boolean;
  miring?: boolean;
  /** `#id-section` (backlink) atau http/https. Divalidasi di gerbang zod. */
  tautan?: string;
}

export interface BlokHalaman {
  id: string;
  tipe: TipeBlok;
  /**
   * Level heading 1–3. Hanya dipakai `tipe: "heading"`.
   * 1 = judul section, 2 = sub, 3 = sub-sub — inilah "heading berformat".
   */
  level?: 1 | 2 | 3;
  ukuran?: UkuranBlok;
  /** Isi sebaris. Dipakai paragraf, heading, kutipan. */
  segmen?: SegmenTeks[];
  /** Butir daftar, masing-masing satu baris berformat. */
  butir?: SegmenTeks[][];
  /** Path `/uploads/...` — hanya untuk `tipe: "gambar"`. */
  src?: string;
  alt?: string;
}

export interface Halaman {
  id: string;
  modul_id: string;
  course_id: string;
  judul: string;
  /** 1-based, eksplisit — sama seperti `Modul.urutan`. */
  urutan: number;
  blok: BlokHalaman[];
  created_at: string;
  updated_at: string;
}
```

Perubahan pada tipe yang sudah ada:

- `Modul` += `halaman?: Halaman[]` — bersarang, alasan sama dengan `materi`
  (`course.ts:46-51`): menghapus modul otomatis menghapus halamannya, tidak ada
  referensi yatim.
- `TipeMateri` = `"video" | "teks" | "pdf" | "kuis"` → `"video" | "pdf" | "kuis"`.
- `CreateModulInput` += `jumlah_halaman?: number` — inilah kontrol "tentukan
  jumlah halaman saat membuat modul".

## 4. Modul murni (client-safe)

Semua di bawah ini **tidak boleh** menyentuh `node:fs` atau store: renderer
halaman adalah komponen klien, dan pelajaran dari bug build sebelumnya
(`AGENTS.md` §"Course curriculum") adalah satu impor yang salah menjatuhkan
build Turbopack dengan "chunking context does not support external modules".

| Berkas | Isi |
|---|---|
| `src/lib/courses/blok.ts` | `idSection(blok)`, `segmenKeTeks(segmen)`, `ringkasBlok(blok)`, `blokKosong(tipe)` |
| `src/lib/courses/halaman.ts` | `halamanUntukModul(modul)`, `cariHalaman`, `judulHalamanOtomatis(n)` |
| `src/lib/validation/blok.ts` | Zod untuk blok + aturan tautan |
| `src/lib/validation/halaman.ts` | Zod untuk halaman (judul + `blok[]`) |

### 4.1 Aturan tautan (backlink vs eksternal)

Satu field `tautan` melayani dua hal, dibedakan oleh bentuknya:

- **Backlink** — `#` + slug, mis. `#menyiapkan-tools`. Divalidasi dengan regex
  ketat `^#[a-z0-9-]{1,80}$`. Renderer memetakannya ke `<a href="#…">` yang
  menunjuk `id` section di halaman yang sama **atau** halaman lain di modul yang
  sama.
- **Eksternal** — lewat `skemaUrlHttp` yang sudah ada
  (`src/lib/validation/url.ts`), yang menolak `javascript:` (zod v4 `z.url()`
  menerimanya — sudah diverifikasi sebelumnya).

Selain itu, editor menawarkan **pemilih backlink**: daftar judul section yang
ada di modul itu, dijangkau lewat kontrak `id` — bukan menebak string. Ini yang
membuat backlink "lengkap": admin memilih tujuan, bukan mengetiknya.

## 5. Store & aksi

### 5.1 Store (`src/lib/courses/store.ts`)

Fungsi baru, mengikuti pola `listModul`/`createModul`/`geserModul` yang ada
(termasuk pemisahan `rapikanUrutan` untuk baca vs `nomoriUlang` untuk mutasi —
`store.ts:237-253`):

- `listHalaman(courseId, modulId)`
- `createHalaman(courseId, modulId, input)`
- `updateHalaman(courseId, modulId, halamanId, input)`
- `deleteHalaman(courseId, modulId, halamanId)`
- `geserHalaman(courseId, modulId, halamanId, arah)`

`createModul` menerima `jumlah_halaman` dan membuat N halaman kosong berjudul
"Halaman 1…N" dalam satu penulisan. **Satu `simpan()` per aksi** — bukan N
penulisan berantai.

Blok tanpa `id` diberi `idBaru("blk")` di sisi store, sekali, supaya id-nya
stabil antar penyuntingan dan menambah blok di tengah tidak mengubah `id`
blok lain (itu yang membuat tautan `#anchor` tetap sahih).

### 5.2 Aksi (`src/actions/halaman.ts`)

Pola persis `src/actions/modul.ts`: `gateStaff()` → validasi zod → store →
`revalidateKurikulum(courseId)`. Perbedaan satu-satunya: `blok` datang sebagai
**satu field JSON** (seperti `soal` pada kuis di `materi.ts:82-105`) — bentuknya
bersarang, dan memetakannya ke field datar jauh lebih rapuh. JSON yang cacat
diteruskan apa adanya agar dilaporkan sebagai `fieldErrors.blok`, bukan
exception yang menutup action.

`revalidateKurikulum` ditambah `/belajar/[slug]` sudah tercakup lewat
`/belajar`; mengikuti pola yang ada di `modul.ts:29-31`.

## 6. Migrasi data lama

`storage.ts:29-45` (`isCourse`) sengaja longgar terhadap field opsional, jadi
`courses.json` lama **tetap terbaca** tanpa perubahan. Yang perlu ditangani
hanya materi bertipe `teks`:

- Fungsi murni `normalisasiHalamanLama(course)` di `src/lib/courses/halaman.ts`:
  setiap materi `teks` pada sebuah modul dikonversi menjadi satu `Halaman`
  (judul dari materi, satu blok paragraf dari `konten`), ditempatkan **di depan**
  halaman lain, lalu dimunculkan sebagai `halaman[]`. Materi `teks` itu dibuang
  dari `materi[]`.
- Dipanggil di jalur baca `storage.ts` setelah `isCourse` menyaring. Hasilnya
  ikut tersimpan pada penulisan berikutnya — migrasi *lazy*, tidak ada skrip
  sekali jalan yang harus diingat.
- Invarian: modul dengan `halaman` kosong **tidak** dianggap punya halaman,
  sehingga kursus lama tetap memakai modul turunan seperti sebelumnya.

## 7. UI

### 7.1 Admin

| Komponen | Peran |
|---|---|
| `halaman-editor.tsx` | Daftar halaman dalam satu modul: tambah, ubah judul, hapus, geser ↑/↓ (pola `modul-editor.tsx`), tombol "+ Tambah halaman". |
| `blok-editor.tsx` | Editor blok untuk satu halaman: toolbar (B, I, H1/H2/H3, A−/A+, tautan, daftar, kutipan, gambar), sunting sebaris, pindah/ hapus blok. |
| `pemilih-tautan.tsx` | Dialog kecil: pilih bagian teks → jadikan backlink ke section mana (daftar dari blok heading modul) atau isi URL eksternal. |

`modul-editor.tsx` mendapat tombol "Halaman (N)" bersebelahan dengan "Materi (N)"
yang sudah ada (`modul-editor.tsx:69-80`).

Form tambah modul mendapat field **"Jumlah halaman"** (`number`, min 1, max 50),
default 1.

### 7.2 Learner

`halaman-view.tsx` — **satu** renderer yang dipakai admin (pratinjau) sekaligus
peserta, alasannya sama dengan `pratinjau-materi.tsx:6-12`: pratinjau yang
berbeda dari kenyataan lebih buruk daripada tidak ada pratinjau.

Isi renderer:

1. **Daftar isi** — dari blok `heading`, tiap entri jadi tautan `#anchor`.
2. Isi halaman — blok dipetakan ke elemen React (`ukuran` → kelas tema, bukan
   px bebas).
3. **Pager** Sebelumnya / Berikutnya antar halaman modul.
4. **Backlink** — `<a href="#…">` antar section; tautan ke halaman lain di modul
   yang sama ikut dikenali.

`detail-kursus.tsx` menggabungkan daftar: modul → lampiran materi → halaman
(lihat bagian atas berkas untuk struktur berikutnya).

## 8. Verifikasi

- `npx vitest run` untuk unit test baru: `blok.test.ts`, `halaman.test.ts`,
  `validation/blok.test.ts`, `validation/halaman.test.ts`,
  `store-halaman.test.ts`, `migrasi-halaman.test.ts`.
- `npm run check` (typecheck → lint → skills:check → test).
- `npm run build` — **wajib**: inilah yang menangkap pelanggaran batas
  klien/server, dan `npm run check` tidak.
- `npm run smoke`.
- Cek render nyata lewat curl dengan cookie sesi ber-HMAC (pola yang sudah
  dipakai), untuk `/admin/courses/crs-1` dan `/belajar/[slug]`.

## 9. Di luar cakupan (jangan dikerjakan tanpa konfirmasi)

- Progres **per halaman** (`selesai_modul` tetap satuan modul; progress halaman
  menuntut perubahan bentuk cookie `ls_enroll` milik pengguna nyata).
- Drag-and-drop penyusunan ulang blok (pakai ↑/↓ seperti modul).
- Ekspor halaman ke PDF, komentar/diskusi, riwayat revisi halaman, blok kode
  dengan syntax highlighting.

## 10. Risiko yang sudah teridentifikasi

| Risiko | Mitigasi |
|---|---|
| Impor store/node:fs bocor ke bundel klien lewat renderer halaman | Renderer hanya mengimpor modul murni; `npm run build` jadi gerbang wajib. |
| Format JSON blok besar melewati batas body Server Action | Batas sudah dinaikkan ke 8mb (`experimental.serverActions.bodySizeLimit`); validasi tetap membatasi ukuran konten per halaman. |
| Halaman kosong membingungkan peserta | Renderer menampilkan keadaan kosong yang jelas, bukan area kosong. |
| Tautan `#anchor` menunjuk section yang sudah dihapus | Validasi hanya menerima bentuk; tautan mati dibiarkan (tidak ada pemeriksaan lintas blok di gerbang zod) — dicatat sebagai batasan, bukan diklaim tertangani. |

---

## 11. Catatan pelaksanaan (ditulis setelah selesai)

### 11.1 Keputusan yang berubah saat implementasi

**Pager memakai state, bukan query string.** Rencana §7.2 menetapkan pager
berupa `Link` ke `?halaman=<id>`. Itu dibatalkan karena satu tempat memakainya
secara berbeda: **pratinjau di panel admin**. Di sana `Link` akan memuat ulang
halaman admin dan membuang seluruh blok yang belum disimpan. Renderer kini
menerima `onPindahHalaman`: bila diberi, pager menjadi `tombol`, bukan tautan.
Sisi peserta tetap memakai state (`halamanTerpilih`), karena daftar modul berada
di dalam satu halaman dan menaikkan query ke URL akan memuat ulang seluruh
halaman hanya untuk berpindah halaman materi.

**Tebal/miring memakai `<strong>`/`<em>`, bukan kelas CSS.** Versi pertama
memakai `<span class="font-semibold">`. Test render menunjukkannya, dan untuk
materi belajar perbedaannya nyata: pembaca layar mengumumkan `<strong>`/`<em>`
sebagai penekanan, sedangkan kelas CSS hanya mengubah tampilan.

### 11.2 Temuan selama pengerjaan

| Temuan | Dampak |
|---|---|
| `fieldErrors` tidak punya jalur per-tipe untuk blok | JSON blok yang cacat diteruskan apa adanya dari action (seperti `soal` pada kuis) supaya dilaporkan sebagai `fieldErrors.blok`, bukan exception yang menutup action dan menghapus isi form. |
| Tombol "Lepas tautan" tampak mati | Awalnya hanya mengubah state; DOM `contentEditable` menggantikannya kembali lewat `onInput`. Diperbaiki agar melepas tautan pada DOM. |
| `z.enum(UKURAN_BLOK as [string, ...string[]])` menghilangkan literal tipe | Hasil parse jadi `string` dan memaksa pemeran tipe di setiap pemanggil; diganti `z.enum([...])` literal. Sama untuk `level` heading. |
| Cast pada tabel cache store | Dev server yang sudah ter-hidrasi tidak melihat kursus yang ditulis proses lain. Bukan bug kode, tapi jebakan verifikasi — dicatat di AGENTS.md. |

### 11.3 Bukti verifikasi

- `npm run check` → **394 test / 34 berkas** lulus; lint **0 error** (1 warning di
  `.remember/tmp/last-ndc.ts`, artefak tool yang tidak terkait).
- `npm run build` → sukses; tidak ada `node:fs` di bundel klien.
- **Test render (`halaman-view.test.ts`, 21 test)** — HTML benar-benar diperiksa:
  `<strong>`, `<em>`, `<h1>`–`<h3>`, keempat kelas ukuran, jangkar section,
  backlink `href="#…"` vs tautan luar `target="_blank"`, daftar isi, "ditautkan
  dari", pager tautan vs tombol, dan bahwa `<script>` **tidak** menjadi elemen
  (ter-escape sebagai teks).
- **Migrasi lewat jalur disk nyata** (`store-hidrasi.test.ts`) — berkas berisi
  materi `teks` lama dibaca store, dipromosikan jadi halaman, dan materi
  teksnya dibuang. Juga dibuktikan pada `data/courses.json` mesin ini: modul
  "Bukti Persist" kini `teksLama=0 halaman=1` berisi "Materi Bukti".
- **Verifikasi HTTP di server produksi (port 3300)** dengan cookie sesi ber-HMAC:
  15/15 penanda ada di `/belajar/demo-halaman-berformat` — judul halaman, teks
  paragraf/kutipan/daftar, jangkar `menyiapkan-tools` dan `tujuan-belajar`,
  tautan luar `nodejs.org`, "3 halaman", "Buka materi". `/admin/courses/[id]`
  menampilkan "Halaman (3)".

### 11.4 Kursus contoh

`demo-halaman-berformat` (3 halaman) sengaja ditinggalkan di `data/courses.json`
sebagai bahan review manual: satu halaman berisi semua format dan backlink dua
arah, satu halaman berisi tautan masuk, dan satu halaman kosong untuk memeriksa
keadaan kosong. Hapus kursus itu dari `/admin/courses` bila sudah tidak perlu.

