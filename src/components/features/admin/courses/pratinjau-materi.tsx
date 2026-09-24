"use client";

import { MateriView } from "@/components/features/learning/materi-view";
import type { TipeMateri, Materi } from "@/types/course";

/**
 * Pratinjau materi sebagaimana peserta akan melihatnya.
 *
 * Sengaja memakai `MateriView` yang sama dengan halaman belajar, bukan
 * renderer kedua — pratinjau yang berbeda dari kenyataan lebih buruk daripada
 * tidak ada pratinjau.
 */

const LABEL: Record<TipeMateri, string> = {
  video: "Video",
  pdf: "PDF",
  kuis: "Kuis",
};

export function PratinjauMateri({ materi }: { materi: Materi }) {
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-2 text-xs font-semibold text-gray-700">
        <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-[#0056D2] uppercase">
          {LABEL[materi.tipe]}
        </span>
        {materi.judul}
      </p>
      <MateriView materi={materi} />
    </div>
  );
}

export { LABEL as LABEL_TIPE_MATERI };
