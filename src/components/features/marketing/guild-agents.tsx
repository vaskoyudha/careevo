"use client";

import {
  ArrowUpRight,
  BadgeCheck,
  Calculator,
  CalendarClock,
  Compass,
  GitBranch,
  GraduationCap,
  ListChecks,
  Milestone,
  RefreshCw,
  Settings,
  ShieldAlert,
  Target,
  X,
} from "lucide-react";
import Image from "next/image";
import * as React from "react";
import { LandingBtnLink } from "@/components/ui/landing-btn";
import { useGuildAgentsMotion } from "./guild-agents-motion";

type Tone = "emerald" | "sky" | "blue" | "amber";

const TONES: Record<Tone, string> = {
  emerald: "bg-[#0596691a] text-[#047857]",
  sky: "bg-[#0284c71a] text-[#0369a1]",
  blue: "bg-[#3b82f61a] text-[#1d4ed8]",
  amber: "bg-[#d977061a] text-[#b45309]",
};

const STATUS = {
  running: {
    label: "Running",
    cls: "bg-[#16a34a14] text-[#15803d]",
    dot: "text-[#15803d]",
  },
  queued: {
    label: "Queued",
    cls: "bg-[#d9770617] text-[#b45309]",
    dot: "text-[#b45309]",
  },
  idle: {
    label: "Idle",
    cls: "bg-black/5 text-[#2d2a3a]/55",
    dot: "text-[#2d2a3a]/55",
  },
} as const;

type AgentCard = {
  position: string;
  icon: React.ElementType;
  tone: Tone;
  name: string;
  description: string;
  status: keyof typeof STATUS;
};

const CARDS: AgentCard[] = [
  {
    position: "left-[3%] top-[16%] -rotate-3",
    icon: Compass,
    tone: "emerald",
    name: "pencari lowongan",
    // Bukan "tiap hari": tidak ada penjadwal, cron, maupun scan saat halaman
    // dimuat — scan hanya berjalan saat pengguna menekan "Pindai lowongan baru"
    // (`inbox-list.tsx`). Badge-nya pun `idle`, bukan `running`, karena agen ini
    // memang menganggur sampai diminta; "running" menyiratkan proses latar yang
    // tidak ada.
    description: "Pindai papan lowongan publik saat kamu minta; hasilnya masuk ke inbox kamu.",
    status: "idle",
  },
  {
    position: "left-[17%] top-[2%] rotate-2",
    icon: ShieldAlert,
    tone: "amber",
    name: "pengecek loker",
    description: "Saring lowongan pakai aturan tetap: biaya, APK, domain baru.",
    status: "queued",
  },
  {
    position: "right-[16%] top-[4%] -rotate-2",
    icon: Target,
    tone: "sky",
    name: "pencocok skill",
    description: "Skor 1–5 dari lima dimensi, plus gap skill versus syarat lowongan.",
    status: "idle",
  },
  {
    position: "right-[2%] top-[22%] rotate-3",
    icon: BadgeCheck,
    tone: "blue",
    name: "penandatangan",
    description: "Tanda tangani hasil kerjamu, biar rekruter bisa cek sendiri lewat satu tautan.",
    status: "running",
  },
  {
    position: "bottom-[16%] left-[6%] rotate-2",
    icon: Calculator,
    tone: "emerald",
    name: "penilai",
    description: "Dinilai verifikator manusia pakai lima kriteria berbobot.",
    status: "running",
  },
  {
    position: "bottom-[13%] right-[5%] -rotate-2",
    icon: GraduationCap,
    tone: "amber",
    name: "penemu materi",
    description: "Susun kursus khusus buat lowongan yang kamu incar, bukan katalog umum.",
    status: "queued",
  },
  {
    position: "left-[26%] top-[13%] rotate-1",
    icon: ListChecks,
    tone: "sky",
    name: "penyusun jalur",
    description: "Ubah lowongan itu jadi daftar topik yang harus kamu kuasai, urut.",
    status: "idle",
  },
  {
    position: "bottom-[6%] left-[31%] -rotate-1",
    icon: CalendarClock,
    tone: "emerald",
    name: "jadwal",
    description: "Target mingguan dan check-in; dihitung jadi 30 dari 100 poin.",
    status: "running",
  },
  {
    position: "bottom-[9%] right-[28%] rotate-2",
    icon: Milestone,
    tone: "blue",
    name: "pelacak lamaran",
    description: "Lacak dari lamar sampai hasil akhir; yang ditolak Sentinel nggak bisa dilamar.",
    status: "queued",
  },
];

