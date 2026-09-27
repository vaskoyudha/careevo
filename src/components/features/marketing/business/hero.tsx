import Image from "next/image";
import Link from "next/link";
import { Building2, CheckCircle2, ChevronRight } from "lucide-react";
import { Reveal } from "@/components/features/marketing/primitives";
import { EcommerceDash } from "@/components/ui/hero-financial-utils/assets-index";

/**
 * Business hero — original content and CTA layout kept, now set on the
 * same wallpaper used by the /loker page hero (`hero-loker-header.png`)
 * with a soft white fade on the bottom edge into the page body.
 * No dithered effect here (Bisnis uses the photo treatment).
 */
export function BusinessHero() {
  return (
    <section className="relative overflow-hidden pt-12 pb-20 lg:pt-16 lg:pb-28">
      {/* Wallpaper background, flush to the top edge, fading to white below */}
      <div className="pointer-events-none absolute inset-0 select-none">
        <Image
          src="/images/hero-loker-header.png"
          alt=""
          fill
          priority
          unoptimized
          className="object-cover object-top"
        />
        {/* Fading to the page body.
         *
         * The old fade was `h-44 sm:h-64` (a flat 256px) with
         * `from-white via-white/80 to-transparent`. Two things went wrong with
         * that, and together they are the "shadow under the hero" this section
         * used to show:
         *
         * 1. 256px is only the last 17.5% of a 1466px hero, and the wallpaper
         *    is `object-cover`, so the photo's sharp green/gold foreground —
         *    the bottom ~30% of the image — lands exactly inside those 256px.
         *    `via-white/80` then reaches 80% white by the halfway point, so
         *    that foreground was dumped from full saturation to a light grey in
         *    a 128px strip. White over a dark midtone *is* grey; a short ramp
         *    cannot help it, it only concentrates the grey into a band that
         *    reads as a smudge.
         * 2. The preview card's `shadow-2xl shadow-blue-900/10` (25px offset,
         *    50px blur) was then cast onto that grey band, doubling it.
         *
         * The fix is a ramp long enough to be gradual, measured in percent of
         * the section rather than pixels: `object-cover` always shows the full
         * height of the photo here (the hero is always taller than
         * `width / 1.911`), so a percentage keeps the same photo content
         * inside the ramp at every viewport instead of sliding with the
         * content-driven section height. The stop curve starts slow — the
         * photo dissolves instead of turning grey — and lands flat on `#fff`
         * at 0% so the hero's bottom edge is pure white and the following
         * section's `bg-gray-50/70` meets it without a seam. */}
        <div className="absolute inset-x-0 bottom-0 h-[38%] bg-[linear-gradient(to_top,#fff_0%,rgba(255,255,255,0.94)_12%,rgba(255,255,255,0.74)_26%,rgba(255,255,255,0.46)_42%,rgba(255,255,255,0.22)_58%,rgba(255,255,255,0.06)_78%,rgba(255,255,255,0)_100%)]" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/90 px-3.5 py-1 text-xs font-semibold text-[#0B408B] shadow-xs backdrop-blur-sm">
              <Building2 className="size-3.5 text-[#0B408B]" />
              <span>Careevo untuk Bisnis & Enterprise</span>
            </div>
            <h1 className="mb-6 text-balance text-4xl font-medium tracking-tight !text-white drop-shadow-sm sm:text-5xl md:text-6xl leading-[1.12]">
              Dibangun untuk pembelajar.<br />
              <span className="!text-white">Mendorong dampak nyata bagi tim.</span>
            </h1>
            <p className="mb-8 text-base text-white/90 sm:text-lg lg:text-xl leading-relaxed">
              Dipercaya oleh ribuan profesional dan organisasi. Careevo Bisnis
              membantu perusahaan Anda meningkatkan keahlian teknis, literasi
              AI, dan kapabilitas rekayasa secara terukur dan terverifikasi.
            </p>

            {/* Value points */}
            <div className="mb-10 flex flex-wrap items-center justify-center gap-y-2 gap-x-6 text-xs sm:text-sm font-medium text-white/90">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-[#bfdbfe]" />
                Kurikulum berbasis praktik langsung
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-[#bfdbfe]" />
                Jalur belajar mandiri & interaktif
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-[#bfdbfe]" />
                Pelaporan & analitik tim real-time
              </span>
            </div>

            {/* CTA buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5">
              <Link
                href="/masuk"
                className="grad-btn inline-flex h-11 w-full sm:w-auto items-center justify-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:shadow-md"
              >
                <span>Minta Demo Platform</span>
                <ChevronRight className="size-4" />
              </Link>
              <Link
                href="#harga"
                className="inline-flex h-11 w-full sm:w-auto items-center justify-center rounded-lg border border-white/70 bg-white/90 px-6 py-2.5 text-sm font-semibold text-[#12324a] shadow-xs backdrop-blur-sm transition hover:bg-white"
              >
                Lihat Paket & Harga
              </Link>
            </div>
          </Reveal>
        </div>

        {/* Hero Dashboard Preview.
         *
         * The image is `EcommerceDash` — the same asset the home page hero
         * card renders, imported from the shared assets index rather than
         * re-typed as a path, so the two heroes cannot drift apart again.
         * (It replaces `business-landing/blp-hero-new.png`, which nothing else
         * referenced.) `next/image` with the index's own width/height keeps the
         * aspect ratio locked and reserves the box before the file lands.
         *
         * The shadow is deliberately *tight and shallow* — about 10% at the
         * card's bottom edge, gone within ~6px. Two earlier versions both read
         * as a bug rather than as depth: `shadow-2xl shadow-blue-900/10`
         * (50px blur) spread a soft grey cloud across the whole lower hero,
         * and a first attempt at this fix (`0 10px 24px -12px / 0.28`) put
         * 28% of hard blue-grey on a background that is already ~94% white,
         * which is a grey bar. A drop shadow needs a dark surface to read as
         * depth; here the honest separator is the card's own hairline border,
         * so the shadow only has to hint at contact. Measured off the rendered
         * page, `0 20px 60px -34px` at 0.22 keeps the edge at ~10% and decays
         * to nothing by 6px below the card. */}
        <Reveal delay={150} className="mt-14 lg:mt-16">
          <div className="relative mx-auto max-w-5xl rounded-2xl border border-gray-200/90 bg-white p-2 shadow-[0_20px_60px_-34px_rgba(9,33,84,0.22)] ring-1 ring-gray-900/5">
            <div className="relative overflow-hidden rounded-xl bg-gray-900">
              <Image
                src={EcommerceDash.src}
                alt={EcommerceDash.alt}
                width={EcommerceDash.width}
                height={EcommerceDash.height}
                className="h-auto w-full object-cover"
              />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
