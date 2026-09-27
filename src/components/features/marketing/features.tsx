import Link from "next/link";
import Image from "next/image";
import {
  Award,
  Bot,
  CheckCircle2,
  ChevronRight,
  Lock,
  SlidersHorizontal,
  Workflow,
} from "lucide-react";
import { Reveal } from "./primitives";

/* -------------------------------------------------------------------------
 * Graphic 01: Skill Track Coverage Diagram (Cal.com style)
 * Clean faint concentric circles, central Careevo pill, square skill tiles.
 * Tiles name skill areas, not third-party companies.
 * ------------------------------------------------------------------------- */
function SkillTrackOrbitGraphic() {
  return (
    <div className="relative flex h-[230px] sm:h-[240px] w-full items-center justify-center overflow-hidden rounded-2xl border border-gray-100 bg-[#FAFAFA]">
      {/* Concentric faint hairline orbit rings */}
      <div className="absolute size-48 rounded-full border border-gray-200/60" />
      <div className="absolute size-32 rounded-full border border-gray-200/50" />
      <div className="absolute size-18 rounded-full border border-gray-200/40" />

      {/* Orbit Tile 1: Top-Left (Backend) */}
      <div className="absolute top-4 left-8 flex size-10 items-center justify-center rounded-xl border border-gray-200 bg-white shadow-2xs transition-transform duration-200 hover:scale-105">
        <span className="text-[10px] font-semibold tracking-tight text-gray-700">
          Backend
        </span>
      </div>

      {/* Orbit Tile 2: Right (Frontend) */}
      <div className="absolute right-6 top-14 flex size-10 items-center justify-center rounded-xl border border-gray-200 bg-white shadow-2xs transition-transform duration-200 hover:scale-105">
        <span className="text-[10px] font-semibold tracking-tight text-gray-700">
          Frontend
        </span>
      </div>

      {/* Orbit Tile 3: Bottom-Left (Data & AI) */}
      <div className="absolute bottom-5 left-14 flex size-10 items-center justify-center rounded-xl border border-gray-200 bg-white shadow-2xs transition-transform duration-200 hover:scale-105">
        <span className="text-center text-[10px] font-semibold leading-tight tracking-tight text-gray-700">
          Data
          <br />&amp; AI
        </span>
      </div>

      {/* Center Core Pill: Careevo */}
      <div className="relative z-10 flex items-center gap-2 rounded-full border border-gray-200/90 bg-white px-4 py-1.5 shadow-2xs">
        <span className="text-xs font-bold text-gray-900 tracking-tight">Careevo</span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
 * Graphic 02: Adaptive AI Agent Personalized Guidance (Cal.com stacked style)
 * Clean standard typography, active toggle switch, interest and pacing controls.
 * ------------------------------------------------------------------------- */
function AiAgentPersonalizedGraphic() {
  return (
    <div className="relative flex h-[230px] sm:h-[240px] w-full flex-col justify-center overflow-hidden rounded-2xl border border-gray-100 bg-[#FAFAFA] p-4">
      <div className="space-y-2.5">
        {/* Row 1: Focus Track / Interest */}
        <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <Bot className="size-4 text-gray-700" />
            <span className="text-xs font-semibold text-gray-900">Minat Belajar</span>
          </div>
          <span className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700 shadow-2xs">
            Backend &amp; AI
          </span>
        </div>

        {/* Row 2: Adaptive Socratic Guidance (Active Solid Black Toggle) */}
        <div className="flex items-center justify-between rounded-xl border border-gray-300/80 bg-white px-3.5 py-2.5 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="flex h-5 w-8 items-center justify-end rounded-full bg-gray-950 p-0.5">
              <div className="size-4 rounded-full bg-white shadow-xs" />
            </div>
            <span className="text-xs font-semibold text-gray-900">Bimbingan Sokratik</span>
          </div>
          <span className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700 shadow-2xs">
            Uji Logika
          </span>
        </div>

        {/* Row 3: Pacing / Tempo Adaptif */}
        <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <SlidersHorizontal className="size-4 text-gray-700" />
            <span className="text-xs font-semibold text-gray-900">Tempo Adaptif</span>
          </div>
          <span className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700 shadow-2xs">
            Nir-Kunci Instan
          </span>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
 * Graphic 03: Verified Certificate & Telemetry Dossier (Cal.com window style)
 * Clean standard typography, balanced metrics grid, zero awkward line breaks.
 * ------------------------------------------------------------------------- */
function VerifiedCertificateGraphic() {
  return (
    <div className="relative flex h-[230px] sm:h-[240px] w-full flex-col justify-between overflow-hidden rounded-2xl border border-gray-100 bg-[#FAFAFA] p-3.5">
      {/* Window Titlebar with 3 Neutral Gray Dots & Verification URL */}
      <div className="flex items-center justify-between border-b border-gray-200/60 pb-2">
        <div className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-gray-300" />
          <span className="size-2 rounded-full bg-gray-300" />
          <span className="size-2 rounded-full bg-gray-300" />
        </div>
        <span className="text-[11px] text-gray-400">careevo.id/verify/cert-8921</span>
      </div>

      {/* Main Certificate Box with Balanced Metric Breakdown */}
      <div className="my-auto rounded-xl border border-gray-200 bg-white p-3 shadow-2xs">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-gray-100 text-gray-900">
              <Award className="size-4 text-gray-800" />
            </div>
            <div>
              <div className="text-xs font-bold text-gray-900 leading-tight">Sertifikat Terverifikasi</div>
              <div className="text-[11px] text-gray-500">Fullstack &amp; AI Engineering</div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-800">
            <CheckCircle2 className="size-3 text-gray-900" />
            Sah
          </span>
        </div>

        {/* 3 Telemetry Metrics (Spacious 3-Column Grid) */}
        <div className="mt-2.5 grid grid-cols-3 gap-2 border-t border-gray-100 pt-2 text-center">
          <div>
            <div className="text-[10px] text-gray-400">Waktu</div>
            <div className="text-xs font-semibold text-gray-800 mt-0.5">48 Jam Aktif</div>
          </div>
          <div>
            <div className="text-[10px] text-gray-400">Progres</div>
            <div className="text-xs font-semibold text-gray-800 mt-0.5">142 Commit</div>
          </div>
          <div>
            <div className="text-[10px] text-gray-400">Integritas</div>
            <div className="text-xs font-semibold text-gray-900 mt-0.5">Nir-AI Instan</div>
          </div>
        </div>
      </div>

      {/* Floating Bottom Integrity Pill */}
      <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3.5 py-1 text-[11px] text-gray-700 shadow-2xs">
        <Lock className="size-3 text-gray-700" strokeWidth={1.8} />
        <span className="font-semibold text-gray-900">Tanda tangan digital</span>
        <span className="text-gray-300">•</span>
        <span>Rekaman kerja tersimpan</span>
      </div>
    </div>
  );
}

const CARDS = [
  {
    step: "01",
    id: "kursus",
    title: "Kursus yang kuratornya orang yang kerja di bidangnya",
    description:
      "Materinya disusun dari lowongan yang baru saja dilamar banyak orang, lalu dijaga praktisi yang memang handles bidang itu. Jadi yang kamu pelajari itu yang perusahaan cari minggu ini, bukan yang masih teori doang.",
    graphic: <SkillTrackOrbitGraphic />,
  },
  {
    step: "02",
    id: "socrates",
    title: "Agent-nya nanya, bukan kasih jawaban",
    description:
      "Kalau kamu mentok di satu soal, dia bakal megang sampai kamu paham sendiri. Latihan ngikutin minat dan waktu luang kamu, bukan ngikutin kurikulum tetap.",
    graphic: <AiAgentPersonalizedGraphic />,
  },
  {
    step: "03",
    id: "sertifikat",
    title: "Sertifikatmu bawa rekam jejak kerjaan",
    description:
      "Ada tugasnya, ada revisi kamu, ada tesnya. Rekruter cuma perlu buka satu tautan, tanpa install apa pun, buat ngecek itu hasil kerjamu sendiri.",
    graphic: <VerifiedCertificateGraphic />,
  },
];

export function MarketingFeatures() {
  return (
    <section
      id="fitur"
      className="border-y border-gray-100 bg-[#F9FAFB] py-14 sm:py-16 lg:py-20"
    >
      <div className="px-6 sm:px-10 lg:px-16">
        {/*
          Image container. The artwork fills this element edge to edge: there
          is deliberately no white mat, padding gap, or ring around it, because
          a light border on a pale sky reads as a visible frame. The only
          margin is the wrapper's own `px`, so the container runs almost to
          both screen edges. The section keeps the neutral `#F9FAFB` band, which
          is also what `comparison.tsx` uses on the other side of this section.

          Content stays at `max-w-7xl` so the three cards keep a comfortable
          measure on wide screens; the sky either side of them is the point of
          a wallpaper backdrop.

          The image is passed through unoptimized, like
          `masalah-solusi/*.webp` and `hero-mountain.png`: it is a wide soft
          gradient, and re-encoding lossy-on-lossy at the optimizer's default
          q=75 is what produces visible banding. The source is already WebP q=90
          (47 dB PSNR vs the original PNG), and at 35 KB a passthrough is
          cheaper than any srcset would be for a backdrop this size.
          Consequence of `unoptimized`: no srcset is generated, so `sizes` would
          never be read and is deliberately omitted.
        */}
        <div className="relative isolate overflow-hidden rounded-[48px] shadow-[0_30px_90px_-18px_rgba(10,61,98,0.12)]">
          <Image
            src="/images/fitur-sky.webp"
            alt=""
            fill
            unoptimized
            aria-hidden="true"
            className="-z-10 object-cover object-center"
          />
          {/*
            Scrim, not decoration. The darkest pixel in the source is
            #9CCBF9; at 40% white the header paragraph's text-gray-600
            measures 5.5:1 against it. Without the scrim text-gray-500
            measures 2.84:1 and fails WCAG AA, and no white scrim rescues
            gray-500 — it needs 80%+ and by then the artwork is gone.
          */}
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-white/40"
          />

          <div className="px-4 py-14 sm:px-6 sm:py-16 lg:py-20">
            {/* Section Header with Pill Badge & Buttons */}
            <div className="mx-auto max-w-3xl text-center">
              <Reveal>
                <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-gray-200/90 bg-white px-3.5 py-1 text-xs font-semibold text-gray-800 shadow-2xs">
                  <Workflow className="size-3.5 text-gray-700" />
                  <span>Cara kerja</span>
                </div>
              </Reveal>

              <Reveal delay={60}>
                <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl lg:text-5xl leading-tight">
                  Tiga langkah nyata: belajar, buktikan, dan siap kerja
                </h2>
              </Reveal>

              <Reveal delay={120}>
                {/* text-gray-600, not gray-500: this paragraph sits
                    directly on the sky artwork, where gray-500 would land
                    at 2.84:1 and fail WCAG AA. */}
                <p className="mt-4 text-base text-gray-600 leading-relaxed max-w-xl mx-auto">
                  Mulai dari materi yang lagi dicari, latihan yang ngikutin
                  minat kamu, sampai sertifikat yang bisa dibuka rekruter.
                </p>
              </Reveal>

              <Reveal delay={160}>
                <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                  <Link
                    href="/daftar"
                    className="inline-flex items-center gap-1.5 rounded-full bg-gray-950 px-5 py-2.5 text-sm font-medium text-white shadow-xs transition hover:bg-gray-800"
                  >
                    <span>Cobain challenge gratis</span>
                    <ChevronRight className="size-4 opacity-70" />
                  </Link>
                  <Link
                    href="/loker"
                    className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-800 shadow-xs transition hover:bg-gray-50"
                  >
                    <span>Lihat cara cek loker</span>
                    <ChevronRight className="size-4 opacity-70" />
                  </Link>
                </div>
              </Reveal>
            </div>

            {/* 3 Cal.com-style Feature Cards */}
            <div className="mx-auto mt-14 max-w-7xl grid grid-cols-1 md:grid-cols-3 gap-6 sm:mt-16 lg:gap-8">
              {CARDS.map((card, index) => (
                <Reveal key={card.step} id={card.id} delay={index * 80}>
                  <div className="group flex h-full flex-col justify-between rounded-2xl lg:rounded-3xl border border-gray-200/90 bg-white p-6 sm:p-7 shadow-xs transition-all duration-300 hover:border-gray-300 hover:shadow-md">
                    <div>
                      {/* Step Number Badge */}
                      <div className="size-8 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-700">
                        {card.step}
                      </div>

                      {/* Title & Description */}
                      <h3 className="mt-5 text-xl font-bold tracking-tight text-gray-900 leading-snug">
                        {card.title}
                      </h3>
                      <p className="mt-2 text-sm text-gray-500 leading-relaxed min-h-[4.5rem]">
                        {card.description}
                      </p>
                    </div>

                    {/* Graphic Visual Mock */}
                    <div className="mt-6">
                      {card.graphic}
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
