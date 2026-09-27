"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { RiSparkling2Fill } from "@remixicon/react";
import { cn } from "@/lib/utils";
import type { ModulKursus } from "@/lib/courses/kurikulum";

/**
 * Bar kaki reader — "sebelumnya | AI Mastery | selanjutnya".
 *
 * Tiga tombol dalam satu baris, dengan pintu AI Mastery di tengah. Susunannya
 * mengikuti kebiasaan pembaca: navigasi antar-modul di dua ujung, dan satu aksi
 * yang selalu tersedia tepat di tengah, tempat mata berhenti.
 *
 * ## Kenapa di bawah, bukan di bar atas
 *
 * Bar fokus di atas sudah memuat pemicu silabus, merek, dan tombol penyelesaian.
 * Menambah dua tombol navigasi di sana membuat barisnya penuh dan judul kursusnya
 * yang pertama mengalah — persis hal yang baru saja diperbaiki. Bar bawah juga
 * tempat yang benar secara arti: "selanjutnya" dibaca **setelah** menuntaskan
 * modul, jadi ia harus berada di ujung bawah kolom baca.
 *
 * ## Kenapa tidak ada sayap
 *
 * Bar atas memakai sayap karena ia tepi **atas** halaman: dua fillet di sudut
 * atas menyambung siluetnya ke sisi layar. Bar bawah adalah tepi **bawah**, dan
 * sayap yang sama di sana akan menggantung di atas tepi viewport tanpa apa pun
 * untuk disambung — ia akan terbaca sebagai hiasan yang salah tempat. Yang
 * dipakai hanya bahasa visualnya: kapsul putih, batas 1px `--wing-edge`, dan
 * sudut membulat.
 *
 * ## Kenapa ujungnya nonaktif, bukan menghilang
 *
 * Modul pertama tidak punya "sebelumnya" dan modul terakhir tidak punya
 * "selanjutnya". Tombol yang **hilang** membuat dua tombol lain melompat ke
 * posisi baru saat berpindah modul — tombol "selanjutnya" yang tiba-tiba pindah
 * tempat sulit diklik. Karena itu tombolnya tetap dirender dengan `disabled` dan
 * `aria-disabled`, dan `aria-label`-nya menyebut sebabnya supaya pembaca layar
 * tidak mengumumkan tombol mati tanpa keterangan.
 */
