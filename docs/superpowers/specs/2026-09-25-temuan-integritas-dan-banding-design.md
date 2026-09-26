# Temuan Integritas & Banding - Design Doc

**Tanggal:** 2026-09-25
**Status:** disetujui untuk implementasi
**Prasyarat:** `2026-09-25-celah-anti-curang-laporan-performa-design.md` (laporan
pembelajaran dan laporan integritas yang sudah dipisah) dan
`2026-02-14-anti-curang-course-design.md` (gerbang sesi).

## Ringkasan

Sistem sudah **mengumpulkan** catatan integritas dan menampilkannya ke staf. Tapi tidak
ada satu pun langkah setelahnya. Tidak ada yang bisa **mengAjukan temuan**. Tidak ada
yang bisa **membantah**. Dan tidak ada keputusan manusia yang tercatat di mana pun.

Dokumen ini menambah **satu rantai keputusan**:

1. Staf mengajukan temuan, dan wajib menyebut bukti yang spesifik.
2. Peserta melihat temuan itu dengan bukti yang sama persis, lalu bisa membantah.
3. Staf **lain** yang memutus — bukan orang yang mengajukan.
4. Hanya temuan yang dikokohkan yang **menahan** progres modul terkait.
5. Penahan itu bisa dipenuhi dengan mengerjakan ulang di sesi terverifikasi.

Hasil akhirnya: kata "curang" punya akibat, dan setiap akibat bisa dibantah secara
tercatat.

## Temuan (dikode, bukan asumsi)

### T1. Tidak ada mekanisme tuduhan

Tidak ada field, aksi, atau rute untuk mencatat bahwa seorang staf curiga terhadap
sesi tertentu. Laporan integritas menampilkan "Keluar tab 6x" dan tidak ada kewajiban
apa pun untukcwitness itu sebagai sesuatu.

Yang lebih halus: pemisahan laporan yang baru saja kita tegakkan membuat sistem
**tidak bisa** menuduh. Itu bagus. Tapi penilaiannya tetap terjadi di kepala manusia,
dan itu di luar sistem. Kalau kesimpulan itu lalu terpakai di tempat lain tanpa
tercatat, maka `/review` dan nilai lain bisa terpengaruh tanpa jejak.

### T2. Tidak ada keputusan manusia yang tercatat di mana pun

```
src/actions/review.ts      -> return { ok, message }  ... tidak menyimpan apa pun
src/lib/audit/logger.ts:15 -> throw new Error("logAudit belum diimplementasikan")
```

`decideReview` mengembalikan pesan yang berisi "Alasan tercatat di audit log" -
padahal `logAudit` melempar error. Jadi tidak ada nomor kasus. Tidak ada siapa. Tidak
ada kapan. Tidak ada bukti apa yang dilihat.

Konsekuensi langsung untuk permintaan ini: **banding terhadap sesuatu yang tidak ada
tidak mungkin dibangun.** Karena itu urutannya dibalik, bukan dimulai dari banding.

### T3. Produk sudah menjanjikan banding yang tidak ada

Ini bukan fitur yang belum dibuat. Ini janji publik yang tidak bisa ditepati.

```
src/components/features/marketing/faq.tsx:27
  "...kamu bisa mengajukan keberatan lewat pengaturan."
src/components/features/settings/settings-form.tsx:70
  "...kamu bisa mengajukan keberatan lewat halaman pengaturan ini."
```

Halaman FAQ bisa dilihat siapa saja tanpa masuk. Dua-duanya hanya copy; kode
keberatannya nol.

Dokumen ini **membuat kedua janji itu benar**, dengan menambahkan tautan nyata di
`/pengaturan` menuju `/banding`. Copy tidak diubah, karena yang salah adalah
produknya, bukan kalimatnya.

### T4. Jalur informal adalah bypass yang harus ditutup

`tandaiModul` (`src/lib/courses/enrollment.ts:146`) adalah **satu-satunya** penulis
`selesai_modul`, dan punya **dua** pemanggil:

```
src/actions/learning.ts:280     selesaikanMateriAction -> tandaiModul(..., "terverifikasi", nama)
src/actions/enrollment.ts:234   tandaiModulAction      -> tandaiModul(target.id, modulId, email)
```

Jalur kedua adalah jalur informal, dan ia **tidak** punya `runId`. Kalau pemeriksaan
penahan hanya dipasang di jalur terverifikasi, peserta cukup menandai modul lewat jalur
informal untuk lolos. Jadi pemeriksaan harus **di dalam `tandaiModul`**, yang
mendasari kedua jalur.

