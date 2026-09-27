"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Award, CalendarDays, Star } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import type { ProgramDetails } from "@/lib/courses/catalog-data";
import { programHref } from "@/lib/courses/explore-queries";
import { kredensialProgram, levelProgram, mulaiProgram } from "./format";

/**
 * Kartu program untuk baris "Jelajahi kursus langsung".
 *
 * Anatomi kartu mengikuti kartu katalog belajar (`CatalogCourseCard`):
 * sampul 16:9, pill kredensial di pojok kiri-atas, baris penyedia (logo +
 * nama), judul yang membiru saat hover, lalu baris rating dan meta tanggal /
 * kredensial di footer dengan pemisah hairline. Field yang tidak ada di
 * `ProgramDetails` tidak pernah ditebak.
 */
export function ProgramCard({ program }: { program: ProgramDetails }) {
  const [logoErrored, setLogoErrored] = useState(false);
  const cover = program.thumbnail ?? program.bannerGraphic;

  return (
    <Link
      href={programHref(program)}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xs transition-shadow duration-200 hover:shadow-md active:scale-[0.99]"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-gray-100">
        {cover ? (
          <Image
            src={cover}
            alt={program.title}
            fill
            sizes="(min-width: 1024px) 22rem, (min-width: 640px) 45vw, 92vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          // Nama penyedia tampil sebagai cadangan jika thumbnail belum tersedia.
          <div className="absolute inset-0 flex items-center justify-center bg-linear-to-br from-[#e2eef4] via-[#ecf3f7] to-[#cbe6ef] p-5">
            <span className="line-clamp-2 text-center text-[13px] leading-snug font-semibold text-[#0a3d62]">
              {program.provider}
            </span>
          </div>
        )}
        <span className="absolute top-2.5 left-2.5 rounded-md bg-white/95 px-2 py-0.5 text-[11px] font-semibold text-gray-800 shadow-xs backdrop-blur-xs">
          {kredensialProgram(program.type)}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="mb-2 flex items-center gap-2">
          {program.providerLogo && !logoErrored ? (
            <div className="relative size-5 shrink-0 overflow-hidden rounded-sm">
              <Image
                src={program.providerLogo}
                alt={program.provider}
                fill
                sizes="20px"
                className="object-contain"
                onError={() => setLogoErrored(true)}
              />
            </div>
          ) : (
            <span
              aria-hidden="true"
              className="inline-flex size-5 shrink-0 items-center justify-center rounded-sm bg-[#0056D2] text-[10px] font-bold text-white uppercase"
            >
              {program.provider.charAt(0)}
            </span>
          )}
          <span className="truncate text-xs font-medium text-gray-600">{program.provider}</span>
        </div>

        <h3 className="mb-1.5 line-clamp-2 min-h-[2.6rem] text-sm font-bold text-gray-900 group-hover:text-[#0056D2]">
          {program.title}
        </h3>

        <div className="mb-3 flex items-center gap-1.5 text-xs">
          <div className="flex items-center text-[#eb8a04]">
            <Star className="size-3.5 fill-[#eb8a04] text-[#eb8a04]" />
            <span className="ml-1 font-bold text-gray-900">{program.rating}</span>
          </div>
          <span className="text-gray-400">·</span>
          <span className="text-gray-500">({program.reviews})</span>
        </div>

        <Separator className="mt-auto mb-3 border-gray-100" />

        <ul className="flex flex-col gap-1.5">
          <li className="flex items-center gap-1.5 text-xs text-gray-500">
            <CalendarDays className="size-3.5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
            {mulaiProgram(program.startDate)}
          </li>
          <li className="flex items-center gap-1.5 text-xs text-gray-500">
            <Award className="size-3.5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
            {kredensialProgram(program.type)} · {levelProgram(program.level)}
          </li>
        </ul>
      </div>
    </Link>
  );
}
