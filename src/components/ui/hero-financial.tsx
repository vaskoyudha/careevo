"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { TimelineAnimation } from "@/components/ui/hero-financial-utils/timeline-animation";
import { EcommerceDash } from "@/components/ui/hero-financial-utils/assets-index";

export const HeroFinancial = () => {
  const timelineRef = React.useRef<HTMLDivElement>(null);

  return (
    <section
      ref={timelineRef}
      aria-labelledby="hero-title"
      className="relative flex min-h-screen min-h-[100svh] flex-col items-center bg-white text-[#1e293b]"
    >
      {/* Mountain Backdrop */}
      <div className="pointer-events-none absolute inset-x-0 -top-28 z-0 h-[640px] sm:h-[780px] md:h-[920px] lg:h-[1050px] w-full overflow-hidden select-none">
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
        <TimelineAnimation
          animationNum={1}
          timelineRef={timelineRef}
          className="bg-white w-fit mx-auto text-black px-1.5 py-1 rounded-full inline-flex items-center gap-2 shadow-lg shadow-blue-500/20 border-2 border-white"
        >
          <span className="bg-neutral-900 text-white px-2 py-0.5 rounded-full text-xs font-medium uppercase tracking-widest">
            Gratis
          </span>
          <span className="text-sm font-medium">
            Latihan interview kerja, satu challenge per minggu
          </span>
        </TimelineAnimation>

        <TimelineAnimation
          as="h1"
          id="hero-title"
          animationNum={2}
          timelineRef={timelineRef}
          className="mx-auto w-full max-w-4xl text-balance text-4xl font-medium tracking-tight text-neutral-900 sm:text-5xl md:text-6xl"
        >
          Perusahaan mau lihat cara kamu berpikir,
          <br />
          bukan cuma proyek dan sertifikat usaha dari AI
        </TimelineAnimation>

        <TimelineAnimation
          as="p"
          animationNum={3}
          timelineRef={timelineRef}
          className="mx-auto w-full max-w-2xl px-4 text-base font-medium leading-relaxed text-neutral-500 md:text-lg"
        >
          Setiap keputusan kodemu dicatat, termasuk yang salah dan kamu perbaiki
          sendiri. Perusahaan bisa buka rekamannya lewat satu tautan.
        </TimelineAnimation>

        <div className="flex w-full flex-wrap justify-center gap-3 sm:gap-4">
          <TimelineAnimation
            as={Link}
            href="/daftar"
            animationNum={4}
            timelineRef={timelineRef}
            className="grad-btn rounded-lg px-4 py-2.5 text-base transition"
          >
            Cobain satu challenge, gratis
          </TimelineAnimation>
          <TimelineAnimation
            as={Link}
            href="/loker"
            animationNum={5}
            timelineRef={timelineRef}
            className="rounded-lg border border-neutral-300 bg-linear-to-br from-neutral-50 via-neutral-100 to-neutral-300 px-4 py-2.5 text-base text-black shadow-sm transition"
          >
            Lihat loker yang lolos cek
          </TimelineAnimation>
          <TimelineAnimation
            as={Link}
            href="/jelajah"
            animationNum={6}
            timelineRef={timelineRef}
            className="rounded-lg border border-neutral-300 bg-linear-to-br from-neutral-50 via-neutral-100 to-neutral-300 px-4 py-2.5 text-base text-black shadow-sm transition"
          >
            Jelajahi kursus
          </TimelineAnimation>
        </div>
      </div>

      {/* Dashboard UI Frame */}
      <div className="relative mx-auto mt-10 w-full max-w-7xl rounded-xl">
        <TimelineAnimation
          animationNum={6}
          timelineRef={timelineRef}
          className="rounded-2xl bg-white/50 backdrop-blur-lg p-4"
        >
          <TimelineAnimation
            as="img"
            animationNum={7}
            timelineRef={timelineRef}
            src={EcommerceDash.src}
            alt={EcommerceDash.alt}
            width={EcommerceDash.width}
            height={EcommerceDash.height}
            className="w-full relative z-4 rounded-2xl"
          />
        </TimelineAnimation>
      </div>
    </section>
  );
};

export default HeroFinancial;
