# Papan Loker Pasar Indonesia — Design Doc

**Tanggal:** 2026-09-27
**Status:** disetujui untuk implementasi (config + seed + pengujian; rincian teknis ada di plan)
**Ruas:** Slice A dari empat. Dispatcher personalize (Slice B), permukaan persiapan
(Slice C), dan UI percakapan (Slice D) di luar lingkup dokumen ini.

Dokumen ini tidak mengubah arsitektur, skema database, atau model penyimpanan.
Ia hanya mengganti isi satu berkas konfigurasi pindai, dan memastikan
konfigurasi itu terlacak sehingga bisa dikirim.

## Ringkasan

`/loker/inbox` menampilkan 443 lowongan yang hampir semuanya Eropa dan Amerika,
dan hanya satu yang berada di Indonesia. Spec ini memperbaiki akar masalahnya:
dua papan lowongan Indonesia yang sudah dikonfigurasi dengan benar —
Jobstreet Indonesia dan Glints Indonesia — punya `enabled: false`, sehingga
pindai berjalan di atas satu papan Polandia.

Perbaikan ini sebelumnya pernah dicoba dan dibatalkan, dengan alasannya tertulis
di `src/lib/career-ops/bootstrap.ts:24-33`. Spec ini membongkar kenapa percobaan
itu gagal, dan memperbaiki kedua variabelnya sekaligus, bukan satu.

## Temuan (dikode, bukan asumsi)

### T1. Dua papan Indonesia ada, lengkap, dan mati

`.data/career-ops/portals.yml` memuat:

| Nama | Provider | Kunci Indonesia | `enabled` |
|---|---|---|---|
| Jobstreet Indonesia | `jobstreet` | `siteKey: "ID-Main"` | `false` |
| Glints Indonesia | `glints` | `countryCode: "ID"` | `false` |
| SolidJobs IT | `solidjobs` | (Polandia) | `true` |

Keduanya punya `api` yang benar dan bukan placeholder:

- `https://id.jobstreet.com/api/jobsearch/v5/search` — SEEK v5 REST, catatan
  provider: "zero tokens" (`engine/providers/jobstreet.mjs:1-28`)
- `https://glints.com/api/v2-alc/graphql` — GraphQL, `DEFAULT_COUNTRY = "ID"`
  (`engine/providers/glints.mjs:1-25`)

Bukti operasi: `.data/career-ops/data/scan-runs.tsv` mencatat `boards=1` pada
keenam pindai. Satu papan, dan itu Polandia.

### T2. Percobaan Indonesia sebelumnya gagal karena hanya satu dari dua variabel diperbaiki

`src/lib/career-ops/bootstrap.ts:24-33`:

> The hand-written 15-line version that used to live here locked
> `location_filter.allow` to Indonesian cities. Against a mostly-US dataset that
> returned `postingsKept: 0` on every run... The template is data, not code —
> copying it is both smaller and correct.

Bukti di `scan-runs.tsv` yang tegas: `filtered_location=0` dan
`filtered_country_eligibility=0` pada keenam pindai.

Diagnosis sebelumnya benar — korpusnya memang Amerika — tetapi perbaikannya
menyentuh satu variabel. `location_filter` berubah dari "enam kota Indonesia"
menjadi "tidak ada filter sama sekali", sementara `tracked_companies` tetap 138
perusahaan Eropa, Amerika, dan Tiongkok, dan kedua papan Indonesia tetap mati.
Menyaring 138 perusahaan Allianz dan ByteDance dengan `location: Jakarta`
menghasilkan nol. Itu bukan filter rusak; itu aritmetika.

Kasus yang lebih buruk: ketika hanya SolidJobs (Polandia) yang aktif, korpus
14.000 lowongan itu tidak memuat satu pun baris Indonesia yang bisa ditemukan
filter apa pun. Jadi `postingsKept: 0` muncul dari dua sebab sekaligus, dan
keduanya salah.

### T3. Kegagalan engine itu senyap, dan itulah yang membuatnya tidak terdiagnosis

`engine/detect-reposts.mjs:737,741` mengaffirmasi dua perilaku sebagai yang
diinginkan:

```js
check(loadAggregatorCompanies(join(fixtures, 'does-not-exist.yml')).size === 0, ...)
check(loadAggregatorCompanies(bad).size === 0, ...)
```

