"use client";

import type { RefObject } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Check, LayoutList, Loader2, PanelRightClose, PanelRightOpen, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { CourseSessionIndicator, CourseSessionPrompt } from "./course-session";
import type { KeputusanAkses } from "@/lib/learning/akses";
import type { ModulKursus } from "@/lib/courses/kurikulum";

/**
 * Bar fokus reader — satu baris, `sticky top-0`.
 *
 * Berada di `top-0`, **bukan** di bawah navbar mengambang: reader tidak memakai
 * `.chrome` sama sekali. Karena itu bar ini tidak butuh offset `--chrome-h`, dan
 * tidak boleh memperkenalkan `-mt-[Npx]` (`chrome-offset.test.ts` menyapu semua
 * `.tsx` dan akan gagal).
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
 */
export function MateriFocusBar({
  slug,
  kursusJudul,
  modul,
  sudah,
  onTandai,
  pending,
  drawerBuka,
  onToggleDrawer,
  aksesTutor,
  pesan,
  modulBuka,
  onToggleModul,
  tombolModulRef,
}: {
  slug: string;
  kursusJudul: string;
  modul: ModulKursus;
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
   * Panel "Daftar modul" (bawah `lg`) sedang terbuka.
   *
   * Statusnya **milik shell**, bukan bar: panelnya sendiri hidup di kolom flex
   * shell, di bawah bar, dan hanya di sana ia bisa menggantikan rail `lg` yang
   * tersembunyi. Bar hanya memegang tombolnya — tempat yang wajar, karena bar
   * sudah memiliki seluruh kendali per halaman (tutor, "Tandai selesai").
   *
   * Opsional (default `false`) mengikuti pola `pesan`: test sibling yang
   * merender bar **sendirian**, tanpa shell, tidak perlu menyediakan state yang
   * bukan miliknya.
   */
  modulBuka?: boolean;
  /** Buka/tutup panel; di shell asli diisi setter state-nya. */
  onToggleModul?: () => void;
  /**
   * Ref tombol modul — shell memakainya untuk mengembalikan fokus saat `Escape`
   * menutup panel. Tanpa itu fokus bisa tertinggal di dalam panel yang sudah
   * tidak ada, dan pembaca layar kehilangan tempatnya.
   */
  tombolModulRef?: RefObject<HTMLButtonElement | null>;
}) {
  const bolehTutor = aksesTutor.tipe === "bebas";

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 backdrop-blur-md">
      <div className="flex w-full items-center gap-3 px-3 py-2.5 sm:px-5">
        <Link
          href={`/belajar/${slug}`}
          // Nama aksesibel yang **tidak bergantung breakpoint**: di bawah `sm`
          // span labelnya `display: none` dan ikonnya `aria-hidden`, sehingga
          // tanpa `aria-label` ini satu-satunya jalan keluar dari reader
          // diumumkan sebagai "link" tanpa nama. Label visualnya tetap seperti
          // semula bagi pengguna awas.
          aria-label="Silabus"
          className="inline-flex shrink-0 items-center gap-1.5 text-[13px] text-gray-600 transition-colors hover:text-gray-900"
        >
          <ArrowLeft className="size-4" strokeWidth={1.8} aria-hidden="true" />
          <span className="hidden sm:inline">Silabus</span>
        </Link>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-gray-900">{kursusJudul}</p>
          <p className="truncate text-[11px] text-gray-500">{modul.judul}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* Panel "Daftar modul" (spec §3.1). Hanya di bawah `lg`: di `lg` ke
              atas rail `w-72` sudah tampil permanen sebagai kolom, jadi tombol
              ini tidak punya pekerjaan — dan `lg:hidden` di sini, bukan sebuah
              cabang render, supaya penambahan ini **tidak menyentuh** kolom
              desktop sama sekali.

              `aria-label` eksplisit karena label visualnya tidak ada: ikonnya
              `aria-hidden` dan tidak ada teks di sebelahnya, jadi tanpa ini
              tombol diumumkan sebagai "tombol" tanpa nama — satu-satunya jalan
              ke peta modul di ponsel, tanpa nama. `aria-controls` menunjuk
              panelnya (`id="panel-modul"`), tapi hanya saat terbuka: elemen
              `aria-controls` yang menunjuk id tidak ada melanggar ARIA, dan
              panelnya sengaja tidak dirender saat tertutup. */}
          <button
            type="button"
            ref={tombolModulRef}
            onClick={onToggleModul}
            aria-expanded={modulBuka ?? false}
            aria-controls={modulBuka ? "panel-modul" : undefined}
            aria-label="Daftar modul"
            title="Daftar modul"
            className="inline-flex size-9 cursor-pointer items-center justify-center rounded-lg border border-gray-300 text-gray-700 transition-colors hover:bg-gray-50 lg:hidden"
          >
            <LayoutList className="size-4" strokeWidth={1.9} aria-hidden="true" />
          </button>

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
              <PanelRightClose className="size-4" strokeWidth={1.9} aria-hidden="true" />
            ) : (
              <PanelRightOpen className="size-4" strokeWidth={1.9} aria-hidden="true" />
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
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Check className="size-3.5" strokeWidth={2.4} aria-hidden="true" />
            )}
            {sudah ? "Selesai" : "Tandai selesai"}
          </button>
        </div>
      </div>

      {/* Ajakan/indikator sesi hidup di bar yang sama supaya peserta selalu punya
          satu titik masuk untuk memulai sesi — termasuk di kursus yang modulnya
          tidak punya lampiran, di mana `CourseSessionGate` tidak pernah tampil. */}
      <div className="px-3 pb-2.5 sm:px-5">
        <CourseSessionPrompt />
        <CourseSessionIndicator />
      </div>

      {!bolehTutor && aksesTutor.tipe === "ditolak" ? (
        <p className="flex items-center gap-1.5 border-t border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-900 sm:px-5">
          <Sparkles className="size-3 shrink-0" aria-hidden="true" />
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
          <AlertTriangle className="mt-px size-3 shrink-0" aria-hidden="true" />
          {pesan}
        </p>
      ) : null}
    </header>
  );
}
