import Link from "next/link";
import { ArrowRight, Play } from "lucide-react";
import { SampulKursus } from "@/components/features/dashboard/sampul-kursus";
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
 *
 * Sampulnya memakai `courseMetaFor`/`ThumbMedia` yang sama dengan `/progres` dan
 * kartu katalog — termasuk aturan "unggahan admin menang atas thumbnail bawaan"
 * dan pengganti saat gambar gagal dimuat. Menyalin aturan itu di sini berarti
 * dua tempat yang bisa menyimpang soal gambar mana yang tampil.
 *
 * Angka `6 modul · 12 jam` di baris meta datang dari entri katalog, bukan dari
 * `durasi` yang dikarang: `duration_min` adalah satu-satunya sumber jam yang
 * katalog punya, dan `modul` adalah jumlah modul kurikulum saat ini.
 */
export function KartuLanjutkan({ course }: { course: ProgresKursus | null }) {
  if (!course) {
    return (
      <section aria-labelledby="judul-lanjutkan" className="dash-card min-w-0">
        <div className="dash-card-head">
          <span className="dash-icon" aria-hidden="true">
            <Play className="size-4" />
          </span>
          <h2 id="judul-lanjutkan" className="dash-title">
            Lanjutkan Belajar
          </h2>
        </div>
        <p className="dash-gap-sm text-[12.5px] leading-[1.5] text-gray-600">
          Belum ada course yang sedang berjalan. Daftar ke satu course untuk
          memulai, dan course itu akan muncul di sini sampai selesai.
        </p>
        <Link
          href="/belajar"
          className="dash-gap-md inline-flex h-9 items-center gap-1.5 rounded-full bg-[#007aff] px-4 text-[13px] font-semibold text-white transition-[background-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-[#0064d2] active:scale-[0.97]"
        >
          Jelajahi course
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </section>
    );
  }

  const { entri, progres, selesai, total } = course;
  const href = `/belajar/${entri.slug}`;
  const jam = Math.round(entri.duration_min / 60);

  return (
    <section aria-labelledby="judul-lanjutkan" className="dash-card min-w-0">
      <div className="dash-card-head">
        <span className="dash-icon" aria-hidden="true">
          <Play className="size-4 fill-current" />
        </span>
        <h2 id="judul-lanjutkan" className="dash-title">
          Lanjutkan Belajar
        </h2>
        <Link
          href="/progres"
          className="dash-head-action inline-flex items-center gap-1 text-[13px] font-semibold text-[#007aff] transition-colors duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:text-[#0056d2]"
        >
          Lihat semua
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>

      <div className="dash-gap-sm flex items-start gap-2.5">
        <Link
          href={href}
          aria-label={`Lihat ${entri.title}`}
          className="group relative block aspect-[4/3] w-[86px] shrink-0 overflow-hidden rounded-lg bg-gray-100 hover:no-underline"
        >
          <SampulKursus entri={entri} sizes="86px" />
        </Link>

        <div className="min-w-0 flex-1">
        <span className="dash-chip whitespace-nowrap">Kursus</span>
          <h3 className="dash-gap-xs line-clamp-2 text-[13.5px] leading-snug font-bold text-gray-900">
            <Link
              href={href}
              className="transition-colors duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:text-[#007aff] hover:no-underline"
            >
              {entri.title}
            </Link>
          </h3>
          <p className="mt-0.5 truncate text-[11.5px] text-gray-500">
            {entri.provider} · {total} modul · {jam} jam
          </p>
        </div>
      </div>

      <div className="dash-gap-sm flex items-center justify-between text-[12px]">
        <span className="font-semibold text-gray-700">
          {selesai}/{total} modul
        </span>
        <span className="font-bold text-gray-900 tabular-nums">{progres}%</span>
      </div>
      <div
        role="progressbar"
        aria-label={`Progres ${entri.title} ${progres} persen`}
        aria-valuenow={progres}
        aria-valuemin={0}
        aria-valuemax={100}
        className="dash-gap-xs h-2 overflow-hidden rounded-full bg-[#dce9f8]"
      >
        <div
          className="h-full rounded-full bg-[#007aff] transition-[width] duration-300 ease-out"
          style={{ width: `${progres}%` }}
        />
      </div>

      {/* CTA penuh, seperti reference: satu aksi utama per kartu. `scale(0.97)`
          saat ditekan memberi tahu peserta bahwa tekanannya terbaca, dan itu
          berlaku untuk semua tombol di dashboard. */}
      <Link
        href={href}
        className="dash-gap-sm flex h-10 w-full items-center justify-center gap-1.5 rounded-[10px] bg-[#007aff] text-[13.5px] font-semibold text-white transition-[background-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-[#0064d2] active:scale-[0.98]"
      >
        Lanjutkan Kursus
        <ArrowRight className="size-4" aria-hidden="true" />
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