export function MateriFootBar({
  slug,
  modulSemua,
  modulAktif,
  drawerBuka,
  onToggleDrawer,
  bolehTutor,
  alasanTutor,
}: {
  slug: string;
  modulSemua: ModulKursus[];
  /** Id modul yang sedang dibuka; dasar "sebelumnya"/"selanjutnya". */
  modulAktif: string;
  drawerBuka: boolean;
  onToggleDrawer: () => void;
  /** Keputusan `putuskanAkses("bantuan_akademik")` — sama dengan tombol di bar atas. */
  bolehTutor: boolean;
  /** Alasan dari `putuskanAkses` saat `bolehTutor` false; apa adanya. */
  alasanTutor?: string;
}) {
  const index = modulSemua.findIndex((m) => m.id === modulAktif);
  // `-1` (id basi) diperlakukan sebagai modul pertama: tidak ada "sebelumnya",
  // dan "selanjutnya" menunjuk modul kedua — perilaku yang sama dengan shell yang
  // jatuh ke `modul[0]` untuk id basi.
  const posisi = index < 0 ? 0 : index;
  const sebelum = posisi > 0 ? modulSemua[posisi - 1] : null;
  const sesudah = posisi < modulSemua.length - 1 ? modulSemua[posisi + 1] : null;

  /**
   * Tombol-tombol di bar ini memakai **kelas navbar yang sama**, bukan meniru
   * tampilannya: `chrome-btn` + salah satu variannya. Primer = `chrome-btn-brand`
   * (persis `DashboardButton` di navbar dan tombol "Daftar"), sekunder =
   * `chrome-btn-white` (pasangan `chrome-btn-brand` yang sudah dipakai di
   * `kartu-detail-loker.tsx`).
   *
   * Sebelum ini kelasnya dikarang sendiri (`rounded-xl px-3 text-[13px]`), dan
   * itulah kenapa tombolnya tidak pernah benar-benar sama dengan tombol navbar
   * meski warnanya sudah disamakan: `chrome-btn` membawa sendiri tingginya,
   * radius `--radius`, bayangan berlapis, `transform` saat hover/active, dan
   * transisi 200ms. Menyalin lima properti warnanya tidak menyalin satu pun dari
   * itu.
   *
   * **Kenapa `chrome-btn-white`, bukan `chrome-btn-ghost`.** Ghost adalah kaca
   * tembus cahaya (`rgba(255,255,255,0.72)` + batas putih 0.75) yang dirancang
   * untuk navbar kaca di atas foto; di atas bar putih pekat ini ia terukur
   * `background: none` dengan batas putih — praktis tidak terlihat, sehingga
   * tombolnya kembali terbaca sebagai teks polos tanpa permukaan. `chrome-btn-white`
   * punya batas `#d4d4d4` dan gradien lembut, jadi permukaannya tetap terbaca di
   * atas putih. Warna teks dan gradien primernya sama persis dengan Dashboard.
   *
   * `!h-11` menaikkan tinggi 40px bawaan `chrome-btn` ke lantai sentuh 44px yang
   * diwajibkan DESIGN.md. `!min-w-11` adalah pasangannya yang mudah terlupa: di
   * bawah 641px kata "Sebelumnya"/"Selanjutnya" disembunyikan, sehingga tombolnya
   * tinggal chevron 16px dan lebarnya jatuh di bawah lantai yang sama, padahal di
   * ponsel kedua tombol inilah satu-satunya jalan berpindah modul.
   *
   * Padding dan `font-size` **tidak** dipaksa: `chrome-btn-brand`/`-white`
   * membawa `13.5px` dan padding optisnya sendiri (`0 1.35rem 0 1rem`), dan
   * memaksanya ke angka karangan justru mengembalikan ketidakcocokan yang sedang
   * diperbaiki. `chrome-btn` lebarnya `auto`, jadi bar `max-content` tetap merapat.
   */
  const kelasNav = "chrome-btn !h-11 !min-w-11 shrink-0 gap-1.5";
  const kelasSekunder = cn(kelasNav, "chrome-btn-white");
  const kelasPrimer = cn(kelasNav, "chrome-btn-brand");
  /** Nonaktif: diredupkan, tanpa kursor, dan tanpa lift saat hover. */
  const kelasMati = "!opacity-45 cursor-not-allowed pointer-events-none shadow-none";

  return (
    <footer className="reader-foot-bar">
      <div className="reader-foot-bar-inner">
        {sebelum ? (
          <Link
            href={`/belajar/${slug}/materi/${sebelum.id}`}
            /* Nama aksesibel menyebut **judul** modulnya: "Sebelumnya" saja
               tidak memberi tahu ke mana, dan judulnya sudah terpotong di layar
               sempit. */
            aria-label={`Sebelumnya: ${sebelum.judul}`}
            className={kelasSekunder}
          >
            <ChevronLeft className="size-4 shrink-0" aria-hidden="true" />
            <span className="reader-foot-teks truncate">Sebelumnya</span>
          </Link>
        ) : (
          <button
            type="button"
            disabled
            aria-disabled="true"
            title="Ini modul pertama"
            className={cn(kelasSekunder, kelasMati)}
          >
            <ChevronLeft className="size-4 shrink-0" aria-hidden="true" />
            <span className="reader-foot-teks truncate">Sebelumnya</span>
            <span className="sr-only"> — ini modul pertama</span>
          </button>
        )}

        {/* Pintu AI Mastery: membuka drawer tutor yang sudah hidup di reader
            (iframe AI Mastery, rute `/embed/chat`), bukan pindah halaman —
            peserta tidak kehilangan posisi bacanya. Karena itu `aria-expanded`
            sejalan dengan drawer-nya, sama seperti tombol tutor di bar atas, dan
            `aria-controls` menunjuk `<aside id="drawer-tutor">` yang sama.

            Tombol ini **sekunder**, bukan primer: gradien merek di bar ini
            dipegang tombol maju ("Selanjutnya"), satu-satunya aksi yang
            memindahkan peserta ke depan — pola yang sama dengan navbar, yang
            hanya punya satu CTA berisi gradien. */}
        <button
          type="button"
          onClick={onToggleDrawer}
          disabled={!bolehTutor}
          aria-expanded={drawerBuka}
          aria-controls="drawer-tutor"
          aria-label={
            bolehTutor ? "AI Mastery" : (alasanTutor ?? "AI Mastery tidak tersedia untuk kursus ini")
          }
          title={bolehTutor ? "AI Mastery" : alasanTutor}
          className={cn(
            kelasSekunder,
            drawerBuka && "ring-2 ring-[#0056D2]/40 border-[#0056D2]",
            !bolehTutor && kelasMati,
          )}
        >
          <RiSparkling2Fill className="size-4 shrink-0" aria-hidden="true" />
          <span>AI Mastery</span>
        </button>

        {sesudah ? (
          <Link
            href={`/belajar/${slug}/materi/${sesudah.id}`}
            aria-label={`Selanjutnya: ${sesudah.judul}`}
            className={kelasPrimer}
          >
            <span className="reader-foot-teks truncate">Selanjutnya</span>
            <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
          </Link>
        ) : (
          <button
            type="button"
            disabled
            aria-disabled="true"
            title="Ini modul terakhir"
            className={cn(kelasPrimer, kelasMati)}
          >
            <span className="reader-foot-teks truncate">Selanjutnya</span>
            <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
            <span className="sr-only"> — ini modul terakhir</span>
          </button>
        )}
      </div>
    </footer>
  );
}
