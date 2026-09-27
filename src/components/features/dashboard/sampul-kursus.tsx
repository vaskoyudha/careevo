"use client";

import { courseMetaFor, ThumbMedia } from "@/components/ui/catalog-course-card";
import type { EntriKatalog } from "@/lib/courses/katalog";

/**
 * Sampul satu entri katalog untuk kartu dashboard.
 *
 * Komponen ini ada karena satu alasan teknis, bukan gaya: `courseMetaFor` dan
 * `ThumbMedia` berada di modul `"use client"` (`catalog-course-card.tsx`, yang
 * memakai `useState` untuk menangani gambar gagal dimuat), sehingga fungsi itu
 * **tidak boleh dipanggil dari server component** — Next melemparkan
 * "Attempted to call courseMetaFor() from the server but courseMetaFor is on the
 * client". Kartu dashboard adalah server component, jadi perhitungan sampulnya
 * dipindahkan ke sini.
 *
 * Aturan gambar tidak ditulis ulang: ia tetap `courseMetaFor` + `ThumbMedia`,
 * sumber yang sama dengan `/progres` dan kartu katalog — termasuk "unggahan admin
 * menang atas thumbnail bawaan" dan pengganti saat gambar gagal.
 */
export function SampulKursus({
  entri,
  sizes,
}: {
  entri: EntriKatalog;
  sizes: string;
}) {
  return (
    <ThumbMedia
      src={courseMetaFor(entri).thumbnail}
      alt={entri.title}
      provider={entri.provider}
      sizes={sizes}
    />
  );
}
