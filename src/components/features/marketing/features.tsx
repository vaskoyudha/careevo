"use client";

import { useRef } from "react";
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
import { useFeaturesMotion } from "./features-motion";

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
  const sectionRef = useRef<HTMLElement>(null);
  useFeaturesMotion(sectionRef);

  return (
    <section id="fitur" ref={sectionRef} className="relative isolate overflow-hidden">
      {/*
        Full-bleed wallpaper. This section IS the image container, so the sky
        runs to all four edges — no `py`, no wrapper `px`, no `rounded-[48px]`,
        no drop shadow, and no `bg-[#F9FAFB]` band with its `border-y` (both of
        which used to draw a frame: the pale gap beside the rounded corners and
        the hairline above and below it). `overflow-hidden` is what keeps the
        `absolute` image and scrim from establishing a scroll region, so the
        sky cannot push a horizontal scrollbar on narrow viewports.

        `object-cover` now upscales ~1.11x at 1850px wide, where the artwork
        (1672x941, aspect 1.777) is slightly narrower than the section it fills.
        That is deliberate and free: the source is a smooth gradient with no hard
        edges, so 11% bilinear scaling is invisible, whereas a srcset at the
        optimizer's default q=75 would band it. Same reason the image is
        `unoptimized` (see below) — which is also why `sizes` is omitted: no
        srcset is generated, so it would never be read.

        The inset is the content wrapper's job now, not the artwork's. Content
        stays at `max-w-7xl` so the three cards keep a comfortable measure on
        wide screens; the sky either side of them is the point of a backdrop.
      */}
      <Image
        src="/images/fitur-sky.webp"
        alt=""
        fill
        unoptimized
        aria-hidden="true"
        data-fe="sky"
        className="-z-10 object-cover object-center"
      />
      {/*
        Scrim, not decoration. The darkest pixel in the source is
        #9CCBF9; at 40% white the header paragraph's text-gray-600
        measures 5.5:1 against it. Without the scrim text-gray-500
        measures 2.84:1 and fails WCAG AA, and no white scrim rescues
        gray-500 — it needs 80%+ and by then the artwork is gone.
      */}
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-white/40" />
      {/*
        Dissolve the wallpaper into the sections either side of it, so the sky
        ends without a horizontal cut. Painted, not masked: a `mask-image` can
        only reveal what is behind the section, and the two neighbours are not
        the same colour — `problems-solutions` above is white, `comparison`
        below is `#F9FAFB`. Two gradients, one per neighbour.

        DOM order after the scrim is what puts these on top of it: all four
        layers are `-z-10` inside the section's `isolate`, so equal z-index
        resolves to document order.

        They stay *under* the content. Negative z-index paints below in-flow
        blocks, so the cards sit on top of the fade rather than being faded with
        it — only the sky between and below them dissolves.

        The falloff is eased rather than linear — opaque only for the first 18%
        of the strip, then a long tail to transparent — because a straight
        white-to-transparent ramp over 160px would wash the "Cara kerja" pill
        and the headline out of the sky. This lands flat on the edge (which is
        what hides the cut) while giving the artwork back by the time the text
        arrives.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-40 bg-[linear-gradient(to_bottom,#ffffff_0%,rgba(255,255,255,0.35)_18%,transparent_100%)] sm:h-48"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-40 bg-[linear-gradient(to_top,#f9fafb_0%,rgba(249,250,251,0.35)_18%,transparent_100%)] sm:h-48"
      />

      <div className="px-6 py-14 sm:px-10 sm:py-16 lg:px-16 lg:py-20">
        {/* Section Header with Pill Badge & Buttons */}
        <div className="mx-auto max-w-3xl text-center">
          <div
            data-fe="pill"
            className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-gray-200/90 bg-white px-3.5 py-1 text-xs font-semibold text-gray-800 shadow-2xs"
          >
            <Workflow className="size-3.5 text-gray-700" />
            <span>Cara kerja</span>
          </div>

          <h2
            data-fe="title"
            className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl lg:text-5xl leading-tight"
          >
            Tiga langkah nyata: belajar, buktikan, dan siap kerja
          </h2>

          {/* text-gray-600, not gray-500: this paragraph sits
              directly on the sky artwork, where gray-500 would land
              at 2.84:1 and fail WCAG AA. */}
          <p
            data-fe="lede"
            className="mt-4 text-base text-gray-600 leading-relaxed max-w-xl mx-auto"
          >
            Mulai dari materi yang lagi dicari, latihan yang ngikutin
            minat kamu, sampai sertifikat yang bisa dibuka rekruter.
          </p>

          <div
            data-fe="cta"
            className="mt-7 flex flex-wrap items-center justify-center gap-3"
          >
            {/* Same navbar classes as `DashboardButton`/`Daftar`, not a
                hand-rolled look-alike: `chrome-btn` carries the height, radius,
                layered shadow, hover/active transform and 200ms transition, so
                the CTA is literally the navbar button. Primary =
                `chrome-btn-brand`, secondary = `chrome-btn-white` (the pair used
                in `materi-foot-bar.tsx`). */}
            <Link
              href="/daftar"
              className="chrome-btn chrome-btn-brand gap-1.5"
            >
              <span>Cobain challenge gratis</span>
              <ChevronRight className="size-4 opacity-70" />
            </Link>
            <Link
              href="/loker"
              className="chrome-btn chrome-btn-white gap-1.5"
            >
              <span>Lihat cara cek loker</span>
              <ChevronRight className="size-4 opacity-70" />
            </Link>
          </div>
        </div>

        {/*
          3 Cal.com-style Feature Cards, plus the two connectors that make them
          a sequence rather than a row.

          The connectors live in the grid, absolutely positioned at 1/3 and
          2/3 of its width — which is the centre of each gap for a 3-column
          grid (the gap itself shifts the true centre by ~0.3%, and being wrong
          by 4px cannot be seen because the ends sit behind the cards).

          Centred with a negative margin instead of `-translate-x-1/2`: the
          container must not own a `transform`, or nothing else could be given
          one without fighting it. The cards are `relative z-10` for the same
          reason in reverse — an absolutely positioned sibling with `z-index:
          auto` paints *above* non-positioned blocks, so without the z-index the
          arrowheads would sit on top of the white cards.

          `h-0` so the children can be placed by their own offsets rather than
          by half of a height that changes at `sm`.
        */}
        <div className="relative mx-auto mt-14 max-w-7xl grid grid-cols-1 md:grid-cols-3 gap-6 sm:mt-16 lg:gap-8">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-[33.333%] top-[42px] hidden h-0 w-14 -ml-7 md:block"
          >
            <span
              data-fe="rail-line"
              className="absolute inset-x-0 top-0 block h-px origin-left bg-gray-400"
            />
            <span
              data-fe="rail-arrow"
              className="absolute left-[60%] top-0 -ml-1.5 -mt-1.5 block size-3 text-gray-500"
            >
              <ChevronRight className="size-3" strokeWidth={2.5} />
            </span>
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-[66.666%] top-[42px] hidden h-0 w-14 -ml-7 md:block"
          >
            <span
              data-fe="rail-line"
              className="absolute inset-x-0 top-0 block h-px origin-left bg-gray-400"
            />
            <span
              data-fe="rail-arrow"
              className="absolute left-[60%] top-0 -ml-1.5 -mt-1.5 block size-3 text-gray-500"
            >
              <ChevronRight className="size-3" strokeWidth={2.5} />
            </span>
          </div>

          {CARDS.map((card) => (
            <div
              key={card.step}
              id={card.id}
              data-fe="card"
              className="relative z-10"
            >
              <div className="group flex h-full flex-col justify-between rounded-2xl lg:rounded-3xl border border-gray-200/90 bg-white p-6 sm:p-7 shadow-xs transition-all duration-300 hover:border-gray-300 hover:shadow-md">
                <div>
                  {/* Step Number Badge */}
                  <div
                    data-fe="badge"
                    className="size-8 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-700"
                  >
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
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
