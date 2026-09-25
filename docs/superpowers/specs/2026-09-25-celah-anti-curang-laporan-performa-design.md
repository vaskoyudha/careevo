# Penutup Celah Anti-Curang & Laporan Performa — Design Doc

**Tanggal:** 2026-09-25
**Status:** disetujui untuk implementasi (keputusan produk tercatat di bawah; rincian tugas di plan)
**Prasyarat:** spesifikasi `2026-02-14-anti-curang-course-design.md` tetap berlaku; dokumen ini hanya menambah dua hal di atasnya.

## Ringkasan

Dua pekerjaan berurutan, sesuai arahan:

1. **Bagian A — tutup celah anti-curang yang tersisa.** Chatbot StudyChat tidak
   pernah membaca `aturan_bantuan`, dan sesi yang ditinggal tanpa "Akhiri sesi"
   berlaku selamanya. Keduanya menutup jalan yang sudah dibuka oleh gerbang sesi.
2. **Bagian B — bangun laporan performa + dashboard verifikator.** Progres,
   skor kuis, dan integritas; dapat dibaca lintas-pengguna oleh staf.

A→B berurutan dan bukan kebetulan: performa yang dilaporkan berasal dari data
yang **pertama kali disimpan di server**. Tanpa Bagian B fondasi datanya, dashboard
akan menampilkan angka yang tidak ada.

## Temuan (dikode, bukan asumsi)

### A1. Chatbot tidak digerbangi kebijakan

`kirimStudyChatAction` (`src/actions/learning-chat.ts:168`) memeriksa sesi,
panjang pesan, dan profil — lalu langsung memanggil `generateStudyReply`
(baris 191). Tidak ada satu pun pembaca `aturan_bantuan`.

Bukti: grep `putuskanAkses|kategoriDiblokir|aturan_bantuan` di
`learning-chat.ts` → **nol hasil**.

Padahal `akses.ts:85` sudah punya keputusannya:

```ts
if (jenisKegiatan === "bantuan_akademik" && kebijakan.aturan_bantuan === "tanpa_ai")
  return { tipe: "ditolak", pesan: "…" };
```

Dan `LABEL_ATURAN_BANTUAN.tanpa_ai` = *"Tanpa AI dan tanpa tutor saat asesmen"*
(`kebijakan.ts:14`). Course `tanpa_ai` melarang tutor — tetapi StudyChat adalah
tutor — dan tetap dilayani. **Itu celahnya: aturan yang ditulis admin tidak
dipatuhi oleh satu-satunya kanal bantuan AI di dalam aplikasi.**

Dua hal yang perlu diketahui sebelum memutuskan desainnya:

- `EntriKatalog` (`katalog.ts:11`) **tidak membawa `kebijakan`**. Gerbang harus
  memuat course sendiri lewat `getCourseById` (`store.ts:353`).
- `kategoriDiblokir` (`akses.ts:104`) **tidak punya pemanggil produksi** — hanya
  test. Ia butuh klasifikasi kategori pesan, dan tidak ada pengklasifikasi di
  `StudyChatMessage` (`chat-types.ts:10`, hanya `id/role/content/createdAt/courseId/moduleId`).
  Memakainya berarti menambah klasifier LLM — gerbang lembut yang menimbang
  apakah permintaan "benar-benar" curang.

### A2. Sesi tidak pernah kedaluwarsa, dan berkas run menumpuk

`buktikanSesi` (`session.ts:253`) hanya menuntut `run.status === "aktif"` (baris 268).
`StatusRun` punya varian `"kedaluwarsa"` (`session.ts:39`) yang **tidak pernah
dihasilkan oleh kode mana pun**. `batas_waktu_menit` ada di `CheckpointMateri`
dengan dokumen *"Batas waktu mengerjakan/menyelesaikan, dalam menit"* — tetapi
pembacanya nol.