Satu hal yang perlu diketahui: `tandaiModul` memakai `lib/courses/enrollment` yang
sudah mengimpor `node:crypto`, jadi sudah server-only. Menambahkan import `node:fs`
(toko temuan) ke sana **aman**, dan tidak melanggar batas client yang dijaga
`kurikulum.ts`.

### T5. "Sesi terawasi" tidak bisa dijanjikan

Keputusan produk: menahan progres modul berarti peserta wajib mengulang di sesi
terawasi. Tapi kamera **belum diimplementasikan**. `CourseSessionGate` dan
`CourseSessionPrompt` keduanya masih menulis "Permintaan akses kamera belum aktif".
Dan `jawaban_benar` masih terkirim ke peramban.

Maka yang bisa dijamin hanya **sesi terverifikasi server**: run yang dibuat lewat
`mulaiSesiAction`, punya `buktiSesi` bertanda HMAC, dan tercatat di `.data/sessions/`.

Kata "terawasi" tidak boleh dipakai di copy, karena mengisyaratkan sesuatu yang tidak
ada. Dokumen ini memakai istilah **sesi terverifikasi** di seluruh UI.

## Prinsip yang tidak boleh dilanggar

### P1 - Beban pembuktian ada di pihak pendakwa

Temuan **tidak pernah** upheld sendiri. Tidak ada ambang batas otomatis. Tidak ada
kokoh otomatis karena diam. Tidak ada skor. Tidak ada reputasi. Kalau tak seorang staf
memutus, temuan itu tidak menahan apa pun.

Sebabnya: kejadian integritas **dilaporkan klien**. `catatKejadianAction` menerima
`jenis` dari peramban. Peserta yang berinisiatif bisa memilih tidak mengirimnya.

Artinya **sesi yang bersih bukan bukti bahwa tidak curang**. Konsekuensinya, sistem
tidak boleh menarik kesimpulan apa pun sendiri. Termasuk "tidak ada kejadian berarti
tidak curang".

### P2 - Tiga invarian

1. **`dikokohkan` butuh pemutus yang berbeda dari pengajas.** Tanpa staf kedua, kasus
   menggantung selamanya. Ini yang mencegah satu orang menuduh lalu memutus sendiri.
2. **Status `diajukan` dan `dibantah` tidak pernah menahan apa pun.** Menahan karena
   staf belum sempat berarti memindahkan kesalahan ke peserta.
3. **Riwayat hanya ditambah, tidak pernah disunting.** Status adalah entri terakhir.
   Entri lama tetap ada, jadi proses yang dikritik bisa dibuktikan dari strukturnya.

### P3 - Bukti harus bisa dirujuk, bukan sekadar diklaim

Staf tidak boleh menulis "orang ini curang". Dia wajib memilih kejadian tertentu dari
sesi tertentu, lalu menuliskan dasarnya dalam bahasa sendiri, minimal 40 karakter.

Simetri: **peserta melihat rujukan yang persis sama**. Id sesi, indeks kejadian,
waktu, jenis, dan lini masa mentah. Kalau kedua pihak melihat data berbeda, prosesnya
rusak sejak awal.

### P4 - Bukti foto adalah klaim, bukan bukti

Sistem tidak bisa memverifikasi gambar. Gambar bisa diedit, tidak ada metadata yang
bisa dipercaya, dan sumbernya bisa dari mana saja.

Jadi lampiran **tidak pernah** memberi bobot otomatis ke pihak mana pun. Kalimat ini
**wajib tertulis** di halaman lampiran.

### P5 - Tidak ada reputasi, tidak pernah

Reputasi tidak bisa dibantah, jadi tidak bisa adil. Kalau temuan lama ikut terbawa ke
kasus baru, itu reputasi yang masuk lewat pintu samping, dan setiap temuan bisa
melemahkan semua temuan lain.

**Setiap kasus berdiri sendiri.** Halaman antrean tidak boleh menampilkan riwayat
temuan peserta.

### P6 - Asimetri disengaja

Bukti staf harus **terstruktur dan bisa dirujuk**: run, indeks kejadian, dan dasar
tertulis. Bukti peserta boleh **bebas**: teks dan foto.

Ini bukan ketidakadilan. Yang dituduh punya waktu dan akses ke sumbernya, sementara
tuduh memutarbalik catatan peserta sendiri.

## State machine

