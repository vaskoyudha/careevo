# Editor Kode C++ — Design Doc

**Tanggal:** 2026-09-27
**Status:** disetujui untuk implementasi (MVP siap-demo; rincian teknis ada di plan)

**Prasyarat:** `docs/modul-halaman-plan.md` (halaman berformat dan editor blok)
serta `docs/adr/0001-topologi-deployment-produksi.md` (topologi M0) tetap berlaku.
Dokumen ini menambah satu tipe blok dan satu proses terpisah. Ia tidak
mengubah prinsip kurikulum, model penyimpanan, maupun topologi.

## Ringkasan

Careevo punya halaman berformat dengan lima tipe blok
(`src/types/course.ts:54`), dan tidak punya blok kode. Spec ini menambah tipe
keenam, `kode`, beserta satu editor (CodeMirror 6) dan satu **runner C++
terpisah** yang mengompilasi lalu menjalankan kode di dalam kontainer terisolasi.

MVP ini **siap-demo di mesin lokal**, bukan siap-produksi. Alasannya ada di
`docs/adr/0001` §1.0: selama M0, Vercel memiliki seluruh permukaan Next.js,
sedangkan API VPS tidak diaktifkan dan tidak dapat dijangkau browser. Tidak
ada subdomain dan tidak ada reverse proxy. Runner yang berjalan di mesin
terpisah karena itu tidak punya rumah di produksi M0. Ia perlu amandemen ADR
0001 lebih dulu: opsi A same-host proxy, atau opsi B subdomain.

Ini bukan hambatan baru. `data/courses.json` dan `.data/` juga tidak bisa
dilayani dari Vercel (§1.1 butir 2), jadi fitur ini konsisten dengan keadaan
repo sekarang.

Bukti bahwa isolasi benar-benar bekerja sudah diukur, bukan diasumsikan. Lihat
bagian "Bukti terukur".

## Temuan (dikode, bukan asumsi)

### T1. Model konten punya titik ekstensi yang memaksa

`TipeBlok` (`src/types/course.ts:54`) adalah union lima nilai, dan `blokSchema`
(`src/lib/validation/blok.ts:84`) adalah `z.discriminatedUnion`. Menambah
`"kode"` berarti menambah satu varian.

Dua sifat yang menguntungkan. Pertama, `z.object` membuang kunci yang tidak
dikenal, sehingga payload kiriman tidak bisa menyelipkan field di luar kontrak
(`src/lib/validation/blok.ts:11-14`). Kedua, karena discriminated union, nilai
`TipeBlok` yang baru memaksa setiap `switch (blok.tipe)` diperbarui atau build
gagal. Ini kegagalan yang memang diinginkan.

### T2. Luas ledakan hanya tiga berkas

Hanya tiga berkas yang bercabang atas `blok.tipe`:

| Berkas | Peran | Yang harus berubah |
|---|---|---|
| `src/components/features/learning/halaman-view.tsx:226` | render peserta dan pratinjau admin, dipakai bersama | satu `case "kode"` |
| `src/components/features/admin/courses/blok-editor.tsx:177` | editor admin | satu `case "kode"` |
| `src/lib/courses/blok.ts:57,72,239` | helper murni | `blokBerisi`, `ringkasBlok`, `blokKosong` |

Selain itu, `src/lib/courses/halaman.ts:49` (`jumlahKata`) harus tahu bahwa
`kode` bukan prosa. Dua konstanta di editor juga perlu entri baru:
`LABEL_TIPE` (`blok-editor.tsx:43`) dan `TIPE_BISA_DITAMBAH`
(`blok-editor.tsx:51`).

### T3. `book` punya sistem blok sendiri dan tidak terpengaruh

`src/components/features/book/blok-renderer.tsx:16` bercabang atas `block.type`,
bukan `blok.tipe`, dan tipenya `Block` dari `src/lib/book/types` dengan kunci
berbahasa Inggris. Sistemnya terpisah, mulai dari nama field sampai sumber
tipenya.

