# Anti-Curang Course & Sesi Ujian — Design Doc

**Tanggal:** 2026-02-14
**Status:** disetujui untuk implementasi (rincian teknis di plan)

## Ringkasan

Fitur ini menambahkan **sesi terverifikasi** di ruang belajar Careevo. Pembuat
course (ahli) menentukan kegiatan wajib beserta syarat kelulusannya; peserta
menjalani sesi dengan aturan yang terlihat dan persetujuan pengawasan; server
menjadi satu-satunya penentu nilai, kelulusan, dan status integritas.

Tujuan utama: **tidak ada kelulusan atau bukti kompetensi terverifikasi kecuali
seluruh kegiatan wajib terpenuhi, dinilai server, dan lolos pemeriksaan yang
ditetapkan ahli.**

## Batas yang diakui (jangan dijanjikan lebih)

Kamera, deteksi pindah tab, dan pemeriksaan ekstensi **memperkuat bukti, bukan
menjamin kejujuran**. Website biasa tidak dapat:

- mengetahui tab/aplikasi tujuan peserta;
- membaca daftar ekstensi yang aktif tanpa ekstensi pendamping atau browser
  terkelola;
- memastikan bantuan orang lain atau perangkat kedua tidak ada;
- memverifikasi identitas pemilik akun dari posisi wajah.

Janji produk yang benar: *"Kelulusan berdasarkan rangkaian kegiatan dan bukti
kompetensi yang diverifikasi sesuai standar pembuat course."*

## Model ancaman & kontrol

| Ancaman | Kontrol |
|---|---|
| Kunci jawaban bocor lewat payload browser | Soal peserta dibentuk tanpa `jawaban_benar`; penilaian di server |
| Manipulasi nilai/kelulusan dari klien | Sesi ujian, ajuan jawaban, dan finalisasi divalidasi server |
| Melewati prasyarat lewat URL/permintaan langsung | Prasyarat diperiksa di setiap action/route |
| Mengerjakan di luar sesi terawasi | Aplikasi hanya mengizinkan pengerjaan saat sesi berjalan |
| Asesmen dikerjakan AI/pihak lain | Aturan bantuan eksplisit + checkpoint + pembelaan + review manusia |
| Klaim pengawasan palsu | Kejadian berkualitas dicatat; batas interpretasi ditampilkan |

## Konsep inti

1. **CourseRun** — satu rangkaian penyelesaian course oleh satu peserta, terikat
   ke `policy_version` saat dimulai.
2. **SessionProof (bukti sesi)** — token HMAC berisi `courseId`, `owner`,
   `policyVersion`, `issuedAt`, `attemptKey`. Hanya bukti sah yang membuka
   pengerjaan. Ini menegakkan "pengerjaan hanya di dalam sesi", bukan sekadar
   menampilkan panel pengawasan.
3. **Aturan bantuan** — `bebas | bertutor | tanpa_ai`. Menentukan langkah yang
   boleh dikerjakan tanpa bukti sesi dan apakah chatbot akademik diblokir.
4. **Aturan pengawasan** — `wajib | opsional`. `wajib` berarti pengerjaan
   memerlukan bukti sesi; `opsional` berarti boleh dilanjutkan tanpa bukti.
5. **Checkpoint pemahaman** — `mode: materi | kuis | proyek`; wajib
   `mode: materi`; `kuis`/`proyek` menautkan id lampiran yang sudah ada.
6. **Kejadian integritas** — pindah tab (`visibilitychange`), kehilangan fokus,
   kamera mulai/berhenti, celah pengawasan. Kejadian **tidak** otomatis
   menggagalkan dan tidak mengurangi reputasi.

## Perbedaan dari sistem lama

- Kuis latihan yang ada di `materi-view.tsx` tetap ada sebagai latihan. Sesi
  ujian baru memakai jalur terpisah: soal tanpa kunci + penilaian server.
- `hitungVts` tidak dipakai untuk menilai integritas asesmen baru; rumus VTS
  memberi poin untuk pengungkapan AI, sedangkan asesmen `tanpa_ai` melarangnya.
- Progres cookie (`ls_enroll`) tetap ada, tetapi **tidak** dapat menghasilkan
  kelulusan terverifikasi.
- Skor/reputasi lama (Jadwal 30 + Karya 40 + Validasi 30) tidak diubah di sini.
  Reputasi terverifikasi hanya menerima hasil dari sesi yang lulus pemeriksaan;
  pemetaannya di luar lingkup ini.

## Cakupan paket C (spec ini)

1. Tipe domain, migrasi, validasi, dan store course run (T1–T4).
2. Kamus aturan dan mesin keputusan akses kegiatan (T5).
3. Pemicu sesi + hook pengawasan + indikator (T6).
4. Aksi pengerjaan yang bergerak dari verifikasi klien ke verifikasi server
   (T7–T9).
5. Gerbang aturan course + endpoint kejadian (T10).
6. Pemeriksaan keamanan statis + smoke (T11).

Paket lanjutan (tidak diimplementasikan di plan ini): paket A (sesi ujian
pilihan ganda penuh), paket B (penilaian & kelulusan server), paket D
(ekstensi pendamping/browser terkelola), paket E (review & reputasi).

## Non-tujuan

- Sandbox eksekusi kode peserta.
- Eksekusi kamera/analisis wajah di produksi.
- Perubahan pada alur review challenge berbasis fixture.
- Menjadikan skor pengawasan sebagai hukuman otomatis.

## Kriteria keberhasilan

- Tidak ada `jawaban_benar` yang dikirim ke klien pada jalur ujian baru.
- Nilai, kelulusan, dan prasyarat diperiksa server; manipulasi klien gagal.
- Pengerjaan kegiatan berstatus `wajib` tidak dapat diselesaikan tanpa bukti
  sesi yang sah dan terikat versi kebijakan.
- Pindah tab, kamera terputus, atau koneksi hilang tercatat sebagai kejadian
  tanpa otomatis menggagalkan peserta.
- `npm run check` dan `npm run build` tetap hijau.