Konsekuensinya ada dua, dan keduanya bisa dicapai lewat alur normal:

- **Bukti abadi.** Peserta menekan "Mulai sesi", menutup tab tanpa "Akhiri sesi",
  kembali tiga hari kemudian — buktinya masih sah.
- **Run duplikat tanpa batas.** `mulaiSesiAction` (`learning.ts:62`) memanggil
  `mulaiRun` tanpa memeriksa run aktif yang sudah ada. Provider menyimpan
  `status` di state React, jadi **memuat ulang halaman kursus mengembalikan
  `status` ke `idle`** → `CourseSessionPrompt` tampil lagi → klik → run kedua.
  `cariRunAktif` (`session.ts:273`) lalu memilih berdasarkan urutan `readdir`
  yang tidak terdefinisi.

### B. Tidak ada toko performa lintas-pengguna

- **Progres** ada di cookie `ls_enroll`, terikat pemilik; semua pembaca
  meneruskan `session.email`. Grep `semuaPengguna|listUsers|allUsers` → kosong.
- **Skor kuis** `useState` di `kuis-view.tsx:25` — tidak pernah dikirim ke mana
  pun, hilang saat muat ulang. Komentar di `kuis-view.tsx:16-21` menyebutnya
  *keputusan produk tersendiri*. **Permintaan ini adalah keputusan itu.**
- **Integritas** sudah di server (`.data/sessions/*.json`, berisi `owner`), tetapi
  tidak ada pembaca staf — hanya aksi milik peserta sendiri.
- Halaman staf hari ini membaca **fixtures**: `review/page.tsx:6`,
  `review/[id]/page.tsx:9`, `audit/page.tsx:6`, `submission/[id]/page.tsx:8`
  semuanya `from "@/lib/fixtures"`.

---

## Bagian A — Penutup celah anti-curang

### A1. Gerbang chatbot

**Keputusan: gunakan `putuskanAkses({ jenisKegiatan: "bantuan_akademik" })`,
bukan `kategoriDiblokir`.**

Alasan: `kategoriDiblokir` hanya mengembalikan `true` untuk tiga kategori di
bawah `tanpa_ai` — tetapi tanpa pengklasifikasi kita tidak punya kategori sama
sekali. Menambah klasifier LLM berarti menyerahkan keputusan penolakan ke model
yang sama yang sedang dijaga. Gerbang kasar (`tanpa_ai` → tolak semua) lebih
kuat dan bisa dibuktikan dengan test murni.

**Penempatan: sebelum pesan disimpan.** Urutan di `kirimStudyChatAction` harus:

```
getSession → validasi pesan → loadPathContext
   → [GERGAR BARU] muat kebijakan course → putuskanAkses → bila "ditolak", kembalikan
   → appendStudyMessage → generateStudyReply → …
```

`appendStudyMessage` ada di baris 190, **sebelum** `generateStudyReply`. Gerbang
harus lebih awal dari itu, kalau tidak pesan yang dilarang tetap masuk ke cookie
transkrip — bukti permintaan yang ditolak justru tersimpan.

**Sumber kebijakan:** `getCourseById(context.course.id)` lalu
`kursus.kebijakan ?? kebijakanDefault()` (pola persis `kebijakanKursus` di
`learning.ts:51`).

**Ketika `context.course` null** (tidak ada konteks kursus): tidak ada course,
tidak ada kebijakan → layani seperti sekarang. Ini bukan celah —
`loadPathContext` menurunkan course dari profil + pendaftaran, bukan dari input
pengguna, jadi peserta tidak bisa menghapus konteksnya lewat formulir.

**Kontrak state baru:**

```ts
// chat-types.ts — varian kelima dari StudyChatActionState
| { status: "policy_denied"; message: string; snapshot: StudyChatSnapshot }
```

Tiga konsumen harus ikut diperbarui (semua sudah terpetakan):