Berkas itu sudah membuang blok yang tidak dikenal
(`blok-renderer.tsx:13`). Jadi menambah `kode` ke `TipeBlok` tidak menyentuhnya.
Ini dinyatakan eksplisit supaya pembaca tidak menebak ada renderer ketiga
yang terlewat.

### T4. Rate limit punya union tertutup yang memaksa entri baru

`NAMA_KEBIJAKAN` (`src/lib/rate-limit/kebijakan.ts:23`) adalah union tertutup
delapan nilai, dan `AMBANG` pada baris 82 bertipe
`Record<NamaKebijakan, SpesifikasiKebijakan>`. Menambah `"jalankanKode"` wajib
disertai satu entri `AMBANG`. Kebijakan baru tidak bisa dipakai tanpa batas
yang ditetapkan.

### T5. Route handler Next.js tidak punya perlindungan CSRF bawaan

Komentar di `src/app/api/unggah/route.ts:126-133` menyatakan ini secara
eksplisit. Perlindungan CSRF bawaan hanya berlaku untuk Server Action, jadi
route handler memeriksa sendiri lewat `originDiizinkan(request)` yang
fail-closed. Pengecualiannya harus diisi lewat
`CAREEVO_ALLOW_MISSING_ORIGIN`.

Route `POST` baru wajib menyalin guard tersebut. Tanpa itu, endpoint yang
menjalankan kode sembarang bisa dipicu dari situs lain.

### T6. Runner tidak boleh masuk `tsconfig.json` Next

`runEngine` (`src/lib/career-ops/exec-engine.ts:43`) sudah menjadi precedent
spawn di repo ini. Tapi ia memanggil Node (`process.execPath`) untuk skrip
`.mjs` milik engine, bukan biner sembarang, dan hanya di mesin yang
menjalankan engine.

Runner C++ berbeda. Ia memanggil `podman` dengan biner `g++` dari dalam image.
Karena itu runner ditulis sebagai program `.mjs` terpisah dengan
`package.json` sendiri, di luar `tsconfig.json` dan `eslint.config.mjs` Next.
Pola yang sama dengan cara repo memperlakukan `engine/`.

### T7. Rootless podman tersedia; `podman-compose` yang tidak

`podman info` melaporkan `rootless: true` dengan `overlay` sebagai graph driver.
`bwrap`, `systemd-run`, dan cgroup v2 juga tersedia. `docker` tidak ada, dan
`podman-compose` tidak bisa membaca compose file.

Konsekuensinya untuk spec ini: jalankan kontainer dengan `podman run` langsung.
Jangan lewat compose.

### T8. SELinux memengaruhi bind mount, dan ini sudah terverifikasi

`id` melaporkan konteks `unconfined_u`. Mount bind rootless podman gagal dengan
`Permission denied` pada berkas 0644 yang sebenarnya bisa dibaca, selama belum
ada relabel. Solusinya sufiks `:z` pada mount, dan hanya direktori spool yang
perlu diberi label.

Ini yang membuat keputusan pada P3 berharga. Hanya runner yang menanggung satu
kewajiban relabel ini.

## Bukti terukur (spike, 2026-09-27)

Dijalankan di mesin ini dengan image `docker.io/library/gcc:13` berukuran
1.41 GB, dan uid di dalam kontainer `65534:65534`:

| Skenario | Hasil | Yang membatasi |
|---|---|---|
| Hello world dengan stdin | `Halo, Budi! Angka 6*7 = 42`, compile dan jalan dalam 1.56 detik | — |
| `for(;;){}` | mencetak `mulai`, lalu mati, `exit=255` | `--timeout 8` |
| Fork bomb | mati, `exit=255` | `--pids-limit=64` |
| `v.resize()` membesar terus | `Killed`, `exit=137` atau SIGKILL | `--memory=512m` |
| Membaca repo atau `.env` | `No such file or directory` | mount namespace terpisah |
| Menyentuh socket Postgres | `No such file or directory` | mount namespace terpisah |
| Jaringan | `Network unreachable` | `--network=none` |
| **Galat kompilasi** | **`m.cpp:3:11: error: invalid conversion`, dengan penanda dan baris sumber** | — |

