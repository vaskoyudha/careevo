import Link from "next/link";
import { Reveal } from "../primitives";

/**
 * Official SVG Logos for Microsoft, Google, Meta, and Stanford
 * matching the floating badges in the Coursera Plus reference.
 */
function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 23 23" className={className} aria-hidden="true">
      <path fill="#f25022" d="M1 1h10v10H1z" />
      <path fill="#00a4ef" d="M1 12h10v10H1z" />
      <path fill="#7fba00" d="M12 1h10v10H12z" />
      <path fill="#ffb900" d="M12 12h10v10H12z" />
    </svg>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </svg>
  );
}

function MetaIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="#0081FB" aria-hidden="true">
      <path d="M16.5 6c-1.8 0-3.3 1-4.5 2.5C10.8 7 9.3 6 7.5 6 4.5 6 2 8.5 2 12s2.5 6 5.5 6c2.4 0 4.2-1.3 5-3.1.8 1.8 2.6 3.1 5 3.1 3 0 5.5-2.5 5.5-6s-2.5-6-5.5-6zm-9 9.8c-2.1 0-3.8-1.7-3.8-3.8s1.7-3.8 3.8-3.8c1.9 0 3.3 1.4 4.1 2.8-.8 1.4-2.2 2.8-4.1 2.8zm9 0c-1.9 0-3.3-1.4-4.1-2.8.8-1.4 2.2-2.8 4.1-2.8 2.1 0 3.8 1.7 3.8 3.8s-1.7 3.8-3.8 3.8z" />
    </svg>
  );
}

function StanfordIcon({ className }: { className?: string }) {
  return (
    <div className="flex flex-col items-center justify-center leading-none">
      <svg viewBox="0 0 24 24" className={className} fill="#8C1515" aria-hidden="true">
        <path d="M12 2L4 16h6v6h4v-6h6L12 2zm0 3.5L16.2 14H7.8L12 5.5z" />
      </svg>
      <span className="text-[6px] font-bold tracking-tighter text-[#8C1515]">ONLINE</span>
    </div>
  );
}

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
 * Careevo Plus Hero — styled with Careevo's signature button gradient blue
 * (from-blue-700 via-blue-600 to-blue-400 with bright highlights),
 * perfectly scaled and compact to fit standard viewports without overflow.
 */
