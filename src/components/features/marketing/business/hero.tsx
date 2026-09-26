import Image from "next/image";
import Link from "next/link";
import { Building2, CheckCircle2, ChevronRight } from "lucide-react";
import { Reveal } from "@/components/features/marketing/primitives";

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
        {/* Gentle white fading on the bottom edge to blend into page body */}
        <div className="absolute inset-x-0 bottom-0 h-44 sm:h-64 bg-gradient-to-t from-white via-white/80 to-transparent" />
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

        {/* Hero Dashboard Preview */}
        <Reveal delay={150} className="mt-14 lg:mt-16">
          <div className="relative mx-auto max-w-5xl rounded-2xl border border-gray-200/90 bg-white p-2 shadow-2xl shadow-blue-900/10 ring-1 ring-gray-900/5">
            <div className="relative overflow-hidden rounded-xl bg-gray-900">
              <img
                src="/images/business-landing/blp-hero-new.png"
                alt="Dashboard Platform Careevo Bisnis"
                className="w-full h-auto object-cover"
              />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
