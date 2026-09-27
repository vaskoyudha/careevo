# Seed konten kursus — kontrak untuk penulis konten

Direktori ini mengisi **seluruh katalog kursus** Careevo dengan isi modul nyata
(halaman berformat + kuis) sehingga setiap kursus di `/belajar` bisa dibuka dan
dikerjakan — bukan sekadar 5 modul turunan kosong.

## Cara menjalankan

```bash
npx tsx scripts/seed/konten/index.ts          # semai/perbarui seluruh katalog
npx tsx scripts/seed/konten/verifikasi-kode.mts   # jalankan semua blok kode C++
```

Idempoten: jalankan berkali-kali aman. Kursus dicocokkan dari **slug**, modul
dari **judul**, halaman dari **judul**, kuis dari **judul yang terpasang di
modul**. Tidak ada yang dihapus.

## Berkas

| Berkas | Isi |
|---|---|
| `tipen.ts` | Tipe + pembantu blok (`p`, `h2`, `h3`, `li`, `q`, `kode`) |
| `engine.ts` | Upsert idempoten ke store |
| `index.ts` | Merangkai semua berkas konten |
| `intikursus.ts` | `crs-1`…`crs-8` (kursus inti Careevo) |
| `pasar-*.ts` | 18 kursus pasar (sudah punya halaman → **hanya tambah kuis**) |
| `verifikasi.ts` | `verifikasi-blok-kode-cpp` |

## Kontrak penulisan

```ts
import { h2, h3, kode, li, p, q, type KursusSeed } from "./tipen";

export const KURSUS_X: KursusSeed[] = [
  {
    slug: "slug-yang-sudah-ada",          // WAJIB sama dengan slug di data/courses.json
    judul: "Judul kursus",
    deskripsi: "…",
    tags: ["tag1", "tag2"],
    level: "dasar" | "menengah" | "lanjut",
    track: "web-dev" | "data" | "game-dev" | "cyber-sec",
    modul: [
      {
        judul: "Judul modul — WAJIB persis sama dengan judul modul yang sudah ada",
        ringkasan: "…",
        durasi_min: 60,
        // OPSIONAL. Untuk kursus pasar: JANGAN tulis `halaman` — halaman kurasi
        // yang sudah ada harus dibiarkan utuh.
        halaman: [
          { judul: "Judul halaman", blok: [h2("…"), p("…"), li("…", "…"), q("…")] },
        ],
        // WAJIB untuk misi ini: satu kuis per modul.
        kuis: {
          judul: "Kuis: …",
          nilai_lulus: 70,
          soal: [
            { pertanyaan: "…", pilihan: ["A", "B", "C", "D"], jawaban_benar: 1 },
          ],
        },
      },
    ],
  },
];
```

## Aturan yang tidak boleh dilanggar

1. **Bahasa Indonesia** untuk seluruh prosa dan soal (UI repo ini berbahasa `id`).
2. **Modul dicocokkan dari judul.** Untuk kursus pasar, judul modul di seed
   harus **persis** sama dengan yang ada di `data/courses.json` — kalau tidak,
   engine akan membuat modul baru alih-alih melengkapi yang lama.
3. **Kursus pasar: jangan tulis `halaman`.** Cukup `kuis`. Halaman kurasi yang
   sudah ada (4 modul × 1–2 halaman) harus dibiarkan.
4. **Kuis: 3–5 soal per modul.** Setiap soal: 4 pilihan, `jawaban_benar` =
   indeks (0-based) pilihan yang benar, **tanpa pilihan duplikat**.
5. **Blok kode hanya untuk C++** (`bahasa: "cpp"`) dan **hanya bila topiknya
   relevan** (algoritma, struktur data, dasar pemrograman). Bahasa lain
   (JS/TS/Python/Go/…): tulis sebagai blok kode **tanpa** `dapatDijalankan`
   (hanya dibaca), atau lebih baik sebagai `p`/`li`.
6. **Blok kode yang bisa dijalankan WAJIB punya `outputHarapan` yang benar.**
   Output diverifikasi lewat runner sungguhan (`verifikasi-kode.mts`). Kalau
   tidak yakin, set `dapatDijalankan: false`.
7. **Jangan mengarang fakta teknis.** Materi harus benar dan spesifik (angka,
   nama API, perilaku nyata), bukan kata-kata kosong.
8. **Panjang halaman wajar**: 3–8 blok per halaman, 1–3 halaman per modul untuk
   kursus inti. Jangan menulis satu halaman 50 blok.

## Blok yang tersedia

- `p(teks)` — paragraf
- `h2(teks)` / `h3(teks)` — heading (h2 jadi jangkar daftar isi)
- `li(...butir)` — daftar
- `q(teks)` — kutipan (untuk penegasan)
- `kode({ kode, dapatDijalankan?, stdin?, outputHarapan? })` — blok kode C++
