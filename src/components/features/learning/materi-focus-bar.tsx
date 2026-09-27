"use client";

import type { RefObject } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  RiCheckLine,
  RiErrorWarningLine,
  RiLayoutRight2Fill,
  RiLayoutRight2Line,
  RiLoader4Line,
  RiSparkling2Fill,
} from "@remixicon/react";
import { cn } from "@/lib/utils";
import type { KeputusanAkses } from "@/lib/learning/akses";
import type { ModulKursus } from "@/lib/courses/kurikulum";
import { ReaderSilabusLeading } from "./reader-silabus";

/**
 * Bar fokus reader — satu baris, `sticky top-0`.
 *
 * Berada di `top-0`, **bukan** di bawah navbar mengambang: reader tidak memakai
 * `.chrome` sama sekali. Karena itu bar ini tidak butuh offset `--chrome-h`, dan
 * tidak boleh memperkenalkan `-mt-[Npx]` (`chrome-offset.test.ts` menyapu semua
 * `.tsx` dan akan gagal).
 *
 * Ujung kirinya adalah **pemicu silabus + progres** (`ReaderSilabusLeading`),
 * mengikuti referensi: ikon menu, lalu nama kursus dengan bit progres di
 * bawahnya. Itu permukaan "di mana saya, sisa berapa" milik reader, dan ia
 * hidup di bar karena bar inilah satu-satunya bagian layar yang selalu terlihat.
 *
 * Tombol tutor mengikuti `aksesTutor` — keputusan `boleh("bantuan_akademik")`,
 * jadi `aturan_bantuan` dihormati lewat satu mesin keputusan, bukan salinan
 * aturan. Saat `tanpa_ai` tombolnya tetap dirender nonaktif dengan alasan dari
 * `putuskanAkses`, mengikuti alasan yang sudah ditulis di `kursus-ai-panel.tsx`.
 *
 * `pesan` adalah penolakan **penyelesaian modul** dari server. Ia wajib tampil:
 * tanpa baris ini, "Tandai selesai" di kursus `wajib` tanpa sesi terverifikasi
 * tampak tidak melakukan apa pun, karena server menolaknya dengan
 * `PESAN_POLICY.wajib` yang tidak pernah terbaca. Pesannya dirender **apa
 * adanya** — ia datang dari mesin akses server, dan memparafrase copy gerbang di
 * klien adalah cara paling mudah membuat dua permukaan berbeda ucapan untuk
 * penolakan yang sama.
 *
 * Bar ini **tidak** memuat ajakan memulai sesi (`CourseSessionPrompt`); itu
 * duduk di kolom baca, tepat di atas kartu materi. `sticky` di sini bukan
 * detail: apa pun yang tinggal di bar ikut mengambang sepanjang modul, dan
 * kartu amber setinggi beberapa baris menutupi judul modul tepat saat peserta
 * membacanya. Lihat catatan render di bawah.
 */