export function CareevoPlusHero() {
  return (
    <section className="relative overflow-hidden bg-[linear-gradient(135deg,#1e40af_0%,#1d4ed8_25%,#2563eb_55%,#3b82f6_85%,#60a5fa_100%)] py-8 text-white lg:py-10">
      {/* Subtle atmospheric highlights */}
      <div
        className="pointer-events-none absolute -top-32 right-0 h-96 w-96 rounded-full bg-blue-300/25 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-16 left-1/4 h-64 w-64 rounded-full bg-cyan-300/20 blur-2xl"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-7xl px-4 lg:px-6">
        <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:gap-10">
          {/* LEFT COLUMN */}
          <Reveal>
            {/* Logo Badge: "Careevo PLUS" */}
            <div className="mb-3 flex items-center gap-1.5">
              <span className="text-xl font-bold tracking-tight text-white sm:text-2xl">
                Care<span className="text-blue-100">evo</span>
              </span>
              <span className="rounded-[3px] border border-white/90 px-1 py-0.25 text-[10px] font-bold tracking-wider text-white uppercase shadow-xs">
                PLUS
              </span>
            </div>

            {/* Headline */}
            <h1
              style={{ color: "#ffffff" }}
              className="mb-3 max-w-xl text-2xl font-bold leading-[1.18] -tracking-[0.5px] text-white sm:text-3xl lg:text-[34px]"
            >
              Berakhir sebentar lagi! Belajar fleksibel dan hemat 40% selama 3
              bulan
            </h1>

            {/* Description */}
            <p className="mb-4 max-w-lg text-xs leading-relaxed text-blue-50/95 sm:text-sm">
              Hari sibuk tidak harus menghambatmu. Ubah menit menjadi lebih
              banyak keahlian lewat 10.000+ program dari Microsoft, Google,
              Meta, Stanford, dan lainnya. Mulai langgananmu dengan hemat dan
              nikmati belajar yang mengikuti rutinitasmu.
            </p>

            {/* Price line */}
            <div className="mb-4 flex flex-wrap items-center gap-2 text-xs sm:text-sm">
              <span className="font-bold text-white/70 line-through">
                IDR 570.000
              </span>
              <span className="font-semibold text-white">
                IDR 342.000/bulan, batalkan kapan saja
              </span>
            </div>

            {/* CTA button + Annual option */}
            <div className="mb-4 flex flex-wrap items-center gap-3.5">
              <Link
                href="#paket"
                className="inline-flex h-9.5 items-center justify-center rounded-lg bg-white px-5 text-xs font-semibold text-blue-700 shadow-sm transition-all duration-200 hover:bg-blue-50 hover:shadow-md sm:text-sm"
              >
                Hemat 40% sekarang
              </Link>
              <span className="text-[11px] font-medium text-white/90 sm:text-xs">
                atau IDR 3.893.000/tahun untuk Careevo Plus Tahunan
              </span>
            </div>

            {/* Disclaimer & Terms */}
            <p className="text-[11px] text-white/75">
              Penawaran berakhir 23 September 2026, lihat{" "}
              <Link
                href="#ketentuan"
                className="text-white underline underline-offset-2 transition-colors hover:text-white/90"
              >
                Ketentuan Penawaran
              </Link>
              .
            </p>
          </Reveal>

          {/* RIGHT COLUMN - VISUAL ARTWORK */}
          <Reveal variant="scale" delay={100}>
            <div className="relative mx-auto h-[280px] w-full max-w-[390px] select-none sm:h-[300px]">
              {/* Organic Wavy Ribbon SVG */}
              <svg
                viewBox="0 0 340 300"
                className="absolute inset-0 h-full w-full"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="ribbonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#93C5FD" stopOpacity="0.9" />
                    <stop offset="50%" stopColor="#60A5FA" stopOpacity="0.75" />
                    <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.5" />
                  </linearGradient>
                  <filter id="ribbonGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="5" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>

                {/* Main smooth S-curve ribbon path */}
                <path
                  d="M250 15 C 285 45, 270 95, 240 135 C 205 175, 215 220, 245 250 C 260 265, 268 285, 250 295"
                  stroke="url(#ribbonGrad)"
                  strokeWidth="18"
                  strokeLinecap="round"
                  filter="url(#ribbonGlow)"
                />
                <path
                  d="M250 15 C 285 45, 270 95, 240 135 C 205 175, 215 220, 245 250 C 260 265, 268 285, 250 295"
                  stroke="#BFDBFE"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeOpacity="0.95"
                />

                {/* Secondary lighter decorative trail */}
                <path
                  d="M275 40 C 300 80, 270 120, 250 160 C 230 195, 225 230, 265 275"
                  stroke="#E0F2FE"
                  strokeWidth="2"
                  strokeDasharray="3 5"
                  strokeLinecap="round"
                  strokeOpacity="0.65"
                />
              </svg>

              {/* Sparkle Stars */}
              <SparkleStar className="absolute top-5 right-22 size-4 text-amber-300 drop-shadow-[0_0_6px_rgba(252,211,77,0.8)]" />
              <SparkleStar className="absolute top-18 right-34 size-5.5 text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.9)]" />
              <SparkleStar className="absolute top-32 right-28 size-3.5 text-amber-300 drop-shadow-[0_0_5px_rgba(252,211,77,0.7)]" />
              <SparkleStar className="absolute top-44 right-10 size-3 text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.8)]" />
              <SparkleStar className="absolute bottom-8 right-36 size-4 text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.9)]" />

              {/* Floating White Circular Logo Badges along the ribbon */}
              {/* 1. Microsoft */}
              <div
                className="absolute top-3 right-4 flex size-9.5 items-center justify-center rounded-full bg-white shadow-md transition-transform duration-300 hover:scale-110 sm:size-10"
                title="Microsoft"
              >
                <MicrosoftIcon className="size-4 sm:size-4.5" />
              </div>

              {/* 2. Google */}
              <div
                className="absolute top-16 right-4 flex size-9.5 items-center justify-center rounded-full bg-white shadow-md transition-transform duration-300 hover:scale-110 sm:size-10"
                title="Google"
              >
                <GoogleIcon className="size-4 sm:size-4.5" />
              </div>

              {/* 3. Meta */}
              <div
                className="absolute top-29 right-4 flex size-9.5 items-center justify-center rounded-full bg-white shadow-md transition-transform duration-300 hover:scale-110 sm:size-10"
                title="Meta"
              >
                <MetaIcon className="size-4 sm:size-4.5" />
              </div>

              {/* 4. Stanford Online */}
              <div
                className="absolute top-42 right-4 flex size-9.5 items-center justify-center rounded-full bg-white shadow-md transition-transform duration-300 hover:scale-110 sm:size-10"
                title="Stanford Online"
              >
                <StanfordIcon className="size-3.5 sm:size-4" />
              </div>

              {/* FLOATING DISCOUNT BADGES (Left of ribbon) */}
              <div className="absolute top-10 left-0 z-10 flex flex-col items-start gap-2.5 sm:top-12 sm:left-2">
                {/* 1. Magenta Price Card */}
                <div className="w-[190px] rounded-xl bg-[#E6007E] px-4 py-2.5 shadow-[0_6px_20px_rgba(230,0,126,0.35)] sm:w-[205px] sm:px-4.5 sm:py-3">
                  <p className="text-center text-[10px] font-semibold text-white/80 line-through sm:text-xs">
                    IDR 570,000
                  </p>
                  <p className="mt-0.5 text-center text-xl font-extrabold text-white tracking-tight whitespace-nowrap sm:text-2xl">
                    IDR 342,000
                    <span className="text-[11px] font-normal text-white/90 sm:text-xs">
                      /month
                    </span>
                  </p>
                </div>

                {/* 2. Golden Yellow Savings Badge */}
                <div className="w-[190px] rounded-lg border border-amber-600/30 bg-[#FFB703] px-3.5 py-2 shadow-[0_4px_14px_rgba(255,183,3,0.3)] sm:w-[205px] sm:py-2.5">
                  <p className="text-center text-xs font-bold text-[#002D72] tracking-wide whitespace-nowrap sm:text-sm">
                    3 months of savings
                  </p>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
