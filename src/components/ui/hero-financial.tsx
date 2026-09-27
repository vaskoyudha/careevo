"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useHeroMotion } from "@/components/ui/hero-financial-utils/hero-motion";
import { EcommerceDash } from "@/components/ui/hero-financial-utils/assets-index";

export const HeroFinancial = () => {
  const sectionRef = React.useRef<HTMLElement>(null);
  const headlineRef = React.useRef<HTMLHeadingElement>(null);
  const backdropRef = React.useRef<HTMLDivElement>(null);

  /**
   * Entrance order, in reading order. `useHeroMotion` staggers these by DOM
   * position, so the list is the single place the sequence is defined — the
   * previous per-child `animationNum` prop let the third CTA and the dashboard
   * frame share a number and land together.
   */
  const sequence = React.useRef<(HTMLElement | null)[]>([]);
  const step = React.useCallback(
    (index: number) => (el: HTMLElement | null) => {
      sequence.current[index] = el;
    },
    [],
  );

  useHeroMotion({
    section: sectionRef,
    headline: headlineRef,
    backdrop: backdropRef,
    sequence,
  });

  return (
    <section
      ref={sectionRef}
      aria-labelledby="hero-title"
      className="relative flex min-h-screen min-h-[100svh] flex-col items-center bg-white text-[#1e293b]"
    >
      {/* Mountain Backdrop */}
      <div
        ref={backdropRef}
        className="pointer-events-none absolute inset-x-0 -top-28 z-0 h-[640px] sm:h-[780px] md:h-[920px] lg:h-[1050px] w-full overflow-hidden select-none"
      >
        <Image
          src="/images/hero-mountain.png"
          alt="Careevo hero background"
          fill
          priority
          unoptimized
          sizes="100vw"
          className="object-cover object-top opacity-100"
        />
        {/* Clean bottom transition into page background */}
        <div className="absolute inset-x-0 bottom-0 h-48 sm:h-72 bg-gradient-to-t from-white via-white/50 to-transparent" />
      </div>

      {/* Hero Content */}
      <div className="relative z-10 flex w-full flex-col gap-6 px-4 pt-24 pb-16 text-center">
        <div
          ref={step(0)}
          className="bg-white w-fit mx-auto text-black px-1.5 py-1 rounded-full inline-flex items-center gap-2 shadow-lg shadow-blue-500/20 border-2 border-white"
        >
          <span className="bg-neutral-900 text-white px-2 py-0.5 rounded-full text-xs font-medium uppercase tracking-widest">
            Gratis
          </span>
          <span className="text-sm font-medium">
            Latihan interview kerja, satu challenge per minggu
          </span>
        </div>

        <h1
          ref={headlineRef}
          id="hero-title"
          className="mx-auto w-full max-w-4xl text-balance text-4xl font-medium tracking-tight text-neutral-900 sm:text-5xl md:text-6xl"
        >
          Perusahaan mau lihat cara kamu berpikir, bukan cuma proyek dan
          sertifikat usaha dari AI
        </h1>

        <p
          ref={step(1)}
          className="mx-auto w-full max-w-2xl px-4 text-base font-medium leading-relaxed text-neutral-500 md:text-lg"
        >
          Setiap keputusan kodemu dicatat, termasuk yang salah dan kamu perbaiki
          sendiri. Perusahaan bisa buka rekamannya lewat satu tautan.
        </p>

        <div className="flex w-full flex-wrap justify-center gap-3 sm:gap-4">
          <Link
            ref={step(2)}
            href="/daftar"
            className="grad-btn rounded-lg px-4 py-2.5 text-base transition"
          >
            Cobain satu challenge, gratis
          </Link>
          <Link
            ref={step(3)}
            href="/loker"
            className="rounded-lg border border-neutral-300 bg-linear-to-br from-neutral-50 via-neutral-100 to-neutral-300 px-4 py-2.5 text-base text-black shadow-sm transition"
          >
            Lihat loker yang lolos cek
          </Link>
          <Link
            ref={step(4)}
            href="/jelajah"
            className="rounded-lg border border-neutral-300 bg-linear-to-br from-neutral-50 via-neutral-100 to-neutral-300 px-4 py-2.5 text-base text-black shadow-sm transition"
          >
            Jelajahi kursus
          </Link>
        </div>
      </div>

      {/* Dashboard UI Frame */}
      <div className="relative mx-auto mt-10 w-full max-w-7xl rounded-xl">
        <div
          ref={step(5)}
          className="rounded-2xl bg-white/50 backdrop-blur-lg p-4"
        >
          <Image
            ref={step(6)}
            src={EcommerceDash.src}
            alt={EcommerceDash.alt}
            width={EcommerceDash.width}
            height={EcommerceDash.height}
            className="w-full relative z-4 rounded-2xl"
          />
        </div>
      </div>
    </section>
  );
};

export default HeroFinancial;
