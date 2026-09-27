"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  Building2,
  Check,
  ChevronDown,
  ExternalLink,
  FileCheck2,
  Minus,
  Search,
  ShieldAlert,
  ShieldCheck,
  Target,
  Terminal,
} from "lucide-react";
import type { JobFixture } from "@/lib/fixtures";
import { StatusBadge } from "@/components/ui/status-badge";
import { JobsBoard } from "@/components/features/jobs/jobs-board";
import { CurvySearchBar } from "@/components/features/jobs/curvy-search-bar";
import Featured_05 from "@/components/ui/globe-feature-section";
import { LogoCloud } from "@/components/ui/logo-cloud-2";
import { cn } from "@/lib/utils";
import { HARGA, rupiah, perBulanTahunan } from "@/lib/pricing";

interface VertexKerjaViewProps {
  jobs: JobFixture[];
  cleanJobsCount: number;
}

// 4 Featured verified showcase jobs
const FEATURED_ROLES = [
  {
    tabLabel: "Frontend & Web",
    role: "Frontend Engineer (Junior)",
    company: "PT Nusantara Digital",
    location: "Jakarta · Hybrid",
    salary: "Rp6-8 jt",
    source: "KarirHub Kemnaker",
    domainAge: "1.240 hari",
    tags: ["React", "TypeScript", "Testing"],
    description:
      "Membangun antarmuka produk B2B dengan React dan TypeScript, menulis automated test, dan berkolaborasi langsung dengan tim desain produk.",
    fitScore: 94,
    status: "clean",
    applyHref: "/loker/1",
    externalApplyUrl: "https://nusantaradigital.co.id/karier/frontend-engineer",
    upcomingReview: "Review Verifikator Siap · Portofolio Terhubung",
    pipeline: [
      { step: "1", title: "Validasi Domain & Host", desc: "nusantaradigital.co.id berumur >3 tahun", passed: true },
      { step: "2", title: "Audit Pola Pungutan Fee", desc: "Nol indikasi pungutan pendaftaran", passed: true },
      { step: "3", title: "Sensor Rekening Pribadi", desc: "Tidak ada transfer rekening perorangan", passed: true },
      { step: "4", title: "AI Fit Score & Skill Gap", desc: "94% kecocokan dengan modul React & TS", passed: true },
    ],
    activities: [
      { action: "Sentinel memindai postingan loker", time: "3 jam lalu" },
      { action: "KarirHub mengonfirmasi entitas badan usaha", time: "1 hari lalu" },
      { action: "Verifikator memvalidasi kontak HR resmi", time: "2 hari lalu" },
    ],
  },
  {
    tabLabel: "Backend & Cloud",
    role: "Fullstack Engineer (React/Node)",
    company: "PT Sinergi Teknologi",
    location: "Remote (Indonesia)",
    salary: "Rp10-14 jt",
    source: "KarirHub Kemnaker",
    domainAge: "930 hari",
    tags: ["React", "Node.js", "PostgreSQL", "REST API"],
    description:
      "Mengembangkan arsitektur fitur end-to-end: REST API Node.js yang scalable, antarmuka pengguna React modern, dan optimasi database PostgreSQL.",
    fitScore: 89,
    status: "clean",
    applyHref: "/loker/3",
    externalApplyUrl: "https://sinergiteknologi.id/karier/fullstack",
    upcomingReview: "Penilaian Tantangan Sokratik · Siap Dilamar",
    pipeline: [
      { step: "1", title: "Validasi Domain & Host", desc: "sinergiteknologi.id tervalidasi SSL & WHOIS", passed: true },
      { step: "2", title: "Audit Pola Pungutan Fee", desc: "Bebas dari skema pelatihan berbayar", passed: true },
      { step: "3", title: "Sensor Rekening Pribadi", desc: "Alamat email domain resmi perusahaan", passed: true },
      { step: "4", title: "AI Fit Score & Skill Gap", desc: "89% kecocokan (perlu latihan SQL indexing)", passed: true },
    ],
    activities: [
      { action: "Sentinel mengaudit skema benefit & gaji", time: "5 jam lalu" },
      { action: "Hasil challenge HMAC diselaraskan", time: "1 hari lalu" },
      { action: "Socrates menandatangani rubrik backend", time: "3 hari lalu" },
    ],
  },
  {
    tabLabel: "Mobile & Platform",
    role: "Backend Engineer (Node.js)",
    company: "PT Data Raya",
    location: "Jakarta · Onsite",
    salary: "Rp9-12 jt",
    source: "KarirHub Kemnaker",
    domainAge: "1.890 hari",
    tags: ["Node.js", "PostgreSQL", "API Security"],
    description:
      "Merancang mikroservis berkinerja tinggi, mengelola pipeline data transaksional, serta memastikan standar keamanan enkripsi dan otorisasi data.",
    fitScore: 91,
    status: "clean",
    applyHref: "/loker/5",
    externalApplyUrl: "https://dataraya.id/karir",
    upcomingReview: "Simulasi Wawancara Arsitektur Siap",
    pipeline: [
      { step: "1", title: "Validasi Domain & Host", desc: "dataraya.id beroperasi aktif sejak 2021", passed: true },
      { step: "2", title: "Audit Pola Pungutan Fee", desc: "Nol biaya seleksi / akomodasi palsu", passed: true },
      { step: "3", title: "Sensor Rekening Pribadi", desc: "Rekrutmen tersentralisasi lewat ATS", passed: true },
      { step: "4", title: "AI Fit Score & Skill Gap", desc: "91% kecocokan dengan tantangan API", passed: true },
    ],
    activities: [
      { action: "Sentinel memverifikasi lowongan via API Kemnaker", time: "4 jam lalu" },
      { action: "Integrasi checklist OWASP tervalidasi", time: "2 hari lalu" },
      { action: "Talent pool terakreditasi menerima notifikasi", time: "3 hari lalu" },
    ],
  },
  {
    tabLabel: "UI & Accessibility",
    role: "UI Engineer",
    company: "Studio Aksara",
    location: "Yogyakarta · Hybrid",
    salary: "Rp5-7 jt",
    source: "KarirHub Kemnaker",
    domainAge: "760 hari",
    tags: ["CSS", "React", "WCAG 2.2", "Figma"],
    description:
      "Menerjemahkan sistem desain kompleks menjadi komponen web aksesibel, memelihara design token, dan memastikan kepatuhan standar WCAG 2.2.",
    fitScore: 96,
    status: "clean",
    applyHref: "/loker/4",
    externalApplyUrl: "https://studioaksara.com/karier/ui-engineer",
    upcomingReview: "Uji Bukti Karya Interaktif Selesai",
    pipeline: [
      { step: "1", title: "Validasi Domain & Host", desc: "studioaksara.com tervalidasi resmi", passed: true },
      { step: "2", title: "Audit Pola Pungutan Fee", desc: "Bebas persyaratan transfer pra-interview", passed: true },
      { step: "3", title: "Sensor Rekening Pribadi", desc: "Komunikasi melalui kanal resmi HR", passed: true },
      { step: "4", title: "AI Fit Score & Skill Gap", desc: "96% kecocokan komponen & aksesibilitas", passed: true },
    ],
    activities: [
      { action: "Audit berkas lowongan berhasil dilakukan", time: "2 jam lalu" },
      { action: "Kandidat mencocokkan portofolio live", time: "12 jam lalu" },
      { action: "Kandidat menerima skor evaluasi A", time: "1 hari lalu" },
    ],
  },
];

// Testimonials data
const TESTIMONIALS_ROW_1 = [
  {
    quote: "Sentinel menyaring lowongan scam yang biasanya menjebak fresh graduate. Saya melamar dengan rasa tenang dan langsung diterima di posisi Frontend.",
    name: "Rian Pratama",
    role: "Frontend Developer",
    company: "PT Nusantara Digital",
    initials: "RP",
  },
  {
    quote: "Fit score AI-nya sangat akurat. Bukan sekadar mencocokkan kata kunci, tapi benar-benar memetakan kode yang pernah saya kerjakan di challenge.",
    name: "Dinda Safitri",
    role: "Fullstack Engineer",
    company: "Studio Aksara",
    initials: "DS",
  },
  {
    quote: "Sebagai rekruter, waktu screening kami terpangkas 70%. Kandidat dari Careevo sudah membawa badge HMAC dan bukti karya terverifikasi.",
    name: "Bambang Wijaya",
    role: "Lead Tech Recruiter",
    company: "Sinergi Group",
    initials: "BW",
  },
  {
    quote: "Pencari kerja tidak perlu cemas ditipu biaya seragam atau tes akal-akalan. Kurasi no-fee di sini 100% konsisten.",
    name: "Farhan Maulana",
    role: "Backend Engineer",
    company: "PT Data Raya",
    initials: "FM",
  },
];

