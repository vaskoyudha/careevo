"use client";

import type { ReactNode } from "react";
import { DitheredHeroBackdrop } from "@/components/features/learning/dithered-hero-backdrop";

/**
 * Pita header bermedia dither — resep yang sama dengan header `/belajar`,
 * dipakai sebagai KEPALA KARTU, bukan sebagai hero satu halaman.
 *
 * Ini salinan ketiga dari resep lima lapis itu (`belajar-home.tsx` untuk hero
 * penuh, `kartu-rekomendasi-profil.tsx` untuk panel loker). Ia diangkat ke satu
 * komponen karena dua alasan yang keduanya sudah terjadi di repo ini:
 *
 *  1. **Crop dan veil adalah angka yang diukur, bukan selera.** Angka veil di
 *     bawah berasal dari pengukuran frame video di lebar band yang nyata
 *     (lihat catatan di masing-masing lapisan). Menyalinnya ke tempat ketiga
 *     membuat satu tempat bisa tertinggal saat angkanya disetel ulang — persis
 *     yang dicegah komentar token `--dash-card-*` di `globals.css` untuk kartu
 *     dashboard.
 *  2. **Pin 8px dan clip lokal itu satu paket.** Memindahkan media sedikit ke
 *     bawah (`-top-2 bottom-0`) berarti media 8px lebih tinggi dari pita, dan
 *     8px teratas itu harus benar-benar terpotong di bawah sudut membulat
 *     kontainer. `overflow: hidden` peramban TIDAK menjamin itu: ia memotong
 *     pada border-box tanpa mengikuti `border-radius` pada sebagian compositor,
 *     jadi stipple-nya terlihat menempel/menyembul di sudut. `overflow-clip` di
 *     dalam band ini yang menegaskannya secara lokal.
 *
 * **Konsekuensi yang harus dibawa pemakainya:** media ini terang, jadi teks di
 * atasnya harus tinta gelap (`#0a3d62`), bukan putih. Putih di atas field pucat
 * ~1.1:1 — angka yang sudah tercatat di banner AI `belajar-home.tsx`. Menahan
 * teks putih berarti menaruh scrim gelap penuh di atas media, dan itu dilarang
 * DESIGN.md ("Do not add a full-surface scrim or image opacity overlay").
 */
export function PitaHeaderDither({
  children,
  /** Tinggi kelas Tailwind, mis. `h-16`. Tinggi harus pasti: crop diukur. */
  className = "h-16",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      // `relative` untuk lapisan media, `overflow-clip` untuk memotong pin-nya,
      // dan `pt-4` supaya isi turun 16px seperti band lama (padding vertikal ada
      // di wrapper ini, bukan di elemen dengan radius kontainer).
      className={`relative isolate flex shrink-0 items-center overflow-clip pt-4 pr-4 ${className}`}
    >
      {/* Lapisan media, seluruhnya dekoratif. `absolute inset-0` + `-top-2`:
          media 8px lebih tinggi dari pita, jadi tepi atasnya tersembunyi dan
          stipple tidak lagi menempel di sudut membulat kontainer. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-2 bottom-0 select-none"
      >
        {/* Ground: gradien langit + dot grid sebagai fallback dither. Tanpa
            WebGL `DitheredHeroBackdrop` mengembalikan canvas transparan, jadi
            tanpa dua lapis ini pita jatuh ke polos dan efek bitnya hilang. */}
        <div className="absolute inset-0 bg-[linear-gradient(170deg,#8FC0F2_0%,#7DD3FC_20%,#BAE6FD_46%,#DDEEFE_76%,#F2F9FF_100%)]" />
        <div className="absolute inset-0 bg-[size:3px_3px] [background-image:radial-gradient(rgba(10,61,98,0.16)_1px,transparent_1px)]" />

        {/* Dither: Bayer ordered-dither + posterise, grid dikunci ke piksel
            canvas. Sumber dan parameter dither sama dengan header `/belajar`.

            `zoom={2.6}` / `focusY={0.8}` — inilah "geser ke bawah"-nya, dan
            angkanya dari pengukuran, bukan tebakan. Video 1440x560 punya dua
            area gelap: langit pekat di ~72% atas, dan kanopi gelap yang mulai
            di sekitar baris 460 (rata-rata L turun dari 0.81 ke 0.33).

            Veil adalah lapisan PUTIH rata di atas media, jadi ia tidak bisa
            menolong teks di atas piksel gelap — ia hanya menaikkan seluruh
            bidang sama rata, dan piksel tergelap tetap menentukan kontras.
            Karena itu yang harus benar lebih dulu adalah CROP-nya: jendela
            sumber harus berhenti SEBELUM baris 460 supaya tidak ada daun gelap
            di dalam frame sama sekali. `focusY={0.8}` pada `zoom={2.6}`
            menempatkan jendela di baris ~276-491 pada band 309px, dan yang
            TERLIHAT (setelah 8px pin dipotong) mulai sekitar baris 290 —
            di bawah langit pekat, di atas kanopi.

            Diukur pada empat frame berurutan, di enam geometri band (309-1312px
            lebar, 58-115px tinggi), dengan `levels={4}`/`ditherScale={2}` yang
            sama: piksel tergelap yang TERLIHAT di seluruh pita L=0.568-0.652,
            yaitu 6.81:1-7.56:1 untuk judul `#0a3d62` dan 8.81:1-9.78:1 untuk
            subtitle `#1e293b` — keduanya lolos AA dengan margin lega.

            Angka itu berlaku untuk tinggi pita 48-120px. Pita yang jauh lebih
            pendek mengubah tinggi gambar (lewat `max(lebar/1440, tinggi/560)`)
            dan karena itu menggeser jendelanya; kalau tinggi pita diubah,
            ukur ulang, jangan asumsikan. */}
        <DitheredHeroBackdrop
          videoSrc="/videos/hero-sterly.mp4"
          levels={4}
          ditherScale={2}
          zoom={2.6}
          focusY={0.8}
        />

        {/* Veil putih VERTIKAL, bukan halo radial dan bukan veil rata.

            Halo `bg-[radial-gradient(…)]` disalin dari hero halaman penuh pernah
            dipakai di sini dan salah: elips sepanjang itu tidak pernah habis di
            dalam kotak, jadi tepi gradiennya terbaca sebagai OVAL PUTIH yang
            ditumpuk di atas gambar.

            Alphanya naik monoton ke bawah (0.44 → 0.58 → 0.82) supaya
            penambahan tutupnya jatuh tepat di tempat piksel tergelap berada,
            dan stop dasarnya pekat untuk menutup baris terbawah pita. */}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.44)_0%,rgba(255,255,255,0.58)_40%,rgba(255,255,255,0.82)_100%)]" />

        {/* Fade batas bawah ke isi kartu. Ini satu-satunya scrim yang diizinkan
            DESIGN.md, dan di sini persis fungsinya: menyambung pita ke section
            berikutnya, bukan menutup media. */}
        <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white via-white/70 to-transparent" />
      </div>

      {/* Isi pita. `relative` wajib: lapisan media `absolute`, dan descendant
          berposisi menggambar setelah semua in-flow (CSS 2.1 Appendix E) —
          tanpa ini field-nya menimpa teksnya sendiri. */}
      <div className="relative flex w-full min-w-0 items-center justify-between gap-3">
        {children}
      </div>
    </div>
  );
}