function AgentCardView({ card }: { card: AgentCard }) {
  const Icon = card.icon;
  const status = STATUS[card.status];
  return (
    <div className="w-[236px] rounded-xl bg-white p-3 text-[#1d1b26] shadow-[0_0_0_0.5px_rgba(45,42,58,0.14),0_1px_2px_rgba(45,42,58,0.04),0_4px_10px_rgba(45,42,58,0.04)] transition-shadow duration-200 ease-out hover:shadow-[0_0_0_0.5px_rgba(45,42,58,0.18),0_8px_24px_rgba(45,42,58,0.1)]">
      <div className="flex items-center gap-2">
        <span
          className={`flex size-5 items-center justify-center rounded-[6px] text-[11px] ${TONES[card.tone]}`}
        >
          <Icon className="size-3" strokeWidth={2} />
        </span>
        <span className="font-mono text-xs font-semibold tracking-tight text-[#2d2a3a]/90">
          {card.name}
        </span>
        <X className="ml-auto size-3 text-[#2d2a3a]/35" strokeWidth={2} />
      </div>
      <p className="mt-2 text-xs leading-relaxed text-[#110f1a]/55">
        {card.description}
      </p>
      <div className="mt-3 flex items-center gap-1.5">
        <div className="flex items-center gap-1.5 text-[#2d2a3a]/45 [&_svg]:size-3.5">
          <Settings strokeWidth={2} />
          <RefreshCw strokeWidth={2} />
          <GitBranch strokeWidth={2} />
        </div>
        <span
          className={`ml-auto flex items-center gap-1.5 rounded px-2 py-1 font-mono text-[9px] leading-none ${status.cls}`}
        >
          <span
            className={`relative size-[5px] rounded-full bg-current ${status.dot} status-pulse`}
          />
          {status.label}
        </span>
      </div>
    </div>
  );
}

function Bracket({
  className,
  flip = false,
  ...rest
}: {
  className?: string;
  flip?: boolean;
} & React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 8 8"
      fill="none"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      <path
        d="M0.8 0.8H3.2M0.8 0.8V3.2M0.8 7.2H3.2M0.8 7.2V4.8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        transform={flip ? "scale(-1,1) translate(-8,0)" : undefined}
      />
    </svg>
  );
}

