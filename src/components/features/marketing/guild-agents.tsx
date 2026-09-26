import Link from "next/link";
import {
  ArrowUpRight,
  BadgeCheck,
  Calculator,
  CalendarClock,
  ClipboardCheck,
  Compass,
  GitBranch,
  MessagesSquare,
  RefreshCw,
  ScrollText,
  Settings,
  ShieldAlert,
  Target,
  X,
} from "lucide-react";
import { Reveal } from "./primitives";

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
  delay: number;
};

const CARDS: AgentCard[] = [
  {
    position: "left-[3%] top-[16%] -rotate-3",
    icon: Compass,
    tone: "emerald",
    name: "penemu materi",
    description: "Nyusun rekomendasi task dari loker yang lagi banyak dilamar.",
    status: "running",
    delay: 0,
  },
  {
    position: "left-[17%] top-[2%] rotate-2",
    icon: ShieldAlert,
    tone: "amber",
    name: "pengecek loker",
    description: "Saring lowongan yang muat indikasi penipuan.",
    status: "queued",
    delay: 0.6,
  },
  {
    position: "right-[16%] top-[4%] -rotate-2",
    icon: MessagesSquare,
    tone: "sky",
    name: "tutor logika",
    description: "Latih logika dan kesiapan interview teknis kamu.",
    status: "idle",
    delay: 1.2,
  },
  {
    position: "right-[2%] top-[22%] rotate-3",
    icon: BadgeCheck,
    tone: "blue",
    name: "penandatangan",
    description: "Tandatangani hasil kerja kamu, biar tidak bisa dimanipulasi.",
    status: "running",
    delay: 1.8,
  },
  {
    position: "bottom-[16%] left-[6%] rotate-2",
    icon: Calculator,
    tone: "emerald",
    name: "penilai",
    description: "Nilai jawaban kamu pakai rubrik lima kriteria yang sama.",
    status: "running",
    delay: 2.4,
  },
  {
    position: "bottom-[13%] right-[5%] -rotate-2",
    icon: ScrollText,
    tone: "amber",
    name: "pencatat proses",
    description: "Simpan catatan belajar kamu supaya bisa dibuka siapa saja.",
    status: "queued",
    delay: 3.0,
  },
  {
    position: "left-[26%] top-[13%] rotate-1",
    icon: ClipboardCheck,
    tone: "sky",
    name: "penyusun laporan",
    description: "Siapin ringkasan laporan buat verifikator.",
    status: "idle",
    delay: 3.6,
  },
  {
    position: "bottom-[6%] left-[31%] -rotate-1",
    icon: CalendarClock,
    tone: "emerald",
    name: "jadwal",
    description: "Kunci jadwal belajar mingguan kamu.",
    status: "running",
    delay: 4.2,
  },
  {
    position: "bottom-[9%] right-[28%] rotate-2",
    icon: Target,
    tone: "blue",
    name: "pencocok skill",
    description: "Cocokkan skill dan CV kamu dengan loker yang lolos cek.",
    status: "idle",
    delay: 4.8,
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

function Bracket({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 8 8" fill="none" className={className} aria-hidden="true">
      <path
        d="M0.8 0.8H3.2M0.8 0.8V3.2M0.8 7.2H3.2M0.8 7.2V4.8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function MarketingAgents() {
  return (
    <section
      id="agen"
      className="guild-type relative overflow-hidden bg-white text-[#0d0c11]"
    >
      {CARDS.map((card) => (
        <div
          key={card.name}
          className={`absolute hidden lg:block ${card.position}`}
        >
          <Reveal>
            <div
              className="guild-float"
              style={{ animationDelay: `${card.delay}s` }}
            >
              <AgentCardView card={card} />
            </div>
          </Reveal>
        </div>
      ))}

      <div className="relative mx-auto flex min-h-[min(860px,calc(100vh-68px))] max-w-3xl flex-col items-center justify-center px-5 py-28 text-center">
        <Reveal>
          <div className="flex items-center justify-center gap-3 font-mono text-xs tracking-[0.02em] text-[#110f1a]/55 uppercase">
            <Bracket className="size-2 text-blue-500" />
            Yang kamu dapat
            <Bracket className="size-2 rotate-180 text-blue-500" />
          </div>
        </Reveal>

        <Reveal delay={90}>
          <h2 className="mt-6 text-5xl leading-[1.08] font-light tracking-[-0.03em] text-[#0d0c11] sm:text-6xl lg:text-[64px] lg:leading-[1.06]">
            Delapan agen kerja buat kamu,
            <br />
            satu akun
          </h2>
        </Reveal>

        <Reveal delay={180}>
          <p className="mx-auto mt-6 max-w-xl text-[15px] leading-relaxed text-[#110f1a]/55">
            Tiap agen pegang satu tugas dan bisa kamu matikan sendiri: nunjukin
            latihan yang perlu, nanya soal logika, cek loker, sampai
            menandatangani hasil kerjamu.
          </p>
        </Reveal>

        <Reveal delay={270}>
          <div className="mt-8 flex items-center justify-center gap-2">
            <Link
              href="/daftar"
              className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#14121c] px-6 text-[15px] font-medium whitespace-nowrap text-white transition-colors duration-200 select-none hover:bg-[#14121c]/85"
            >
              Cobain satu challenge, gratis
            </Link>
            <Link
              href="#loop"
              className="group inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl px-6 text-[15px] font-medium whitespace-nowrap text-[#0d0c11]/85 transition-colors duration-200 select-none hover:bg-black/5"
            >
              Lihat alurnya
              <ArrowUpRight
                className="size-4 text-blue-500 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                strokeWidth={2}
              />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
