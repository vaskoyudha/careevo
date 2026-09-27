"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Drawer tutor AI di sisi kanan reader.
 *
 * Diadaptasi dari "reading companion" DeepTutor
 * (`features/sijago/components/reading/workspace/ReadingWorkspace.tsx`):
 * kolom kanan ter-dock yang bisa di-resize di `xl`, dan **sheet** di atas
 * dokumen dengan scrim di bawahnya. Yang diambil adalah mekanismenya — bukan
 * chat-nya: isi drawer adalah aplikasi AI Mastery lewat rute chromeless
 * `/embed/chat`, jadi tidak ada chat kedua di Careevo.
 *
 * ## Kenapa tidak pernah di-unmount
 *
 * DeepTutor memakai `companionOpen && <ReadingCompanion/>` — ia membongkar
 * panelnya saat ditutup, dan itu benar di sana karena `ChatRuntimeProvider` di
 * atasnya memegang state percakapan. Di sini tidak ada lapisan itu: transkrip
 * dan WebSocket hidup **di dalam** iframe. Melepas iframe memuat ulang dokumen
 * dan memutus giliran yang sedang berjalan. Karena itu drawer selalu dirender
 * dan hanya disembunyikan dengan CSS.
 *
 * ## `boleh: false` tidak memuat iframe
 *
 * Kebijakan `tanpa_ai` harus berarti aplikasi tutor tidak pernah dimuat, bukan
 * hanya disembunyikan. Karena itu `src` tidak diberikan sama sekali saat
 * `boleh` false — frame yang dimuat lalu ditutup tetap sudah memanggil backend.
 */

/** Lebar default drawer; sama dengan lebar tetap DeepTutor sebelum bisa di-resize. */
const LEBAR_BAWAAN = 400;
const LEBAR_MIN = 300;
const LEBAR_MAKS = 640;
const KUNCI_SIMPAN = "careevo.reader.tutorWidth";

