# Lapisan Pengawasan Anti-Curang — Design Doc

**Tanggal:** 2026-09-27
**Status:** disetujui untuk implementasi (rincian teknis di plan)

**Prasyarat:** `2026-02-14-anti-curang-course-design.md` (sesi terverifikasi & kejadian
integritas), `2026-09-25-celah-anti-curang-laporan-performa-design.md` (laporan
performa & integritas), dan `2026-09-25-temuan-integritas-dan-banding-design.md`
(ranah keputusan manusia) tetap berlaku. Dokumen ini **menambah lapisan deteksi**,
tidak mengubah prinsip mana pun di ketiganya.

## Ringkasan

Hari ini Careevo hanya punya deteksi Tier 0: keluar tab, fokus hilang, dan skor
kuis yang dinilai server. Riset menunjukkan detector di luar sana bekerja
berlapis — tiap lapisan menutup celah yang mustahil ditutup lapisan sebelumnya:

| Lapisan | Menutup | Diminta |
|---|---|---|
| **Tier 1** (browser) | fullscreen keluar, paste massal, pintasan terlarang | ya |
| **Tier 2** (kamera) | wajah tidak ada, orang kedua | ya |
| **Tier 3** (lockdown browser) | aplikasi lain, OS shortcut, navigasi | ya (SEB, open source) |
| **Tier 4** (OS + network) | AI overlay, LLM on-device, perangkat kedua, remote-access | **tidak** — di luar jangkauan repo ini |

Dokumen ini merancang **Tier 1 dan Tier 2**, dan menetapkan Tier 3 sebagai
batas integrasi yang hanya membaca sinyal dari luar (bukan membangunnya).

## Temuan (dikode, bukan asumsi)

### T1. `JENIS_KEJADIAN_SAH` adalah daftar tunggal yang bisa diperluas

`src/lib/learning/akses.ts:136-146` menurunkan `KJenisKejadian` dari array
`JENIS_KEJADIAN_SAH`, dan `klasifikasiKejadian` sudah memetakan tiap jenis ke
`kejadian` atau `celah`. Menambah jenis baru berarti menambah satu entri ke array
satu ini — dan karena `JENIS_KEJADIAN_SAH` sudah divalidasi di wire
(`learning.ts:168`), tidak ada tempat kedua yang perlu ikut berubah. Ini membuat
Tier 1 dan Tier 2 jadi **penambahan daftar**, bukan skema baru.

### T2. `payloadRedacted` sudah merupakan tempat yang tepat untuk data sinyal

`learningEvents.payloadRedacted` (`schema.ts:602`) sudah Jsonb yang disaring, sudah
dipakai untuk `jenis_klasifikasi`, `visibilitas`, dan `detail` (dipotong 300
karakter di `run-service.ts:197`). Sinyal baru seperti `panjang_paste`,
`selisih_detik_sejak_ketik`, atau `jumlah_wajah` masuk ke sini — **tanpa migrasi
database**.

### T3. Kamera belum diimplementasikan, tapi infrastrukturnya sudah ada

`kamera_mulai` / `kamera_berhenti` / `kamera_gagal` sudah ada di
`JENIS_KEJADIAN_SAH` dan sudah punya klasifikasi (`celah` untuk berhenti/gagal,
`integritas.ts:158`). Yang belum ada hanya sisi kliennya: tidak ada satu pun
panggilan `getUserMedia` di repo. Copy di `course-session.tsx:293` dan
`settings-form.tsx:65` sudah jujur menyebut "belum aktif" — jadi Tier 2 boleh
mengganti copy itu **hanya setelah** kameranya benar-benar jalan.

### T4. Aturan pengawasan sudah punya dua nilai; perlu yang ketiga

`AturanPengawasan` adalah `wajib | opsional` (`types/course.ts`). Keduanya tidak
membedakan captive dan non-captive assessment: `wajib` memaksa sesi tapi tanpa
kamera, `opsional` tidak memaksa apa pun. Sistem VT/AI-proctored butuh nilai
ketiga yang **menuntut** kamera, dan nilainya harus punya konsekuensi nyata —
tanpa itu `wajib` tetap bisa diselesaikan tanpa kamera seperti sekarang.

### T5. Retensi data kamera belum pernah ditetapkan

`learning_runs` dan `learning_events` tidak punya kebijakan retensi sama sekali
(catatan eksplisit di `temuan-integritas-dan-banding-design.md:373-374`). Foto
kamera dan snapshot layar adalah data pribadi yang jauh lebih sensitif daripada
catatan kejadian, jadi Tier 2 **tidak boleh** lewat tanpa keputusan retensi tertulis.

