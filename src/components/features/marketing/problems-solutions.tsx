"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Compass,
  FileCode2,
  Lock,
  MessagesSquare,
  Quote,
  SearchX,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Reveal } from "./primitives";

interface ProblemSolutionItem {
  id: string;
  tag: string;
  problem: {
    title: string;
    description: string;
    impact: string;
    icon: React.ElementType;
  };
  solution: {
    agent: string;
    title: string;
    description: string;
    outcome: string;
    icon: React.ElementType;
  };
}

const COMPARISONS: ProblemSolutionItem[] = [
  {
    id: "portfolio-trust",
    tag: "Kepercayaan Portofolio",
    problem: {
      title: "Banjir Portofolio AI yang Seragam",
      description:
        "Ribuan pelamar mengirimkan repository GitHub dan proyek identik hasil salinan AI. Rekruter kewalahan membedakan mana keahlian asli dan mana kode hasil generate.",
      impact: "Portofolio dan klaim CV diabaikan karena minim bukti autentik.",
      icon: FileCode2,
    },
    solution: {
      agent: "Verifier & Attestation",
      title: "Bukti Kompetensi Kriptografis HMAC-SHA256",
      description:
        "Setiap alur pengerjaan dan hasil submission ditandatangani secara kriptografis. Rekruter mendapatkan satu tautan publik untuk mengaudit bukti proses kerja tanpa manipulasi.",
      outcome: "Bukti kemampuan nyata terverifikasi tanpa kamera pengawas (Nir-biometrik & Zero-PII).",
      icon: BadgeCheck,
    },
  },
  {
    id: "interview-prep",
    tag: "Kesiapan Interview",
    problem: {
      title: "Tutorial Hell & Gagap Saat Technical Interview",
      description:
        "Banyak developer lancar mengikuti tutorial video, tetapi langsung buntu ketika diuji interview kerja: ditanya alasan trade-off arsitektur, pemilihan struktur data, atau mitigasi bug.",
      impact: "Gugur di tahap interview teknis karena tidak terbiasa menjelaskan proses berpikir.",
      icon: AlertTriangle,
    },
    solution: {
      agent: "Socrates AI",
      title: "Sparring Sokratik Berpikir Tingkat Tinggi",
      description:
        "Bukan sekadar memberi tahu kode benar atau salah. Socrates menantang alasan di balik keputusan kodemu, menanyakan edge-case, dan melatih caramu berargumen seperti tech lead sungguhan.",
      outcome: "Percaya diri dan fasih mempertahankan keputusan teknis di depan interviewer.",
      icon: MessagesSquare,
    },
  },
  {
    id: "loker-scams",
    tag: "Keamanan Melamar",
    problem: {
      title: "Loker Bodong & Modus Pungutan Biaya",
      description:
        "Bursa kerja penuh dengan lowongan fiktif, ghost jobs, serta penipuan yang meminta biaya administrasi, tiket penerbangan fiktif, atau nomor transfer rekening pribadi.",
      impact: "Waktu dan uang pencari kerja terkuras demi lowongan palsu.",
      icon: ShieldAlert,
    },
    solution: {
      agent: "Sentinel Audit",
      title: "Penyaringan Otomatis Bebas Penipuan",
      description:
        "Sentinel memindai usia domain, regex rekening transfer pribadi, dan pola pungutan biaya pada setiap loker. Lowongan mencurigakan langsung dikarantina sebelum sempat kamu lihat.",
      outcome: "100% bursa lowongan kerja bersih, terverifikasi, dan aman dilamar.",
      icon: ShieldCheck,
    },
  },
  {
    id: "skill-matching",
    tag: "Efisiensi Karier",
    problem: {
      title: "Melamar Buta Tanpa Tahu Celah Skill",
      description:
        "Mengirim ratusan lamaran secara acak tanpa feedback yang jelas mengapa ditolak atau materi apa yang harus dipelajari untuk memenuhi ekspektasi industri.",
      impact: "Frustrasi karena terus menerima email penolakan otomatis tanpa solusi perbaikan.",
      icon: SearchX,
    },
    solution: {
      agent: "Navigator AI",
      title: "Analisis Skill Gap & Kurikulum Penutup",
      description:
        "Navigator membandingkan skill serta profilmu dengan data loker valid, mendeteksi kriteria yang belum terpenuhi, dan menyusun roadmap task terarah untuk menutup gap tersebut.",
      outcome: "Latihan yang kamu kerjakan langsung menjawab kebutuhan lowongan kerja incaran.",
      icon: Compass,
    },
  },
];