const TESTIMONIALS_ROW_2 = [
  {
    quote: "Transparansi audit per lowongan membuat kami tahu persis umur domain perusahaan, rekam jejak, dan tingkat kecocokan teknis.",
    name: "Nadia Utami",
    role: "UI/UX & Web Developer",
    company: "Karya Mandiri",
    initials: "NU",
  },
  {
    quote: "Fitur penutup skill gap memberi tahu saya persis materi apa yang kurang sebelum wawancara. Sangat membantu menembus remote job.",
    name: "Kevin Anggara",
    role: "Remote Software Engineer",
    company: "TechScale Global",
    initials: "KA",
  },
  {
    quote: "Standar verifikasi Careevo menggantikan ratusan halaman CV formalitas dengan satu bukti pengerjaan tugas nyata.",
    name: "Siti Rahmawati",
    role: "Head of People & Culture",
    company: "Digital Optima",
    initials: "SR",
  },
  {
    quote: "Lowongan yang ada di sini benar-benar aktif dan relevan. Tidak ada ghost job yang dibiarkan menggantung berbulan-bulan.",
    name: "Agus Prasetyo",
    role: "Junior DevOps",
    company: "Cloud Nusantara",
    initials: "AP",
  },
];

// FAQ items
const FAQ_DATA = [
  {
    category: "umum",
    categoryLabel: "Umum",
    items: [
      {
        q: "Apa itu papan lowongan kerja Careevo?",
        a: "Careevo adalah platform jembatan karier terverifikasi yang mengagregasikan lowongan resmi dari KarirHub Kemnaker, kemudian mengauditnya secara otonom menggunakan Sentinel AI untuk memastikan seluruh lowongan bebas dari pungutan biaya dan penipuan.",
      },
      {
        q: "Apakah seluruh lowongan kerja di Careevo gratis untuk dilamar?",
        a: "Ya, 100% gratis. Sentinel secara ketat mengkarantina dan menolak setiap lowongan yang menyisipkan biaya pendaftaran, seragam, akomodasi tes, atau nomor rekening pribadi.",
      },
      {
        q: "Bagaimana cara melamar lowongan di sini?",
        a: "Pilih posisi yang kamu minati, tinjau ringkasan hasil audit Sentinel dan kecocokan skill, lalu klik tombol 'Lamar Lowongan' untuk menuju portal pendaftaran resmi perusahaan.",
      },
    ],
  },
  {
    category: "sentinel",
    categoryLabel: "Audit Sentinel",
    items: [
      {
        q: "Bagaimana Sentinel mendeteksi lowongan palsu?",
        a: "Sentinel menjalankan audit berlapis: verifikasi umur dan reputasi domain situs, pemindaian regex untuk nomor rekening dan e-wallet pribadi, analisis pola semantik permintaan biaya (fee detection), serta validasi status badan usaha pemberi kerja.",
      },
      {
        q: "Apa yang terjadi jika suatu lowongan terindikasi mencurigakan?",
        a: "Lowongan tersebut langsung diberi status KARANTINA atau DITOLAK. Lowongan yang berstatus DITOLAK disembunyikan sepenuhnya dari publik sehingga pencari kerja terlindungi.",
      },
      {
        q: "Mengapa usia domain perusahaan menjadi parameter audit?",
        a: "Banyak sindikat penipuan tenaga kerja membuat domain web instan yang baru berumur beberapa hari. Sentinel menetapkan batas aman usia domain agar hanya perusahaan beroperasi nyata yang lolos.",
      },
    ],
  },
  {
    category: "fit-score",
    categoryLabel: "Fit Score & Pelamaran",
    items: [
      {
        q: "Bagaimana Fit Score dihitung?",
        a: "Fit Score dihitung dari kesesuaian antara keterampilan yang kamu buktikan lewat modul challenge Careevo dengan kualifikasi teknis yang diminta oleh lowongan. Skor ini objektif dan berbasis kode nyata, bukan klaim verbal.",
      },
      {
        q: "Apakah saya bisa melamar jika belum memiliki Fit Score penuh?",
        a: "Tentu saja. Kamu tetap dapat melamar langsung. Namun memiliki skor evaluasi tinggi dan badge HMAC terverifikasi akan memperbesar peluang lolos seleksi berkas rekruter.",
      },
      {
        q: "Apa itu badge bukti karya HMAC?",
        a: "Badge HMAC adalah tanda tangan kriptografis yang membuktikan bahwa tugas coding dan submission proyek yang kamu buat telah divalidasi oleh verifikator dan tidak dapat dipalsukan.",
      },
    ],
  },
];

const DIAMOND_COLORS = [
  "bg-emerald-500",
  "bg-blue-500",
  "bg-amber-500",
  "bg-rose-500",
];