## Prinsip yang tidak boleh dilanggar

### P1 — Pengawasan yang lebih kuat, klaim yang tetap jujur

Setiap kontrol baru harus menambah sinyal **dan** batasnya. Menambah fullscreen
tidak boleh membuat copy berpindah dari "memperkuat bukti" menjadi "menjamin
kehujuran". Spec 2026-02-14 sudah menetapkan bentuk kalimat ini; Tier 1/2 hanya
mengisi celah yang kosong, tidak mengubahnya.

### P2 — Tidak ada sinyal yang otomatis menghukum

Sama seperti Prinsip P1 di spec 2026-09-25: kejadian integritas **tidak pernah**
mengurangi skor, reputasi, kelulusan, atau-esteem. Sinyal baru (`keluar
fullscreen`, `paste_massal`, `wajah_hilang`) tetap konteks. Satu-satunya
akibat yang boleh terjadi adalah **hold modul**, dan itu hanya lewat temuan yang
`dikokohkan` staf yang berbeda dari pengaju.

### P3 — Setiap sumber punya label kebocorannya sendiri

Sinyal berasal dari empat sumber dengan empat tingkat keyakinan berbeda. Laporan
**wajib** menampilkan asal-usulnya, karena "keluar tab 3×" (dilaporkan browser)
dan "3 wajah terdeteksi" (diturunkan model ML) bukan klaim yang setara:

| Sumber | Contoh sinyal | Batas yang wajib ditulis |
|---|---|---|
| Browser (self-report) | `pindah_tab`, `paste`, `keluar_fullscreen` | Bisa dihentikan peserta; tidak melihat tab lain |
| Turunan kamera | `wajah_tidak_terdeteksi`, `wajah_kedua` | Model bisa salah; tidak mengidentifikasi orang |
| Sinyal luar | `seb_aktif` (SEB) | Hanya terdeteksi bila ujian benar-benar berjalan di SEB |
| Turunan server | `paste_tanpa_mengetik`, `kedaluwarsa` | Hanya menghitung yang tercatat |

### P4 — Sinyal baru harus punya label backward-compatible

Menambah nilai enum (`aturan_pengawasan` baru) atau jenis kejadian baru tidak boleh
membuat record lama **tidak terbaca sebagai record yang memenuhi syarat**.
`versi_skema` sudah ada di toko performa; untuk `learning_events` yang dipakai
adalah `JENIS_KEJADIAN_SAH` yang dibaca: jenis yang dihapus harus tetap
diklasifikasikan (atau diabaikan eksplisit), bukan dianggap `kejadian` default.

### P5 — Kamera adalah keputusan produk, bukan default

Kamera merekam wajah orang. Itu data pribadi di bawah UU PDP, dan materinya
menuntut persetujuan terpisah dari "Mulai sesi". Maka:

- `aturan_pengawasan` baru **tidak pernah** aktif secara default.
- Peserta yang menolak kamera tidak kehilangan akses belajar; ia hanya tidak
  mendapat jalur virtual.
- Penolakan dicatat sebagai `kamera_gagal` dengan penyebab `produk`/`peramban`,
  bukan sebagai kegagalan peserta.

## Sinyal baru (kontrak data)

### Lapisan 1 — browser (tanpa izin, tanpa media)

| `jenis` baru | Klasifikasi | `payloadRedacted` | Kapan |
|---|---|---|---|
| `keluar_fullscreen` | `kejadian` | `{ jumlah_keluar }` | `fullscreenchange` saat bukan `fullscreenElement` |
| `paste_massal` | `kejadian` | `{ panjang, sejak_mengetik_detik }` | `paste` dengan `panjang ≥ 200` |
| `pintasan_terlarang` | `kejadian` | `{ kombinasi }` | `keydown` Ctrl/Cmd/Alt + `[cvxps]` |
| `salin_terlarang` | `kejadian` | `{ panjang }` | `copy`/`cut` pada area materi |

`sejak_mengetik_detik` adalah jeda sejak ketikan terakhir sebelum paste. Pola
"paste 400 karakter tanpa mengetik selama 30 detik" adalah sinyal joki/AI paling
andal yang tersedia di browser (Forasoft, 2026) — dan ia **diturunkan server**,
jadi bukan klaim self-report murni.

### Lapisan 2 — kamera (opsional, butuh persetujuan)