export function MarketingProblemsSolutions() {
  const [activeTab, setActiveTab] = useState<"all" | "problem" | "solution">("all");

  return (
    <section id="masalah-dan-solusi" className="relative bg-neutral-50/60 py-20 lg:py-28">
      {/* Decorative gradient background */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[800px] rounded-full bg-blue-100/40 blur-3xl" />
        <div className="absolute bottom-1/4 right-10 h-[400px] w-[400px] rounded-full bg-rose-100/30 blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header Section */}
        <div className="mx-auto mb-14 max-w-3xl text-center">
          <Reveal>
            <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3.5 py-1 text-xs font-semibold tracking-wide text-neutral-700 shadow-xs uppercase">
              <Sparkles className="size-3.5 text-blue-600" />
              Realita Masalah vs Solusi Careevo
            </div>
          </Reveal>

          <Reveal delay={80}>
            <h2 className="mt-4 text-3xl font-medium tracking-tight text-neutral-900 sm:text-4xl lg:text-5xl">
              Rekrutmen tech sedang rusak. <br className="hidden sm:inline" />
              Inilah cara kami memperbaikinya.
            </h2>
          </Reveal>

          <Reveal delay={160}>
            <p className="mt-4 text-base text-neutral-600 sm:text-lg">
              Ketika AI memudahkan semua orang membuat CV dan portofolio instan, rekruter kehilangan kepercayaan.
              Careevo hadir menjembatani proses belajar autentik hingga peluang kerja nyata.
            </p>
          </Reveal>

          {/* Quote dari Dario Amodei (CEO Anthropic) */}
          <Reveal delay={180}>
            <div className="mt-8 overflow-hidden rounded-2xl border border-neutral-200/90 bg-white p-6 sm:p-7 text-left shadow-sm">
              <div className="flex flex-col sm:flex-row items-start gap-4">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-neutral-900 text-white shadow-xs">
                  <Quote className="size-5 text-blue-400" />
                </div>
                <div className="flex-1 space-y-3">
                  <p className="text-base sm:text-[17px] font-medium leading-relaxed text-neutral-800 italic">
                    &ldquo;In a world where AI can generate anything and create anything, having basic critical thinking skills may be the most important thing to success. It&rsquo;s really hard to tell what&rsquo;s real from what&rsquo;s not... You don&rsquo;t want to fall for things that are fake, and you don&rsquo;t want to get scammed.&rdquo;
                  </p>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-3">
                    <div>
                      <span className="font-semibold text-neutral-900 text-sm">Dario Amodei</span>
                      <span className="text-xs text-neutral-500"> — CEO & Co-founder, Anthropic (Kreator Claude AI)</span>
                    </div>
                    <a
                      href="https://x.com/vikktorrrre/status/2102446813714293039"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      <span>Lihat diskusi di X</span>
                      <ArrowRight className="size-3" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>

          {/* Filter Pills */}
          <Reveal delay={200}>
            <div className="mt-8 flex justify-center">
              <div className="inline-flex rounded-xl border border-neutral-200 bg-white p-1 shadow-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab("all")}
                  className={`rounded-lg px-4 py-1.5 text-xs sm:text-sm font-medium transition-all ${
                    activeTab === "all"
                      ? "bg-neutral-900 text-white shadow-xs"
                      : "text-neutral-600 hover:text-neutral-900"
                  }`}
                >
                  Bandingkan Semua
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("problem")}
                  className={`rounded-lg px-4 py-1.5 text-xs sm:text-sm font-medium transition-all ${
                    activeTab === "problem"
                      ? "bg-rose-600 text-white shadow-xs"
                      : "text-neutral-600 hover:text-neutral-900"
                  }`}
                >
                  Tantangan Saat Ini
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("solution")}
                  className={`rounded-lg px-4 py-1.5 text-xs sm:text-sm font-medium transition-all ${
                    activeTab === "solution"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-neutral-600 hover:text-neutral-900"
                  }`}
                >
                  Solusi Careevo
                </button>
              </div>
            </div>
          </Reveal>
        </div>

        {/* Comparison Grid */}
        <div className="space-y-6">
          {COMPARISONS.map((item, index) => {
            const ProblemIcon = item.problem.icon;
            const SolutionIcon = item.solution.icon;

            return (
              <Reveal key={item.id} delay={index * 90}>
                <div className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-xs transition hover:shadow-md">
                  {/* Category Header Bar */}
                  <div className="flex items-center justify-between border-b border-neutral-100 bg-neutral-50/70 px-6 py-3">
                    <span className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
                      {item.tag}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-400">
                      <Lock className="size-3" />
                      Careevo Zero-Surveillance
                    </span>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-neutral-100">
                    {/* Problem Side */}
                    {(activeTab === "all" || activeTab === "problem") && (
                      <div
                        className={`p-6 sm:p-8 transition-colors ${
                          activeTab === "problem" ? "bg-rose-50/30" : "bg-neutral-50/20"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="inline-flex size-9 items-center justify-center rounded-lg bg-rose-100 text-rose-700">
                            <ProblemIcon className="size-5" />
                          </span>
                          <span className="text-xs font-semibold text-rose-700 uppercase tracking-wide">
                            Tantangan Industri
                          </span>
                        </div>

                        <h3 className="mt-3.5 text-xl font-semibold text-neutral-900">
                          {item.problem.title}
                        </h3>

                        <p className="mt-2.5 text-sm leading-relaxed text-neutral-600">
                          {item.problem.description}
                        </p>

                        <div className="mt-5 rounded-xl border border-rose-100 bg-rose-50/60 p-3.5 text-xs text-rose-900">
                          <span className="font-semibold">Dampaknya: </span>
                          {item.problem.impact}
                        </div>
                      </div>
                    )}

                    {/* Solution Side */}
                    {(activeTab === "all" || activeTab === "solution") && (
                      <div
                        className={`p-6 sm:p-8 transition-colors ${
                          activeTab === "solution" ? "bg-blue-50/30" : "bg-white"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <span className="inline-flex size-9 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                              <SolutionIcon className="size-5" />
                            </span>
                            <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
                              Solusi: {item.solution.agent}
                            </span>
                          </div>
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                            <CheckCircle2 className="size-3" />
                            Terverifikasi
                          </span>
                        </div>

                        <h3 className="mt-3.5 text-xl font-semibold text-neutral-900">
                          {item.solution.title}
                        </h3>

                        <p className="mt-2.5 text-sm leading-relaxed text-neutral-600">
                          {item.solution.description}
                        </p>

                        <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50/60 p-3.5 text-xs text-blue-950">
                          <span className="font-semibold text-blue-800">Hasil Nyata: </span>
                          {item.solution.outcome}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>

        {/* Bottom Metric & Action Bar */}
        <Reveal delay={240}>
          <div className="mt-12 rounded-2xl border border-neutral-200 bg-neutral-900 p-6 sm:p-8 text-white shadow-xl">
            <div className="flex flex-col items-center justify-between gap-6 lg:flex-row">
              <div className="space-y-2 text-center lg:text-left">
                <h3 className="text-xl font-semibold sm:text-2xl">
                  Buktikan keahlian aslimu dan mulai karier impian sekarang
                </h3>
                <p className="text-sm text-neutral-400">
                  Latihan terarah dengan Socrates AI, dapatkan badge HMAC-SHA256, dan temukan lowongan terkurasi.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/daftar"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-medium text-neutral-900 transition hover:bg-neutral-100"
                >
                  Coba Latihan Gratis
                  <ArrowRight className="size-4" />
                </Link>
                <Link
                  href="/loker"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-neutral-700 bg-neutral-800/80 px-5 text-sm font-medium text-white transition hover:bg-neutral-800"
                >
                  Jelajahi Loker Terverifikasi
                </Link>
              </div>
            </div>

            {/* Micro stats banner */}
            <div className="mt-8 grid grid-cols-2 gap-4 border-t border-neutral-800 pt-6 sm:grid-cols-4 text-center">
              <div>
                <p className="text-2xl font-bold text-white">0%</p>
                <p className="text-xs text-neutral-400">Kamera Pengawas (Nir-Biometrik)</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-400">HMAC</p>
                <p className="text-xs text-neutral-400">Verifikasi Bukti Kriptografis</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-400">100%</p>
                <p className="text-xs text-neutral-400">Audit Bebas Scam & Fee</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-400">1-on-1</p>
                <p className="text-xs text-neutral-400">Bimbingan Sokratik AI</p>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