Baris terakhir adalah yang menentukan secara pedagogis. Galat kompilasi GCC
datang utuh, lengkap dengan nomor baris dan penanda, jadi peserta belajar dari
pesan compiler sungguhan. Sebaliknya, timeout dan kehabisan memori menghasilkan
`255` dan `137`. Angka itu tidak boleh tampil ke peserta mentah-mentah. Lihat
P4.

Belum terukur: perilaku di bawah beban, yaitu sepuluh peserta menekan Jalankan
sekaligus. Juga belum terukur: konsistensi sufiks `:z` setelah reboot.

## Prinsip yang tidak boleh dilanggar

### P1 — Satu komponen, dua mode

Highlighter yang sama untuk membaca dan menyunting. Kalau jalur baca memakai
satu highlighter dan jalur tulis memakai yang lain, keduanya pasti menyimpang.
Peserta lalu belajar dari kode yang tidak sama dengan yang dia jalankan.

Karena itu `KodeView` adalah satu komponen CodeMirror dengan sifat `editable`
yang bisa diubah, bukan dua renderer terpisah.

### P2 — Runner hanya mendengarkan di loopback, dan punya rahasia bersama

Runner adalah endpoint menjalankan kode sembarang tanpa autentikasi pengguna.
Dua aturan ini tidak bisa ditawar:

- Bind `127.0.0.1`, tidak pernah `0.0.0.0`. Kalau portnya terjangkau dari
  jaringan, siapa pun bisa menjalankan kode di mesin ini.
- `CAREEVO_RUNNER_SECRET` dibandingkan di setiap permintaan. Tanpa itu, proses
  lokal lain bisa mengendarai runner.

### P3 — Next.js tidak pernah menulis kode peserta ke disk

Next mengirim sumber lewat HTTP. Runner yang menulis, mengompilasi, menjalankan,
lalu menghapus. Kewajiban relabel SELinux (T8) dan kewajiban membersihkan
berkas sementara jadi milik runner sepenuhnya. Permukaan Next tetap hanya satu
panggilan HTTP yang tervalidasi.

### P4 — Status semantik, bukan exit code mentah

Runner mengembalikan enum: `sukses`, `gagal_kompilasi`, `waktu_habis`,
`memori_habis`, `proses_habis`, `ditolak`, dan `galat_runner`. Angka 255 dan 137
tidak pernah sampai ke peserta.

Peserta yang fork bom-nya dihentikan dengan bersih belajar apa itu batas
proses. Peserta yang hanya melihat `exit=137` belajar tidak apa-apa.

`gagal_kompilasi` mengembalikan stderr GCC apa adanya. Itu sinyal mengajar,
dan menulis ulang akan menjadi penurunan kualitas.

### P5 — Ruang latihan di `localStorage` tidak pernah jadi bukti

Kode yang diketik peserta di ruang latihan bukan bukti apa pun. Aturan repo
§2.2, jangan biarkan peramban menentukan kelayakan, berlaku utuh. Ruang
latihan adalah tempat mencoba, bukan tempat bersertifikat.

Kalau nanti kode perlu dihitung sebagai bukti, itu tabel baru dan keputusan
terpisah. Bukan `localStorage` yang perlahan dinaikkan statusnya.

### P6 — Kode adalah teks polos, tidak pernah HTML

Blok `kode` menyimpan string biasa, lalu dirender sebagai anak React. Tidak
ada `dangerouslySetInnerHTML` di mana pun, sama seperti blok lain
(`src/components/features/learning/halaman-view.tsx:24-29`).

### P7 — Satu berkas adalah seluruh permukaan audit sandbox