| `jenis` baru | Klasifikasi | `payloadRedacted` | Keterangan |
|---|---|---|---|
| `wajah_tidak_terdeteksi` | `celah` | `{ durasi_detik }` | Dipicu setelah `≥ 10 detik` tanpa wajah |
| `wajah_kedua` | `kejadian` | `{ jumlah }` | Deteksi multi-face |

Deteksi **suara kedua ditunda**, bukan dikecualikan karena tidak bisa diukur:
menentukan "ada orang lain yang bicara" butuh speaker diarization, yang tidak ada
di browser tanpa model besar. Ambang volume sederhana hanya bisa membedakan
"suara" dari "hening" — dan melaporkan "suara terdeteksi" sebagai "ada orang lain"
akan menuduh berdasarkan angka yang tidak mengukurnya. Mengerjakannya dengan
benar adalah proyek tersendiri.

Deteksi wajah memakai **MediaPipe Face Detection** via `@mediapipe/tasks-vision` —
client-side, model diunduh sekali, tidak ada video yang pernah meninggalkan
perangkat. Ini pilihan yang sengaja: server-side CV butuh unggahan video dan
kebijakan retensi yang belum ada (T5). Deteksi **objek** (HP/buku) ditunda: modelnya
jauh lebih besar dan akurasinya rendah pada pencahayaan rumah, jadi menambah
biaya unduhan tanpa menambah keyakinan yang sebanding.

## Aturan pengawasan: nilai ketiga

```ts
export type AturanPengawasan = "opsional" | "wajib" | "wajib_kamera";
```

| Nilai | Sesi | Kamera | Label |
|---|---|---|---|
| `opsional` | tidak | tidak | "Sesi terverifikasi opsional" |
| `wajib` | ya | tidak | "Wajib sesi terverifikasi (kamera opsional)" |
| `wajib_kamera` | ya | **wajib** | "Wajib sesi terverifikasi dengan kamera" |

### Kamera tidak menambah nilai `completion_path`

Nilai `completion_path` **tidak** menjadi tiga. Kolom itu punya CHECK constraint
database (`schema.ts:473` — `in ('terverifikasi', 'informal')`) yang dipakai tiga
tabel, jadi menambah nilai berarti migrasi yang menyentuh setiap pembaca
(`normalisasiJalur`, `hitungCompletionPath`, `LABEL_SUMBER`, laporan). Risiko dan
luasannya tidak sepadan dengan manfaat yang nyata.

Sebagai gantinya, jalur kamera **diturunkan**, bukan disimpan — mengikuti aturan
repo yang sudah berjalan: *derive, never hardcode*. `wajib_kamera` hanya menuntut
kamera untuk mendapat jalur `terverifikasi`; modul yang diselesaikan tanpa kamera
pada course itu **tidak menghasilkan** completion terverifikasi sama sekali, dan
laporan menandai jalurnya sebagai `terverifikasi` atau `terverifikasi_kamera`
dari run yang mendasarinya (ada/tidaknya `kamera_mulai` di kejadian run itu).

Konsekuensinya harus dinyatakan di laporan: *jalur `terverifikasi` pada course
`wajib_kamera` berarti kamera hidup; pada course `wajib` biasa ia berarti kamera
mungkin tidak pernah menyala.*

**Status implementasi (2026-09-27):** konsekuensi di atas sudah ditegakkan.
`completion_path` tetap dua nilai; label jalur diturunkan di
`src/lib/performa/jalur-selesai.ts` (`jalurDariBukti` + `LABEL_JALUR`).
Gerbang `wajib_kamera` ditegakkan server di dua jalur: `selesaikanMateriAction`
dan `selesaikanModulKuisVerified`, keduanya membaca `kamera_mulai` dari run —
bukan dari klaim klien.

**Pelusan spec ini.** Paragraf di atas menyebut label `terverifikasi` atau
`terverifikasi_kamera` "dari run yang mendasarinya", dan itu belum cukup lengkap.
`module_progress.evidence_id` punya dua writer: jalur materi menyimpannya sebagai
`learning_runs.id`, jalur kuis sebagai `quiz_attempts.id` (`schema.ts:524-526`).
Penyelesaian kuis karena itu **tidak punya run yang bisa ditelusuri**, dan label
untuknya adalah `terverifikasi_tanpa_bukti_kamera` — "jalur terverifikasi, kamera
tidak bisa ditelusuri ke run". Itu **bukan** nilai `completion_path` keempat:
kolomnya tetap dua nilai, dan label turunan boleh lebih dari dua.