| Berkas | Perubahan |
|---|---|
| `chat-types.ts` | tambah varian |
| `learning-chat.ts` | kembalikan varian saat `ditolak` |
| `study-chat.tsx:58` | ikutkan di syarat `setMessage("")` — supaya input dikosongkan |
| `study-chat.tsx:78` | ikutkan di syarat `displayedSnapshot` — supaya pesan tampil di transkrip |

Tanpa dua baris terakhir UI diam-diam jatuh ke `initialSnapshot` dan pesan
penolakan tidak pernah terlihat — penyimpangan kontrak jenis persis kelas defect
yang dicatat `careevo-review`.

**Sengaja di luar cakupan:** `setujuiStudyPathAction` (persetujuan usulan jalur
belajar) bukan bantuan akademik atas asesmen, jadi tetap terbuka.

### A2. Kedaluwarsa sesi + satu run aktif

**Model: masa berlaku dicap ke run saat dibuat, lalu dievaluasi di `buktikanSesi`.**

Tambah satu field:

```ts
export interface SessionRun {
  // …yang sudah ada…
  /** ISO — batas masa berlaku; lewat dari ini statusnya jadi `kedaluwarsa`. */
  berlaku_hingga: string;
}
```

**Sumber angkanya: `batas_waktu_menit` yang sudah ada**, diambil sebagai
**maksimum dari seluruh checkpoint course** — bukan field kebijakan baru.

- Ini pembaca pertama untuk field yang sudah didokumentasikan tapi tidak pernah
  dibaca (inti HIGH-1), tanpa menyentuh skema `KebijakanCourse` atau admin editor.
- Karena sesi berlaku untuk **seluruh course** (`mulaiSesiAction(courseId)`)
  sedangkan `batas_waktu_menit` per **modul**, nilai course harus mencakup
  modul mana pun: `max`, bukan `min`. Bila tidak ada modul → `30`
  (`CHECKPOINT_DEFAULT.batas_waktu_menit`).
- Menghitungnya di `mulaiSesiAction` murah: `modulUntukSumber` sudah diimpor di
  `learning.ts:7`.

**Perilaku `buktikanSesi`:**

```ts
if (Date.now() > Date.parse(run.berlaku_hingga)) {
  await tulisRun({ ...run, status: "kedaluwarsa",
                   berakhir_at: now, alasan_akhir: "kedaluwarsa_waktu" });
  return null;
}
```

Menulis statusnya **penting**, bukan kosmetik: `cariRunAktif` melewatkan run non-`aktif`,
jadi run kedaluwarsa membersihkan dirinya sendiri dan tidak lagi memblokir run
berikutnya. Ini juga akhirnya menghasilkan `StatusRun.kedaluwarsa` yang selama
ini mati.

**Batas per percobaan ikut ditegakkan** — terpisah dari masa berlaku sesi:

```ts
// selesaikanMateriAction, setelah `bukti` didapat dan sebelum ada tulisan
const batas = checkpoint.batas_waktu_menit * 60_000;
if (bukti && Date.now() - Date.parse(bukti.mulai_at) > batas) {
  return { ok: false, error: "Sesi ini sudah melewati batas waktu pengerjaan. Mulai sesi baru untuk mencoba kembali." };
}
```

Dua mekanisme melengkapi, bukan mengulang:

| Mekanisme | Menjawab |
|---|---|
| `berlaku_hingga` | Bukti tidak berlaku selamanya (HIGH-1) |
| batas per modul | `batas_waktu_menit` dihormati sesuai makna yang didokumentasikan |

**Batas yang diakui dengan jujur:** batas per modul bisa dilewati dengan memulai
sesi baru. Itu terlihat (run lama ditutup, run baru tercatat, riwayat kejadian
tidak hilang) — bukan pemalsuan tersembunyi, dan konsisten dengan posisi spesifikasi
bahwa kamera/timer *memperkuat* bukti, bukan *menjamin*.

