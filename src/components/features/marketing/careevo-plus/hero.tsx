import Link from "next/link";
import {
  BadgeCheck,
  BarChart3,
  Bot,
  Code2,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
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

/**
 * A floating fact chip for the artwork column: a small white card pinned to the
 * edge of the price card, reading as a sticker the offer threw off. Only facts
 * the page already states elsewhere (Socrates AI coaching, publicly verifiable
 * HMAC certificates, the 7-day trial) appear here, so the chips add reach
 * rather than new claims.
 *
 * The float is a split-layout device and both offsets are chosen, not
 * arbitrary. A chip is 48px tall, so hung at `-top-8` it reaches 16px into the
 * card — less than the card's 20px inner padding — which means it crosses the
 * card's whole width without ever covering a figure. Two chips share the top
 * band only because the card is 320px and each chip stays under 176px: at that
 * width the pair still leaves a gutter between them. Below `@lg` there is no
 * room to overlap and the chip falls back to an ordinary row under the card.
 */
function FloatingCard({
  Ikon,
  judul,
  keterangan,
  warna,
  className,
}: {
  Ikon: LucideIcon;
  judul: string;
  keterangan: string;
  warna: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex w-fit items-center gap-2 rounded-xl border border-[#dbe9f2] bg-white px-2.5 py-2 shadow-[0_18px_34px_-18px_rgba(10,61,98,0.65)] @lg:absolute @lg:z-10",
        className,
      )}
    >
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-lg",
          warna,
        )}
      >
        <Ikon className="size-4" />
      </span>
      <span className="leading-tight">
        <span className="block text-xs font-bold whitespace-nowrap text-[#0a3d62]">
          {judul}
        </span>
        <span className="block text-[11px] whitespace-nowrap text-[#48606e]">
          {keterangan}
        </span>
      </span>
    </div>
  );
}

/**
 * Careevo Plus Hero — the promotional content (headline, price, CTAs,
 * disclaimer) sitting on the shared `/belajar`-style dithered hero shell so the
 * header pattern matches the Belajar page.
 *
 * The left column deliberately has no "Careevo PLUS" logo badge any more: the
 * page header and the sticky sub-nav both already announce the product, so the
 * badge was a third mark saying the same thing and pushing the headline — the
 * one line that carries the offer — down the column.
 *
 * The artwork column is the price card at full weight, the four track chips it
 * unlocks, and three inclusion chips floating off the card's edges. The blue
 * ribbon SVG that used to flow down this column is gone: it painted a blue band
 * behind and between the card and the chips, which is the blue effect that made
 * the surfaces hard to read. Nothing decorative sits behind them now — the
 * white cards carry their own shadows straight against the dithered ground.
 */
export function CareevoPlusHero() {
  return (
    <DitheredHero
      className="py-8 lg:py-10"
      contentClassName="relative mx-auto max-w-7xl px-4 lg:px-6"
    >
      <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-10">
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
            what the annual cycle saves, the four tracks it unlocks, and the
            three facts a subscription includes. The price card restates the
            headline offer but adds the two figures the copy does not carry (the
            annual monthly-equivalent and the rupiah saving), so the whole column
            stays real, selectable content. */}
        <Reveal variant="scale" delay={100}>
          {/* `@container` reads the artwork box's own width, not the viewport:
              `@lg` (512px) is the first size where the 300px price card and the
              chip rail still fit side by side without the longest track name
              clipping. The page grid caps this column near 530px, so the split
              layout engages from roughly 1230px up and stacks below that. */}
          <div className="@container relative mx-auto w-full max-w-[520px]">
            {/* Stacked until the artwork box is wide enough to hold the card and
                the chip rail side by side; below that the card clips the longest
                track name. In the stacked layout the inclusion chips drop out of
                the float and fall in under the card as ordinary rows. */}
            <div className="relative grid gap-5 @lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)] @lg:items-center">
              {/* The offer, priced. */}
              <div className="w-full rounded-2xl bg-white p-5 shadow-[0_30px_60px_-26px_rgba(10,61,98,0.55)] sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-base font-semibold text-[#0a3d62]">
                    Careevo Plus
                  </p>
                  <span className="rounded-full bg-[#eef4f8] px-2.5 py-0.5 text-[11px] font-semibold text-[#3d5a6c]">
                    Bulanan
                  </span>
                </div>

                <p className="mt-3.5 flex items-baseline gap-1.5 whitespace-nowrap">
                  <span className="text-[36px] font-bold leading-none -tracking-[0.02em] text-[#0a3d62] tabular-nums sm:text-[38px]">
                    {rupiah(HARGA.plusBulanan)}
                  </span>
                  <span className="text-sm font-medium text-[#48606e]">
                    /bulan
                  </span>
                </p>

                <div className="my-4 h-px bg-[#e2eef4]" />

                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[13px] font-medium text-[#48606e]">
                    Paket tahunan
                  </span>
                  <span className="text-[15px] font-semibold text-[#0a3d62] tabular-nums">
                    {rupiah(HARGA.plusTahunan)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#48606e]">
                  Setara {perBulanTahunan(HARGA.plusTahunan)}/bulan
                </p>

                <p className="mt-4 inline-flex items-center rounded-full bg-[#FFB703] px-3 py-1.5 text-xs font-bold text-[#3b2600] tabular-nums">
                  Hemat 2 bulan ·{" "}
                  {rupiah(HARGA.plusBulanan * 12 - HARGA.plusTahunan)}
                </p>
              </div>

              {/* Tracks Careevo teaches. Named so the icons mean something and
                  the column is not just unlabelled dots. */}
              <ul
                aria-label="Jalur keahlian di Careevo"
                className="flex flex-wrap gap-2 @lg:flex-col @lg:items-start @lg:gap-3"
              >
                {JALUR.map(({ nama, Ikon, warna }) => (
                  <li
                    key={nama}
                    className="inline-flex items-center gap-2 rounded-full bg-white py-1.5 pr-3.5 pl-1.5 shadow-[0_14px_26px_-14px_rgba(10,61,98,0.6)]"
                  >
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-full",
                        warna,
                      )}
                    >
                      <Ikon className="size-4" />
                    </span>
                    <span className="text-[13px] font-semibold whitespace-nowrap text-[#0a3d62]">
                      {nama}
                    </span>
                  </li>
                ))}
              </ul>

              {/* The three facts the plan list states, hung off the cluster's
                  edges in the split layout. Each vertical offset is 32px
                  against the card's 20px padding plus the 16px its own height
                  adds, so a chip that crosses the card's width only ever sits on
                  padding, never on a figure. The rail is the shorter column and
                  is centre-aligned, which leaves the band above its first chip
                  free for the third card. Stacked, the float is off and these
                  fall in under the chips as a plain legend. */}
              <FloatingCard
                Ikon={Bot}
                judul="Socrates AI"
                keterangan="Tutor pendamping latihan"
                warna="bg-indigo-50 text-indigo-700"
                className="@lg:-top-8 @lg:-left-7"
              />
              <FloatingCard
                Ikon={BadgeCheck}
                judul="Sertifikat HMAC"
                keterangan="Bisa diverifikasi publik"
                warna="bg-emerald-50 text-emerald-700"
                className="@lg:-bottom-8 @lg:-left-7"
              />
              <FloatingCard
                Ikon={Sparkles}
                judul="Uji coba 7 hari"
                keterangan="Langganan bulanan"
                warna="bg-blue-50 text-blue-700"
                className="@lg:-top-8 @lg:-right-5"
              />
            </div>
          </div>
        </Reveal>
      </div>
    </DitheredHero>
  );
}