export function VertexKerjaView({ jobs, cleanJobsCount }: VertexKerjaViewProps) {
  const [cards, setCards] = useState(() =>
    FEATURED_ROLES.map((role, i) => ({ ...role, originalIndex: i }))
  );
  const [isPaused, setIsPaused] = useState(false);
  const [activeFaqCategory, setActiveFaqCategory] = useState("umum");
  const [openFaqIndexes, setOpenFaqIndexes] = useState<Record<string, boolean>>({
    "umum-0": true,
  });
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [searchQuery, setSearchQuery] = useState("");

  const bringToFront = (slotIndex: number) => {
    if (slotIndex === 0) return;
    setCards((prev) => [...prev.slice(slotIndex), ...prev.slice(0, slotIndex)]);
  };

  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setCards((prev) => [...prev.slice(1), prev[0]]);
    }, 5000);
    return () => clearInterval(interval);
  }, [isPaused]);

  const handleHeroSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const board = document.getElementById("board");
    if (board) {
      board.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleQuickSearch = (term: string) => {
    setSearchQuery(term);
    const board = document.getElementById("board");
    if (board) {
      board.scrollIntoView({ behavior: "smooth" });
    }
  };

  const toggleFaq = (key: string) => {
    setOpenFaqIndexes((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    // `under-chrome`, bukan margin negatif yang diketik manual: navbar
    // `position: sticky` memakan tinggi sungguhan di flow, dan hero di sini
    // harus mulai tepat di y=0 agar bar transparan mengambang di atasnya. Angka
    // yang dipakai sebelumnya (60) bukan tinggi bar — 66px di desktop, 62px di
    // mobile — jadi enam piksel latar halaman tersingkap sebagai pita putih di
    // atas layar. Satu pengukuran ada di `--chrome-h`; lihat `.under-chrome`.
    <div className="under-chrome relative min-h-screen bg-white text-neutral-900 selection:bg-neutral-200 overflow-x-hidden">
      {/* ============================================================ */}
      {/* 1. HERO SECTION (SEC 0) - Blended with transparent navbar at top, floating on scroll */}
      {/* ============================================================ */}
      <div className="relative z-10 w-full pt-28 sm:pt-32 md:pt-36 lg:pt-40 pb-24 sm:pb-28 lg:pb-32 overflow-hidden">
        {/* Background Layers: Striped Radial White BEHIND Wallpaper Background (Full Height) */}
        <div className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-hidden select-none">
          {/* Layer 1: Striped Radial White Background (Behind the Wallpaper) */}
          <div className="absolute inset-0 z-0 bg-[size:12px_12px] [background-image:repeating-linear-gradient(315deg,rgba(0,0,0,0.04)_0_1px,transparent_0_50%)] [mask-image:radial-gradient(ellipse_85%_80%_at_50%_40%,black_40%,transparent_92%)]" />
          <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_85%_75%_at_50%_35%,rgba(255,255,255,0.85)_0%,rgba(255,255,255,0.35)_55%,transparent_85%)]" />

          {/* Layer 2: Wallpaper Background (Full original sky restored, flush to top edge, no top crop) */}
          <div className="absolute inset-x-0 top-0 z-10 h-[850px] sm:h-[950px] md:h-[1050px] w-full overflow-hidden">
            <Image
              src="/images/hero-loker-header.png"
              alt="Careevo header visual"
              fill
              priority
              unoptimized
              className="object-cover object-top opacity-100"
            />
            {/* Gentle white fading on the bottom edge to blend into page body */}
            <div className="absolute inset-x-0 bottom-0 h-44 sm:h-64 bg-gradient-to-t from-white via-white/80 to-transparent" />
          </div>
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            {/* Main Headline (Matched to Home Page Hero Typography & White Color) */}
            <h1 className="mx-auto max-w-4xl text-balance text-4xl font-medium tracking-tight text-white sm:text-5xl md:text-6xl drop-shadow-sm">
              Kurasi lowongan kerja resmi yang diaudit Sentinel, tanpa biaya
            </h1>

                  {/* Lead Subtitle */}
                  <p className="mx-auto mt-5 max-w-2xl text-balance text-base text-white/85 sm:text-lg leading-relaxed">
                    Setiap lowongan kerja dipindai otomatis dari indikasi scam, pungutan fee seleksi, dan rekening pribadi. Dilengkapi Fit Score AI dan portofolio bukti karya nyata.
                  </p>

                  {/* Search Bar UIverse curvy-earwig-22 (Blue Edition) */}
                  <div className="mx-auto mt-7 w-full max-w-xl">
                    <CurvySearchBar
                      value={searchQuery}
                      onChange={setSearchQuery}
                      onSubmit={handleHeroSearch}
                      placeholder="Cari loker: Frontend, Node.js, Remote, Jakarta, Rp8-12 jt…"
                    />

                    {/* Quick Search Chips */}
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5 text-xs text-neutral-500">
                      <span className="text-[11px] text-neutral-400">Paling dicari:</span>
                      {["Frontend", "Node.js", "Remote", "Jakarta", "React", "Fullstack"].map((term) => (
                        <button
                          key={term}
                          type="button"
                          onClick={() => handleQuickSearch(term)}
                          className="cursor-pointer rounded-full border border-neutral-200/80 bg-white px-2.5 py-0.5 text-[11px] font-medium text-neutral-600 shadow-2xs transition-colors hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/50"
                        >
                          {term}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Dual Action CTAs */}
                  <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                    <Link
                      href="/loker/inbox"
                      className="chrome-btn chrome-btn-brand !h-11 !px-6 !text-sm gap-2"
                    >
                      <span>Jelajahi Papan Loker</span>
                      <ArrowRight className="size-4" />
                    </Link>
                    <Link
                      href="/loker/inbox"
                      className="chrome-btn chrome-btn-white !h-11 !px-6 !text-sm gap-2"
                    >
                      <span>Semua Lowongan</span>
                      <ArrowRight className="size-4" />
                    </Link>
                  </div>

                  {/* Credit label */}
                  <p className="mt-4 text-xs text-white/70">
                    Didukung oleh <strong className="font-medium text-white">Sentinel AI</strong> · Data resmi <strong className="font-medium text-white">KarirHub Kemnaker</strong>
                  </p>
                </div>

                {/* Stacked Showcase Card Deck (Vertex Signature - Full Width, Plain Flat, Unrounded, Crisp Border) */}
                <div
                  className="relative mx-auto mt-12 w-full max-w-full sm:mt-16"
                  style={{ paddingTop: "96px" }}
                  onMouseEnter={() => setIsPaused(true)}
                  onMouseLeave={() => setIsPaused(false)}
                >
                  <div className="relative">
                    {/* Natural height anchor: measures tallest card so container dynamically matches actual card height on all breakpoints */}
                    <div
                      className="grid invisible pointer-events-none select-none opacity-0"
                      aria-hidden="true"
                    >
                      {FEATURED_ROLES.map((role) => (
                        <div
                          key={role.tabLabel}
                          className="col-start-1 row-start-1 rounded-none border border-neutral-300"
                        >
                          {/* Card Tab Header */}
                          <div className="flex h-11 items-center gap-x-2 border-b border-neutral-200 px-4">
                            <span className="size-2 shrink-0" />
                            <span className="font-semibold text-xs sm:text-sm tracking-tight">{role.company}</span>
                            <span className="text-sm">·</span>
                            <span className="truncate text-xs sm:text-sm tracking-tight">{role.role} ({role.location})</span>
                            <span className="ml-auto text-[11px] font-medium">{role.tabLabel}</span>
                          </div>

                          {/* Card Content Grid */}
                          <div className="grid grid-rows-[auto_auto] lg:grid-cols-[320px_1fr] lg:grid-rows-[auto_1fr] divide-y lg:divide-y-0 lg:divide-x divide-neutral-200">
                            {/* Left Column */}
                            <div className="flex flex-col p-6 sm:p-7">
                              <div className="flex items-center justify-between">
                                <div className="size-11" />
                                <div className="h-6 w-20" />
                              </div>
                              <div className="mt-4">
                                <h2 className="text-lg font-semibold tracking-tight leading-snug">{role.role}</h2>
                                <p className="mt-1 text-sm font-medium">{role.company} · {role.location}</p>
                              </div>
                              <div className="mt-4 flex flex-wrap gap-2">
                                <div className="h-8 w-28" />
                                <div className="h-8 w-24" />
                              </div>
                              <div className="mt-6 border-t border-neutral-100 pt-5 space-y-2.5 text-xs">
                                <div className="flex items-center justify-between"><span>Rentang Gaji</span><span>{role.salary}</span></div>
                                <div className="flex items-center justify-between"><span>Sumber Data</span><span>{role.source}</span></div>
                                <div className="flex items-center justify-between"><span>Umur Domain</span><span>{role.domainAge}</span></div>
                                <div className="flex items-center justify-between"><span>Fit Match AI</span><span>{role.fitScore}% Cocok</span></div>
                              </div>
                              <div className="mt-5 flex flex-wrap gap-1.5">
                                {role.tags.map((t) => (
                                  <span key={t} className="px-2 py-0.5 text-[11px]">{t}</span>
                                ))}
                              </div>
                            </div>

                            {/* Right Column */}
                            <div className="flex flex-col p-6 sm:p-7">
                              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 pb-4">
                                <div className="text-xs font-semibold uppercase tracking-wider">Hasil Audit Sentinel & Evaluasi Kecocokan</div>
                                <span className="text-xs">{role.upcomingReview}</span>
                              </div>
                              <div className="mt-4">
                                <p className="text-sm leading-relaxed">{role.description}</p>
                              </div>
                              <div className="mt-6">
                                <div className="text-xs font-semibold uppercase tracking-wider mb-3">Protokol Validasi Sentinel</div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  {role.pipeline.map((item) => (
                                    <div key={item.step} className="p-3 text-xs">
                                      <div className="font-semibold">{item.title}</div>
                                      <p className="mt-1 pl-7">{item.desc}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div className="mt-6 border-t border-neutral-100 pt-5">
                                <div className="text-xs font-semibold uppercase tracking-wider mb-2.5">Jejak Audit Terakhir</div>
                                <div className="space-y-2 text-xs">
                                  {role.activities.map((act, i) => (
                                    <div key={i} className="flex items-center justify-between gap-2">
                                      <span>{act.action}</span>
                                      <span>{act.time}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {cards.map((role, slotIndex) => {
                      const topOffset = -slotIndex * 32;
                      const scale = 1 - slotIndex * 0.05;
                      const zIndex = 4 - slotIndex;

                      return (
                        <article
                          key={role.tabLabel}
                          className="absolute inset-x-0 top-0 overflow-hidden rounded-none border border-neutral-300 bg-white shadow-none ring-1 ring-neutral-200/80"
                          style={{
                            transformOrigin: "center top",
                            transform: `scale(${scale})`,
                            top: `${topOffset}px`,
                            zIndex,
                            transition:
                              "transform 600ms cubic-bezier(0.16, 1, 0.3, 1), top 600ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 500ms ease",
                          }}
                        >
                          {/* Card Tab Header */}
                          <div
                            onClick={() => bringToFront(slotIndex)}
                            className={cn(
                              "flex h-11 items-center gap-x-2 border-b border-neutral-200 px-4 transition-colors select-none",
                              slotIndex === 0
                                ? "bg-neutral-50/90"
                                : "bg-neutral-100/90 hover:bg-neutral-200/70 cursor-pointer"
                            )}
                          >
                            <span
                              aria-hidden="true"
                              className={cn(
                                "size-2 shrink-0 rotate-45 rounded-[2px]",
                                DIAMOND_COLORS[role.originalIndex]
                              )}
                            />
                            <span className="font-semibold text-neutral-900 text-xs sm:text-sm tracking-tight">
                              {role.company}
                            </span>
                            <span className="text-neutral-300 text-sm">·</span>
                            <span className="truncate text-neutral-600 text-xs sm:text-sm tracking-tight">
                              {role.role} ({role.location})
                            </span>
                            <span className="ml-auto text-[11px] font-medium text-neutral-400">
                              {role.tabLabel}
                            </span>
                          </div>

                          {/* Card Content Grid */}
                          <div className="grid grid-rows-[auto_auto] lg:grid-cols-[320px_1fr] lg:grid-rows-[auto_1fr] divide-y lg:divide-y-0 lg:divide-x divide-neutral-200 bg-white">
                            {/* Left Column: Job / Candidate Profile Card */}
                            <div className="relative flex flex-col p-6 sm:p-7 bg-white">
                              <div className="flex items-center justify-between">
                                <div className="flex size-11 items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-800 shadow-xs">
                                  <Building2 className="size-5 text-neutral-700" />
                                </div>
                                <StatusBadge status={role.status} />
                              </div>

                              <div className="mt-4">
                                <h2 className="text-lg font-semibold text-neutral-900 tracking-tight leading-snug">
                                  {role.role}
                                </h2>
                                <p className="mt-1 text-sm font-medium text-neutral-500">
                                  {role.company} · {role.location}
                                </p>
                              </div>

                              {/* Quick Actions */}
                              <div className="mt-4 flex flex-wrap gap-2">
                                <Link
                                  href={role.applyHref}
                                  className="chrome-btn chrome-btn-brand !h-8 !px-3.5 !text-xs gap-1.5"
                                >
                                  <Briefcase className="size-3.5" />
                                  <span>Lamar Loker</span>
                                </Link>
                                <a
                                  href={role.externalApplyUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="chrome-btn chrome-btn-white !h-8 !px-3.5 !text-xs gap-1.5"
                                >
                                  <ExternalLink className="size-3.5 text-neutral-500" />
                                  <span>KarirHub</span>
                                </a>
                              </div>

                              {/* Job Metadata Table */}
                              <div className="mt-6 border-t border-neutral-100 pt-5 space-y-2.5 text-xs">
                                <div className="flex items-center justify-between">
                                  <span className="text-neutral-400">Rentang Gaji</span>
                                  <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                                    {role.salary}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-neutral-400">Sumber Data</span>
                                  <span className="font-medium text-neutral-700">{role.source}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-neutral-400">Umur Domain</span>
                                  <span className="font-medium text-neutral-700">{role.domainAge}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-neutral-400">Fit Match AI</span>
                                  <span className="font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                                    {role.fitScore}% Cocok
                                  </span>
                                </div>
                              </div>

                              {/* Tag Pills */}
                              <div className="mt-5 flex flex-wrap gap-1.5">
                                {role.tags.map((t) => (
                                  <span
                                    key={t}
                                    className="rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600"
                                  >
                                    {t}
                                  </span>
                                ))}
                              </div>
                            </div>

                            {/* Right Column: Highlights, Pipeline & Activity Log */}
                            <div className="flex flex-col p-6 sm:p-7 bg-white">
                              {/* Top Bar */}
                              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 pb-4">
                                <div className="flex items-center gap-2 text-xs font-semibold text-neutral-900 uppercase tracking-wider">
                                  <ShieldCheck className="size-4 text-emerald-600" />
                                  <span>Hasil Audit Sentinel & Evaluasi Kecocokan</span>
                                </div>
                                <span className="text-xs text-neutral-400">
                                  {role.upcomingReview}
                                </span>
                              </div>

                              {/* Summary Section */}
                              <div className="mt-4">
                                <p className="text-sm text-neutral-700 leading-relaxed">
                                  {role.description}
                                </p>
                              </div>

                              {/* Verification Pipeline Steps */}
                              <div className="mt-6">
                                <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">
                                  Protokol Validasi Sentinel
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  {role.pipeline.map((item) => (
                                    <div
                                      key={item.step}
                                      className="rounded-lg border border-neutral-200/80 bg-neutral-50/60 p-3 text-xs"
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className="flex size-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                                          ✓
                                        </span>
                                        <span className="font-semibold text-neutral-900">{item.title}</span>
                                      </div>
                                      <p className="mt-1 pl-7 text-neutral-500">{item.desc}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Realtime Activity Feed */}
                              <div className="mt-6 border-t border-neutral-100 pt-5">
                                <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2.5">
                                  Jejak Audit Terakhir
                                </h3>
                                <div className="space-y-2 text-xs text-neutral-600">
                                  {role.activities.map((act, i) => (
                                    <div key={i} className="flex items-center justify-between gap-2">
                                      <span className="flex items-center gap-2">
                                        <span className="size-1.5 rounded-full bg-blue-500" />
                                        <span>{act.action}</span>
                                      </span>
                                      <span className="text-neutral-400 shrink-0">{act.time}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* ============================================================ */}
            {/* FULL-WIDTH FEATURE BANDS (Globe & Logo Cloud)                */}
            {/* Separated from vertical container lines, spanning 100% width */}
            {/* ============================================================ */}
            <div className="relative z-10 w-full overflow-hidden">
              {/* Top dashed divider */}
              <div className="relative h-10 w-full border-y border-dashed border-neutral-200 bg-[size:10px_10px] [background-image:repeating-linear-gradient(315deg,rgba(0,0,0,0.035)_0_1px,transparent_0_50%)] md:h-12" />

              {/* 1. Full-width Globe Feature Section */}
              <Featured_05 className="w-full border-b border-t-0" />

              {/* Middle dashed divider */}
              <div className="relative h-10 w-full border-y border-dashed border-neutral-200 bg-[size:10px_10px] [background-image:repeating-linear-gradient(315deg,rgba(0,0,0,0.035)_0_1px,transparent_0_50%)] md:h-12" />

              {/* 2. Full-width Logo Cloud Section */}
              <section aria-label="Sumber papan lowongan" className="relative w-full bg-white dark:bg-neutral-950 overflow-hidden">
                <div className="w-full border-b border-neutral-200 bg-neutral-50/50 py-3.5 text-center">
                  <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Lowongan yang ditampilkan dibaca dari papan ini, lalu diaudit Sentinel
                  </p>
                </div>
                <LogoCloud className="w-full border-x-0" />
              </section>

              {/* Bottom dashed divider */}
              <div className="relative h-10 w-full border-y border-dashed border-neutral-200 bg-[size:10px_10px] [background-image:repeating-linear-gradient(315deg,rgba(0,0,0,0.035)_0_1px,transparent_0_50%)] md:h-12" />
            </div>

            {/* ============================================================ */}
            {/* OUTER VERTEX GRID FRAME (Starting below Full-Width Sections) */}
            {/* ============================================================ */}
            <div className="container relative z-10 mx-auto mt-10 sm:mt-14 lg:mt-16">
              <div className="border-x border-neutral-200">
                <div className="mx-1 border-x border-neutral-200 sm:mx-1.5 lg:mx-2 bg-white">
            {/* ============================================================ */}
            {/* 5. FEATURES / BENTO GRID (SEC 4)                             */}
            {/* ============================================================ */}
            <section id="features" className="scroll-mt-20 bg-white py-16 md:py-24">
              <div className="px-6 sm:px-8 lg:px-12">
                <div className="mx-auto max-w-2xl text-center">
                  <h2 className="text-balance font-semibold text-3xl sm:text-4xl text-neutral-950 tracking-tight">
                    Semua yang kamu butuhkan untuk menjemput karier pertama
                  </h2>
                  <p className="mt-4 text-balance text-base text-neutral-600 sm:text-lg">
                    Kurasi otonom tanpa celah, rekomendasi cerdas, dan jembatan bukti karya nyata dari course hingga interview.
                  </p>
                </div>

                {/* Bento Grid */}
                <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Bento Card 1: Large Span 2 */}
                  <div className="md:col-span-2 rounded-2xl border border-neutral-200/90 bg-white p-6 sm:p-8 shadow-xs transition-colors hover:border-neutral-300 flex flex-col justify-between">
                    <div>
                      <div className="inline-flex size-9 items-center justify-center rounded-xl bg-neutral-100 border border-neutral-200/80 text-neutral-900 mb-4 shadow-2xs">
                        <ShieldCheck className="size-5 text-neutral-800" />
                      </div>
                      <h3 className="text-xl font-semibold text-neutral-950">
                        Papan Loker & Sentinel Live Audit
                      </h3>
                      <p className="mt-2 text-sm text-neutral-600 leading-relaxed max-w-xl">
                        Sentinel memantau database loker resmi KarirHub secara berkala. Menganalisis usia domain web, menyaring pola pemerasan biaya seleksi, dan menandai status lowongan secara transparan.
                      </p>
                    </div>

                    {/* Visual UI Preview */}
                    <div className="mt-6 rounded-xl border border-neutral-200/90 bg-white p-4 shadow-2xs">
                      <div className="flex items-center justify-between border-b border-neutral-100 pb-2.5 text-xs">
                        <span className="font-semibold text-neutral-800 flex items-center gap-1.5">
                          <Terminal className="size-3.5 text-neutral-700" />
                          <span>Sinkronisasi KarirHub</span>
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-medium text-neutral-700">
                          <span className="size-1.5 rounded-full bg-neutral-900" />
                          Aktif
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                        <div className="rounded-lg border border-neutral-100 bg-neutral-50/70 p-2.5">
                          <span className="text-neutral-400 block text-[11px]">Total Dipindai</span>
                          <span className="font-bold text-neutral-900 text-sm mt-0.5 block">{jobs.length} Loker</span>
                        </div>
                        <div className="rounded-lg border border-neutral-100 bg-neutral-50/70 p-2.5">
                          <span className="text-neutral-400 block text-[11px]">Status Aman</span>
                          <span className="font-bold text-neutral-900 text-sm mt-0.5 block">{cleanJobsCount} Terverifikasi</span>
                        </div>
                        <div className="rounded-lg border border-neutral-100 bg-neutral-50/70 p-2.5">
                          <span className="text-neutral-400 block text-[11px]">Fee Seleksi</span>
                          <span className="font-bold text-neutral-900 text-sm mt-0.5 block">0 Pungutan Liar</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bento Card 2: Bukti Karya Terverifikasi */}
                  <div className="rounded-2xl border border-neutral-200/90 bg-white p-6 sm:p-8 shadow-xs transition-colors hover:border-neutral-300 flex flex-col justify-between">
                    <div>
                      <div className="inline-flex size-9 items-center justify-center rounded-xl bg-neutral-100 border border-neutral-200/80 text-neutral-900 mb-4 shadow-2xs">
                        <FileCheck2 className="size-5 text-neutral-800" />
                      </div>
                      <h3 className="text-xl font-semibold text-neutral-950">
                        Bukti Karya Terverifikasi
                      </h3>
                      <p className="mt-2 text-sm text-neutral-600 leading-relaxed">
                        Tantangan coding yang kamu selesaikan ditandatangani dengan HMAC tamper-evident, siap dicek langsung oleh rekruter tanpa perlu tes ulang.
                      </p>
                    </div>

                    <div className="mt-6 rounded-xl border border-neutral-200/90 bg-white p-3.5 shadow-2xs text-xs">
                      <div className="flex items-center justify-between text-neutral-500 text-[11px] mb-1.5">
                        <span>Attestation Status</span>
                        <span className="inline-flex items-center gap-1 font-medium text-neutral-800">
                          <Check className="size-3 text-neutral-900" />
                          Terverifikasi
                        </span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg bg-neutral-50 px-2.5 py-1.5 border border-neutral-100 text-[11px] text-neutral-700">
                        <span>HMAC-SHA256</span>
                        <span className="text-neutral-400">verify.careevo.id</span>
                      </div>
                    </div>
                  </div>

                  {/* Bento Card 3: Kesesuaian Skill & Penutup Gap */}
                  <div className="rounded-2xl border border-neutral-200/90 bg-white p-6 sm:p-8 shadow-xs transition-colors hover:border-neutral-300 flex flex-col justify-between">
                    <div>
                      <div className="inline-flex size-9 items-center justify-center rounded-xl bg-neutral-100 border border-neutral-200/80 text-neutral-900 mb-4 shadow-2xs">
                        <Target className="size-5 text-neutral-800" />
                      </div>
                      <h3 className="text-xl font-semibold text-neutral-950">
                        Kesesuaian Skill &amp; Penutup Gap
                      </h3>
                      <p className="mt-2 text-sm text-neutral-600 leading-relaxed">
                        Bandingkan keahlianmu dengan requirement loker secara objektif, lalu kamu
                        dapat rekomendasi modul latihan spesifik yang menutup kekurangan skill itu.
                      </p>
                    </div>

                    <div className="mt-6 rounded-xl border border-neutral-200/90 bg-white p-3 shadow-2xs text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-500 text-[11px]">Kebutuhan Posisi</span>
                        <span className="font-medium text-neutral-800 text-[11px]">Backend API</span>
                      </div>
                      <div className="flex items-center justify-between border-t border-neutral-100 pt-1.5">
                        <span className="text-neutral-500 text-[11px]">Modul Rekomendasi</span>
                        <span className="font-medium text-neutral-900 text-[11px]">PostgreSQL Indexing</span>
                      </div>
                    </div>
                  </div>

                  {/* Bento Card 4: Pencarian Kata Kunci Cerdas */}
                  <div className="rounded-2xl border border-neutral-200/90 bg-white p-6 sm:p-8 shadow-xs transition-colors hover:border-neutral-300 flex flex-col justify-between">
                    <div>
                      <div className="inline-flex size-9 items-center justify-center rounded-xl bg-neutral-100 border border-neutral-200/80 text-neutral-900 mb-4 shadow-2xs">
                        <Search className="size-5 text-neutral-800" />
                      </div>
                      <h3 className="text-xl font-semibold text-neutral-950">
                        Pencarian Kata Kunci Cerdas
                      </h3>
                      <p className="mt-2 text-sm text-neutral-600 leading-relaxed">
                        Cari posisi berdasarkan teknologi, lokasi (Remote, Jakarta, Hybrid), atau rentang gaji yang kamu targetkan.
                      </p>
                    </div>

                    <div className="mt-6 flex flex-wrap gap-1.5 text-xs">
                      <span className="rounded-lg bg-neutral-50 border border-neutral-200/80 px-2.5 py-1 text-[11px] font-medium text-neutral-700 shadow-2xs">
                        Remote Friendly
                      </span>
                      <span className="rounded-lg bg-neutral-50 border border-neutral-200/80 px-2.5 py-1 text-[11px] font-medium text-neutral-700 shadow-2xs">
                        Fullstack &amp; Backend
                      </span>
                      <span className="rounded-lg bg-neutral-50 border border-neutral-200/80 px-2.5 py-1 text-[11px] font-medium text-neutral-700 shadow-2xs">
                        Gaji Transparan
                      </span>
                    </div>
                  </div>

                  {/* Bento Card 5: Karantina Scam Otomatis */}
                  <div className="rounded-2xl border border-neutral-200/90 bg-white p-6 sm:p-8 shadow-xs transition-colors hover:border-neutral-300 flex flex-col justify-between">
                    <div>
                      <div className="inline-flex size-9 items-center justify-center rounded-xl bg-neutral-100 border border-neutral-200/80 text-neutral-900 mb-4 shadow-2xs">
                        <ShieldAlert className="size-5 text-neutral-800" />
                      </div>
                      <h3 className="text-xl font-semibold text-neutral-950">
                        Karantina Scam Otomatis
                      </h3>
                      <p className="mt-2 text-sm text-neutral-600 leading-relaxed">
                        Lowongan yang meminta biaya tes seleksi atau menggunakan nomor WhatsApp mencurigakan langsung ditahan di ruang karantina oleh verifikator.
                      </p>
                    </div>

                    <div className="mt-6 rounded-xl border border-neutral-200/90 bg-neutral-50/80 p-3 text-xs text-neutral-700 flex items-center gap-2.5">
                      <AlertTriangle className="size-4 text-neutral-800 shrink-0" />
                      <div className="leading-tight">
                        <span className="font-semibold text-neutral-900 block">Sinyal Pungutan Biaya</span>
                        <span className="text-[11px] text-neutral-500">Loker ditahan otomatis ke karantina</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* ============================================================ */}
            {/* 6. DASHED SECTION DIVIDER                                    */}
            {/* ============================================================ */}
            <div className="relative h-10 border-y border-dashed border-neutral-200 bg-[size:10px_10px] [background-image:repeating-linear-gradient(315deg,rgba(0,0,0,0.035)_0_1px,transparent_0_50%)] md:h-12" />

            {/* ============================================================ */}
            {/* 7. SCALE & INFRASTRUCTURE SECTION (SEC 6)                    */}
            {/* ============================================================ */}
            <section className="bg-white">
              <div className="border-t border-dashed border-neutral-200" />
              <div className="px-6 pt-16 pb-10 sm:px-8 sm:pb-16 lg:px-12">
                <div className="mx-auto max-w-2xl text-center">
                  <h2 className="text-balance font-semibold text-3xl sm:text-4xl text-neutral-950 tracking-tight">
                    Dibangun untuk Skala & Keamanan Pencari Kerja
                  </h2>
                  <p className="mt-4 text-balance text-base text-neutral-600 sm:text-lg">
                    Memproses puluhan ribu lowongan dengan latensi sub-detik untuk memastikan ruang aman bagi talenta muda.
                  </p>
                </div>
              </div>

              {/* Graphic curve with numbers */}
              <div className="relative overflow-hidden border-y border-dashed border-neutral-200 bg-neutral-50/40">
                <svg
                  aria-hidden="true"
                  className="absolute inset-0 h-full w-full opacity-60"
                  preserveAspectRatio="none"
                  viewBox="0 0 1400 600"
                >
                  <defs>
                    <linearGradient id="services-curve-fill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#266DF0" stopOpacity="0.08" />
                      <stop offset="100%" stopColor="#266DF0" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d="M 0 560 C 700 540 1100 200 1400 40 L 1400 600 L 0 600 Z" fill="url(#services-curve-fill)" />
                  <path d="M 0 560 C 700 540 1100 200 1400 40" fill="none" stroke="#266DF0" strokeLinecap="round" strokeWidth="1.5" />
                </svg>

                <div className="relative px-6 py-12 sm:px-8 sm:py-16 lg:px-12">
                  <div className="max-w-2xl">
                    <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:gap-x-12 sm:gap-y-10">
                      <div className="flex flex-col gap-1">
                        <span className="text-3xl sm:text-4xl font-bold tracking-tight text-neutral-950">
                          100%
                        </span>
                        <span className="text-xs sm:text-sm font-medium text-neutral-500">
                          No-fee terfilter & loker berbiaya dikarantina
                        </span>
                      </div>

                      <div className="flex flex-col gap-1">
                        <span className="text-3xl sm:text-4xl font-bold tracking-tight text-neutral-950">
                          81.000+
                        </span>
                        <span className="text-xs sm:text-sm font-medium text-neutral-500">
                          Lowongan terpindai dari database resmi
                        </span>
                      </div>

                      <div className="flex flex-col gap-1">
                        <span className="text-3xl sm:text-4xl font-bold tracking-tight text-neutral-950">
                          Rp 0
                        </span>
                        <span className="text-xs sm:text-sm font-medium text-neutral-500">
                          Biaya rekrutmen atau pungutan liar
                        </span>
                      </div>

                      <div className="flex flex-col gap-1">
                        <span className="text-3xl sm:text-4xl font-bold tracking-tight text-neutral-950">
                          &lt; 3 Detik
                        </span>
                        <span className="text-xs sm:text-sm font-medium text-neutral-500">
                          Waktu audit Sentinel per loker
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 4 Workflow / Job Area Cards */}
                  <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs">
                      <h3 className="font-semibold text-sm text-neutral-900">Frontend & Web</h3>
                      <p className="mt-1 text-xs text-neutral-500 leading-relaxed">
                        React, Next.js, TypeScript, Tailwind, optimasi performa dan standar aksesibilitas.
                      </p>
                    </div>

                    <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs">
                      <h3 className="font-semibold text-sm text-neutral-900">Backend & Cloud</h3>
                      <p className="mt-1 text-xs text-neutral-500 leading-relaxed">
                        Node.js, Go, PostgreSQL, Docker, arsitektur REST & GraphQL, pemrosesan data transaksional.
                      </p>
                    </div>

                    <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs">
                      <h3 className="font-semibold text-sm text-neutral-900">Mobile & Platform</h3>
                      <p className="mt-1 text-xs text-neutral-500 leading-relaxed">
                        Flutter, React Native, integrasi native API, state management dan sinkronisasi offline.
                      </p>
                    </div>

                    <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs">
                      <h3 className="font-semibold text-sm text-neutral-900">QA & Security</h3>
                      <p className="mt-1 text-xs text-neutral-500 leading-relaxed">
                        Automated testing, validasi keamanan OWASP, audit integritas kode dan pipeline CI/CD.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* ============================================================ */}
            {/* 8. DASHED SECTION DIVIDER                                    */}
            {/* ============================================================ */}
            <div className="relative h-10 border-y border-dashed border-neutral-200 bg-[size:10px_10px] [background-image:repeating-linear-gradient(315deg,rgba(0,0,0,0.035)_0_1px,transparent_0_50%)] md:h-12" />

            {/* ============================================================ */}
            {/* 9. REAL JOBS BOARD COMPONENT (#board)                        */}
            {/* ============================================================ */}
            <section id="board" className="scroll-mt-20 bg-white py-16 md:py-24">
              <div className="px-6 sm:px-8 lg:px-12">
                <div className="mx-auto max-w-3xl text-center mb-10">
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-3">
                    Papan Loker Terverifikasi
                  </div>
                  <h2 className="text-balance font-semibold text-3xl sm:text-4xl text-neutral-950 tracking-tight">
                    Cari & Temukan Lowongan Kerja Valid
                  </h2>
                  <p className="mt-3 text-sm sm:text-base text-neutral-600">
                    Tulis lowongan yang kamu mau dalam bahasa sehari-hari. Semua lowongan
                    sudah diaudit Sentinel, jadi yang tampil tidak meminta biaya.
                  </p>
                </div>

                {/* Stat Boxes */}
                <div className="mb-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-5 shadow-xs">
                    <span className="block text-xs font-medium text-neutral-500 uppercase tracking-wider">
                      Total Loker
                    </span>
                    <span className="block mt-1 text-3xl font-bold text-neutral-900">
                      {jobs.length}
                    </span>
                    <p className="mt-1 text-xs text-neutral-400">Dari cache resmi KarirHub</p>
                  </div>

                  <div className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-5 shadow-xs">
                    <span className="block text-xs font-medium text-neutral-500 uppercase tracking-wider">
                      Lolos Audit Sentinel
                    </span>
                    <span className="block mt-1 text-3xl font-bold text-emerald-600">
                      {cleanJobsCount}
                    </span>
                    <p className="mt-1 text-xs text-emerald-600/80 font-medium">Status AMAN terverifikasi</p>
                  </div>

                  <div className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-5 shadow-xs">
                    <span className="block text-xs font-medium text-neutral-500 uppercase tracking-wider">
                      No-Fee Terfilter
                    </span>
                    <span className="block mt-1 text-3xl font-bold text-blue-600">
                      100%
                    </span>
                    <p className="mt-1 text-xs text-neutral-400">Pungutan berbiaya dikarantina</p>
                  </div>
                </div>

                {/* The JobsBoard Card */}
                <div className="rounded-xl border border-neutral-200 bg-white p-6 sm:p-8 shadow-xs">
                  <JobsBoard
                    jobs={jobs}
                    searchQuery={searchQuery}
                    onSearchQueryChange={setSearchQuery}
                  />
                </div>
              </div>
            </section>

            {/* ============================================================ */}
            {/* 10. DASHED SECTION DIVIDER                                   */}
            {/* ============================================================ */}
            <div className="relative h-10 border-y border-dashed border-neutral-200 bg-[size:10px_10px] [background-image:repeating-linear-gradient(315deg,rgba(0,0,0,0.035)_0_1px,transparent_0_50%)] md:h-12" />

            {/* ============================================================ */}
            {/* 11. TESTIMONIALS INFINITE MARQUEE (SEC 8)                     */}
            {/* ============================================================ */}
            <section id="testimonials" className="scroll-mt-20 bg-white py-16 md:py-24">
              <div className="px-6 sm:px-8 lg:px-12 text-center">
                <h2 className="text-balance font-semibold text-3xl sm:text-4xl text-neutral-950 tracking-tight">
                  Cerita dari mereka yang membuktikan kompetensi
                </h2>
                <p className="mx-auto mt-4 max-w-2xl text-base text-neutral-600">
                  Ribuan pencari kerja dan rekruter mempercayai Careevo untuk memvalidasi lowongan aman dan menyaring talenta asli.
                </p>
              </div>

              {/* Dual-row marquee */}
              <div className="relative mt-12 flex flex-col gap-4 overflow-hidden py-4">
                {/* Row 1: Leftward scroll */}
                <div className="group relative flex overflow-hidden">
                  <div className="flex shrink-0 items-stretch gap-4 pr-4 group-hover:[animation-play-state:paused] animate-scroll-left-slow">
                    {[...TESTIMONIALS_ROW_1, ...TESTIMONIALS_ROW_1].map((item, idx) => (
                      <figure
                        key={idx}
                        className="flex w-80 shrink-0 flex-col justify-between gap-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-xs transition-colors hover:border-neutral-300"
                      >
                        <p className="text-xs sm:text-sm text-neutral-700 leading-relaxed">
                          &ldquo;{item.quote}&rdquo;
                        </p>
                        <div className="flex items-center gap-3 border-t border-neutral-100 pt-3">
                          <div className="flex size-8 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold text-neutral-700">
                            {item.initials}
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-neutral-900">{item.name}</div>
                            <div className="text-[11px] text-neutral-500">
                              {item.role} · {item.company}
                            </div>
                          </div>
                        </div>
                      </figure>
                    ))}
                  </div>
                </div>

                {/* Row 2: Rightward scroll */}
                <div className="group relative flex overflow-hidden">
                  <div className="flex shrink-0 items-stretch gap-4 pr-4 group-hover:[animation-play-state:paused] animate-scroll-right-slow">
                    {[...TESTIMONIALS_ROW_2, ...TESTIMONIALS_ROW_2].map((item, idx) => (
                      <figure
                        key={idx}
                        className="flex w-80 shrink-0 flex-col justify-between gap-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-xs transition-colors hover:border-neutral-300"
                      >
                        <p className="text-xs sm:text-sm text-neutral-700 leading-relaxed">
                          &ldquo;{item.quote}&rdquo;
                        </p>
                        <div className="flex items-center gap-3 border-t border-neutral-100 pt-3">
                          <div className="flex size-8 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold text-neutral-700">
                            {item.initials}
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-neutral-900">{item.name}</div>
                            <div className="text-[11px] text-neutral-500">
                              {item.role} · {item.company}
                            </div>
                          </div>
                        </div>
                      </figure>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* ============================================================ */}
            {/* 12. DASHED SECTION DIVIDER                                   */}
            {/* ============================================================ */}
            <div className="relative h-10 border-y border-dashed border-neutral-200 bg-[size:10px_10px] [background-image:repeating-linear-gradient(315deg,rgba(0,0,0,0.035)_0_1px,transparent_0_50%)] md:h-12" />

            {/* ============================================================ */}
            {/* 13. PRICING & TRANSPARENCY COMPARISON (SEC 10)               */}
            {/* ============================================================ */}
            <section id="pricing" className="scroll-mt-20 bg-white py-16 md:py-24">
              <div className="px-6 sm:px-8 lg:px-12">
                <div className="mx-auto max-w-2xl text-center">
                  <h2 className="text-balance font-semibold text-3xl sm:text-4xl text-neutral-950 tracking-tight">
                    Transparansi penuh, tanpa biaya tersembunyi
                  </h2>
                  <p className="mt-4 text-balance text-base text-neutral-600">
                    Akses lowongan terverifikasi 100% gratis untuk semua pencari kerja. Bimbingan mentoring dan fitur rekruter tersedia untuk akselerasi karier.
                  </p>

                  {/* Billing cycle toggle */}
                  <div className="mt-8 inline-flex items-center rounded-xl border border-neutral-200 bg-neutral-100/70 p-1">
                    <button
                      type="button"
                      onClick={() => setBillingCycle("monthly")}
                      className={cn(
                        "cursor-pointer rounded-lg px-4 py-1.5 text-xs font-semibold transition-all active:scale-[0.97]",
                        billingCycle === "monthly"
                          ? "chrome-btn chrome-btn-brand !h-auto !py-1.5 !px-4"
                          : "text-neutral-500 hover:text-neutral-900"
                      )}
                    >
                      Tagihan Bulanan
                    </button>
                    <button
                      type="button"
                      onClick={() => setBillingCycle("annual")}
                      className={cn(
                        "cursor-pointer rounded-lg px-4 py-1.5 text-xs font-semibold transition-all active:scale-[0.97]",
                        billingCycle === "annual"
                          ? "chrome-btn chrome-btn-brand !h-auto !py-1.5 !px-4"
                          : "text-neutral-500 hover:text-neutral-900"
                      )}
                    >
                      Tahunan (Hemat 2 bulan)
                    </button>
                  </div>
                </div>

                {/* 3 Tier Cards */}
                <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Free Plan */}
                  <div className="flex flex-col justify-between rounded-xl border border-neutral-200 bg-white p-6 sm:p-8 shadow-xs">
                    <div>
                      <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                        Pencari Kerja
                      </div>
                      <div className="mt-3 flex items-baseline gap-1">
                        <span className="text-4xl font-bold tracking-tight text-neutral-950">{rupiah(HARGA.gratis)}</span>
                        <span className="text-xs text-neutral-500">/ selamanya</span>
                      </div>
                      <p className="mt-3 text-xs text-neutral-600 leading-relaxed">
                        Akses penuh ke papan lowongan kerja KarirHub yang diaudit Sentinel, filter no-fee, dan pengajuan lamaran tanpa batas.
                      </p>

                      <ul className="mt-6 space-y-2.5 text-xs text-neutral-700">
                        <li className="flex items-center gap-2">
                          <Check className="size-4 text-emerald-600 shrink-0" />
                          <span>Akses semua lowongan terverifikasi</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="size-4 text-emerald-600 shrink-0" />
                          <span>Audit Sentinel & sensor rekening</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="size-4 text-emerald-600 shrink-0" />
                          <span>Profil publik portofolio /p/[username]</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="size-4 text-emerald-600 shrink-0" />
                          <span>Filter gaji dan lokasi kerja</span>
                        </li>
                      </ul>
                    </div>

                    <a
                      href="#board"
                      className="chrome-btn chrome-btn-white mt-8 !w-full !h-10 !text-xs"
                    >
                      Mulai Eksplor Loker
                    </a>
                  </div>

                  {/* Pro Plan */}
                  <div className="relative rounded-xl p-[2px] bg-gradient-to-br from-blue-600 via-blue-500 to-sky-400 shadow-md">
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-blue-700 via-blue-600 to-blue-500 px-3 py-0.5 text-[10px] font-semibold text-white uppercase tracking-wider shadow-sm">
                      Paling Populer
                    </span>
                    <div className="flex h-full flex-col justify-between rounded-[10px] bg-white p-6 sm:p-8">
                      <div>
                        <div className="text-xs font-semibold text-blue-700 uppercase tracking-wider">
                          Careevo Pro
                        </div>
                        <div className="mt-3 flex items-baseline gap-1">
                          <span className="text-4xl font-bold tracking-tight text-neutral-950">
                            {billingCycle === "monthly"
                              ? rupiah(HARGA.proBulanan)
                              : perBulanTahunan(HARGA.proTahunan)}
                          </span>
                          <span className="text-xs text-neutral-500">/ bulan</span>
                        </div>
                        <p className="mt-3 text-xs text-neutral-600 leading-relaxed">
                          Pendampingan intensif Socrates AI, evaluasi Fit Score mendalam, penutup skill gap otomatis, dan simulasi interview teknis.
                        </p>

                        <ul className="mt-6 space-y-2.5 text-xs text-neutral-700">
                          <li className="flex items-center gap-2">
                            <Check className="size-4 text-emerald-600 shrink-0" />
                            <span>Semua fitur Pencari Kerja</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <Check className="size-4 text-emerald-600 shrink-0" />
                            <span>Bimbingan Sokratik AI interaktif</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <Check className="size-4 text-emerald-600 shrink-0" />
                            <span>AI Fit Score terperinci per lowongan</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <Check className="size-4 text-emerald-600 shrink-0" />
                            <span>Tanda tangan bukti karya HMAC</span>
                          </li>
                        </ul>
                      </div>

                      <Link
                        href="/careevo-plus"
                        className="chrome-btn chrome-btn-brand mt-8 !w-full !h-10 !text-xs font-semibold shadow-sm"
                      >
                        Tingkatkan ke Pro
                      </Link>
                    </div>
                  </div>

                  {/* Enterprise / Mitra Rekruter */}
                  <div className="flex flex-col justify-between rounded-xl border border-neutral-200 bg-white p-6 sm:p-8 shadow-xs">
                    <div>
                      <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                        Mitra Rekruter
                      </div>
                      <div className="mt-3 flex items-baseline gap-1">
                        <span className="text-3xl font-bold tracking-tight text-neutral-950">Custom</span>
                        <span className="text-xs text-neutral-500">/ per kuota hiring</span>
                      </div>
                      <p className="mt-3 text-xs text-neutral-600 leading-relaxed">
                        Akses langsung ke talent pool yang telah diverifikasi bukti karyanya, integrasi ATS, dan posting lowongan prioritas.
                      </p>

                      <ul className="mt-6 space-y-2.5 text-xs text-neutral-700">
                        <li className="flex items-center gap-2">
                          <Check className="size-4 text-emerald-600 shrink-0" />
                          <span>Akses kandidat terakreditasi HMAC</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="size-4 text-emerald-600 shrink-0" />
                          <span>Verifikasi portofolio otomatis</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="size-4 text-emerald-600 shrink-0" />
                          <span>Penyematan badge Verified Partner</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="size-4 text-emerald-600 shrink-0" />
                          <span>Dukungan dedicated account manager</span>
                        </li>
                      </ul>
                    </div>

                    <a
                      href="mailto:rekruter@careevo.id"
                      className="chrome-btn chrome-btn-white mt-8 !w-full !h-10 !text-xs"
                    >
                      Hubungi Tim Kemitraan
                    </a>
                  </div>
                </div>

                {/* Feature Comparison Matrix Table */}
                <div className="mt-14 overflow-hidden rounded-xl border border-neutral-200 bg-white">
                  <div className="border-b border-neutral-200 bg-neutral-50/70 p-4 sm:px-6">
                    <h3 className="text-sm font-semibold text-neutral-900">
                      Tabel Perbandingan Fitur Lengkap
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-neutral-200 bg-neutral-50/30 text-neutral-500">
                          <th className="py-3 px-4 sm:px-6 font-medium">Fitur & Kemampuan</th>
                          <th className="py-3 px-4 font-medium text-center">Pencari Kerja</th>
                          <th className="py-3 px-4 font-medium text-center">Careevo Plus</th>
                          <th className="py-3 px-4 font-medium text-center">Mitra Rekruter</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 text-neutral-700">
                        <tr>
                          <td className="py-3 px-4 sm:px-6 font-medium text-neutral-900">Papan Lowongan KarirHub Teraudit</td>
                          <td className="py-3 px-4 text-center"><Check className="mx-auto size-4 text-emerald-600" /></td>
                          <td className="py-3 px-4 text-center"><Check className="mx-auto size-4 text-emerald-600" /></td>
                          <td className="py-3 px-4 text-center"><Check className="mx-auto size-4 text-emerald-600" /></td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4 sm:px-6 font-medium text-neutral-900">Audit Sentinel Anti-Scam & No-Fee</td>
                          <td className="py-3 px-4 text-center"><Check className="mx-auto size-4 text-emerald-600" /></td>
                          <td className="py-3 px-4 text-center"><Check className="mx-auto size-4 text-emerald-600" /></td>
                          <td className="py-3 px-4 text-center"><Check className="mx-auto size-4 text-emerald-600" /></td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4 sm:px-6 font-medium text-neutral-900">Fit Score Kecocokan Otomatis</td>
                          <td className="py-3 px-4 text-center text-neutral-400">Dasar</td>
                          <td className="py-3 px-4 text-center font-medium text-emerald-600">Terperinci (AI)</td>
                          <td className="py-3 px-4 text-center font-medium text-emerald-600">Skrining Massal</td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4 sm:px-6 font-medium text-neutral-900">Rekomendasi Penutup Skill Gap</td>
                          <td className="py-3 px-4 text-center"><Minus className="mx-auto size-4 text-neutral-300" /></td>
                          <td className="py-3 px-4 text-center"><Check className="mx-auto size-4 text-emerald-600" /></td>
                          <td className="py-3 px-4 text-center"><Minus className="mx-auto size-4 text-neutral-300" /></td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4 sm:px-6 font-medium text-neutral-900">Attestation Bukti Karya HMAC</td>
                          <td className="py-3 px-4 text-center"><Minus className="mx-auto size-4 text-neutral-300" /></td>
                          <td className="py-3 px-4 text-center"><Check className="mx-auto size-4 text-emerald-600" /></td>
                          <td className="py-3 px-4 text-center"><Check className="mx-auto size-4 text-emerald-600" /></td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4 sm:px-6 font-medium text-neutral-900">Akses Talent Pool Terverifikasi</td>
                          <td className="py-3 px-4 text-center"><Minus className="mx-auto size-4 text-neutral-300" /></td>
                          <td className="py-3 px-4 text-center"><Minus className="mx-auto size-4 text-neutral-300" /></td>
                          <td className="py-3 px-4 text-center"><Check className="mx-auto size-4 text-emerald-600" /></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </section>

            {/* ============================================================ */}
            {/* 14. DASHED SECTION DIVIDER                                   */}
            {/* ============================================================ */}
            <div className="relative h-10 border-y border-dashed border-neutral-200 bg-[size:10px_10px] [background-image:repeating-linear-gradient(315deg,rgba(0,0,0,0.035)_0_1px,transparent_0_50%)] md:h-12" />

            {/* ============================================================ */}
            {/* 15. FAQ ACCORDION (SEC 12)                                    */}
            {/* ============================================================ */}
            <section id="faq" className="scroll-mt-20 bg-white py-16 md:py-24">
              <div className="px-6 sm:px-8 lg:px-12">
                <div className="mx-auto max-w-2xl text-center">
                  <h2 className="text-balance font-semibold text-3xl sm:text-4xl text-neutral-950 tracking-tight">
                    Pertanyaan yang sering diajukan
                  </h2>
                  <p className="mt-4 text-balance text-base text-neutral-600">
                    Jawaban cepat seputar lowongan kerja resmi, audit Sentinel, dan pelamaran.
                  </p>
                </div>

                <div className="mt-12 grid grid-cols-1 md:grid-cols-5 gap-8">
                  {/* Sticky Category Sidebar */}
                  <nav
                    aria-label="Kategori FAQ"
                    className="md:col-span-2 md:sticky md:top-24 h-fit space-y-1.5"
                  >
                    {FAQ_DATA.map((cat) => {
                      const isActive = activeFaqCategory === cat.category;
                      return (
                        <button
                          key={cat.category}
                          type="button"
                          onClick={() => setActiveFaqCategory(cat.category)}
                          className={cn(
                            "w-full flex items-center justify-between rounded-lg px-4 py-2.5 text-xs font-medium text-left transition-colors cursor-pointer",
                            isActive
                              ? "bg-neutral-900 text-white font-semibold"
                              : "text-neutral-600 hover:bg-neutral-100"
                          )}
                        >
                          <span>{cat.categoryLabel}</span>
                          <span className="text-[11px] opacity-70">
                            {cat.items.length} pertanyaan
                          </span>
                        </button>
                      );
                    })}
                  </nav>

                  {/* Accordion List */}
                  <div className="md:col-span-3 space-y-3">
                    {FAQ_DATA.find((c) => c.category === activeFaqCategory)?.items.map((item, idx) => {
                      const itemKey = `${activeFaqCategory}-${idx}`;
                      const isOpen = !!openFaqIndexes[itemKey];
                      return (
                        <div
                          key={itemKey}
                          className="rounded-xl border border-neutral-200 bg-white shadow-xs overflow-hidden transition-all"
                        >
                          <button
                            type="button"
                            onClick={() => toggleFaq(itemKey)}
                            className="flex w-full items-center justify-between p-4 sm:p-5 text-left text-xs sm:text-sm font-semibold text-neutral-900 cursor-pointer hover:bg-neutral-50/60"
                          >
                            <span>{item.q}</span>
                            <ChevronDown
                              className={cn(
                                "size-4 text-neutral-400 transition-transform duration-200 shrink-0 ml-3",
                                isOpen && "rotate-180 text-neutral-900"
                              )}
                            />
                          </button>
                          {isOpen && (
                            <div className="border-t border-neutral-100 p-4 sm:p-5 text-xs sm:text-sm text-neutral-600 leading-relaxed bg-neutral-50/30">
                              {item.a}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>

            {/* ============================================================ */}
            {/* 16. DASHED SECTION DIVIDER                                   */}
            {/* ============================================================ */}
            <div className="relative h-10 border-y border-dashed border-neutral-200 bg-[size:10px_10px] [background-image:repeating-linear-gradient(315deg,rgba(0,0,0,0.035)_0_1px,transparent_0_50%)] md:h-12" />

            {/* ============================================================ */}
            {/* 17. CONCENTRIC ORBIT RADAR CTA (SEC 14)                      */}
            {/* ============================================================ */}
            <section className="relative overflow-hidden bg-white">
              <div className="relative flex min-h-[26rem] md:min-h-[30rem] flex-col items-center justify-center px-6 py-16 sm:px-8 md:py-24 lg:px-12 text-center">
                {/* Concentric radar rings background */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 mx-auto flex items-center justify-center opacity-40"
                  style={{ width: "700px", height: "700px", bottom: "-300px" }}
                >
                  <div className="absolute size-[640px] rounded-full border border-neutral-200 bg-neutral-50/40" />
                  <div className="absolute size-[460px] rounded-full border border-neutral-200 bg-neutral-100/40" />
                  <div className="absolute size-[280px] rounded-full border border-neutral-200 bg-neutral-200/40" />

                  {/* Orbiting elements */}
                  <div
                    className="absolute size-[640px] rounded-full animate-orbit"
                    style={{ ["--duration" as string]: "32s" }}
                  >
                    <div
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                      style={{ transform: "rotate(0deg) translateX(320px)" }}
                    >
                      <div className="animate-counter-orbit flex size-10 items-center justify-center rounded-full border border-neutral-200 bg-white text-xs font-semibold text-blue-600 shadow-xs" style={{ ["--duration" as string]: "32s" }}>
                        TS
                      </div>
                    </div>
                    <div
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                      style={{ transform: "rotate(120deg) translateX(320px)" }}
                    >
                      <div className="animate-counter-orbit flex size-10 items-center justify-center rounded-full border border-neutral-200 bg-white text-xs font-semibold text-emerald-600 shadow-xs" style={{ ["--duration" as string]: "32s" }}>
                        Go
                      </div>
                    </div>
                    <div
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                      style={{ transform: "rotate(240deg) translateX(320px)" }}
                    >
                      <div className="animate-counter-orbit flex size-10 items-center justify-center rounded-full border border-neutral-200 bg-white text-xs font-semibold text-purple-600 shadow-xs" style={{ ["--duration" as string]: "32s" }}>
                        Py
                      </div>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="relative z-10 mx-auto max-w-xl">
                  <h2 className="text-balance font-semibold text-3xl sm:text-4xl text-neutral-950 tracking-tight">
                    Siap membuktikan kompetensimu ke dunia kerja?
                  </h2>
                  <p className="mt-4 text-balance text-sm sm:text-base text-neutral-600">
                    Cari lowongan terverifikasi sekarang, selesaikan tantangan nyata, dan dapatkan pengakuan objektif tanpa biaya.
                  </p>
                  <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                    <a
                      href="#board"
                      className="chrome-btn chrome-btn-brand !h-11 !px-7 !text-sm gap-2"
                    >
                      <span>Eksplor Papan Loker Sekarang</span>
                      <ArrowRight className="size-4" />
                    </a>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