**Satu run aktif** — perbaikan yang diperlukan agar A2 tidak meninggalkan run
yang menumpuk:

```
mulaiSesiAction(courseId):
  cari run aktif (courseId, owner)
  ada  & belum kedaluwarsa → jalankan run itu; bukti baru untuk run lama  (resume)
  ada  & sudah kedaluwarsa → tandai kedaluwarsa, buat run baru           (restart)
  tidak ada                → buat run baru
```

Ini juga memperbaiki kegagalan UX yang nyata: setelah muat ulang halaman, bukti
hilang dari state React sehingga peserta harus mengklik "Mulai sesi" — dan
klik itu sekarang akan **melanjutkan** sesi yang masih berlaku, bukan membuat
duplikat. `buktiBaru` mengikat course+owner+versi kebijakan (`session.ts:109`),
bukan id run, jadi bukti segar untuk run lama valid.

`cariRunAktif` perlu diekspor (atau dijadikan fungsi publik
`cariRunAktifUntuk(courseId, owner)`).

---

## Bagian B — Laporan performa & dashboard verifikator

### Prinsip yang tidak boleh dilanggar

Tiga konsep tetap terpisah — dashboard **tidak boleh** menggabungkannya:

1. **Skor belajar** — hasil kerja peserta.
2. **Status integritas sesi** — apa yang teramati selama sesi.
3. **Reputasi profil** — entitas lain, tidak disentuh pekerjaan ini.

Karena itu:

- **Kejadian integritas mentah TIDAK PERNAH mengurangi skor atau reputasi.**
  Dashboard menampilkannya sebagai *konteks*, diberi label tegas, bukan vonis.
- Tidak ada `dangerouslySetInnerHTML` — angka dan teks, dirender sebagai React.
- Klaim apa pun soal "anti-curang" tetap memuat batas yang sudah disepakati:
  web + kamera tidak menjamin 100% bebas AI/joki/perangkat kedua.

### Sumber metrik (ketiganya diminta)

| Metrik | Sumber | Masalah yang harus diselesaikan |
|---|---|---|
| **Progres modul** | cookie `ls_enroll.selesai_modul` | tidak bisa dibaca staf → perlu cermin server |
| **Skor kuis** | `kuis-view.tsx` (klien) | tidak pernah disimpan → perlu aksi simpan baru |
| **Integritas** | `.data/sessions/*.json` | sudah di server, hanya butuh pembaca |

#### B1. Cermin progres

Tulis di **satu tempat**: `tandaiModul()` (`enrollment.ts:133`) adalah **satu-satunya**
penulis `selesai_modul`. Menaruh cermin di sana membuat cermin ≡ cookie
dengan konstruksi — tidak mungkin berdivergensi lewat salah satu dari dua aksi
penyelesaian.

```ts
export async function tandaiModul(
  courseId: string, modulId: string, owner: string,
  sumber: "terverifikasi" | "informal" = "informal",   // ← baru, opsional
): Promise<Pendaftaran | null>
```

- `selesaikanMateriAction` → `sumber: "terverifikasi"`
- `tandaiModulAction` → `sumber: "informal"` (default)

**Provenance ini yang membuat dashboard bernilai bagi verifikator**: modul yang
ditandai sendiri vs yang lolos gerbang sesi adalah dua hal berbeda, dan perbedaan
itu baru bisa dilihat staf kalau dicatat saat penulisan.

Toggle tetap toggle: saat `selesai_modul` di **hapus**, entri cermin ikut dihapus.

#### B2. Skor kuis

Aksi baru `simpanNilaiKuisAction`, dipanggil `KuisView` setelah `setNilai`.

**Dua hal yang harus berubah dulu di `KuisView`:**

1. Props-nya saat ini hanya `{ kuis, className }` (`kuis-view.tsx:23`) — **tidak
   ada konteks course/modul.** `detail-kursus.tsx` memilikinya dan harus
   meneruskannya.