> a missing portals.yml yields no aggregators, no crash
> a malformed portals.yml yields no aggregators, no crash

Konfigurasi rusak tidak melempar. Ia menghasilkan nol papan, yang dilaporkan
pindai sebagai `postingsKept: 0` — identik dengan "pindai berjalan benar,
tidak ada yang cocok".

Inilah alasan utama spec ini menyertakan pengujian yang membuktikan konfigurasi
bisa di-parse dan memiliki satu papan Indonesia yang aktif. Tanpa itu, satu
salah ketik akan mengulangi kegagalan lama secara persis.

### T4. `location_filter` hanya membatasi lewat `allow` yang tidak kosong

Semantik resmi, dari `.data/career-ops/portals.yml:76-115`:

```
location kosong       -> lolos
block_hard ada        -> tolak (always_allow tidak bisa mengoverride)
always_allow ada      -> lolos (mengalahkan block)
block ada             -> tolak
allow kosong          -> lolos
allow tidak kosong    -> harus cocok minimal satu keyword
```

`always_allow` saja tidak membatasi apa pun; ia hanya menyelamatkan lowongan
multi-lokasi. Agar pasar ini benar-benar dibatasi, `allow` harus tidak kosong.

`strict: true` sengaja tidak dipakai. Default-nya meloloskan lowongan tanpa
lokasi, sedangkan `strict` gagal tertutup dan akan membuang setiap baris Glints
yang tidak mencantumkan lokasi. Gagal tertutup adalah arah yang salah di sini.

### T5. `title_filter` sekarang menyalahi pasar target

`positive` berisi 36 kata kunci profil karier AI dan otomatisasi Eropa — `AI`,
`LLM`, `Agentic`, `LLMOps`, `Forward Deployed`, `GTM Engineer`, `RevOps`,
`Dozent`, `Weiterbildung` — dan `negative` secara aktif menyingkirkan bahasa
yang mainstream di Indonesia: `Java `, `PHP`, `Ruby`, `.NET`.

Istilah tesis Jerman (`Werkstudent`, `Praktikant`, `Praktikum`, `Masterarbeit`,
`Bachelorarbeit`) adalah beban mati di sini.

### T6. Pagar "minimal 10 kota" tidak mencegah kegagalan yang dicatat sebagai nalinya

`src/lib/career-ops/portals.test.ts:43-52`:

```js
// The regression: an allow-list of six Indonesian cities matched nothing in a
// dataset of 50k mostly-American companies, so every run reported
// `postingsKept: 0`... a short allow-list is what must never come back.
it("does not lock the location filter to a short list of cities", () => {
  if (Array.isArray(allow) && allow.length > 0) {
    expect(allow.length).toBeGreaterThanOrEqual(10);
  }
});
```

Diagnosis penulisnya benar, tetapi aturan minimal 10 kota tidak mencegah apa
yang dicatat sebagai pencegahannya. SolidJobs dengan sepuluh kota yang diizinkan
tetap menghasilkan nol. Aturan itu menjaga gejala, bukan sebab.

Catatan lebih lanjut: karena `allow` kosong secara default, aturan ini
melewati seluruh berkas saat ini. Pagar itu tidak sedang melindungi apa pun.

Kabar baik: daftar `allow` Indonesia yang jujur — sepuluh metro nyata atau
lebih, ditambah `Indonesia` dan `Remote` — memenuhi pagar ini karena alasan
yang benar. Pagar bisa dibiarkan utuh.

## Keputusan

### K1. Konfigurasi pasar adalah artefak Careevo yang terlacak, bukan setelan lokal

`.data/` diabaikan git (`.gitignore:47`). Benih `portals.yml` hanya berasal dari
`engine/templates/portals.example.yml`, yang terlacak, divendor, dan
`AGENTS.md` menyebutnya "Verbatim vendored core of career-ops". Mengeditnya akan
mematahkan batas yang disengaja dan memicu skill `career-ops-port` serta
`careevo-attribution`.

Pilihan yang diambil: benih Careevo sendiri, dengan `engine/` tetap
byte-identik.

Tiga opsi yang dipertimbangkan:

1. **Benih Careevo sendiri** — berkas terlacak baru, `bootstrap.ts` memilihnya,
   `engine/` tidak tersentuh. Dipilih.
