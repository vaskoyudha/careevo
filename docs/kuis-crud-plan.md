# Plan — CRUD Kuis di area verifikator

Status: ✅ SUDAH DIEKSEKUSI
Lanjutan dari: `docs/modul-halaman-plan.md` (halaman berformat & backlink)

## 1. Tujuan

Sebelum ini, kurikulum hanya bisa diisi **modul pembelajaran** (prosa/halaman)
dan **materi** (video/PDF). Kuis bukan entitas tersendiri: ia hanya salah satu
varian `Materi` (`tipe: "kuis"`) yang disunting lewat tab di dalam editor materi.
Akibatnya:

- Satu set soal tidak bisa dipakai di dua modul tanpa menyalinnya, dan tidak ada
  cara mengetahui salinan mana yang sudah diperbaiki.
- Editor soal menempel di dalam formulir materi, sehingga menambah/menghapus
  soal selalu menuntut mengirim ulang seluruh payload materi.
- Tidak ada tempat untuk melihat seluruh asesmen yang ada.

Yang diminta: **CRUD kuis di area verifikator**, tidak hanya modul dan materi.

## 2. Keputusan yang mengikat

Dipilih pengguna lewat pertanyaan pilihan, dengan jawaban **"terapkan opsi 1 dan
2"** — entitas di dalam modul **dan** bank soal terpisah sekaligus. Satu-satunya
bentuk yang koheren dari gabungan keduanya:

> **Bank soal adalah sumber kebenaran; modul merujuknya lewat id.**

| Keputusan | Pilihan | Konsekuensi |
|---|---|---|
| Model data | `Kuis` di `data/kuis.json`, dirujuk `Modul.kuis: string[]` | Satu kuis bisa dipasang di banyak modul/kursus. Perbaikan satu soal berlaku di semua pemakai. |
| Letak UI | Panel **Kuis** per modul + halaman **`/admin/kuis`** | Pemasangan (modul) dan penyuntingan (bank) dipisah, sesuai sifatnya yang berbeda. |

### 2.1 Kenapa bank, bukan salinan di dalam modul

Menanam kuis di dalam modul (pilihan "opsi 1" murni) berarti soal yang sama
disalin ke setiap modul yang memakainya. Itu membuat: (a) perbaikan salah ketik
harus diulang di setiap salinan, (b) tidak ada cara mengetahui salinan mana yang
tertinggal, dan (c) melaporkan "berapa peserta gagal soal ini" hanya mungkin
per salinan.

Opsi 2 murni (bank saja) kehilangan hal yang diminta di opsi 1: kuis tidak
terlihat sebagai bagian dari kurikulum modul. Merujuk id dari modul memberi
keduanya — soal hidup di satu tempat, tapi tetap terpasang dan terurut di dalam
modul.

### 2.2 Kenapa `kuis` dihapus dari `TipeMateri`

Sama persis dengan alasan `teks` dihapus di fitur sebelumnya: dua cara menulis
konten yang sama membuat admin ragu, dan setiap perubahan aturan penilaian harus
dikerjakan dua kali. Materi `kuis` yang sudah tersimpan **dimigrasikan otomatis**
saat dibaca — lihat §4.

## 3. Model data

```
Kuis                                   (bank soal, data/kuis.json)
├─ id: "kuis-…"
├─ judul, deskripsi
├─ soal: SoalKuis[]      → { id, pertanyaan, pilihan[], jawaban_benar }
├─ nilai_lulus: 0–100
└─ created_at, updated_at

Modul
├─ halaman?: Halaman[]   (dimiliki — prosa)
├─ materi?: Materi[]     (dimiliki — video | pdf)
└─ kuis?: string[]       (DIRUJUK — id ke bank, urut sesuai tampilnya)
```

`kuis` adalah satu-satunya koleksi modul yang berisi **rujukan**, bukan objek.
Itu perbedaan yang menentukan seluruh penanganan sisanya.

## 4. Migrasi malas

`promosiKuisLama(course, bank)` di `src/lib/courses/kuis.ts`, dipanggil sekali di
`pastikanTermuat()` — satu lintasan bersama `normalisasiHalamanLama()`.

Empat sifat yang disengaja, masing-masing punya test:

1. **Deterministik & idempoten.** Id kuis diturunkan dari id materi
   (`kuis-<id materi>`), bukan waktu. Terpanggil ulang tidak menggandakan.