2. Kunci record **bukan `kuis.id`**: satu kuis bisa dipasang di banyak modul
   (dijelaskan di `kuis-view.tsx:30`). Kunci = `(courseId, modulId, kuisId)`.

**⚠️ Kejujuran yang tidak boleh dikorbankan — skor ini *self-reported*.**

`jawaban_benar` ikut terkirim ke perender (cela yang sudah tercatat), jadi skor
dihitung di klien dan klien bisa memalsukannya. Dashboard **wajib** melabeli
setiap skor kuis dengan status asal:

```
Sumber: dilaporkan klien  ·  belum dinilai server
```

Menampilkan skor ini tanpa label = dashboard mengklaim sesuatu yang tidak benar.
**Penilaian server** (kirim jawaban, `jawaban_benar` hanya di server) adalah
perbaikan yang benar tetapi jauh lebih besar — diusulkan sebagai lanjutan, bukan
bagian dari pass ini. Menjaga label jujur sampai ia mendarat.

#### B3. Pembaca integritas

Baca langsung dari `.data/sessions/*.json` — **jangan disalin** ke toko performa.
Duplikat menciptakan dua sumber kebenaran yang bisa berbeda; `.data/sessions/`
sudah menjadi sumber kebenaran dan sudah menyimpan `owner`.

`indeks()` pustaka performa melakukan dua lintasan: satu untuk catatan per-owner,
satu untuk run sesi per-owner. Keduanya kecil dan halaman staf bukan jalur panas.

### Toko data

Mengikuti pola yang sudah ada (store resume), **bukan cookie**:

```
.env / opsional
  CAREEVO_PERFORMA_DIR   → default: <cwd>/.data/performa

.data/performa/<sha256(email)>.json
```

Mengapa `.data/` dan bukan cookie atau `data/courses.json`:

- **Bukan cookie** — cookie milik peserta tidak bisa dibaca staf; itu justru
  masalah yang mau diselesaikan. Juga tidak terbatas ~4KB.
- **Bukan `data/courses.json`** — itu toko konten milik kurikulum. Menaruh data
  peserta di sana mencampur dua domain yang sengaja dipisah AGENTS.md.
- **`.data/`** sudah jadi rumah data peserta yang tidak terbatas ukuran
  (`store.ts` resume). Ikuti.

File per-owner (bukan satu berkas agregat) seperti store resume: tidak terbatas
ukuran, dan kegagulan tulis satu peserta tidak menyentuh yang lain. `indeks()`
membaca direktori untuk daftar staf.

Nama berkas = `sha256(email)` (pola yang sudah ada) supaya email tidak menentukan
struktur direktori. Karena hash tidak bisa dibalik, **record menyimpan `owner`
dan `nama` di dalamnya** agar dashboard punya tampilan.

```ts
interface RecordPerforma {
  owner: string;          // email — sumber identitas di dashboard
  nama: string;
  versi_skema: 1;
  kursus: Array<{
    course_id: string;
    judul: string;
    selesai: Array<{
      modul_id: string;
      at: string;
      sumber: "terverifikasi" | "informal";
    }>;
    kuis: Array<{
      kuis_id: string; modul_id: string;
      nilai: number;      // 0–100
      total_soal: number;
      at: string;
      sumber: "klien";    // selalu "klien" di pass ini — lihat label B2
    }>;
  }>;
}
```

`versi_skema` sejak hari pertama: field baru besok tidak boleh membuat record
lama terbaca sebagai record yang memenuhi syarat padahal tidak.

### Dashboard

Rute baru di `(verifikator)` — layoutnya **sudah** memeriksa `isStaffRole`
(`(verifikator)/layout.tsx:14`), jadi gerbangnya gratis dan konsisten.

```
src/app/(verifikator)/performa/page.tsx          → daftar peserta
src/app/(verifikator)/performa/[owner]/page.tsx  → detail satu peserta
```