Semua flag podman dibangun di satu fungsi murni yang diekspor
(`src/lib/exec/runner/soal.mjs`). Pertanyaan "apa yang boleh dilakukan kode
peserta" harus bisa dijawab dengan membaca satu berkas, dan harus bisa diuji.
Flag yang tersebar di beberapa tempat tidak bisa diaudit.

## Kontrak data

Ditambahkan ke `BlokHalaman` (`src/types/course.ts:77`):

```ts
export type BahasaKode = "cpp";

export interface BlokKode {
  id: string;
  tipe: "kode";
  bahasa: BahasaKode;        // union tertutup, bukan teks bebas
  kode: string;              // teks polos; sumber yang dikompilasi
  kodeAwal?: string;         // titik mulai peserta di ruang latihan
  stdin?: string;            // masukan latihan
  outputHarapan?: string;    // pane keluaran yang diharapkan
  /** Sakelar mati milik ahli: blok ini tampil tapi tanpa tombol Jalankan. */
  dapatDijalankan?: boolean;
}
```

`bahasa` memakai union tertutup, bukan teks bebas. Nilai `bahasa` masuk ke
pemilihan image, dan string bebas berarti image bisa dipilih dari mana saja.

Bawaan saat baca. `dapatDijalankan` yang `undefined` berarti `false`, jadi
hanya `true` eksplisit yang boleh jalan. Ini fail-closed. `kodeAwal` yang
`undefined` berarti `kode`.

## Arsitektur proses

```
KodeView (klien)  --POST { bahasa, kode, stdin }-->  /api/jalankan
                                                         | originDiizinkan (T5)
                                                         | getSession, bukan gate staff
                                                         | batasiRequestMasuk "jalankanKode"
                                                         | zod: bahasa ada di union, panjang dibatasi
                                                         v
                                      runner :8021  (127.0.0.1 + rahasia, P2)
                                      | antrean, maksimum 3
                                      | tulis spool, podman, hapus
                                                         v
                              { status, stdout, stderr, exitCode, durasiMs }
```

`/api/jalankan` memakai `getSession()` seperti `src/app/api/unggah/route.ts:137`.
Bukan `gateStaff()`, karena yang menjalankan adalah peserta yang belajar, bukan
staf. Pengguna tanpa sesi mendapat 401.

Semua galat setelah gerbang tersebut mengembalikan 200 dengan amplop hasil.
Hanya auth, rate limit, dan validasi yang menghasilkan 4xx. Peserta yang
programnya gagal kompilasi sedang tidak mengalami galat jaringan, dan
membedakannya penting untuk mencoba ulang.

**Batas konkurensi 3.** Sepuluh peserta menekan Jalankan bersamaan berarti
sepuluh proses `g++` berebut CPU di satu laptop. Antrean sederhana di runner
lebih murah daripada laptop yang tidak bisa dipakai. Ini kegagalan kelas
kelas, bukan kegagalan per-peserta, jadi ditangani di runner, bukan dengan
membatasi peserta satu per satu.

**Runner ditulis dalam `.mjs` biasa** dengan tipe JSDoc. Tidak ada build step,
tidak ada perubahan `tsconfig.json`, dan tidak ada perebutan keanggotaan
eslint.

## Kebijakan kegagalan

| `status` | Pemicu | Yang dilihat peserta |
|---|---|---|
| `sukses` | exit 0 | stdout, badge hijau |
| `gagal_kompilasi` | `g++` exit bukan 0 | stderr GCC apa adanya |
| `waktu_habis` | `--timeout` | "Program berhenti karena berjalan terlalu lama." |
| `memori_habis` | exit 137 atau kehabisan memori | "Program berhenti karena memakai terlalu banyak memori." |
| `proses_habis` | pids limit | "Program dihentikan karena membuat terlalu banyak proses." |
| `ditolak` | validasi, atau `dapatDijalankan` false | "Blok ini belum bisa dijalankan." |
| `galat_runner` | image hilang, podman gagal | "Layanan eksekusi sedang tidak tersedia." |

