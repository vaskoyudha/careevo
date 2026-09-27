import Link from "next/link";
import { ArrowRight, PlayCircle } from "lucide-react";
import type { ProgresKursus } from "@/lib/learning/progres-kursus";

/**
 * Kartu "Lanjutkan belajar" di dashboard.
 *
 * Course yang dipilih adalah **enrollment yang progresnya belum 100%**, dengan
 * urutan enrollment (paling baru dulu) — persis urutan yang dipakai `/progres`
 * dan `/belajar`, karena keduanya membaca `listProgresKursus`. Menentukan
 * "terakhir dikerjakan" dari sumber lain (misalnya run terakhir) akan membuat
 * dashboard dan `/progres` menampilkan course yang berbeda, dan tidak ada yang
 * memperingatkan.
 *
 * Course yang sudah 100% **tidak pernah** dipilih: kursus yang sudah tuntas bukan
 * "lanjutkan", dan mengarahkan ke sana membuat blok ini terasa salah setiap kali
 * dipakai setelah selesai.
 */
export function KartuLanjutkan({ course }: { course: ProgresKursus | null }) {
  if (!course) {
    return (
      <section
        aria-labelledby="judul-lanjutkan"
        className="min-w-0 rounded-xl border border-gray-200 bg-white p-5 shadow-xs"
      >
        <h2
          id="judul-lanjutkan"
          className="flex items-center gap-1.5 text-base font-bold text-gray-900"
        >
          <PlayCircle className="size-4 text-[#0056D2]" aria-hidden="true" />
          Lanjutkan belajar
        </h2>
        <p className="mt-2 text-[13px] text-gray-600">
          Belum ada course yang sedang berjalan. Daftar ke satu course untuk
          memulai, dan course itu akan muncul di sini sampai selesai.
        </p>
        <Link
          href="/belajar"
          className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-[#0056D2] hover:underline"
        >
          Jelajahi course
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </section>
    );
  }

  const { entri, progres, selesai, total } = course;

  return (
    <section
      aria-labelledby="judul-lanjutkan"
      className="min-w-0 rounded-xl border border-gray-200 bg-white p-5 shadow-xs"
    >
      <h2
        id="judul-lanjutkan"
        className="flex items-center gap-1.5 text-base font-bold text-gray-900"
      >
        <PlayCircle className="size-4 text-[#0056D2]" aria-hidden="true" />
        Lanjutkan belajar
      </h2>

      <Link
        href={`/belajar/${entri.slug}`}
        className="mt-2 block text-[15px] font-bold text-gray-900 hover:text-[#0056D2] hover:underline"
      >
        {entri.title}
      </Link>
      <p className="truncate text-[13px] text-gray-500">{entri.provider}</p>

      <div className="mt-3 flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-semibold text-gray-700">Progres</span>
        <span className="text-[13px] font-bold text-gray-900 tabular-nums">
          {progres}%
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={`Progres ${entri.title} ${progres} persen`}
        aria-valuenow={progres}
        aria-valuemin={0}
        aria-valuemax={100}
        className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-200"
      >
        <div
          className="h-full rounded-full bg-[#0056D2]"
          style={{ width: `${progres}%` }}
        />
      </div>
      <p className="mt-1.5 text-[13px] text-gray-500">
        {selesai} dari {total} modul selesai
      </p>

      <Link
        href={`/belajar/${entri.slug}`}
        className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-[#0056D2] hover:underline"
      >
        Buka course
        <ArrowRight className="size-3.5" aria-hidden="true" />
      </Link>
    </section>
  );
}

/**
 * Pilih enrollment yang masih berjalan dari daftar progres.
 *
 * **Murni dan terpisah** supaya aturan ini bisa diuji tanpa database dan tidak
 * ditulis ulang di halaman: course yang progresnya sudah 100 dilewati, dan
 * enrollment pertama yang tersisa yang menang. Daftar dari `listProgresKursus`
 * sudah terurut enrollment terbaru lebih dulu, jadi "pertama yang tersisa" adalah
 * "yang paling baru yang belum selesai" — bukan yang paling dekat selesai, yang
 * akan terasa mengarahkan peserta mundur.
 */
export function pilihCourseDilanjutkan(
  daftar: readonly ProgresKursus[],
): ProgresKursus | null {
  for (const course of daftar) {
    if (course.progres < 100) return course;
  }
  return null;
}