Tiga hal yang **sengaja tidak** dikerjakan dan tidak boleh dianggap terlewat:

1. `performa-belajar.tsx` (daftar peserta) tetap menampilkan
   `LABEL_SUMBER.terverifikasi` yang generik. `BarisPembelajaran` hanya punya
   **hitungan**, bukan daftar modul, jadi tidak ada run yang bisa dipetakan
   tanpa mengubah bentuk datanya lebih dulu.
2. `SumberPenyelesaian` di `src/lib/performa/store.ts` tidak mendapat nilai
   baru. Tipe itu adalah bentuk data **yang tersimpan** (`.data/performa`), bukan
   bentuk tampilan; menambah nilainya mengubah kontrak JSON yang sudah punya
   pembaca.
3. `evidence_id` tidak diubah, dan tidak ada kolom kedua untuk run kuis.
   Menambahkannya berarti migrasi; label `terverifikasi_tanpa_bukti_kamera`
   menyatakan batas bukti apa adanya, yang justru lebih jujur daripada menyimpan
   run tebakan.

## Batas yang harus tertulis di UI

Setiap permukaan yang menampilkan sinyal baru memuat baris ini:

1. Kejadian dilaporkan peramban peserta dan bisa dihentikan sepihak. **Sesi bersih
   tidak membuktikan apa pun.**
2. Kamera, ketika aktif, adalah model deteksi — bisa salah, dan tidak
   mengidentifikasi siapa pun.
3. Deteksi wajah/objek berjalan di perangkat peserta; yang terkirim adalah
   **angka**, bukan gambar, kecuali retensi gambar diaktifkan secara eksplisit.
4. Tidak ada kontrol yang bisa memastikan bantuan AI, joki, atau perangkat kedua
   tidak ada. Yang dijamin adalah: *catatan yang bisa ditinjau manusia* dan
   *bukti yang tidak bisa dimanipulasi di server*.
5. Foto dan snapshot adalah klaim, bukan bukti.

## Retensi (keputusan produk, belum ditetapkan — jangan akui sudah)

- `learning_runs` / `learning_events`: **tanpa batas**, seperti sekarang.
- Frame kamera / snapshot layar: **belum dikirim ke server sama sekali** pada
  pass ini. Server hanya menerima angka turunan (jumlah wajah, durasi). Kalau
 ditentukan retensi gambar, itu task terpisah dengan keputusan produk tersendiri.

## Cakupan tiap lapis

| Lapisan | Masuk | Keluar |
|---|---|---|
| 1 — browser | **ya, pass ini** | — |
| 2 — kamera | **ya, pass ini** (face, bukan suara/objek) | deteksi suara & objek (butuh model besar) |
| 3 — SEB | **ya, pass ini hanya pembacaan** header `X-SafeExamBrowser` | membangun aplikasinya |
| 4 — OS/network | **tidak** | di luar repo, di luar jangkauan |

## Non-tujuan

- **Kirim** frame kamera ke server (lihat Retensi).
- Biometri yang mengidentifikasi orang (face **recognition** ≠ face **detection**).
- Analisis tikupan kata AI (butuh model bahasa besar, tidak ada di repo).
- Deteksi perangkat kedua (butuh Tier 4).
- Membuat skor surveillance tunggal yang menghukum.
- Mengganti sponsor `juri`/review manusia dengan model.

## Kriteria keberhasilan

- `npm run check` dan `npm run build` hijau.
- Sinyal Tier 1 tercatat tanpa izin kamera, tanpa media, dan tanpa menyentuh
  `node:fs` di bundel klien.
- Mutasi yang harus merah: menghapus `sejak_mengetik_detik` dari payload
  `paste_massal`; menghapus cabang `fullscreenchange`; menghapus gate
  `wajib_kamera` di `putuskanAkses`; menghapus pemanggilan `getUserMedia`; menghapus
  pemetaan `wajah_kedua` di `klasifikasiKejadian`.
- Sesi lengkap dengan kamera ditolak: `wajib_kamera` tanpa persetujuan →
  `perlu_kamera`, dan `selesaikanMateriAction` menolak.
- Laporan menunjukkan sumber tiap sinyal (P3) dan tidak memuat kata vonis.
- Peserta menolak kamera pada `wajib` (bukan `wajib_kamera`) tetap bisa
  menyelesaikan modul lewat `terverifikasi`.
