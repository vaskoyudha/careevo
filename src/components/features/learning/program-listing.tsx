import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Star, Clock, Signal } from "lucide-react";
import type { ProgramListItem } from "@/lib/courses/explore-queries";

/**
 * Kartu program untuk semua halaman listing Explore.
 * Mengikuti pola kartu yang sudah dipakai /explore/most-popular-courses
 * (border #C1CBDB, thumbnail 16:9, logo mitra di pojok, tag di bawah).
 */
export function ProgramCard({ program }: { program: ProgramListItem }) {
  const cover =
    program.thumbnail ?? program.bannerGraphic ?? program.providerLogo;

  return (
    <Link
      href={program.href}
      className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-[#C1CBDB] bg-white shadow-2xs transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-1 hover:border-gray-400 hover:no-underline hover:shadow-md active:scale-[0.99]"
    >
      <div>
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-gray-100">
          <Image
            src={cover}
            alt={program.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            unoptimized
          />
          <div className="absolute top-2.5 left-2.5 flex size-6 items-center justify-center rounded bg-white p-1 shadow-xs">
            <Image
              src={program.providerLogo}
              alt={program.provider}
              width={18}
              height={18}
              className="object-contain"
              unoptimized
            />
          </div>
        </div>

        <div className="p-4">
          <div className="flex items-center gap-1.5">
            <div className="relative size-4 shrink-0 overflow-hidden">
              <Image
                src={program.providerLogo}
                alt={program.provider}
                fill
                sizes="16px"
                className="object-contain"
                unoptimized
              />
            </div>
            <span className="text-xs font-medium text-gray-700">
              {program.provider}
            </span>
          </div>

          <h3 className="mt-2 line-clamp-2 min-h-[44px] text-base leading-snug font-bold text-[#0D0F12] transition-colors group-hover:text-[#0056D2]">
            {program.title}
          </h3>

          <p className="mt-1 text-xs font-normal text-gray-500">
            {program.type === "Professional Certificate"
              ? "Sertifikat Profesional"
              : "Spesialisasi"}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-600">
            <span className="inline-flex items-center gap-1">
              <Star className="size-3 fill-[#0056D2] text-[#0056D2]" />
              {program.rating}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" />~{program.durationWeeks} minggu
            </span>
            <span className="inline-flex items-center gap-1">
              <Signal className="size-3" />
              {program.level}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 px-4 pt-1 pb-4">
        {program.skills.slice(0, 2).map((skill) => (
          <span
            key={skill}
            className="inline-flex items-center rounded-md bg-[#F0F6FF] px-2 py-0.5 text-[11px] font-semibold text-[#0D2F60]"
          >
            {skill}
          </span>
        ))}
      </div>
    </Link>
  );
}

export function ProgramGrid({ programs }: { programs: ProgramListItem[] }) {
  if (programs.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#C1CBDB] bg-[#F5F7FA] px-6 py-14 text-center">
        <p className="text-base font-semibold text-gray-900">
          Belum ada program di bagian ini
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm text-gray-600">
          Coba lihat kategori lain, atau kembali ke semua program yang tersedia.
        </p>
        <Link
          href="/browse"
          className="mt-6 inline-flex items-center rounded-lg bg-[#0056D2] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#0047A8] active:scale-[0.98]"
        >
          Lihat semua kategori
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {programs.map((program) => (
        <ProgramCard key={program.slug} program={program} />
      ))}
    </div>
  );
}

interface ListingPageProps {
  title: string;
  description: string;
  eyebrow?: string;
  programs: ProgramListItem[];
  emptyHint?: string;
  children?: React.ReactNode;
}

export function buildListingMetadata(
  title: string,
  description: string,
): Metadata {
  return { title: `${title} | Careevo`, description };
}

/** Kerangka halaman listing: hero tipis + grid, tanpa gradient/glass. */
export function ListingPage({
  title,
  description,
  eyebrow,
  programs,
  children,
}: ListingPageProps) {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <section className="border-b border-[#E3E7EF] bg-[#F5F7FA] pt-20 pb-10 sm:pt-24 sm:pb-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {eyebrow ? (
            <p className="mb-2 text-xs font-semibold tracking-widest text-[#0056D2] uppercase">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="text-3xl leading-[1.15] font-extrabold tracking-tight text-[#0D0F12] sm:text-4xl lg:text-[40px]">
            {title}
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-gray-700">
            {description}
          </p>
          {children}
        </div>
      </section>

      <section className="py-12 sm:py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-6 flex items-baseline justify-between">
            <h2 className="text-lg font-bold text-gray-900">
              {programs.length} program
            </h2>
            <Link
              href="/browse"
              className="text-sm font-semibold text-[#0056D2] underline underline-offset-2 hover:text-[#0047A8]"
            >
              Lihat semua kategori
            </Link>
          </div>
          <ProgramGrid programs={programs} />
        </div>
      </section>
    </div>
  );
}
