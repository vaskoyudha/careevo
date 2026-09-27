import Link from "next/link";
import { BarChart3, Code2, ShieldCheck, Sparkles } from "lucide-react";
import { Reveal } from "../primitives";
import { DitheredHero } from "@/components/features/marketing/dithered-hero";
import { HARGA, rupiah } from "@/lib/pricing";

/**
 * Skill-domain badges floating beside the ribbon. These represent the tracks
 * Careevo actually teaches (data, web, security, AI) — deliberately not
 * third-party brand logos, which would imply partnerships Careevo does not have.
 */
function DataIcon({ className }: { className?: string }) {
  return <BarChart3 className={className} strokeWidth={2.25} aria-hidden="true" />;
}

function WebIcon({ className }: { className?: string }) {
  return <Code2 className={className} strokeWidth={2.25} aria-hidden="true" />;
}

function SecurityIcon({ className }: { className?: string }) {
  return <ShieldCheck className={className} strokeWidth={2.25} aria-hidden="true" />;
}

function AiIcon({ className }: { className?: string }) {
  return <Sparkles className={className} strokeWidth={2.25} aria-hidden="true" />;
}

function SparkleStar({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 0C12 6.627 6.627 12 0 12C6.627 12 12 17.373 12 24C12 17.373 17.373 12 24 12C17.373 12 12 6.627 12 0Z" />
    </svg>
  );
}

/**
 * Careevo Plus Hero — keeps the original promotional content (logo badge,
 * headline, price, CTAs, disclaimer and the ribbon + logo-badge artwork) while
 * sitting on the shared `/belajar`-style dithered hero shell so the header
 * pattern matches the Belajar page.
 */