2. **Fork `engine/templates/portals.example.yml`** — kode nyaris nol, tetapi
   melanggar batas verbatim, menghasilkan diff 2822 baris, dan bertabrakan
   dengan sinkronisasi engine berikutnya. Penulis sebelumnya sudah menolak ini.
3. **Sunting `.data/` saja** — nol kode, dan tidak terkirim. Clone baru
   mengembalikan bug. Itu perangkap, bukan opsi.

### K2. Sasaran papan adalah peran tech umum di Indonesia

`positive` diperluas ke keluarga peran tech umum dengan ejaan Indonesia dan
Inggris. `negative` memulihkan `Java `, `PHP`, `Ruby`, dan membuang istilah tesis
Jerman. Sasaran sempit "kewirausahaan AI" ditolak karena menyisakan sebagian
besar lowongan tech Indonesia dan sebagian besar pelajar Careevo.

### K3. `strict` dimatikan

Lihat T4. Gagal tertutup adalah arah yang salah untuk sumber yang bisa
kehilangan lokasi.

## Perubahan

### Baru — `src/lib/career-ops/portals-careevo.yml`

Konfigurasi pindai Indonesia-first. Skema sama dengan template engine:
`title_filter`, `location_filter`, `job_boards`, `tracked_companies`.

### Ubah — `src/lib/career-ops/bootstrap.ts:36-44`

`seedPortalsFromTemplate()` mencari `portals-careevo.yml` lebih dulu, lalu
fallback ke `engine/templates/portals.example.yml` bila tidak ada. Kedua jalur
menjaga semantik tulis-sekali yang sudah ada: `portals.yml` yang sudah ada tidak
pernah diganti, sehingga suntingan lokal pengguna selamat.

### Ubah — `src/lib/career-ops/portals.test.ts:34-39`

`'is seeded from the engine template, not a hand-written stub'` menjadi
pernyataan bahwa seed berasal dari konfigurasi Careevo. Niat asli — stub 15
baris tulis-tangan tidak boleh kembali — tetap terjaga.

### Tidak diubah

- `engine/**` — byte-identik; batas verbatim dan atribusi tetap berlaku
- `career-ops/` — tidak disentuh
- `src/lib/db/schema.ts` dan `drizzle/` — tidak ada perubahan skema atau migrasi

## Bentuk konfigurasi

### Papan

Setiap papan Indonesia diaktifkan. `searchLocation` Jobstreet dikosongkan,
bukan `"Jakarta"`, supaya `location_filter` yang melakukan pemangkasan dan
lowongan di luar Jabodetabek tidak hilang.

Generalisasi ke banyak keluarga peran mengikuti preseden yang sudah ada di
berkas ini: SolidJobs dikonfigurasi sebagai delapan entri terpisah — IT,
Engineering, Marketing, Sales, HR, Logistics, Finances, Other — masing-masing
dengan `searchKeywords` sendiri. Peran tech umum adalah gerakan yang sama.

### Batas atas per pindai — koreksi terhadap presentasi sebelumnya

Batas provider adalah `pageSize` kali `maxPages` per entri papan, default
30 kali 3 = 90. Karena konvensi multi-entri, batas sebenarnya adalah jumlah
entri dikali 90, bukan 180.

Konsekuensi yang harus dinyatakan di UI: dengan dua belas entri, batas
teoretis adalah 1.080 lowongan per pindai, dan itu tetap bukan papan lowongan
nasional. UI tidak boleh menjanjikan cakupan nasional. Angka sebenarnya
dibaca dari `new_added` di `scan-runs.tsv`, bukan dari perkiraan.

### `title_filter.negative` dipulihkan

`Java `, `PHP`, `Ruby`, dan `.NET` dipindahkan ke `positive` sebagai Istilah
yang dicari, bukan ditahan di `negative`. Istilah `Werkstudent`, `Praktikant`,
`Praktikum`, `Masterarbeit`, dan `Bachelorarbeit` dibuang.

## Kegagalan dan penanganannya

