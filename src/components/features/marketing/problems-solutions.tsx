"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChevronDown,
  Quote,
  Search,
  X,
} from "lucide-react";
import { Reveal } from "./primitives";

interface StepItem {
  id: string;
  number: string;
  badge: string;
  agent: string;
  title: string;
  problemSummary: string;
  problemDetail: string;
  solutionSummary: string;
  solutionDetail: string;
  plugins: { name: string; status: string; statusColor: "emerald" | "amber" | "sky" | "gray" }[];
  consoleLog: { label: string; value: string };
}

const STEPS: StepItem[] = [
  {
    id: "verifier",
    number: "01",
    badge: "KEPERCAYAAN PORTOFOLIO",
    agent: "verifier",
    title: "Banjir Portofolio AI yang Seragam",
    problemSummary: "Kode jadi mudah disalin dengan satu prompt. Rekruter kehilangan kepercayaan pada repo GitHub dan klaim CV biasa.",
    problemDetail: "Ketika ribuan pelamar mengirim proyek yang identik dari ChatGPT atau Claude, rekruter mengabaikan portofolio karena tidak ada bukti proses berpikir nyata.",
    solutionSummary: "Bukti Kriptografis HMAC-SHA256 & Audit Log",
    solutionDetail: "Setiap tahap pengerjaan tugas ditandatangani secara kriptografis tanpa kamera pengawas (Nir-Biometrik & Zero-PII). Rekruter dapat memverifikasi integritas proses kerjamu lewat satu tautan publik.",
    plugins: [
      { name: "hmac-sha256-signer", status: "Verified", statusColor: "emerald" },
      { name: "audit-append-only", status: "Enabled", statusColor: "emerald" },
      { name: "zero-pii-guard", status: "Active", statusColor: "emerald" },
      { name: "biometric-bypass", status: "Disabled", statusColor: "gray" },
      { name: "public-proof-link", status: "Ready", statusColor: "emerald" },
      { name: "ledger-validator", status: "Enabled", statusColor: "emerald" },
    ],
    consoleLog: {
      label: "Payload Signature",
      value: "sha256:7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
    },
  },
  {
    id: "socrates",
    number: "02",
    badge: "KESIAPAN INTERVIEW",
    agent: "socrates",
    title: "Tutorial Hell & Gagap Technical Interview",
    problemSummary: "Lancar meniru tutorial video, tetapi buntu saat tech lead menguji alasan arsitektur dan trade-off kode.",
    problemDetail: "Banyak developer gagal bukan karena tidak bisa menulis kode, melainkan karena tidak terbiasa menjelaskan pertimbangan struktur data, kompleksitas, dan penanganan edge-case.",
    solutionSummary: "Sparring Sokratik dengan Socrates AI",
    solutionDetail: "Bukan memberi jawaban instan. Socrates bertindak sebagai Principal Engineer yang menanyakan 'Mengapa pakai arsitektur ini?', menguji ketahanan logika kodemu, dan melatih artikulasi teknismu.",
    plugins: [
      { name: "socratic-dialog-engine", status: "Running", statusColor: "sky" },
      { name: "tradeoff-evaluator", status: "Active", statusColor: "emerald" },
      { name: "edge-case-challenger", status: "Enabled", statusColor: "emerald" },
      { name: "direct-answer-leak", status: "Blocked", statusColor: "gray" },
      { name: "logic-rubric-scorer", status: "Calibrated", statusColor: "emerald" },
      { name: "interview-readiness", status: "95% Score", statusColor: "sky" },
    ],
    consoleLog: {
      label: "Socratic Question",
      value: "Why choose B-Tree indexing over Hash index for this timestamp range query?",
    },
  },
  {
    id: "sentinel",
    number: "03",
    badge: "KEAMANAN BURSA KERJA",
    agent: "sentinel",
    title: "Loker Bodong & Modus Pungutan Biaya",
    problemSummary: "Waktu dan tenaga terkuras melamar lowongan kerja palsu, ghost jobs, atau penipuan berkedok biaya tes.",
    problemDetail: "Oknum penipu sering meminta biaya seragam atau tes kesehatan lewat WhatsApp dan transfer rekening pribadi, mencoreng bursa kerja bagi para pencari kerja baru.",
    solutionSummary: "Audit Otonom Sentinel Bebas Scam",
    solutionDetail: "Sentinel memindai usia domain, regex rekening transfer pribadi, dan pola permintaan biaya sebelum loker tampil di hadapanmu. Lowongan mencurigakan langsung dikarantina.",
    plugins: [
      { name: "domain-age-verifier", status: "Passed (>1y)", statusColor: "emerald" },
      { name: "fee-pattern-detector", status: "0 Flags", statusColor: "emerald" },
      { name: "personal-bank-regex", status: "Clean", statusColor: "emerald" },
      { name: "ghost-job-quarantine", status: "Guarded", statusColor: "emerald" },
      { name: "corporate-entity-check", status: "Verified", statusColor: "emerald" },
      { name: "whatsapp-scam-shield", status: "Enforced", statusColor: "emerald" },
    ],
    consoleLog: {
      label: "Sentinel Verdict",
      value: "VERIFIED_SAFE — PT Sinergi Tech (Domain age: 4.2y, Fee flags: 0)",
    },
  },
  {
    id: "navigator",
    number: "04",
    badge: "EFISIENSI KARIER",
    agent: "navigator",
    title: "Melamar Buta Tanpa Tahu Celah Skill",
    problemSummary: "Mengirim ratusan lamaran tanpa pernah mendapat feedback mengapa ditolak atau materi apa yang harus diperbaiki.",
    problemDetail: "Pencari kerja sering bingung mengapa CV mereka tidak lolos ATS atau interview, karena tidak pernah ada analisis komprehensif mengenai skill gap riil mereka.",
    solutionSummary: "Navigator Gap Analysis & Curated Challenges",
    solutionDetail: "Navigator memetakan profil dan CV kamu dengan kebutuhan lowongan valid, mendeteksi kriteria yang belum terpenuhi, dan menyusun tugas terarah untuk menutup gap tersebut.",
    plugins: [
      { name: "cv-jd-semantic-match", status: "88% Match", statusColor: "emerald" },
      { name: "gap-detector-v2", status: "Active", statusColor: "emerald" },
      { name: "challenge-recommender", status: "Enabled", statusColor: "emerald" },
      { name: "curriculum-sequencer", status: "Synced", statusColor: "emerald" },
      { name: "industry-trend-radar", status: "Real-time", statusColor: "sky" },
      { name: "blind-apply-suppressor", status: "Enabled", statusColor: "emerald" },
    ],
    consoleLog: {
      label: "Detected Skill Gap",
      value: "Missing: Web Performance (LCP & CLS). Recommended task: Modul 3 Challenge.",
    },
  },
];