Batas keras. Maksimal 20.000 baris sumber, 8 KB stdin, dan 64 KB keluaran yang
dikembalikan. Timeout 10 detik, memori 512 MB, 64 proses, 1 CPU.

Setiap batas dipotong di runner. Memangkas di Next hanya bersifat kosmetik.

## Batas yang harus tertulis di UI

1. Kode peserta dikompilasi dan dijalankan di server, di kontainer terpisah.
   Ia tidak pernah menyentuh database atau berkas repo. Batas pada tabel
   "Bukti terukur" adalah batas yang dijamin, bukan yang dipercaya begitu saja.
2. Hasil dan galat bukan bukti nilai. Penilaian tetap lewat kuis yang nilainya
   dihitung server.
3. Batas 10 detik, 512 MB, dan 64 proses adalah batas pelayanan, bukan kesalahan
   peserta. Copy harus menyatakannya.

## Non-tujuan

- Menilai kode terhadap test case tersembunyi.
- Proyek multi-berkas, misalnya `#include` antar berkas buatan peserta.
- Menyimpan kode peserta di sisi server, beserta setiap tabelnya.
- Bahasa selain C++. `BahasaKode` bernilai satu. Menambah bahasa berarti
  mengganti image dan menguji ulang seluruhnya.
- Autocomplete dan IntelliSense. Di sinilah Monaco akan membayar bobotnya,
  dan bobot itu belum sepadan.
- Streaming output. `stdout` datang utuh, dalam sekitar 1.5 detik.
- Menjalankan runner di produksi. Itu amandemen ADR 0001, bukan spec ini.

## Kriteria keberhasilan

- `npm run check` dan `npm run build` hijau.
- `npm test` hijau tanpa podman dan tanpa g++. Ini kontrak yang menjaga
  `npm test` tetap jalan di mesin tanpa Docker. Karena itu `port.ts` bersifat
  murni dan pemetaan status diuji dengan port palsu. Tidak ada integrasi
  kontainer di `vitest.config.mts`.
- `vitest.integration.config.mts` tidak dilebarkan. Glob-nya
  `src/**/*.integration.test.ts` adalah kontrak yang sudah didokumentasikan.
  Melebarinya adalah keputusan terpisah, bukan efek samping spec ini.
- Blok `kode` dengan `dapatDijalankan` yang tidak ada atau bernilai `false`
  tidak menampilkan tombol Jalankan, dan POST langsung ditolak.
- Galat kompilasi sampai ke peserta lengkap dengan nomor baris dan penanda.
- Peserta tidak pernah melihat angka exit mentah.

### Mutasi yang harus merah

Mutasi berikut harus membuat test gagal. Kalau ada yang hijau, test itu bukan
test.

1. Hapus `--network=none` dari `soal.mjs`.
2. Hapus `--pids-limit=64`.
3. Hapus `--memory=512m`.
4. Hapus `--read-only`.
5. Ubah `--user=65534:65534` menjadi root.
6. Ubah bind runner dari `127.0.0.1` ke `0.0.0.0`.
7. Hapus perbandingan `CAREEVO_RUNNER_SECRET`.
8. Hapus `originDiizinkan` dari `/api/jalankan`.
9. Hapus `getSession` dari `/api/jalankan`.
10. Hapus gerbang `dapatDijalankan` sebelum POST.
11. Hapus `case "kode"` dari `blokBerisi`.
12. Hapus `kode` dari `blokSchema`.
13. Hilangkan pemetaan `waktu_habis`, `memori_habis`, atau `proses_habis`,
    sehingga exit mentah bocor ke UI.
14. Hapus cabang `kode` dari `jumlahKata`, sehingga isi kode dihitung sebagai
    kata baca.
15. Ubah bawaan `kodeAwal` dari `kode` menjadi string kosong.