```
                     staf A: wajib cite bukti + dasar
        +--------------------------------------------+
        |                                            v
      draf -------------------------------------> diajukan
                                                    |  ^
                      staf B != A: tolak            |  | peserta: banding + bukti
                                                    v  |
                                                  ditolak
                                                    |  |
                    staf B atau C != A: kokohkan    |  | staf != A: kokohkan
                                                    v  v
                                               dikokohkan --(modul diulang di
                                                    |        sesi terverifikasi)--> teratasi
                                                    v
                                        penahan: selesai_modul ditarik
```

Tindakan yang tersedia:

| Aksi | Pelaku | Syarat |
|---|---|---|
| `diajukan` | staf | bukti tidak kosong, `dasar` minimal 40 karakter |
| `dibantah` | peserta pemilik | maximal sekali per temuan |
| `dikokohkan` | staf | pemutus beda dari pengajas, status `diajukan` atau `dibantah` |
| `ditolak` | staf | pemutus beda dari pengajas, status `diajukan` atau `dibantah` |
| `teratasi` | otomatis | modul diulang di sesi terverifikasi yang bukan run yang dicurigai |

`dikokohkan` dan `ditolak` saling menutup jalan satu sama lain: `bolehMemutus`
memeriksa pemutus beda dari pengajas sekaligus status saat ini, jadi tidak ada aksi
yang bisa memakai jalur yang sudah tertutup.

## Model data

Baru, di `src/lib/temuan/`:

```ts
export type StatusTemuan =
  | "diajukan" | "dibantah" | "dikokohkan" | "ditolak" | "teratasi";

export interface BuktiRujukan {
  /** Indeks kejadian dalam run.kejadian, mulai dari 0. */
  indeks: number;
  at: string;
  jenis: KJenisKejadian;
  jenis_klasifikasi: "kejadian" | "celah";
}

export interface Lampiran {
  nama: string;
  mime: "image/png" | "image/jpeg" | "image/webp";
  byte: number;
  sha256: string;
  /** Nama berkas di dalam direktori bukti. Tidak pernah dipakai membentuk path. */
  berkas: string;
}

export interface RiwayatTemuan {
  at: string;
  oleh: string;
  aksi: StatusTemuan;
  catatan: string;
}

export interface Temuan {
  id: string;
  owner: string;
  nama: string;
  course_id: string;
  modul_id: string;
  /** Run yang menjadi dasar temuan. */
  run_id: string;
  bukti: BuktiRujukan[];
  /** Dasar pemeriksaan staf, minimal 40 karakter. */
  dasar: string;
  status: StatusTemuan;
  /** Pengajas. Diambil dari sejarah[0].oleh, jadi tidak bisa diubah diam-diam. */
  pengajas: string;
  Putting_at: string | null;
  banding: { alasan: string; lampiran: Lampiran[]; pada: string } | null;
  /** Run terverifikasi yang menepaskan penahan. */
  pemenuhan: { run_id: string; pada: string } | null;
  sejarah: RiwayatTemuan[];
  versi_skema: 1;
}
```

Field yang **tidak** ada, dan alasannya: `skor`, `level_bahaya`, `reputasi`, `label`,
dan `penyebab`. Semuanya vonis, dan vonis milik manusia lewat `dasar` plus
`dikokohkan`, bukan milik aritmetika.

`bukti` disalin **dari** `run.kejadian` saat pengajuan, bukan direferensikan. Kalau
hanya direferensikan, kejadian yang ditambahkan kemudian pada run yang sama bisa mengubah
bukti setelah fakta. `catatKejadian` memang sudah menolak itu untuk sesi tertutup, tapi
temuan harus bertahan walau run-nya nanti ditulis ulang. Salinan membekukan apa yang
benar-benar dilihat staf saat mengajukan.

## Logika murni (`src/lib/temuan/aturan.ts`)

Dipisah dari `store.ts` supaya aturan penahan bisa diuji tanpa `node:fs`, dan supaya
titik penahan tidak pernah menjadi tempat logika bisnis bersembunyi.

| Fungsi | Tanggung jawab |
|---|---|
| `bolehMenaikkan({bukti, dasar})` | bukti tidak kosong, indeks unik dan urut, `dasar` minimal 40 karakter |
| `bolehMemutus(temuan, aktorId)` | status boleh diputus **dan** `aktorId` beda dari `pengajas` |
| `temuanYangMemblokir(temuan, courseId, modulId)` | `dikokohkan` tanpa `pemenuhan`, cocok course dan modul |
| `blokirModul(temuan, courseId, modulId)` | bentuk ringkas untuk pemanggil yang sudah punya daftar |
| `bolehLepasPenahan(temuan, buktiUlang)` | penahan bisa dilepas hanya oleh `terverifikasi`, run milik peserta yang cocok, dan **run berbeda dari yang dicurigai** |
| `ringkasTemuan(temuan)` | hitungan per status untuk antrean |