export function MarketingAgents() {
  const sectionRef = React.useRef<HTMLElement>(null);
  useGuildAgentsMotion(sectionRef);

  return (
    <section
      id="agen"
      ref={sectionRef}
      className="guild-type relative isolate overflow-hidden bg-white text-[#0d0c11] [--agen-ratio:1.8827] [--agen-h:calc(100vw/var(--agen-ratio))]"
    >
      {/*
        Full-bleed wave artwork. The section is `isolate` and the image is at
        `-z-10`, so the wallpaper sits behind the floating agent cards and the
        centred copy without needing a wrapper element. It spans edge to edge
        — no side margins — because the section itself is the container.

        THE ART IS NEVER DISTORTED OR CROPPED, and the section's height is
        derived from the art's own aspect to guarantee it. The art is 1721x914,
        aspect 1.8827. The section is full-bleed, so its width is the viewport
        width, and `--agen-h` on the section above is `100vw / 1.8827` — the
        exact height at which the image fills the box with nothing left over.

        This matters because the obvious alternative is wrong in two visible
        ways. A hard-coded section height (this used to be 860px, aspect 2.390
        — WIDER than the art) forced `object-cover` to upscale 1.19x, which is
        what made the waves look soft, and then to discard 21% of the
        composition, which is what made the framing look arbitrary. Baking the
        asset to the box's aspect instead of sizing the box to the asset's
        aspect just moves the distortion into the pixels and stretches the
        waves wide — worse, because it is permanent rather than responsive.

        So: the ratio is the art's, the height follows from it, and
        `object-cover` has nothing to scale or cut. Keep it as `cover` anyway
        so narrow viewports, where the content needs more height than
        100vw/1.8827, still fill rather than letterbox.

        Baked at 4110px wide (2x the 2055px reference viewport) so a retina
        display gets a ~1:1 device-pixel map. It cannot invent detail, but it
        removes the double resample that made the source look mushy. Re-encode
        PSNR is 47.8 dB, above the 45+ dB this repo treats as imperceptible.
        Passed through unoptimized for the same reason as `fitur-sky.webp` and
        `masalah-solusi/*.webp`: a wide soft gradient re-encoded at the
        optimizer's default q=75 bands visibly.

        The artwork is full opacity; legibility comes from the radial scrim
        inside the wrapper below, not from dimming the whole section. The copy
        region's worst pixel is `#B4DCFC` and the paragraph's
        `text-[#110f1a]/70` measures 4.95:1 against it with no scrim at all, so
        the scrim is headroom rather than the thing making the text readable.

        Top and bottom fade out via a mask on the wrapper below, so the section
        meets the hero above it and the `#F9FAFB` band of the next section
        without a hard horizontal seam. Each fade is an eased ramp rather than a
        single stop: partial-alpha stops at 6% and 16% (and 95%/88% mirrored)
        spread the transition over ~26% of the section, so the artwork dissolves
        gradually instead of showing a visible band where it hits full opacity.
        The opaque band is 26%-78%, which is where the copy and the agent cards
        sit, so nothing legible is inside a fade.
      */}
      {/*
        One wrapper holds the artwork and the scrim so the fade mask applies to
        the pair. Masking them separately would let the scrim's hard rectangle
        show through wherever the image faded out.

        A flat section-wide scrim is the wrong tool here: it dims the whole
        wallpaper to protect text that occupies one small centred column. The
        radial confines the wash to that column and falls to 0% by the section's
        mid-edges, so the waves keep their colour across the left and right.

        The copy is legible without any scrim (see the asset note above), so
        these stops are deliberately light — 22% buys headroom over 4.95:1
        rather than crossing a threshold, and 0% at the edges keeps the
        wallpaper at full strength where there is no text at all. The agent
        cards are opaque white panels, so they need no scrim of their own.
      */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 [mask-image:linear-gradient(to_bottom,transparent_0%,rgba(0,0,0,0.35)_6%,#000_16%,#000_26%,#000_78%,#000_88%,rgba(0,0,0,0.4)_95%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_bottom,transparent_0%,rgba(0,0,0,0.35)_6%,#000_16%,#000_26%,#000_78%,#000_88%,rgba(0,0,0,0.4)_95%,transparent_100%)]"
      >
        <Image
          src="/images/agen-waves.webp"
          alt=""
          fill
          unoptimized
          className="object-cover object-bottom"
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_46%_42%_at_50%_48%,rgba(255,255,255,0.22)_0%,rgba(255,255,255,0.15)_55%,rgba(255,255,255,0)_100%)]" />
      </div>
      {/*
        Three nested elements per card, one animation each: `data-ag="card"`
        takes the scrubbed parallax and keeps the Tailwind tilt below it,
        `data-ag="enter"` takes the fly-in from the centre, `data-ag="drift"`
        takes the ambient orbit. Two animations on one element means the later
        tween overwrites the earlier `transform` and the card snaps.

        The `Reveal` wrapper and `.guild-float` that used to be here are gone.
        `Reveal` is a plain IntersectionObserver fade shared by twenty other
        marketing sections, so it cannot carry a per-card direction, and
        `.guild-float` gave all nine cards the same 7s period, so the
        constellation pulsed as one object. Both are now this section's own
        motion, in `guild-agents-motion.ts`.
      */}
      {CARDS.map((card) => (
        <div
          key={card.name}
          data-ag="card"
          className={`absolute hidden lg:block ${card.position}`}
        >
          <div data-ag="enter">
            <div data-ag="drift">
              <AgentCardView card={card} />
            </div>
          </div>
        </div>
      ))}

      {/*
        `min-h-[var(--agen-h)]` is what makes the artwork uncropped: the content
        stretches to the image's own aspect-derived height, so the section can
        never be shorter than the art and `object-cover` has nothing to cut.
        The old fixed `min(860px, ...)` is what forced the 21% crop. It is kept
        only as a floor via the max(), for narrow viewports where 100vw/1.8827
        is shorter than the headline and cards need.
      */}
      <div className="relative mx-auto flex min-h-[max(var(--agen-h),560px)] max-w-3xl flex-col items-center justify-center px-5 py-28 text-center">
        <div
          data-ag="eyebrow"
          className="flex items-center justify-center gap-3 font-mono text-xs tracking-[0.02em] text-[#110f1a]/55 uppercase"
        >
          <Bracket className="size-2 text-blue-500" data-ag="bracket-l" />
          Yang bantu kamu
          <Bracket
            className="size-2 text-blue-500"
            data-ag="bracket-r"
            flip
          />
        </div>

        <h2
          data-ag="title"
          className="mt-6 text-5xl leading-[1.08] font-light tracking-[-0.03em] text-[#0d0c11] sm:text-6xl lg:text-[64px] lg:leading-[1.06]"
        >
          Cari lowongan,{" "}
          {/* The flat `#0056D2`, not a Tailwind `blue-500`: this is the blue
              DESIGN.md reserves for inline text on a light surface, and at 64px
              it holds ~6.4:1 here. `blue-500` lands at ~3:1 unscrimmed. */}
          <span className="text-[#0056D2]">targetkan, lamar,</span>
          <br />
          sampai kamu keterima
        </h2>

        {/* /70, not /55: over this artwork's copy region /70 measures
            4.95:1 with no scrim at all and 5.38:1 under the 22% radial
            centre. /55 only reaches 2.91:1 unscrimmed, so it fails AA
            outright here. */}
        <p
          data-ag="body"
          className="mx-auto mt-6 max-w-xl text-[15px] leading-relaxed text-[#110f1a]/70"
        >
          Sembilan agen AI yang ngerjain bagian administratifnya: pindai papan
          lowongan, saring penipuan, hitung kecocokan, susun kursus dan jalur
          belajar khusus lowongan itu, sampai nyatet progres lamaranmu. Kamu
          tetap yang ngerjain, dan hasil kerjamu dinilai verifikator manusia —
          bukan model.
        </p>

        <div
          data-ag="actions"
          className="mt-8 flex flex-wrap items-center justify-center gap-2 sm:gap-3"
        >
          <LandingBtnLink href="/daftar" className="shrink-0">
            Cobain satu challenge, gratis
          </LandingBtnLink>
          <LandingBtnLink
            href="#loop"
            variant="secondary"
            className="group shrink-0"
          >
            Lihat alurnya
            <ArrowUpRight
              className="size-4 text-blue-500 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              strokeWidth={2}
            />
          </LandingBtnLink>
        </div>
      </div>
    </section>
  );
}