export function TutorDrawer({
  src,
  buka,
  onTutup,
  boleh,
}: {
  /** URL rute embed AI Mastery, sudah dihitung server. */
  src: string;
  buka: boolean;
  onTutup: () => void;
  /** `false` = kebijakan melarang; iframe tidak dimuat sama sekali. */
  boleh: boolean;
}) {
  /**
   * Lebar drawer, disimpan di `localStorage`.
   *
   * Lazy-init dan dibaca hanya di klien: nilai ini tidak pernah masuk markup
   * server, jadi tidak ada ketidakcocokan hidrasi yang perlu dijaga. Di server
   * `window` tidak ada, jadi lebar bawaannya yang dipakai.
   */
  const [lebar, setLebar] = useState(() => {
    if (typeof window === "undefined") return LEBAR_BAWAAN;
    try {
      const tersimpan = Number(window.localStorage.getItem(KUNCI_SIMPAN));
      return Number.isFinite(tersimpan) && tersimpan >= LEBAR_MIN && tersimpan <= LEBAR_MAKS
        ? tersimpan
        : LEBAR_BAWAAN;
    } catch {
      // Penyimpanan yang diblokir cukup kembali ke default; bukan alasan gagal.
      return LEBAR_BAWAAN;
    }
  });
  const mulaiRef = useRef<{ x: number; lebar: number } | null>(null);

  /**
   * `Escape` menutup drawer — pola yang sama dengan mode belajar DeepTutor.
   *
   * Hanya terpasang saat drawer terbuka, dan hanya menutup drawer (bukan
   * menghentikan sesi belajar): peserta yang menekan Escape ingin kembali ke
   * materi, bukan mengakhiri sesinya.
   */
  useEffect(() => {
    if (!buka) return;
    const padaTombol = (e: KeyboardEvent) => {
      if (e.key === "Escape") onTutup();
    };
    document.addEventListener("keydown", padaTombol);
    return () => document.removeEventListener("keydown", padaTombol);
  }, [buka, onTutup]);

  const mulaiResize = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    mulaiRef.current = { x: e.clientX, lebar };
    const padaGerak = (ev: PointerEvent) => {
      const mulai = mulaiRef.current;
      if (!mulai) return;
      // Menyeret ke kiri memperlebar drawer: delta dibalik.
      const berikut = mulai.lebar + (mulai.x - ev.clientX);
      setLebar(Math.min(LEBAR_MAKS, Math.max(LEBAR_MIN, Math.round(berikut))));
    };
    const padaLepas = () => {
      window.removeEventListener("pointermove", padaGerak);
      window.removeEventListener("pointerup", padaLepas);
      mulaiRef.current = null;
      setLebar((sekarang) => {
        try {
          window.localStorage.setItem(KUNCI_SIMPAN, String(sekarang));
        } catch {
          // Gagal menyimpan hanya berarti default lagi lain kali.
        }
        return sekarang;
      });
    };
    window.addEventListener("pointermove", padaGerak);
    window.addEventListener("pointerup", padaLepas);
  };

  return (
    <>
      {/* Scrim: hanya di bawah `xl`, tempat drawer menjadi sheet di atas
          dokumen. Di `xl` drawer ter-dock, jadi menutup layar justru menghalangi
          membaca — persis kesalahan yang pernah terjadi di DeepTutor, di mana
          scrim tunggal meredupkan dokumen yang sedang dibaca. */}
      {buka && boleh ? (
        <div
          onClick={onTutup}
          aria-hidden="true"
          className="fixed inset-0 z-30 bg-black/30 xl:hidden"
        />
      ) : null}

      <aside
        id="drawer-tutor"
        aria-label="Tutor AI"
        // Selalu ada di pohon React: saat tertutup ia hanya disembunyikan dengan
        // CSS (`hidden`), sehingga iframe di dalamnya **tidak** dimuat ulang dan
        // WebSocket tidak putus. Ini beda dari `companionOpen && <Panel/>` milik
        // DeepTutor, yang boleh membongkar panelnya karena state-nya ada di
        // provider di atas — di sini state-nya ada di dalam iframe.
        // Di `xl` drawer ter-dock dan tetap **in-flow**; `relative` (bukan
        // `static`) dipakai karena gagang resize di dalamnya `absolute`, dan
        // `static` tidak membentuk containing block — tanpa ini gagangnya
        // mengukur ke initial containing block dan muncul sebagai garis 4px di
        // tepi kiri viewport, bukan di tepi kiri drawer. `inset-y-0 right-0`
        // dari keadaan `fixed` tetap terpasang di sini, tapi semuanya nol
        // (`left:auto` pada elemen relative resolve ke `-right` = 0), jadi
        // drawer tidak tergeser saat menjadi `relative`.
        className={cn(
          "border-gray-200 bg-white",
          buka
            ? "fixed inset-y-0 right-0 z-40 flex flex-col border-l shadow-xl xl:relative xl:z-auto xl:shadow-none"
            : "hidden",
        )}
        style={buka ? { width: `${lebar}px`, maxWidth: "92vw" } : undefined}
      >
        {boleh ? (
          <>
            {/* Gagang resize hanya di layar lebar, tempat drawer benar-benar ter-dock. */}
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Ubah lebar tutor"
              onPointerDown={mulaiResize}
              className="absolute inset-y-0 -left-0.5 z-10 hidden w-1 cursor-col-resize hover:bg-blue-200 xl:block"
            />
            <iframe
              src={src}
              title="Tutor AI"
              // Sama seperti `ai-mastery-frame.tsx`: frame tidak boleh menjangkau
              // dokumen Careevo, dan tidak perlu mengirim referrer.
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
              referrerPolicy="no-referrer"
              allow="clipboard-read; clipboard-write"
              className="h-full w-full flex-1 border-0 bg-transparent"
            />
          </>
        ) : (
          <p className="p-4 text-[12.5px] text-gray-500">
            Tutor AI tidak tersedia untuk kursus ini.
          </p>
        )}
      </aside>
    </>
  );
}