**Daftar** — satu baris per peserta:

| Kolom | Nilai |
|---|---|
| Nama / email | dari record |
| Modul selesai | jumlah, dipecah `terverifikasi` vs `informal` |
| Rata-rata kuis | **dilabeli** "dilaporkan klien" |
| Sesi | jumlah run, `diakhiri` vs `kedaluwarsa` |
| Kejadian integritas | `kejadian` / `celah` — **tanpa bobot skor** |

**Detail** — per course: progres per modul dengan provenance, riwayat percobaan
kuis, riwayat sesi dengan kejadiannya.

**Navigasi:** `dashboard-sidebar.tsx` — tambah `{ href: "/performa", title:
"Laporan Performa", icon: … }` ke `STAFF_GROUPS` (baris 49-57, berdekatan
`Kelola Kursus`).

**Label wajib di kedua halaman** — ini bagian dari fitur, bukan catatan kaki:

> Skor kuis dilaporkan oleh klien dan belum dinilai server. Kejadian integritas
> adalah konteks, bukan dasar penilaian — tidak mengurangi skor atau reputasi
> siapa pun. Web dan kamera tidak menjamin bebas bantuan AI, joki, atau perangkat
> kedua.

### Privasi & retensi

- **Cakupan akses:** hanya `isStaffRole`. Tidak ada rute publik; khususnya
  `p/[username]` tidak boleh menampilkan data ini.
- **Isi:** email + nama + data belajar. Setara tingkat kerahasiaan yang sudah ada
  di `.data/resume`.