`pengajas` dibaca dari `sejarah[0].oleh`. Entri pertama, hanya ditambah, jadi tidak
bisa diubah tanpa meninggalkan jejak.

## Titik penahan: satu titik, di `tandaiModul`

`src/lib/courses/enrollment.ts:146`. Satu-satunya penulis `selesai_modul`, jadi satu
pemeriksaan di sini menutup kedua jalur sekaligus (T4), **dan** menutup cermin
performa, karena cermin ditulis dari fungsi yang sama.

```ts
export async function tandaiModul(
  courseId, modulId, email, sumber?, nama?, runId?,
)
```

`runId` tambahan bersifat opsional dan **tidak pernah** datang dari klien. Jalur
terverifikasi menyalurkannya dari `bukti?.id` yang sudah diverifikasi HMAC
(`learning.ts:289`). Jalur informal tidak mengirimkannya sama sekali, dan itu memang
persis yang membuatnya tidak bisa lifted penahan.

Perilaku, dievaluasi **sebelum** penulisan apa pun:

```
baca status modul saat ini dalam pendaftaran
baca temuan yang menahan untuk (email, courseId, modulId)

kalau tidak ada penahan          -> lanjut seperti sekarang
kalau ada penahan DAN sedang batal -> izinkan (menarik nilai, bukan memperolehnya)
kalau ada penahan DAN akan menandai selesai:
    sumber != "terverifikasi"    -> tolak
    runId kosong                  -> tolak
    runId == temuan.run_id        -> tolak
    run tidak ada atau owner beda -> tolak
    run.course_id != courseId     -> tolak
    selain itu                    -> tulis pemenuhan dulu, baru lanjut
```

**Arah `batal` dikecualikan secara sengaja.** Menarik nilai adalah penurunan, bukan
pemperolehannya. Menolaknya akan mengunci kesalahan penandaan yang hanya bisa diperbaiki
peserta sendiri.

Mengecualikannya juga tidak membuka bypass. Untuk mendapat kembali status "selesai",
peserta harus melewati seluruh syarat penahan di atas.

**Urutan `pemenuhan` sebelum penyelesaian** dipilih karena gagal-aman. Kalau penulisan
`pemenuhan` berhasil lalu penulisan penyelesaian gagal, keadaan tersisa "temuan
terpenuhi, modul belum selesai". Keadaan itu **tidak berbahaya**, karena peserta tinggal menyelesaikan
modulnya secara normal.

Urutan sebaliknya menghasilkan "modul selesai tapi masih tertahan", dan peserta tidak
punya jalan keluar.

## Penarikan nilai saat dikokohkan

Saat `dikokohkan`, entri `selesai_modul` untuk modul itu **ditarik**: cookie dan cermin
performa, dalam satu operasi, lewat arah `batal` pada `tandaiModul`.

Kalau tidak ditarik, modul terbaca selesai di Enrollment dan di cermin, sementara
laporan integritas menyatakan perlu diulang. Dua sumber kebenaran untuk satu fakta.

Yang ditarik adalah **status penyelesaian modul**, bukan nilai kuis. Nilai kuis yang
sudah tercatat tidak dihapus. Kalau perlu dihitung ulang, itu nilai baru.

## Bukti foto

Endpoint baru `POST /api/unggah-banding`. **Terpisah** dari `/api/unggah` yang milik
store resume, karena retensi dan aturan aksesnya berbeda.

- MIME di-allow-list `image/png|jpeg|webp`. Ekstensi diturunkan dari MIME yang lolos,
  bukan dari nama berkas yang dikirim. Pola yang sama dengan `EKSTENSI_PER_MIME`.
- **Magic byte** diperiksa, seperti yang dilakukan untuk `%PDF-`: PNG `\x89PNG`,
  JPEG `\xff\xd8\xff`, WebP `RIFF....WEBP`.
- Batas **4MB** per berkas, maksimal **3** lampiran per banding.
- Disimpan di `.data/temuan/<sha256(owner)>/bukti/`, dengan nama berkas dari hash acak
  ditambah ekstensi. Bukan nama yang dikirim, jadi nama tidak pernah menjadi path.
- `CAREEVO_TEMUAN_DIR` untuk isolasi test, dipasang di `vitest.config.mts`.

### Retensi