export function MarketingProblemsSolutions() {
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const stepElementsRef = useRef<(HTMLDivElement | null)[]>([]);

  // Observe scrolling to keep the sticky right modal in sync
  useEffect(() => {
    const handleScroll = () => {
      const triggerY = window.innerHeight * 0.45;

      for (let i = stepElementsRef.current.length - 1; i >= 0; i--) {
        const el = stepElementsRef.current[i];
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= triggerY) {
            setActiveStepIndex(i);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const current = STEPS[activeStepIndex] ?? STEPS[0];

  return (
    <section
      id="solusi"
      className="relative overflow-hidden bg-[#0c0d12] py-24 sm:py-32 text-white selection:bg-blue-500/30"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Intro Header */}
        <div className="mx-auto mb-16 max-w-3xl text-center lg:mb-24">
          <Reveal>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 font-mono text-xs tracking-widest text-neutral-300 uppercase">
              <span className="size-1.5 rounded-full bg-blue-400" />
              Design Approach &amp; Core Philosophy
            </div>
          </Reveal>

          <Reveal delay={80}>
            <h2 className="mt-5 text-4xl font-light tracking-tight text-white sm:text-5xl lg:text-[56px] lg:leading-[1.12]">
              Portofolio bisa dibuat AI. <br className="hidden sm:inline" />
              <span className="font-normal text-blue-400">Kompetensi berpikir tidak.</span>
            </h2>
          </Reveal>

          <Reveal delay={160}>
            <p className="mt-4 text-base text-neutral-400 sm:text-lg">
              Ketika AI memudahkan semua orang menyalin kode dan memoles CV, rekruter kehilangan kepercayaan.
              Careevo menjembatani proses belajar autentik hingga siap membuktikan kompetensi di dunia kerja.
            </p>
          </Reveal>
        </div>

        {/* DeepSeek Harness Style: 2-Column Split with Left Scroll & Right Sticky Modal */}
        <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-12 lg:gap-16">
          {/* Left Column: Scrolling Content Steps */}
          <div className="space-y-24 sm:space-y-36 lg:col-span-5">
            {/* Dario Amodei Quote Card (Editorial Minimalist) */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xs">
              <div className="flex items-start gap-3">
                <Quote className="size-5 shrink-0 text-blue-400" />
                <div className="space-y-3">
                  <p className="text-[15px] leading-relaxed text-neutral-200 italic">
                    &ldquo;In a world where AI can generate anything and create anything, having basic critical thinking skills may be the most important thing to success. It&rsquo;s really hard to tell what&rsquo;s real from what&rsquo;s not... You don&rsquo;t want to fall for things that are fake, and you don&rsquo;t want to get scammed.&rdquo;
                  </p>
                  <div className="flex items-center justify-between border-t border-white/[0.08] pt-3 text-xs">
                    <div>
                      <span className="font-semibold text-white">Dario Amodei</span>
                      <span className="text-neutral-400"> — CEO &amp; Co-founder, Anthropic</span>
                    </div>
                    <a
                      href="https://x.com/vikktorrrre/status/2102446813714293039"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 hover:underline"
                    >
                      Di X &rarr;
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Scrollable Narrative Steps */}
            {STEPS.map((step, idx) => {
              const isSelected = activeStepIndex === idx;

              return (
                <div
                  key={step.id}
                  ref={(el) => {
                    stepElementsRef.current[idx] = el;
                  }}
                  onClick={() => setActiveStepIndex(idx)}
                  className={`group cursor-pointer rounded-2xl border p-6 sm:p-8 transition-all duration-200 ${
                    isSelected
                      ? "border-blue-500/40 bg-white/[0.04] shadow-[0_0_24px_rgba(59,130,246,0.06)]"
                      : "border-white/[0.08] bg-white/[0.01] hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold tracking-wider text-blue-400 uppercase">
                      {step.number} — {step.badge}
                    </span>
                    <span
                      className={`font-mono text-[10px] rounded px-2 py-0.5 uppercase tracking-wide ${
                        isSelected
                          ? "bg-blue-500/20 text-blue-300 border border-blue-400/30"
                          : "bg-white/5 text-neutral-500 border border-white/5"
                      }`}
                    >
                      Agen: {step.agent}
                    </span>
                  </div>

                  {/* Problem Description */}
                  <div className="mt-5">
                    <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-rose-400 uppercase">
                      <span className="size-1.5 rounded-full bg-rose-400" />
                      Tantangan Industri
                    </div>
                    <h3 className="mt-1.5 text-2xl font-medium text-white sm:text-3xl">
                      {step.title}
                    </h3>
                    <p className="mt-2.5 text-sm leading-relaxed text-neutral-400">
                      {step.problemDetail}
                    </p>
                    <div className="mt-3.5 rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-200">
                      <strong className="font-semibold text-rose-300">Dampak nyata: </strong>
                      {step.problemSummary}
                    </div>
                  </div>

                  {/* Careevo Solution */}
                  <div className="mt-6 border-t border-white/[0.08] pt-5">
                    <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-emerald-400 uppercase">
                      <span className="size-1.5 rounded-full bg-emerald-400" />
                      Solusi Careevo
                    </div>
                    <h4 className="mt-1 text-lg font-medium text-neutral-100">
                      {step.solutionSummary}
                    </h4>
                    <p className="mt-1.5 text-xs sm:text-sm leading-relaxed text-neutral-400">
                      {step.solutionDetail}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Sticky App GUI Mockup (matching DeepSeek Harness screenshot) */}
          <div className="lg:col-span-7 sticky top-28 self-start w-full">
            <div className="overflow-hidden rounded-2xl border border-white/15 bg-[#17181e] shadow-[0_24px_60px_rgba(0,0,0,0.7)]">
              {/* Outer Window Header Bar */}
              <div className="flex items-center justify-between border-b border-white/10 bg-[#1f2027] px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="size-3 rounded-full bg-[#ff5f56]" />
                  <span className="size-3 rounded-full bg-[#ffbd2e]" />
                  <span className="size-3 rounded-full bg-[#27c93f]" />
                  <span className="ml-3 font-mono text-xs text-neutral-400">
                    Careevo Engine — Settings &amp; Modules
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="hidden sm:inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-mono text-neutral-300 hover:bg-white/10"
                  >
                    <span>Config: hmac_audit.json</span>
                  </button>
                  <X className="size-4 text-neutral-400" />
                </div>
              </div>

              {/* Modal Body: Left Sidebar + Right Main Plugins List */}
              <div className="grid grid-cols-1 md:grid-cols-12 min-h-[490px]">
                {/* Modal Sidebar */}
                <div className="border-b md:border-b-0 md:border-r border-white/10 bg-[#14151b] p-4 md:col-span-4">
                  <span className="font-mono text-xs font-semibold text-neutral-400 tracking-wider uppercase">
                    System Subsystems
                  </span>

                  <div className="mt-4 space-y-1.5">
                    {STEPS.map((s, idx) => {
                      const isActive = activeStepIndex === idx;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setActiveStepIndex(idx)}
                          className={`w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-left text-xs transition-colors duration-150 ${
                            isActive
                              ? "bg-white/15 text-white font-medium shadow-xs"
                              : "text-neutral-400 hover:bg-white/5 hover:text-neutral-200"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`size-2 rounded-full ${
                                isActive ? "bg-emerald-400 shadow-[0_0_8px_#34d399]" : "bg-white/20"
                              }`}
                            />
                            <span className="capitalize">{s.agent}</span>
                          </div>
                          <span className="text-[10px] font-mono text-neutral-500">
                            {s.number}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Subsystem Metric Specs */}
                  <div className="mt-10 border-t border-white/10 pt-4 text-[11px] font-mono space-y-2 text-neutral-400">
                    <div className="flex justify-between">
                      <span>Protocol:</span>
                      <span className="text-white">Zero-PII</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Attestation:</span>
                      <span className="text-white">HMAC-SHA256</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Loker Safety:</span>
                      <span className="text-emerald-400">100% Clean</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Sparring:</span>
                      <span className="text-sky-400">Socratic</span>
                    </div>
                  </div>
                </div>

                {/* Modal Main View: Plugins Viewport */}
                <div className="p-5 sm:p-6 md:col-span-8 bg-[#181920]">
                  {/* Top Panel Title */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-4">
                    <div>
                      <h4 className="text-lg font-semibold text-white capitalize">
                        {current.agent} Modules
                      </h4>
                      <p className="text-xs text-neutral-400">
                        Configure and inspect active modules for this verification subsystem.
                      </p>
                    </div>
                  </div>

                  {/* Search bar inside GUI */}
                  <div className="mt-4 flex items-center gap-2 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs">
                    <Search className="size-3.5 text-neutral-500" />
                    <input
                      type="text"
                      readOnly
                      value={`filter --agent ${current.agent} --status active`}
                      className="w-full bg-transparent font-mono text-xs text-neutral-300 outline-none"
                    />
                  </div>

                  {/* List Header & Counter */}
                  <div className="mt-4 flex items-center justify-between text-xs text-neutral-400">
                    <span>Active modules list</span>
                    <span className="font-mono text-[11px] text-neutral-500">
                      {current.plugins.length} loaded
                    </span>
                  </div>

                  {/* 2-Column Grid of Plugin Cards (matching DeepSeek Harness screenshot) */}
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {current.plugins.map((plugin) => (
                      <div
                        key={plugin.name}
                        className="flex items-center justify-between rounded-lg border border-white/[0.08] bg-[#1f2029] px-3 py-2.5 text-xs shadow-xs"
                      >
                        <span className="font-mono font-medium text-neutral-200 truncate pr-2">
                          {plugin.name}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-mono shrink-0 ${
                            plugin.statusColor === "emerald"
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
                              : plugin.statusColor === "sky"
                                ? "bg-sky-500/15 text-sky-400 border border-sky-500/25"
                                : "bg-neutral-800 text-neutral-400 border border-white/5"
                          }`}
                        >
                          <span
                            className={`size-1.5 rounded-full ${
                              plugin.statusColor === "emerald"
                                ? "bg-emerald-400"
                                : plugin.statusColor === "sky"
                                  ? "bg-sky-400"
                                  : "bg-neutral-500"
                            }`}
                          />
                          {plugin.status}
                          <ChevronDown className="size-2.5 opacity-60" />
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Live Console Output Card */}
                  <div className="mt-5 rounded-lg border border-white/10 bg-black/50 p-3.5 font-mono text-xs">
                    <span className="text-[10px] text-neutral-500 uppercase tracking-wider">
                      Console Inspection: {current.consoleLog.label}
                    </span>
                    <p className="mt-1 text-[11px] text-blue-300 break-all leading-relaxed">
                      &gt; {current.consoleLog.value}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Sub-Bar */}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.02] p-4 text-xs">
              <span className="text-neutral-400 font-mono text-[11px]">
                Status: All verification services operating with Zero-Surveillance guarantees.
              </span>
              <Link
                href="/daftar"
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-500 px-3.5 py-1.5 font-medium text-white transition hover:bg-blue-400"
              >
                <span>Coba Sekarang</span>
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