- **Retensi:** tanpa batas di pass ini (keputusan produk #3) — belum diatur,
  jangan diaku sudah.
- **Audit akses staf:** `logAudit` masih stub yang melempar
  ("belum diimplementasikan"), jadi **membaca performa belum ter-audit**. Dicatat
  sebagai keterbatasan yang diketahui, bukan diaku sudah beres.

---

## Urutan eksekusi

| # | Fase | Hasil | Tergantung |
|---|---|---|---|
| **A1** | Gerbang chatbot | `putuskanAkses("bantuan_akademik")` di `kirimStudyChatAction`, varian `policy_denied` | — |
| **A2** | Kedaluwarsa sesi | `berlaku_hingga`, penulisan status `kedaluwarsa`, batas per modul, satu run aktif | — |
| **B1** | Cermin progres | `tandaiModul(..., sumber)` → toko performa | B0 |
| **B2** | Skor kuis | aksi simpan + props konteks di `KuisView` | B0 |
| **B3** | Pembaca integritas | `indeks()` gabungan | B0 |
| **B0** | Toko performa | `src/lib/performa/store.ts` + skema | — |
| **B4** | Dashboard | daftar + detail + sidebar | B1–B3 |

A1 dan A2 tidak saling bergantung dan tidak menyentuh berkas yang sama — boleh
dikerjakan paralel. B0 harus selesai sebelum B1–B3.

**Gerbang pengujian:** repo tidak punya harness render (Vitest `include` =
`src/**/*.test.ts`, node, tanpa jsdom), jadi invarian UI diproteksi dengan
**static source check** di `security.test.ts` — pola yang sudah dipakai dan
sudah terbukti (dihancurkan → merah → dipulihkan → hijau).

## Non-tujuan

- **Kamera** — tidak disentuh. Design intent belum aktif, copy tetap begitu.
- **Penilaian server untuk kuis** — diusulkan terpisah; pass ini hanya melabeli
  skor klien dengan jujur.
- **Dasbor performa milik peserta** — `/dashboard` hari ini membaca fixtures.
  Keputusan: **di luar cakupan pass ini** (lihat keputusan produk #1); peserta
  melihat progresnya di `/belajar`.
- **Middleware route guard** — tidak ada `middleware.ts` di repo ini; gerbang
  tetap di layout.
- **Retensi/penghapusan data** — tidak dibuat di pass ini.
- **Mengaudit akses staf** — butuh `logAudit` yang berfungsi lebih dulu.

## Kriteria keberhasilan

**A1**
1. Course `aturan_bantuan: "tanpa_ai"` → `kirimStudyChatAction` mengembalikan
   `policy_denied`, `generateStudyReply` **tidak dipanggil**, pesan **tidak**
   masuk cookie transkrip.
2. Course `bertutor`/`bebas` → perilaku tidak berubah.
3. Tanpa konteks course → dilayani.
4. `study-chat.tsx` menampilkan pesan penolakan (static check: ketiga kondisi
   `status` ikut diperbarui).

**A2**
1. Run melewati `berlaku_hingga` → `buktikanSesi` null **dan** file berstatus
   `kedaluwarsa` (bukan cuma ditolak).
2. Lewat batas `checkpoint.batas_waktu_menit` sejak `mulai_at` → completion
   ditolak, **sebelum** ada tulisan apa pun.
3. Klik "Mulai sesi" dua kali → **satu** run aktif, id sama.
4. Muat ulang halaman lalu klik "Mulai sesi" → run lama dilanjutkan, bukan duplikat.

**B**
1. Selesaikan modul → record muncul di toko performa dengan `sumber` yang benar.
2. Submit kuis → record skor tersimpan dengan kunci `(courseId, modulId, kuisId)`.
3. `/performa` hanya bisa dibuka `isStaffRole`; peserta biasa dialihkan.
4. Label "dilaporkan klien" dan disclaimer integritas tampil di kedua halaman.
5. `p/[username]` tidak menampilkan data performa apa pun.

**Umum:** `npm run check` lulus, `npm run build` lulus.

## Keputusan produk (sudah disetujui 2026-09-25)

| # | Pertanyaan | Keputusan | Alasan |
|---|---|---|---|
| 1 | Apakah `/dashboard` peserta ikut dialihkan ke data nyata? | **Tidak — staf saja.** | Permintaan menyebut "dashboard untuk melihat performa dari users" (= staf). Peserta tetap melihat progresnya di `/belajar`. Menambah pembaca toko baru di luar cakupan. |
| 2 | Skor kuis: klien (berlabel) atau server? | **Opsi A dulu — klien, berlabel jujur. Opsi B (penilaian server) menyusul.** | Opsi A 1× biaya, data mengalir sekarang. Field `sumber: "klien" \| "server"` di record membuat opsi B bisa mendarat **tanpa melabeli ulang data lama** — tidak ada momen di mana angka historis tiba-tiba mengklaim "dinilai server". |
| 3 | Retensi data performa | **Tanpa batas di pass ini**, dicatat sebagai keputusan terbuka. | Setara `.data/resume`. Belum ditetapkan, jangan diaku sudah. |

### Kenapa opsi A dulu — bukan karena lebih mudah

Opsi B (penilaian server) memang lebih benar, tetapi ia **menunda seluruh Bagian
B**: serializer payload kuis, alur async `kuis-view`, fungsi nilai murni yang
bisa ditest (harness repo tidak punya render test), dan perubahan arti `Ulangi()`.
Itu 3–4× biaya sebelum dashboard punya angka untuk ditampilkan.

Dan opsi B **tidak** menutup risiko yang paling sulit: peserta tetap bisa membuka
tab/device lain dan mencari jawaban. Server grading menghapus *"memalsukan skor"*,
bukan *"melihat jawaban"* — untuk itu perlu acak urutan soal + bank per sesi,
yang dimiliki kuis tetap tidak punya. Nilai marginalnya nyata tetapi terbatas,
konsisten dengan posisi spesifikasi bahwa kontrol *memperkuat* bukti, bukan
*menjamin*.

Urutan A→B karena keduanya menulis ke **record yang sama** dengan field `sumber`
yang berbeda. Tidak ada migrasi, tidak ada rekonsiliasi.