Lampiran adalah **kiriman peserta sendiri** untuk membela dirinya. Risikonya jauh lebih
kecil daripada rekaman kamera. Masalah sebenarnya adalah satu: **apakah kasusnya masih
bisa dibantah**.

| Keadaan | Berkas foto | Yang tetap disimpan |
|---|---|---|
| Belum ada putusan | selamanya | berkas utuh |
| Sudah putusan final, kurang dari 30 hari | utuh | berkas utuh |
| Sudah putusan final, lebih dari 30 hari | dihapus | `nama`, `byte`, `sha256`, waktu, dan fakta bahwa lampiran pernah ada |

Penghapusan berjalan **best-effort** saat daftar dibaca. Kalau `unlink` gagal, berkas
tetap dan pembacaan **tidak boleh** gagal. Pembersihan ini tidak andal, dan
sengaja tidak diklaim andal.

Yang membuat aturan ini masuk akal adalah P1. Karena tidak ada kokoh otomatis, kasus
yang tidak pernah diputuskan **tidak pernah final**. Jadi tidak pernah ada tenggat yang
bisa menghabisi hak peserta menjawab. Berkas hanya dihapus setelah kasus benar-benar
tidak bisa berubah lagi.

Store `SessionRun` sendiri masih **tanpa kebijakan retensi**. Itu gap yang sudah
diketahui, dan dokumen ini sengaja tidak mengarang kebijakan untuk store itu.

## Permukaan

| Rute | Isi |
|---|---|
| `/performa/temuan` | antrean kerja semua temuan lintas peserta, difilter per status |
| `/performa/temuan/[id]` | berkas kasus: bukti, riwayat, form pengajuan, banding, putusan |
| `/performa/integritas/[owner]` | tombol "Ajukan temuan" per sesi, dengan centang kejadian |
| `/banding` | daftar temuan terhadap peserta |
| `/banding/[id]` | temuan, bukti yang sama persis, lini masa mentah, form tanggap, hasil |
| `/pengaturan` | tautan ke `/banding`, yang **membuat janji `faq.tsx:27` benar** |

Tanpa `/performa/temuan`, temuan tidak bisa ditemukan, dan seluruh fitur jadi tidak
 terjangkau.

Dua keterbatasan wajib tertulis di kedua sisi: **tidak ada tenggat** untuk membantah,
dan **tidak ada kokoh otomatis**. Keduanya akan memindahkan kesalahan ke peserta.

## Ketiadaan yang disengaja

- Tidak ada pengurangan skor, penghapusan nilai kuis, atau pengurangan poin
- Tidak ada field reputasi, di mana pun, selamanya
- Tidak ada penandaan otomatis dari ambang batas
- Tidak ada tenggat yang menghabisi hak peserta menjawab
- Tidak ada tampilan riwayat temuan peserta di halaman temuan lain
- Tidak ada klaim "terawasi", hanya "sesi terverifikasi"
- Tidak ada tanda tangan elektronik atau proses hukum

## Batas yang harus tertulis di UI

Kalau tidak ditulis, sistemnya berbohong. Kelima ini masuk sebagai teks di `/banding`
dan `/performa/temuan/[id]`, bukan sebagai komentar kode:

1. Kejadian integritas dilaporkan oleh peramban peserta, jadi bisa dihentikan sepihak.
   **Sesi bersih tidak membuktikan apa pun.**
2. Lampiran foto adalah klaim. Sistem tidak bisa memverifikasinya.
3. Catatan sesi bisa tidak lengkap.
4. Kamera belum diimplementasikan, jadi tidak ada rekaman yang bisa ditinjau.
5. Nilai kuis dilaporkan klien dan belum dinilai server.

## Kriteria keberhasilan

- `npm run check` dan `npm run build` hijau
- Mutasi yang harus merah: menghapus pemutus-beda-dari-pengajas; membuat `diajukan`
  menahan; menghapus `runId == temuan.run_id`; menghapus pemeriksaan `sumber`;
  membaca `bukti` dari `run.kejadian` setelah `catatKejadian` menolak sesi tertutup
- Unggahan ditolak saat MIME dipalsukan, dan ditolak saat melebihi 4MB
- Alur langsung: ajukan, banding, kokohkan, modul tertahan, ulang di sesi terverifikasi,
  `teratasi`, modul selesai
- Bypass tertutup: `tandaiModulAction` yang informal tidak bisa melewati penahan
- Banding maximal sekali, dan `dikokohkan` serta `ditolak` tidak bisa dipakai ulang
- Peserta hanya bisa membaca dan membantah temuannya sendiri