| # | Kegagalan | Gejala | Penanganan |
|---|---|---|---|
| G1 | Config rusak atau tidak bisa di-parse | `postingsKept: 0` (T3) | Test: seed harus bisa di-parse dan punya minimal satu papan Indonesia aktif |
| G2 | Glints diblokir WAF pada jalur non-Playwright | Nol hasil, tampak seperti "tidak ada lowongan Indonesia" | Jobstreet adalah andalannya (REST, "zero tokens"). Glints kosong adalah hipotesis pertama, bukan kesimpulan |
| G3 | `allow` terlalu sempit; "Bekasi" dan "Tangerang" tidak cocok | Sedikit hasil | `allow` memuat metro Jabodetabek yang sah. Substring match case-insensitive, jadi "Jakarta" menangkap "Jakarta Selatan" |
| G4 | `title_filter` terlalu sempit | Nol hasil, kelas bug yang sama | `positive` longgar, diverifikasi lewat pindai nyata, bukan lewat test |
| G5 | `portals.yml` sudah ada di mesin ini | Perbaikan tidak berlaku | Tulis-sekali disengaja; verifikasi menghapus berkas secara manual. Dokumentasikan di `docs/local-db.md` agar tidak gagal senyap di mesin lain |

### Keputusan operasional untuk `pipeline.md`

`pipeline.md` memuat 443 lowongan Barat dan `scan-history.tsv` men-dedup
selamanya. Setelah pindai ulang, inbox menampilkan 443 Barat plus N Indonesia —
keluhan asli, hanya dengan tambahan perusahaan.

**Keputusan: bersihkan `pipeline.md` dan `scan-history.tsv` setelah pindai baru
terbukti mengembalikan baris Indonesia.** Salinan dibuat di luar `.data/` lebih
dulu bila data lama masih dibutuhkan. Kalau pindai baru kurang, menyimpan 443
baris adalah default yang lebih aman, dan langkah ini ditunda.

## Pengujian

`portals.test.ts` berubah dari empat test menjadi satu tulis-ulang plus lima
tambahan, dengan tiga test lama dibiarkan utuh.

| | Test | Alasan |
|---|---|---|
| Tulis-ulang | `:34` — seed dari konfigurasi Careevo | Wajar; menjaga niat "tanpa stub tulis-tangan" |
| Tambah | Seed bisa di-parse | Penjaga kegagalan senyap (G1) |
| Tambah | Minimal satu papan aktif dengan identitas Indonesia (`siteKey` diawali `ID` atau `countryCode: ID`) | Papan yang mati terbaca sebagai "config sehat, hasil kosong", persis bug T1 |
| Tambah | `Java `, `PHP`, `Ruby` tidak ada di `negative` | Mengunci perbaikan T5 |
| Tambah | `positive` memuat istilah peran Indonesia | Mencegah daftar Inggris lama terkirim ulang |
| Tambah | Fallback masih bekerja tanpa berkas Careevo | Mempertahankan safety net |
| Utuh | `:47` minimal 10 kota, `:54` positive tidak kosong, `:61` papan dan perusahaan | Masih benar, dan kini terpenuhi dengan jujur |

### Batas jujur dari test ini

Semuanya adalah penjaga regresi atas berkas data, bukan bukti perilaku.
Semuanya akan hijau pada config yang mengembalikan nol lowongan Indonesia,
persis cara percobaan sebelumnya gagal sementara test-nya sendiri hijau.

Tidak ada test yang bisa membuktikan ini bekerja. Hanya pindai yang benar-benar
dijalankan bisa, jadi bukti penerimaan adalah:

1. `scan-runs.tsv` menunjukkan `boards` naik dari 1 dan `new_added` di atas nol
2. Baris di `pipeline.md` menyebut kota Indonesia
3. Tangkapan layar inbox yang berjalan, sesuai `careevo-browser-verify`, bukan
   hanya diff

## Di luar lingkup

- **Slice B** — dispatcher personalisasi: tabel `ai_evaluation_requests`,
  `ai_evaluation_results`, `ai_usage_counters`, dan permukaan "Untuk kamu".
  Bergantung pada hasil pindai ini.
- **Slice C** — permukaan persiapan: `requirements` pada `JobSeed`, dan
  `RekomendasiKursusPanel` / `JalurLokerPanel` yang bisa dijangkau dari papan.
- **Slice D** — UI percakapan. `LlmPort` hanya punya
  `generate(): Promise<LlmResult>`, tanpa streaming dan tanpa tool-calling,
  jadi tidak akan terasa seperti AI Mastery.

`location_filter` di `portals.yml` yang sudah ada tidak disentuh; semantik
tulis-sekali melindunginya.