2. **Tidak menimpa bank yang sudah ada.** Bila id turunan itu sudah ada, entri
   itu dipakai apa adanya — admin yang sudah menyunting hasil migrasi tidak
   kehilangan perubahannya.
3. **Tidak mengubah apa pun bila tidak perlu.** Kursus tanpa materi `kuis`
   dikembalikan dengan referensi yang sama, jadi tidak memicu penulisan disk.
4. **Referensi ditambahkan di akhir**, supaya tidak menggeser urutan yang sudah
   disusun admin.

Dua kasus tepi yang ditangani eksplisit:

- **Soal rusak dibuang, bukan dipaksakan.** Soal tanpa kunci yang sah atau
  dengan pilihan < 2 tidak bisa dinilai; menampilkannya berarti memberi peserta
  pertanyaan yang mustahil dijawab.
- **Kuis yang seluruh soalnya rusak tidak dipromosikan**, dan materi lamanya
  **sengaja dibiarkan** di `materi[]` supaya tidak hilang tanpa jejak.

## 5. Penanganan rujukan yatim

Ini risiko yang lahir dari keputusan §2, dan ditangani di dua lapis:

- `deleteKuis()` membersihkan rujukan dari **setiap** modul yang memakainya
  dalam operasi yang sama, dan mengembalikan **jumlah modul** yang tersentuh
  (bukan jumlah kursus — satu kursus bisa punya beberapa modul dengan kuis yang
  sama). Pesan ke admin menyebut angka itu.
- `kuisUntukModul()` mengabaikan id yang tidak ada di bank, sebagai jaring
  kedua untuk berkas yang disunting tangan. Mengembalikannya sebagai entri
  kosong akan membuat UI menjanjikan asesmen yang tidak bisa dikerjakan.

`deleteModul()` **tidak** menghapus kuisnya — modul hanya memegang rujukan.

## 6. Isi pekerjaan

| Berkas | Peran |
|---|---|
| `src/types/course.ts` | `Kuis`, `CreateKuisInput`/`UpdateKuisInput`, `Modul.kuis`, `TipeMateri` → `video \| pdf` |
| `src/lib/validation/kuis.ts` | `soalKuisSchema`, `kuisSchema`, `updateKuisSchema` |
| `src/lib/courses/kuis.ts` | Murni/client-safe: `kuisUntukModul`, `promosiKuisLama`, `ringkasKuis`, … |
| `src/lib/courses/storage.ts` | `berkasKuis()`, `muatKuis()`, `simpanKuis()`; rantai tulis dibagi dengan `courses.json` |
| `src/lib/courses/store.ts` | CRUD bank + `pasangKuis`/`lepasKuis`/`geserKuis` + hidrasi & migrasi |
| `src/actions/kuis.ts` | 7 Server Action (3 CRUD + 3 pemasangan + geser) |
| `src/components/features/learning/kuis-view.tsx` | Renderer bersama learner & pratinjau admin |
| `src/components/features/admin/courses/kuis-modul-editor.tsx` | Panel pasang/lepas/urut di tiap modul |
| `src/components/features/admin/courses/editor-soal.tsx` | Editor daftar soal (dipindah dari `materi-editor.tsx` agar dipakai ulang) |
| `src/components/features/admin/kuis/kuis-manager.tsx` | Daftar + CRUD bank |
| `src/app/(verifikator)/admin/kuis/page.tsx` | Halaman bank soal |

## 7. Keputusan teknis yang perlu diketahui

**Bawaan skema tidak boleh ikut `partial()`.** `updateKuisSchema` diturunkan
lewat `.partial()`, dan `partial()` **tidak** menghapus `.default()`. Bila
`nilai_lulus` diberi `.default(70)` di objek bersama, menyunting judul kuis akan
ikut menimpa nilai lulus menjadi 70. Karena itu bidang bersama dipisah dari
`kuisSchema` yang menambahkan bawaan. **Ditemukan oleh test**, bukan oleh review.

**Penilaian di klien.** `kuis-view.tsx` menilai di browser dan tidak menyimpan
apa pun. Menyimpan hasil per peserta berarti mengubah bentuk cookie `ls_enroll`
— keputusan produk tersendiri. Konsekuensinya: kunci jawaban ikut terkirim ke
perender, jadi ini **alat latihan, bukan ujian tahan curang**. Komentar itu ada
di berkasnya supaya batas ini tidak terlupakan bila kuis dipakai untuk
sertifikasi.

