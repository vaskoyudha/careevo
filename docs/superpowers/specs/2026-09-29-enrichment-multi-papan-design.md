# Enrichment Multi-Papan — Design Doc

**Tanggal:** 2026-09-29
**Status:** disetujui untuk implementasi (registry adapter + cache terpadu + langkah pasca-scan)
**Ruas:** satu slice. Tidak mengubah skema database, model penyimpanan, atau `engine/`.

## Ringkasan

`/loker/inbox` menampilkan 257 lowongan, tetapi **hanya 180** yang pernah diaudit
Sentinel. **77 baris (30%)** selalu tampil "Belum diperiksa" dengan panel "Hasil
Audit Sentinel & Evaluasi Kecocokan" yang kosong — bukan karena kegagalan sesaat,
melainkan karena enrichment hanya mengenal Jobstreet.

Dokumen ini memperbaiki akarnya: enrichment menjadi **multi-papan** lewat satu
registry adapter, cache terpadu berkunci URL, dan langkah pasca-scan yang mengisi
cache secara proaktif sehingga render halaman tidak pernah menunggu jaringan.

## Temuan (diukur, bukan diasumsikan)

Semua angka di bawah dari probe langsung ke API/HTML publik papan pada 2026-09-29,
dan dari `.data/career-ops/data/pipeline.md` di mesin ini.

### T1. Enam papan, satu yang bisa di-enrich

Sebaran host di `pipeline.md`:

| Baris | Host | Papan |
|---:|---|---|
| 180 | `id.jobstreet.com` | Jobstreet ✅ sudah jalan |
| 32 | `www.kalibrr.com` | Kalibrr |
| 18 | `kredivo-group.breezy.hr` + `akar-inti-teknologi.breezy.hr` | Breezy |
| 10 | `apply.workable.com` | Workable |
| 10 | `dealls.com` | Dealls |
| 7 | `jobs.smartrecruiters.com` | SmartRecruiters |

`jobIdFromUrl` (`jobstreet-audit.ts:40`) mengembalikan `null` untuk semua host
selain Jobstreet — dibuktikan dengan menjalankan regex-nya pada URL Breezy
(`/\/id\/job\/(\d+)/` → `null`). `bacaInboxDiaudit` (`inbox.ts:103`) lalu
**tidak menyentuh jaringan sama sekali** dan `auditBaris` jatuh ke `takTeraudit()`.

### T2. Semua papan menyediakan deskripsi tanpa browser — tetapi strateginya per-papan

Klaim awal "Breezy kemungkinan butuh browser per lowongan" **salah**. Probe juga
**mengoreksi** dua asumsi berikutnya: API pencarian Kalibrr bersifat global
(param `company_code`/`job_id` **diabaikan** — mengembalikan perusahaan lain),
dan widget Workable **tanpa** `details=true` tidak memuat deskripsi sama sekali.
Yang benar:

| Papan | Sumber deskripsi | Strategi | Biaya terukur |
|---|---|---|---|
| Kalibrr | search API `?company=<code>` → `description` + `qualifications` | `ambilFeed` | 589 + 947 char; **1 req / perusahaan** (17 kode) |
| Workable | widget `?details=true` → `job.description` | `ambilFeed` | 3876 char; **1 req / akun** |
| SmartRecruiters | detail `/v1/companies/<slug>/postings/<id>` → `jobAd.sections.jobDescription` | `ambilDetail` | 1105 char; 1 req / lowongan |
| Dealls | HTML `__NEXT_DATA__` → `responsibilities` + `requirements` | `ambilDetail` | 2924 + 1035 char; 1 req / lowongan |
| Breezy | HTML server-rendered `#description` (dan `og:description`) | `ambilDetail` | container 1618 char; 1 req / lowongan |

Konsekuensi: tidak ada kasus "butuh browser" — semua selesai dengan `fetch`
biasa. Tetapi **tidak ada satu strategi yang berlaku untuk semua papan**, jadi
kontrak adapter harus mengizinkan keduanya (`ambilFeed` **atau** `ambilDetail`),
dan biaya dihitung per papan, bukan diasumsikan seragam.

