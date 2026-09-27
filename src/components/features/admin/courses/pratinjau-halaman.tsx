"use client";

import { HalamanView } from "@/components/features/learning/halaman-view";
import type { Halaman, Modul } from "@/types/course";

/**
 * Pratinjau halaman sebagaimana peserta akan melihatnya.
 *
 * Memakai `HalamanView` yang sama dengan halaman belajar, bukan renderer kedua
 * — pratinjau yang berbeda dari kenyataan lebih buruk daripada tidak ada
 * pratinjau. Karena modul di sini sengaja hanya memuat satu bab berisi halaman
 * yang sedang disunting, pager tidak muncul dan tidak ada tautan keluar yang
 * bisa membuang tulisan yang belum disimpan.
 */
export function PratinjauHalaman({
  modul,
  halaman,
}: {
  modul: Pick<Modul, "submodul">;
  halaman: Halaman;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
      <p className="mb-2 text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
        Pratinjau
      </p>
      <HalamanView modul={modul} halaman={halaman} />
    </div>
  );
}