**Satu rantai tulis untuk dua berkas.** `storage.ts` memakai satu antrean
serialisasi bersama untuk `courses.json` dan `kuis.json`. Memasang kuis mengubah
keduanya, dan rantai bersama menjamin urutan penulisannya.

## 8. Verifikasi

Yang diperiksa:

| Gerbang | Hasil |
|---|---|
| `npm run check` | **503 test / 40 berkas lulus**, typecheck 0 error, lint 0 error, 5 skill valid |
| `npm run build` | Compiled successfully; `/admin/kuis` terdaftar di manifest route |
| `npm run smoke` | **22/22** rute (bertambah 2: `/admin/courses`, `/admin/kuis`) |
| HTTP `/admin/kuis` (sesi admin) | 200, marka "Bank Soal Kuis", "Tambah kuis", "Cari judul kuis" ada |
| HTTP `/belajar/demo-halaman-berformat` | 200, kuis tampil: judul, pertanyaan, pilihan, "1 kuis" |

Test baru, semuanya lulus:

| Berkas | Isi |
|---|---|
| `src/lib/courses/kuis.test.ts` | 17 test — id yatim gugur, migrasi idempoten, tidak menimpa suntingan admin, soal rusak |
| `src/lib/courses/store-kuis.test.ts` | 24 test — CRUD bank, rujukan yatim dibersihkan, pemasangan idempoten, pengurutan |
| `src/lib/validation/kuis.test.ts` | 18 test — batas skema, kunci di luar rentang, pilihan kembar, perilaku `partial()` |
| `src/actions/kuis.test.ts` | 20 test — gerbang staf untuk **ketujuh** aksi, JSON soal cacat tidak melempar |
| `src/components/features/learning/kuis-view.test.ts` | 13 test — escaping XSS, radio unik per instans, kunci tidak bocor sebelum diperiksa |
| `src/lib/courses/store-hidrasi.test.ts` | 3 test baru — migrasi lewat **jalur disk sebenarnya**, `kuis.json` ditulis terpisah |

### 8.1 Tiga bug asli yang ditemukan test, bukan review

Semuanya di kode yang saya tulis sendiri, dan semuanya ditemukan karena test
memeriksa **perilaku**, bukan sekadar bentuk:

1. **Migrasi menghapus materi yang tidak bisa dipromosikan.** `materiTersisa`
   membuang *semua* materi `kuis` lama, termasuk yang soalnya rusak dan karena
   itu sengaja tidak dipromosikan — materi itu hilang tanpa jejak. Diperbaiki
   dengan melacak id yang benar-benar berpindah.
2. **`deleteKuis()` menghitung kursus, bukan modul.** Pesannya menjanjikan
   "dilepas dari N modul", tapi penghitungnya bertambah sekali per kursus —
   dua modul dalam satu kursus dilaporkan sebagai satu.
3. **`.partial()` mewarisi `.default(70)`.** Menyunting judul kuis akan
   diam-diam menimpa nilai lulus menjadi 70. Diperbaiki dengan memisahkan
   bidang bersama dari skema pembuatan.

Selain itu, satu bug ditemukan saat memeriksa ulang kode sendiri (bukan dari
test): **nama radio memakai id kuis**, sehingga kuis yang sama dipasang di dua
modul — justru kasus utama fitur ini — berbagi grup radio dan saling
membatalkan jawaban. Diperbaiki dengan `useId()`, dan regresinya dikunci test.

## 9. Di luar cakupan (disengaja)

Dicatat supaya tidak dikira terlewat:

- **Hasil kuis per peserta** — butuh perubahan bentuk cookie `ls_enroll`.
- **Bank soal lintas kursus dengan pencarian lanjutan** — pencarian judul sudah
  ada; filter per tag/kursus belum dibutuhkan.
- **Impor/ekspor soal** (CSV/JSON) — belum ada kebutuhan nyata.
- **Pengacakan soal & pilihan, batas waktu, bobot per soal** — mengubah model
  penilaian; sebaiknya dibicarakan dulu sebelum dikerjakan.
- **Riwayat revisi soal** — bank sudah menyelesaikan masalah "salinan mana yang
  benar", tapi belum menyelesaikan "siapa mengubah apa".