export function MateriFocusBar({
  slug,
  kursusJudul,
  modulSemua,
  selesai,
  sudah,
  onTandai,
  pending,
  drawerBuka,
  onToggleDrawer,
  aksesTutor,
  pesan,
  silabusBuka,
  onToggleSilabus,
  tombolSilabusRef,
}: {
  slug: string;
  kursusJudul: string;
  /**
   * Seluruh kurikulum, untuk bit progres di kiri bar dan daftar panel silabus.
   *
   * Satu-satunya kurikulum yang dioper ke bar. Dulu ada prop `modul` (modul
   * aktif) di sampingnya, khusus untuk blok judul di tengah bar; blok itu sudah
   * dihapus — judul kursusnya diulang persis oleh pemicu silabus, dan nama
   * modul punya rumahnya sendiri di kolom baca — jadi prop-nya ikut hilang
   * ketimbang tinggal sebagai parameter mati yang membuat pembaca berikutnya
   * mengira bar masih merender judul modul.
   */
  modulSemua: ModulKursus[];
  /** Id modul yang sudah selesai; dari server, bukan dihitung di sini. */
  selesai: string[];
  sudah: boolean;
  onTandai: () => void;
  pending: boolean;
  drawerBuka: boolean;
  onToggleDrawer: () => void;
  /** Keputusan `putuskanAkses` untuk `bantuan_akademik`. */
  aksesTutor: KeputusanAkses;
  /** Penolakan penyelesaian dari server; `null`/`undefined` saat tidak ada. */
  pesan?: string | null;
  /**
   * Panel silabus setinggi layar sedang terbuka.
   *
   * Statusnya **milik shell**, bukan bar: panelnya `portal` ke `<body>` dan hidup
   * di luar bar, jadi ia tidak bisa menyimpan state-nya sendiri di sini. Bar hanya
   * memegang tombolnya dan melaporkan keadaan itu lewat `aria-expanded`.
   *
   * Opsional (default `false`) mengikuti pola `pesan`: test sibling yang
   * merender bar **sendirian**, tanpa shell, tidak perlu menyediakan state yang
   * bukan miliknya.
   */
  silabusBuka?: boolean;
  /** Buka/tutup panel silabus; di shell asli diisi setter state-nya. */
  onToggleSilabus?: () => void;
  /**
   * Ref tombol silabus — shell memakainya untuk mengembalikan fokus saat panel
   * ditutup. Tanpa itu fokus bisa tertinggal di dalam panel yang sudah tidak ada,
   * dan pembaca layar kehilangan tempatnya.
   */
  tombolSilabusRef?: RefObject<HTMLButtonElement | null>;
}) {
  const bolehTutor = aksesTutor.tipe === "bebas";

  return (
    <header className="reader-bar">
      <div className="flex w-full items-center gap-3 py-2.5">
        {/* Blok logo, paling kiri, dan **ia tautan keluarnya** — bukan hiasan.
            Bar ini tidak punya lagi tautan "← Silabus" bertuliskan teks: label
            itu satu-satunya teks navigasi di bar, dan yang dibaca peserta di
            sini adalah judul modulnya. Mark Careevo mengambil tempatnya di
            ujung kiri (blok merek paling kiri, seperti referensi), jadi jalan
            kembali ke halaman kursus tetap ada tanpa satu kata pun.

            `aria-label` wajib dan **tidak** opsional: di bawah `sm` kata
            "Careevo" disembunyikan CSS, jadi tanpa nama aksesibel tautan ini —
            satu-satunya jalan keluar dari reader — diumumkan sebagai "link"
            tanpa keterangan. Nama itu juga menyebut tujuannya, bukan mereknya:
            yang perlu didengar pengguna keyboard adalah "kembali ke halaman
            kursus", bukan "Careevo". */}
        <Link href={`/belajar/${slug}`} aria-label="Kembali ke halaman kursus" className="reader-brand">
          <Image
            src="/careevo-mark.png"
            alt=""
            width={256}
            height={235}
            aria-hidden="true"
            className="reader-brand-mark"
          />
          <span className="reader-brand-nama">Careevo</span>
        </Link>

        {/* Pemicu silabus + progres. Ia tetap di kiri, tepat setelah blok merek:
            yang dibaca di sini adalah "berapa modul lagi", dan bar ini
            satu-satunya bagian layar yang selalu terlihat. Panel yang
            dibukanya hidup di shell (`reader-silabus.tsx`) karena `portal` ke
            `<body>` tidak bisa jadi anak bar.

            Judul kursusnya ikut di sini (`reader-silabus-judul`), jadi bar tidak
            perlu blok judul kedua di tengah: blok itu mengulang judul kursus
            yang sama persis, dan yang benar-benar baru di dalamnya hanyalah
            nama modul. Nama modul sudah punya rumahnya sendiri di kolom baca
            (`MateriPane`, sebagai `<h2>` modulnya) — satu judul, satu tempat. */}
        <ReaderSilabusLeading
          kursusJudul={kursusJudul}
          modul={modulSemua}
          selesai={selesai}
          buka={silabusBuka ?? false}
          onToggle={onToggleSilabus}
          tombolRef={tombolSilabusRef}
        />

        {/* Ruang kosong yang menyerap lebar: mendorong tombol aksi ke kanan
            tanpa menambahkan apa pun ke bar. Tanpa ini, `justify-between` tidak
            punya apa pun untuk memisahkan dan tombolnya menempel ke pemicu
            silabus. */}
        <div className="min-w-0 flex-1" aria-hidden="true" />

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onToggleDrawer}
            disabled={!bolehTutor}
            aria-expanded={drawerBuka}
            aria-controls="drawer-tutor"
            aria-label={bolehTutor ? "Tutor AI" : aksesTutor.tipe === "ditolak" ? aksesTutor.pesan : "Tutor AI"}
            title={bolehTutor ? "Tutor AI" : aksesTutor.tipe === "ditolak" ? aksesTutor.pesan : undefined}
            className={cn(
              "inline-flex size-9 items-center justify-center rounded-lg border transition-colors",
              bolehTutor
                ? "cursor-pointer border-gray-300 text-gray-700 hover:bg-gray-50"
                : "cursor-not-allowed border-gray-200 text-gray-300",
            )}
          >
            {drawerBuka ? (
              <RiLayoutRight2Fill className="size-4" aria-hidden="true" />
            ) : (
              <RiLayoutRight2Line className="size-4" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            onClick={onTandai}
            disabled={pending}
            aria-pressed={sudah}
            className={cn(
              "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-[13px] font-semibold transition-colors disabled:opacity-60",
              sudah
                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
            )}
          >
            {pending ? (
              <RiLoader4Line className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <RiCheckLine className="size-3.5" aria-hidden="true" />
            )}
            {sudah ? "Selesai" : "Tandai selesai"}
          </button>
        </div>
      </div>

      {/* Ajakan memulai sesi **tidak** di bar ini, tapi di kolom baca di atas
          kartu materi (`materi-shell.tsx`).

          Alasannya bentuk, bukan isi: bar fokus `sticky`, jadi apa pun yang
          tinggal di dalamnya ikut mengambang sepanjang modul — dan kartu amber
          setinggi beberapa baris di sana menutupi judul modul tepat saat
          peserta sedang membacanya. Di kolom baca ia berada tepat di atas kartu
          yang harus dijawab, jadi posisinya sudah menjelaskan diri.

          Yang tetap di sini hanya dua baris **satu kalimat**: penolakan
          completion dari server dan alasan tutor ditolak. Keduanya menyertain
          aksi di bar itu sendiri, jadi harus terlihat di tempat tombolnya
          ditekan. */}
      {!bolehTutor && aksesTutor.tipe === "ditolak" ? (
        <p className="flex items-center gap-1.5 border-t border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-900 sm:px-5">
          <RiSparkling2Fill className="size-3 shrink-0" aria-hidden="true" />
          {aksesTutor.pesan}
        </p>
      ) : null}

      {/* Penolakan penyelesaian modul. Baris ini bentuknya sengaja sama dengan
          baris tutor di atas, dan keduanya boleh tampil bersamaan: "tutor
          ditolak" dan "penyelesaian ditolak" bukan keadaan yang saling
          meniadakan, jadi tidak ada presedensi buatan di sini. `items-start`
          karena pesan gerbang bisa panjang (`PESAN_POLICY.wajib` beberapa
          kalimat) dan ikon di tengah baris berbaris-baris terbaca seperti salah
          tempat. */}
      {pesan ? (
        <p
          role="status"
          className="flex items-start gap-1.5 border-t border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] leading-snug text-amber-900 sm:px-5"
        >
          <RiErrorWarningLine className="mt-px size-3 shrink-0" aria-hidden="true" />
          {pesan}
        </p>
      ) : null}
    </header>
  );
}