### T3. Scan sudah memegang deskripsi lalu membuangnya

`formatPipelineOffer` (`engine/scan.mjs:2465`) menulis baris sebagai
`- [ ] url | company | title | location | compensation | posted | trust | note`.
Deskripsi yang provider kembalikan (Kalibrr, Workable) ada di memori saat scan
tetapi tidak pernah masuk `pipeline.md`.

`engine/` byte-identik dan tidak boleh disentuh (batas `career-ops-port` +
`careevo-attribution`), jadi enrichment **harus mengambil ulang** dari feed
papan. Untuk papan ber-feed itu satu request per perusahaan/akun; untuk papan
per-lowongan itu satu request per baris.

### T4. Jalur render tidak boleh menunggu jaringan

`bacaInboxDiaudit()` dipanggil dari `loker/inbox/page.tsx:39` saat render
(`dynamic = "force-dynamic"` = setiap request), untuk seluruh baris. Aman
sekarang karena Jobstreet di-cache. Tetapi 77 baris non-Jobstreet berdeskripsi
per-request berarti **puluhan request jaringan di jalur render** saat cache
dingin — satu cache dingin akan memblokir halaman.

### T5. `ATS_DIIZINKAN` belum memuat Dealls

`trust.ts:53-75` memuat `breezy.hr`, `kalibrr.com`, `workable.com`,
`smartrecruiters.com`, `jobstreet.*`, `glints.com` — **tidak** `dealls.com`.
`nilaiKepercayaan` (`trust.ts:230`) hanya melewati cek domain untuk host di
daftar itu, jadi 10 baris Dealls akan menerima `domain_tidak_cocok` palsu
("CFACTORY.CO" ≠ "dealls.com"). Ini akan salah menaikkan status ke karantina.

### T6. `apply_url` off-platform adalah sinyal yang harus dipertahankan

`applyUrlFromTeaser` (`jobstreet-audit.ts:58`) sudah menerapkan aturan: URL di
luar platform menang, karena URL agregator tidak memberi sinyal apa pun. Papan
lain punya field setara (`apply_redirect_url` Kalibrr, `externalPlatformApplyUrl`
Dealls, `applyUrl` SmartRecruiters) — memakai URL posting mentah sebagai
`apply_url` akan menghilangkan satu-satunya sinyal yang berarti (`link_pendek`,
`link_apk`).

### T7. Biaya nyata untuk 77 baris non-Jobstreet

Dihitung dari `pipeline.md` di mesin ini (17 kode perusahaan Kalibrr berbeda,
satu akun Workable):

| Papan | Baris | Request sekali (lalu di-cache) |
|---|---:|---:|
| Kalibrr | 32 | ~17 (per-perusahaan, `company=<code>`) |
| Workable | 10 | ~1–2 (per-akun, `details=true`) |
| Breezy | 18 | 18 |
| Dealls | 10 | 10 |
| SmartRecruiters | 7 | 7 |
| **Total** | **77** | **~53–54** |

Ini yang membuat langkah pasca-scan (K3) menjadi wajib: ~53 request satu kali
untuk menaikkan cakupan dari 180 → 257 baris tidak boleh berada di jalur render
(T4).

## Keputusan

### K1. Satu registry adapter, `auditBaris` tetap murni

Direktori baru `src/lib/career-ops/boards/`, satu berkas per papan, dengan
kontrak seragam:

```ts
export interface BahanPapan {
  url: string;            // URL posting — kunci cache
  bahan: BahanAudit;      // { description, apply_url, company, employer_known }
  tags?: string[];        // kategori pekerjaan, bila papan menyediakannya
}

export interface PapanAdapter {
  nama: string;                       // "Kalibrr" — untuk copy UI
  cocok(url: string): boolean;        // apakah URL ini milik papan ini
  /**
   * Papan ber-feed: satu request per kunci mengembalikan banyak lowongan. Boleh
   * mengembalikan lebih banyak dari yang ada di inbox; pemanggil hanya menyimpan
   * kunci inbox (lihat K3). Kunci datang dari `kunciFeed`.
   */
  ambilFeed?(kunci: string, fetchJson: FetchJson, fetchText: FetchText): Promise<BahanPapan[]>;
  /** Papan per-lowongan: satu request per posting. */
  ambilDetail?(url: string, fetchJson: FetchJson, fetchText: FetchText): Promise<BahanPapan | null>;
  /** Dari URL inbox → kunci pengelompokan feed (mis. slug akun). `ambilFeed` saja. */
  kunciFeed?(url: string): string | null;
}
```

`auditBaris` **tidak boleh** mengetahui papan mana pun. Ia hanya menerima
`BahanAudit`. Inilah yang mencegah pola `if/else` per-host yang tersebar —
persis kelas bug yang `careevo-review` peringatkan ("dua salinan aturan yang
bisa berbeda").

Tiga opsi yang dipertimbangkan:

1. **Registry adapter** — satu kontrak, menambah papan = menambah satu berkas. Dipilih.
2. **Satu berkas enrich per papan + `auditBaris` bercabang per host** — paling
   sedikit kode per papan, tetapi aturan "papan mana, kapan fetch" tersebar dan
   menambah papan ke-7 menyentuh tiga tempat. Ditolak.
3. **Pakai ulang provider `engine/` lewat child process** — engine sudah punya
   parser tiap papan, tetapi provider dirancang untuk scan, bukan fetch per-URL,
   dan beberapa tidak mengembalikan deskripsi. Melanggar batas
   "Careevo menyentuh engine hanya lewat child process". Ditolak.

### K2. Cache terpadu berkunci URL

`src/lib/career-ops/job-cache.ts` menggantikan `jobstreet-enrich.ts` sebagai
pemilik I/O:

```
.data/job-cache/enrichment.json
Record<urlTernormalisasi, { board: string; bahan: BahanAudit; tags?: string[]; diambilPada: string }>
```

- Kunci **URL** (lewat `normalisasiKunciUrl` yang sudah ada), bukan id Jobstreet —
  papan lain tidak punya id numerik yang seragam.
- `bacaCache` rusak = cache kosong, bukan error (aturan yang sudah berlaku di
  `jobstreet-enrich.ts:35`).
- **Migrasi tanpa jaringan:** cache lama `{jobstreetId → ListingJobstreet}`
  dipetakan sekali (`jobIdFromUrl(row) → row.url`) sehingga 180 baris Jobstreet
  tidak perlu di-fetch ulang.

### K3. Langkah pasca-scan mengisi cache proaktif

Fungsi `perkayaSemua(rows, opsi)` di `job-cache.ts`:

- Kelompokkan baris per adapter. Adapter ber-feed (`ambilFeed`) dikelompokkan
  lagi lewat `kunciFeed(url)` — Kalibrr jadi satu request **per kode perusahaan**
  (17, bukan 32), Workable satu request **per akun** (bukan 10). `ambilFeed`
  boleh mengembalikan seluruh papan; hasilnya di-key dengan
  `normalisasiKunciUrl(bahan.url)` dan **hanya kunci yang ada di inbox yang
  disimpan**. Feed yang lebih besar dari inbox adalah normal dan tidak boleh
  menulis ribuan baris ke cache.
- Untuk adapter `ambilDetail` (Breezy, Dealls, SmartRecruiters), jalankan per
  baris dengan **batas konkurensi per-host** (4) + timeout per request
  (10 detik) + backoff pada HTTP 429.
- Dipanggil dari `jalankanScanAction` **setelah** scan sukses. Render hanya
  membaca cache dan tidak pernah menunggu jaringan.
- Satu baris gagal → tetap `enriched: false` (tidak pernah `clean`).
- Karena langkah ini hanya menyentuh baris baru, 257 baris yang sudah ada
  di-backfill sekali lewat `scripts/enrich-inbox.ts`.

### K4. Perbaikan yang wajib menyertai

1. **`ATS_DIIZINKAN` += `dealls.com`, `sejutacita.id`** (T5).
2. **`apply_url` off-platform menang** untuk tiap papan (T6).
3. **Copy UI** `takTeraudit` menyebut papan yang belum didukung, bukan "belum
   bisa diambil" generik — sehingga "Belum diperiksa" tidak terbaca seperti
   kegagalan sesaat.
4. **`kebutuhanDariInbox`** (`persiapan-inbox.ts:123`) dan
   **`hitungJumlahKursus`** (`hitung-kursus.ts:24`) membaca cache terpadu,
   bukan `ListingJobstreet` per-id.

## Perubahan

### Baru — `src/lib/career-ops/boards/`

| Berkas | Isi |
|---|---|
| `types.ts` | `PapanAdapter`, `BahanPapan` |
| `index.ts` | `adapterUntuk(url)`, `semuaAdapter()` |
| `html.ts` | HTML→teks, ekstraksi `__NEXT_DATA__`, `og:description` |
| `jobstreet.ts` | Membungkus `jobstreet-audit.ts` + `jobstreet-enrich.ts` yang ada — **tidak ditulis ulang** (`ambilFeed`, satu id per baris) |
| `kalibrr.ts` | `ambilFeed` (`?company=<code>`, satu request per perusahaan) |
| `workable.ts` | `ambilFeed` (`?details=true`, satu request per akun) |
| `smartrecruiters.ts` | `ambilDetail` |
| `dealls.ts` | `ambilDetail` (HTML `__NEXT_DATA__`) |
| `breezy.ts` | `ambilDetail` (HTML `#description`) |

### Baru — `src/lib/career-ops/job-cache.ts`

`bacaCache`, `tulisCache`, `perkayaSemua`, migrasi cache lama.

### Baru — `scripts/enrich-inbox.ts`

Backfill sekali untuk 257 baris yang sudah ada.

### Ubah

| Berkas | Perubahan |
|---|---|
| `inbox-audit.ts` | `auditBaris` menerima `Record<url, BahanPapan>`; `takTeraudit` menerima nama papan |
| `inbox.ts` | `bacaInboxDiaudit` memanggil `perkayaSemua` lewat adapter |
| `jobs/hitung-kursus.ts` | Membaca cache terpadu |
| `jobs/persiapan-inbox.ts` | `kebutuhanDariInbox` menerima `BahanPapan` |
| `jobs/trust.ts` | `ATS_DIIZINKAN` += `dealls.com`, `sejutacita.id` |
| `actions/inbox.ts` | `jalankanScanAction` memanggil `perkayaSemua` setelah scan sukses |
| `actions/loker-inbox-persiapan.ts` | Membaca cache terpadu |
| `app/(app)/loker/inbox/page.tsx` | `hitungJumlahKursus` membaca cache terpadu |
| `career-ops/index.ts` | Ekspor `job-cache`, `boards` |
| `jobstreet-enrich.ts` | `perkaya` dipertahankan sebagai adapter Jobstreet; `bacaCache` lama dipindah/di-deprecate |

### Tidak diubah

- `engine/**` — byte-identik
- `src/lib/db/schema.ts` dan `drizzle/` — tidak ada perubahan skema
- `src/lib/agents/sentinel.ts` dan `rules/fee-rules.ts` — audit tetap deterministik
- Fixture dan `src/lib/fixtures.ts`

## Alur data

```
scan (engine)  →  data/pipeline.md
                        │
        jalankanScanAction ──► perkayaSemua(rows)
                        │           │
                        │      adapterUntuk(url) per papan
                        │           ├─ ambilFeed   (Kalibrr, Workable, Jobstreet)
                        │           └─ ambilDetail (SmartRecruiters, Dealls, Breezy)
                        │           ▼
                        │      .data/job-cache/enrichment.json
                        ▼
     render /loker/inbox ──► bacaCache() (tanpa jaringan)
                        ▼
                   auditBaris(rows, cache) ──► verdict diturunkan
```

## Kegagalan dan penanganannya

| # | Kegagalan | Gejala | Penanganan |
|---|---|---|---|
| G1 | Papan mengubah bentuk HTML (Dealls, Breezy) | Baris itu `enriched: false` | Ekstraksi diisolasi per adapter; gagal → `takTeraudit`, tidak pernah verdict salah |
| G2 | Cache dingin = puluhan request | Backfill lambat sekali | Pasca-scan proaktif + batas konkurensi + timeout; render tidak pernah menunggu |
| G3 | Host membalas 429 | Beberapa baris `enriched: false` | Backoff per-host; baris tetap "Belum diperiksa", tidak salah verdict |
| G4 | Cache lama belum dimigrasi | 180 baris Jobstreet tiba-tiba "Belum diperiksa" | Migrasi sekali baca; test menutup round-trip |
| G5 | Dealls lolos tanpa masuk `ATS_DIIZINKAN` | 10 baris karantina palsu | Test mengunci `dealls.com` ada di `ATS_DIIZINKAN` |
| G6 | `normalisasiKunciUrl` mengembalikan `""` | Kunci cache tidak valid | `""` = tanpa kunci; baris dianggap belum ter-enrich, bukan cocok dengan `""` lain |
| G7 | `kunciFeed` tidak bisa diturunkan dari URL inbox (mis. URL Kalibrr tanpa `/c/<code>/jobs`) | Baris itu tak punya grup feed | Jatuh ke `ambilDetail`; bila itu juga tidak ada → `enriched: false` |
| G8 | Satu feed perusahaan Workable/Kalibrr mengembalikan lowongan yang tidak ada di inbox, atau melewatkan yang ada | Cache tidak lengkap | Hanya kunci inbox yang disimpan; baris tanpa hasil tetap "Belum diperiksa" — feed tidak boleh dianggap sumber kebenaran daftar inbox |

## Pengujian

| Test | Alasan |
|---|---|
| Kontrak tiap adapter (fixture respons → `BahanPapan`) | Mengunci parsing, termasuk HTML Dealls/Breezy dan feed `?details=true` Workable |
| `kunciFeed` menurunkan kode perusahaan/akun dari URL inbox | Menutup G7 |
| Feed yang lebih besar dari inbox hanya menyimpan kunci inbox | Menutup G8 |
| Round-trip cache + migrasi cache lama | Menutup G4 |
| `auditBaris` berkunci URL: cache ada → `enriched: true`; tidak → `false` | Kontrak inti |
| Baris tanpa deskripsi **tidak boleh** `clean` | Menjaga invarian `inbox-audit` |
| `ATS_DIIZINKAN` memuat `dealls.com` | Mengunci G5 |
| `apply_url` off-platform dipilih bila ada | Mengunci T6 |
| `perkayaSemua` menghormati batas konkurensi + tidak melempar saat satu adapter gagal | Mengunci G1–G3 |

### Batas jujur dari test ini

Semua test di atas adalah penjaga regresi atas parsing dan kontrak, bukan bukti
perilaku terhadap papan nyata. Papan bisa mengubah HTML kapan saja tanpa
mengubah test. Bukti penerimaan hanya dari fetch sungguhan:

1. Jumlah baris `enriched: true` di inbox naik dari 180 → ~255
2. Tangkapan layar inbox yang berjalan, sesuai `careevo-browser-verify`
3. `node scripts/enrich-inbox.ts` melaporkan per-papan berapa baris berhasil

## Di luar lingkup

- Perubahan pada `engine/` atau provider career-ops
- Deteksi perubahan bentuk HTML papan secara otomatis (alerting)
- Penjadwalan pasca-scan berulang (cron) — langkah ini dipicu oleh scan sukses
- Evaluasi A–H (`loker-evaluasi`) untuk baris non-Jobstreet — dokumen ini hanya
  menyiapkan `BahanAudit` yang juga dibutuhkannya nanti
