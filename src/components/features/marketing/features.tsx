import Link from "next/link";
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
 * Graphic 01: Industry Partners Orbit Diagram (Cal.com style)
 * Clean faint concentric circles, central Careevo pill, square partner tiles.
 * ------------------------------------------------------------------------- */
function IndustryPartnersOrbitGraphic() {
  return (
    <div className="relative flex h-[230px] sm:h-[240px] w-full items-center justify-center overflow-hidden rounded-2xl border border-gray-100 bg-[#FAFAFA]">
      {/* Concentric faint hairline orbit rings */}
      <div className="absolute size-48 rounded-full border border-gray-200/60" />
      <div className="absolute size-32 rounded-full border border-gray-200/50" />
      <div className="absolute size-18 rounded-full border border-gray-200/40" />

      {/* Orbit Tile 1: Top-Left (Google) */}
      <div className="absolute top-4 left-8 flex size-10 items-center justify-center rounded-xl border border-gray-200 bg-white shadow-2xs transition-transform duration-200 hover:scale-105">
        <svg viewBox="0 0 24 24" className="size-5" aria-label="Google">
          <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z" />
          <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z" />
          <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.97 0 12s.45 3.82 1.25 5.42l4.03-3.15z" />
          <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
        </svg>
      </div>

      {/* Orbit Tile 2: Right (IBM) */}
      <div className="absolute right-6 top-14 flex size-10 items-center justify-center rounded-xl border border-gray-200 bg-white shadow-2xs transition-transform duration-200 hover:scale-105">
        <span className="text-xs font-black tracking-tight text-gray-900">IBM</span>
      </div>

      {/* Orbit Tile 3: Bottom-Left (Microsoft) */}
      <div className="absolute bottom-5 left-14 flex size-10 items-center justify-center rounded-xl border border-gray-200 bg-white shadow-2xs transition-transform duration-200 hover:scale-105">
        <svg viewBox="0 0 24 24" className="size-4" aria-label="Microsoft">
          <rect x="1" y="1" width="10" height="10" fill="#F25022" />
          <rect x="13" y="1" width="10" height="10" fill="#7FBA00" />
          <rect x="1" y="13" width="10" height="10" fill="#00A4EF" />
          <rect x="13" y="13" width="10" height="10" fill="#FFB900" />
        </svg>
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
        <span className="font-semibold text-gray-900">HMAC-SHA256 Signed</span>
        <span className="text-gray-300">•</span>
        <span>Bebas Kecurangan</span>
      </div>
    </div>
  );
}

const CARDS = [
  {
    step: "01",
    id: "kursus",
    title: "Pilih kursus terverifikasi profesional",
    description:
      "Temukan materi dan sertifikasi industri yang sesuai dengan arah kariermu. Kurikulum dirancang bersama praktisi Google, IBM, dan institusi global agar skill yang kamu bangun relevan dengan kebutuhan industri.",
    graphic: <IndustryPartnersOrbitGraphic />,
  },
  {
    step: "02",
    id: "socrates",
    title: "Didampingi AI agent sesuai minatmu",
    description:
      "AI agent mempersonalisasi alur belajarmu, membantumu membedah logika yang buntu, dan menguji pemahaman secara bertahap tanpa jalan pintas atau jawaban instan.",
    graphic: <AiAgentPersonalizedGraphic />,
  },
  {
    step: "03",
    id: "sertifikat",
    title: "Sertifikat dengan bukti progres nyata",
    description:
      "Setiap sertifikat memuat laporan riwayat pengerjaan dan bukti kompetensi autentik. Rekruter mendapat bukti nyata kemampuanmu, terbebas dari kecurangan atau hasil salin-tempel AI.",
    graphic: <VerifiedCertificateGraphic />,
  },
];

export function MarketingFeatures() {
  return (
    <section id="fitur" className="bg-[#F9FAFB] border-y border-gray-100 py-24 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
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
            <p className="mt-4 text-base text-gray-500 leading-relaxed max-w-xl mx-auto">
              Mulai dari kurasi materi industri, bimbingan AI adaptif sesuai minatmu, sampai sertifikat dengan rekam jejak yang membuktikan kemampuan aslimu.
            </p>
          </Reveal>

          <Reveal delay={160}>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/daftar"
                className="inline-flex items-center gap-1.5 rounded-full bg-gray-950 px-5 py-2.5 text-sm font-medium text-white shadow-xs transition hover:bg-gray-800"
              >
                <span>Coba latihan gratis</span>
                <ChevronRight className="size-4 opacity-70" />
              </Link>
              <Link
                href="/loker"
                className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-800 shadow-xs transition hover:bg-gray-50"
              >
                <span>Lihat alur audit</span>
                <ChevronRight className="size-4 opacity-70" />
              </Link>
            </div>
          </Reveal>
        </div>

        {/* 3 Cal.com-style Feature Cards */}
        <div className="mt-14 sm:mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
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
    </section>
  );
}
