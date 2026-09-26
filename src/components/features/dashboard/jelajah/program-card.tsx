import Image from "next/image";
import Link from "next/link";
import { Award, CalendarDays } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import type { ProgramDetails } from "@/lib/courses/catalog-data";
import { programHref } from "@/lib/courses/explore-queries";
import { kredensialProgram, levelProgram, mulaiProgram } from "./format";

/**
 * Kartu program untuk baris "Jelajahi kursus langsung".
 *
 * Setiap baris di kartu ini berasal dari `ProgramDetails`: nama pengajar,
 * peran, tanggal mulai, dan jenis kredensial. Tidak ada field yang ditebak —
 * kalau `bannerGraphic` kosong, sampulnya jadi blok warna merek, bukan gambar
 * rekaan.
 *
 * Pill di tepi atas sengaja berisi **level**, bukan diskon. Referensi visualnya
 * memakai badge "Early bird - 20% off", tetapi diskon seperti itu adalah klaim
 * yang tidak ada di data — geometries-nya ditiru, isinya tidak.
 */
export function ProgramCard({ program }: { program: ProgramDetails }) {
  return (
    <Link
      href={programHref(program)}
      className="group relative flex h-full flex-col rounded-[14px] border border-[#cbe6ef] bg-white transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-t-[14px] bg-[#0a3d62]">
        {program.bannerGraphic ? (
          <Image
            src={program.bannerGraphic}
            alt=""
            fill
            sizes="(min-width: 1024px) 22rem, (min-width: 640px) 45vw, 92vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          // `bannerGraphic` hanya ada di satu dari enam program, dan
          // `providerLogo` menolak dimuat (403) untuk dua lainnya — jadi
          // keduanya tidak bisa diandalkan sebagai artwork. Nama penyedia
          // selalu ada dan selalu tampil.
          <div className="absolute inset-0 flex items-center justify-center bg-linear-to-br from-[#e2eef4] via-[#ecf3f7] to-[#cbe6ef] p-5">
            <span className="line-clamp-2 text-center text-[13px] leading-snug font-semibold text-[#0a3d62]">
              {program.provider}
            </span>
          </div>
        )}
      </div>

      {/* Sengaja di luar wrapper yang `overflow-hidden`: pill menyilang tepi atas
          sampul, jadi klan jendela di sampul akan memotong separuhnya. */}
      <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[980px] border border-[#e8a33d]/50 bg-[#e8a33d] px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap text-[#3d2a00] shadow-sm">
        {levelProgram(program.level)}
      </span>

      <div className="flex flex-1 flex-col p-3.5">
        <h3 className="line-clamp-2 text-[15px] leading-snug font-semibold text-[#0a2a3a]">
          {program.title}
        </h3>
        <p className="mt-1.5 text-[13px] font-semibold text-[#0a2a3a]">
          {program.instructor}
        </p>
        <p className="mt-0.5 line-clamp-1 text-[12px] text-[#48606e]">
          {program.instructorRole}
        </p>

        <Separator className="my-2.5 border-dashed bg-[#cbe6ef]" />

        <ul className="mt-auto flex flex-col gap-1">
          <li className="flex items-center gap-1.5 text-[12px] text-[#48606e]">
            <CalendarDays className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
            {mulaiProgram(program.startDate)}
          </li>
          <li className="flex items-center gap-1.5 text-[12px] text-[#48606e]">
            <Award className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
            {kredensialProgram(program.type)}
          </li>
        </ul>
      </div>
    </Link>
  );
}