export function CareevoPlusHero() {
  return (
    <DitheredHero
      className="py-8 lg:py-10"
      contentClassName="relative mx-auto max-w-7xl px-4 lg:px-6"
    >
      <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:gap-10">
        {/* LEFT COLUMN */}
        <div className="relative">
          {/* Localised soft halo so ink text stays crisp over the bright
              dithered stipple. Not a full-surface scrim — the backdrop
              remains visible around it and on the artwork side. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-x-6 -inset-y-5 rounded-[3rem] bg-white/65 blur-2xl sm:-inset-x-10 lg:-inset-x-14"
          />
          <Reveal className="relative">
          {/* Logo Badge: "Careevo PLUS" */}
          <div className="mb-3 flex items-center justify-center gap-1.5 lg:justify-start">
            <span className="text-xl font-bold tracking-tight text-[#12324a] sm:text-2xl">
              Care<span className="text-[#0056D2]">evo</span>
            </span>
            <span className="rounded-[3px] border border-[#0B408B] px-1 py-0.25 text-[10px] font-bold tracking-wider text-[#0B408B] uppercase shadow-xs">
              PLUS
            </span>
          </div>

          {/* Headline */}
          <h1 className="mx-auto mb-3 max-w-xl text-3xl font-bold leading-[1.18] -tracking-[0.5px] text-[#0a3d62] sm:text-4xl lg:mx-0 lg:text-[38px]">
            Belajar fleksibel, siap kerja, tanpa batas
          </h1>

          {/* Description */}
          <p className="mx-auto mb-4 max-w-lg text-sm leading-relaxed text-[#1e293b] sm:text-base lg:mx-0">
            Ubah menit senggangmu jadi keahlian yang dicari perusahaan. Akses
            seluruh kursus, latihan, dan sertifikat Careevo dengan satu
            langganan yang mengikuti rutinitasmu.
          </p>

          {/* Price line */}
          <div className="mb-4 flex flex-wrap items-center justify-center gap-2 text-xs sm:text-sm lg:justify-start">
            <span className="font-semibold text-[#0a3d62]">
              Mulai {rupiah(HARGA.plusBulanan)}/bulan, batalkan kapan saja
            </span>
          </div>

          {/* CTA button + Annual option */}
          <div className="mb-4 flex flex-wrap items-center justify-center gap-3.5 lg:justify-start">
            <Link
              href="#paket"
              className="inline-flex h-9.5 items-center justify-center rounded-lg bg-[#0056D2] px-5 text-xs font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[#0046ab] hover:shadow-md sm:text-sm"
            >
              Lihat paket Plus
            </Link>
            <span className="text-xs font-medium text-[#405464] sm:text-sm">
              atau {rupiah(HARGA.plusTahunan)}/tahun — hemat 2 bulan
            </span>
          </div>

          {/* Disclaimer & Terms */}
          <p className="text-xs text-[#405464]">
            Uji coba gratis 7 hari untuk langganan bulanan, lihat{" "}
            <Link
              href="#ketentuan"
              className="font-semibold text-[#0056D2] underline underline-offset-2 transition-colors hover:text-[#0046ab]"
            >
              Ketentuan Layanan
            </Link>
            .
          </p>
        </Reveal>
        </div>

        {/* RIGHT COLUMN - VISUAL ARTWORK */}
        <Reveal variant="scale" delay={100}>
          <div className="relative mx-auto h-[280px] w-full max-w-[390px] select-none sm:h-[300px]">
            {/* Organic Wavy Ribbon SVG */}
            <svg
              viewBox="0 0 340 300"
              className="absolute inset-0 h-full w-full"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="ribbonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#93C5FD" stopOpacity="0.9" />
                  <stop offset="50%" stopColor="#60A5FA" stopOpacity="0.75" />
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.5" />
                </linearGradient>
                <filter id="ribbonGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="5" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Main smooth S-curve ribbon path */}
              <path
                d="M250 15 C 285 45, 270 95, 240 135 C 205 175, 215 220, 245 250 C 260 265, 268 285, 250 295"
                stroke="url(#ribbonGrad)"
                strokeWidth="18"
                strokeLinecap="round"
                filter="url(#ribbonGlow)"
              />
              <path
                d="M250 15 C 285 45, 270 95, 240 135 C 205 175, 215 220, 245 250 C 260 265, 268 285, 250 295"
                stroke="#BFDBFE"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeOpacity="0.95"
              />

              {/* Secondary lighter decorative trail */}
              <path
                d="M275 40 C 300 80, 270 120, 250 160 C 230 195, 225 230, 265 275"
                stroke="#E0F2FE"
                strokeWidth="2"
                strokeDasharray="3 5"
                strokeLinecap="round"
                strokeOpacity="0.65"
              />
            </svg>

            {/* Sparkle Stars */}
            <SparkleStar className="absolute top-5 right-22 size-4 text-amber-300 drop-shadow-[0_0_6px_rgba(252,211,77,0.8)]" />
            <SparkleStar className="absolute top-18 right-34 size-5.5 text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.9)]" />
            <SparkleStar className="absolute top-32 right-28 size-3.5 text-amber-300 drop-shadow-[0_0_5px_rgba(252,211,77,0.7)]" />
            <SparkleStar className="absolute top-44 right-10 size-3 text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.8)]" />
            <SparkleStar className="absolute bottom-8 right-36 size-4 text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.9)]" />

            {/* Floating skill-domain badges along the ribbon */}
            {/* 1. Data */}
            <div
              className="absolute top-3 right-4 flex size-9.5 items-center justify-center rounded-full bg-white text-blue-700 shadow-md transition-transform duration-300 hover:scale-110 sm:size-10"
              title="Data & Analitik"
            >
              <DataIcon className="size-4 sm:size-4.5" />
            </div>

            {/* 2. Web Dev */}
            <div
              className="absolute top-16 right-4 flex size-9.5 items-center justify-center rounded-full bg-white text-emerald-700 shadow-md transition-transform duration-300 hover:scale-110 sm:size-10"
              title="Web Development"
            >
              <WebIcon className="size-4 sm:size-4.5" />
            </div>

            {/* 3. Security */}
            <div
              className="absolute top-29 right-4 flex size-9.5 items-center justify-center rounded-full bg-white text-rose-700 shadow-md transition-transform duration-300 hover:scale-110 sm:size-10"
              title="Keamanan Siber"
            >
              <SecurityIcon className="size-4 sm:size-4.5" />
            </div>

            {/* 4. AI */}
            <div
              className="absolute top-42 right-4 flex size-9.5 items-center justify-center rounded-full bg-white text-indigo-700 shadow-md transition-transform duration-300 hover:scale-110 sm:size-10"
              title="AI & Prompting"
            >
              <AiIcon className="size-3.5 sm:size-4" />
            </div>

            {/* FLOATING DISCOUNT BADGES (Left of ribbon) */}
            <div className="absolute top-10 left-0 z-10 flex flex-col items-start gap-2.5 sm:top-12 sm:left-2">
              {/* 1. Magenta Price Card */}
              <div className="w-[190px] rounded-xl bg-[#E6007E] px-4 py-2.5 shadow-[0_6px_20px_rgba(230,0,126,0.35)] sm:w-[205px] sm:px-4.5 sm:py-3">
                <p className="text-center text-[10px] font-semibold text-white/80 sm:text-xs">
                  Careevo Plus
                </p>
                <p className="mt-0.5 text-center text-xl font-extrabold text-white tracking-tight whitespace-nowrap sm:text-2xl">
                  {rupiah(HARGA.plusBulanan)}
                  <span className="text-[11px] font-normal text-white/90 sm:text-xs">
                    /bulan
                  </span>
                </p>
              </div>

              {/* 2. Golden Yellow Savings Badge */}
              <div className="w-[190px] rounded-lg border border-amber-600/30 bg-[#FFB703] px-3.5 py-2 shadow-[0_4px_14px_rgba(255,183,3,0.3)] sm:w-[205px] sm:py-2.5">
                <p className="text-center text-xs font-bold text-[#002D72] tracking-wide whitespace-nowrap sm:text-sm">
                  Hemat 2 bulan dengan tahunan
                </p>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </DitheredHero>
  );
}
