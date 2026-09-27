import Link from "next/link";
import { BarChart3, Code2, ShieldCheck, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Reveal } from "../primitives";
import { DitheredHero } from "@/components/features/marketing/dithered-hero";
import { HARGA, rupiah, perBulanTahunan } from "@/lib/pricing";

/**
 * The tracks Careevo actually teaches (data, web, security, AI) — deliberately
 * not third-party brand logos, which would imply partnerships Careevo does not
 * have. These are the same four domains the floating badges used to represent;
 * they now carry their names so a first-time visitor can read them.
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

/** The four tracks Plus unlocks, with the hue each already carries on this page. */
const JALUR = [
  { nama: "Data & Analitik", Ikon: DataIcon, warna: "bg-blue-50 text-blue-700" },
  { nama: "Web Development", Ikon: WebIcon, warna: "bg-emerald-50 text-emerald-700" },
  { nama: "Keamanan Siber", Ikon: SecurityIcon, warna: "bg-rose-50 text-rose-700" },
  { nama: "AI & Prompting", Ikon: AiIcon, warna: "bg-indigo-50 text-indigo-700" },
] as const;

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
 * headline, price, CTAs, disclaimer and the ribbon artwork) while sitting on
 * the shared `/belajar`-style dithered hero shell so the header pattern matches
 * the Belajar page. The artwork column is a single price card plus the four
 * track chips, so the offer reads in one glance instead of as loose stickers.
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

        {/* RIGHT COLUMN — the offer as one artefact: what Plus costs per month,
            what the annual cycle saves, and the four tracks it unlocks. The
            ribbon stays as the page motif, drawn crisply through the gutter
            behind both surfaces instead of glowing over them.

            The price card restates the headline offer but adds the two figures
            the copy does not carry (the annual monthly-equivalent and the
            rupiah saving), so it stays real, selectable content; only the
            ribbon and sparkles are decorative. */}
        <Reveal variant="scale" delay={100}>
          {/* `@container` reads the artwork box's own width, not the viewport:
              the split layout needs ~448px before the chip rail can sit beside
              the card without clipping its longest track name. */}
          <div className="@container relative mx-auto w-full max-w-[470px]">
            {/* Ribbon — a constant-weight band flowing down the gutter between
                the price card and the track chips. `preserveAspectRatio="none"`
                plus `non-scaling-stroke` lets one path serve every breakpoint
                without the band fattening as the box stretches. It only exists
                in the split layout; stacked, there is no gutter for it and it
                would just cross the chips. */}
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              fill="none"
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 hidden size-full @md:block"
            >
              <defs>
                <linearGradient
                  id="ribbonGrad"
                  gradientUnits="userSpaceOnUse"
                  x1="0"
                  y1="100"
                  x2="0"
                  y2="0"
                >
                  <stop offset="0%" stopColor="#93C5FD" stopOpacity="0.85" />
                  <stop offset="55%" stopColor="#60A5FA" stopOpacity="0.7" />
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.42" />
                </linearGradient>
              </defs>

              {/* Main S-curve band */}
              <path
                d="M58 106 C 65 92, 55 78, 61 62 C 67 46, 56 30, 62 14 C 64 6, 66 0, 68 -8"
                stroke="url(#ribbonGrad)"
                strokeWidth="15"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              {/* Inner highlight keeps the band from reading as flat paint */}
              <path
                d="M58 106 C 65 92, 55 78, 61 62 C 67 46, 56 30, 62 14 C 64 6, 66 0, 68 -8"
                stroke="#BFDBFE"
                strokeWidth="3"
                strokeLinecap="round"
                strokeOpacity="0.95"
                vectorEffect="non-scaling-stroke"
              />
              {/* Lighter trail, a step off the band */}
              <path
                d="M66 108 C 73 94, 63 80, 69 64 C 75 48, 64 32, 70 16 C 72 8, 74 2, 76 -6"
                stroke="#E0F2FE"
                strokeWidth="2"
                strokeDasharray="3 6"
                strokeLinecap="round"
                strokeOpacity="0.7"
                vectorEffect="non-scaling-stroke"
              />
            </svg>

            {/* Amber sparkles — the ribbon's travelling stars. Same rule as the
                ribbon: they belong to the split layout, and in the stacked one
                they would land on the chip row. */}
            <SparkleStar className="absolute -top-4 left-4 hidden size-4 text-amber-300 drop-shadow-[0_0_6px_rgba(252,211,77,0.8)] @md:block" />
            <SparkleStar className="absolute -right-1 -bottom-2 hidden size-5 text-amber-400 drop-shadow-[0_0_9px_rgba(251,191,36,0.85)] @md:block" />

            {/* Stacked until the artwork box is wide enough to hold the card and
                the chip rail side by side; below that the card clips the
                longest track name. */}
            <div className="relative grid gap-4 @md:grid-cols-[minmax(0,268px)_minmax(0,1fr)] @md:items-center @md:gap-7">
              {/* The offer, priced — extra detail beyond the headline copy. */}
              <div className="w-full rounded-2xl bg-white p-4 shadow-[0_24px_46px_-22px_rgba(10,61,98,0.55)] sm:p-4.5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[#0a3d62]">
                    Careevo Plus
                  </p>
                  <span className="rounded-full bg-[#eef4f8] px-2 py-0.5 text-[10px] font-semibold text-[#3d5a6c]">
                    Bulanan
                  </span>
                </div>

                <p className="mt-3 flex items-baseline gap-1.5 whitespace-nowrap">
                  <span className="text-[30px] font-bold leading-none -tracking-[0.02em] text-[#0a3d62] tabular-nums sm:text-[32px]">
                    {rupiah(HARGA.plusBulanan)}
                  </span>
                  <span className="text-xs font-medium text-[#48606e]">
                    /bulan
                  </span>
                </p>

                <div className="my-3.5 h-px bg-[#e2eef4]" />

                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xs font-medium text-[#48606e]">
                    Paket tahunan
                  </span>
                  <span className="text-sm font-semibold text-[#0a3d62] tabular-nums">
                    {rupiah(HARGA.plusTahunan)}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-[#48606e]">
                  Setara {perBulanTahunan(HARGA.plusTahunan)}/bulan
                </p>

                <p className="mt-3 inline-flex items-center rounded-full bg-[#FFB703] px-2.5 py-1 text-[11px] font-bold text-[#3b2600] tabular-nums">
                  Hemat 2 bulan ·{" "}
                  {rupiah(HARGA.plusBulanan * 12 - HARGA.plusTahunan)}
                </p>
              </div>

              {/* Tracks Careevo teaches. Named so the icons mean something and
                  the column is not just unlabelled dots. */}
              <ul
                aria-label="Jalur keahlian di Careevo"
                className="flex flex-wrap gap-2 @md:flex-col @md:items-start @md:gap-2.5"
              >
                {JALUR.map(({ nama, Ikon, warna }) => (
                  <li
                    key={nama}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white py-1 pr-2.5 pl-1 shadow-[0_10px_20px_-12px_rgba(10,61,98,0.6)]"
                  >
                    <span
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-full",
                        warna,
                      )}
                    >
                      <Ikon className="size-3.5" />
                    </span>
                    <span className="text-[11px] font-semibold whitespace-nowrap text-[#0a3d62]">
                      {nama}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Reveal>
      </div>
    </DitheredHero>
  );
}
