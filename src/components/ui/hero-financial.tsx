"use client";

import * as React from "react";
import Link from "next/link";
import { TimelineAnimation } from "@/components/ui/hero-financial-utils/timeline-animation";
import { EcommerceDash } from "@/components/ui/hero-financial-utils/assets-index";

export const HeroFinancial = () => {
  const timelineRef = React.useRef<HTMLDivElement>(null);

  return (
    <section
      ref={timelineRef}
      aria-labelledby="hero-title"
      className="relative flex min-h-screen flex-col items-center bg-white text-[#1e293b]"
    >
      <div className="absolute -top-40 left-0 z-0 h-[calc(100vh+10rem)] w-full bg-[url('https://cdn.21st.dev/assets/mirror/f2/f2f40d6a9618bd458d2e195ccde0198a210e9700f51eb0e97976fcd984259b26.jpg')] bg-cover bg-top bg-no-repeat opacity-50 [mask-image:linear-gradient(to_bottom,black_55%,transparent)]" />

      {/* Soft Background Gradients */}
      <TimelineAnimation
        timelineRef={timelineRef}
        animationNum={5}
        className="absolute -top-40 left-0 w-full h-[calc(600px+10rem)] bg-linear-to-b from-blue-50 via-blue-100 to-transparent opacity-100"
      />

      {/* Hero Content */}
      <div className="relative z-10 text-center pt-24 pb-16 px-4 flex flex-col gap-6">
        <TimelineAnimation
          animationNum={1}
          timelineRef={timelineRef}
          className="bg-white w-fit mx-auto text-black px-1.5 py-1 rounded-full inline-flex items-center gap-2 shadow-lg shadow-blue-500/20 border-2 border-white"
        >
          <span className="bg-linear-to-br from-blue-500 to-blue-200 text-white px-2 py-0.5 rounded-full text-xs font-medium uppercase tracking-widest">
            Baru
          </span>
          <span className="text-sm font-medium">
            Belajar terverifikasi untuk lulusan Computer Science
          </span>
        </TimelineAnimation>

        <TimelineAnimation
          as="h1"
          id="hero-title"
          animationNum={2}
          timelineRef={timelineRef}
          className="max-w-4xl text-4xl font-medium tracking-tight text-neutral-900 sm:text-5xl md:text-6xl"
        >
          Portofolio bisa dibuat AI. <br /> Kompetensi tidak.
        </TimelineAnimation>

        <TimelineAnimation
          as="p"
          animationNum={3}
          timelineRef={timelineRef}
          className="mx-auto max-w-2xl px-4 text-base font-medium leading-relaxed text-neutral-500 md:text-lg"
        >
          Careevo adalah jembatan terverifikasi dari course ke kerja
          pertama. Proses belajar terekam, hasil ditandatangani HMAC-SHA256, dan
          setiap loker diaudit agen. Nir-biometrik dan Zero-PII.
        </TimelineAnimation>

        <div className="flex gap-4 justify-center">
          <TimelineAnimation
            as={Link}
            href="/daftar"
            animationNum={4}
            timelineRef={timelineRef}
            className="rounded-lg border border-blue-300 bg-linear-to-br from-blue-500 via-blue-400 to-blue-200 px-4 py-2.5 text-base text-white shadow-sm transition"
          >
            Mulai gratis
          </TimelineAnimation>
          <TimelineAnimation
            as={Link}
            href="#loop"
            animationNum={5}
            timelineRef={timelineRef}
            className="rounded-lg border border-neutral-300 bg-linear-to-br from-neutral-50 via-neutral-100 to-neutral-300 px-4 py-2.5 text-base text-black shadow-sm transition"
          >
            Lihat cara kerja
          </TimelineAnimation>
        </div>
      </div>

      {/* Dashboard UI Frame */}
      <div className="w-full max-w-7xl mx-auto rounded-xl relative mt-10">
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
