"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Quote,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Reveal } from "./primitives";

interface ComparisonItem {
  id: string;
  stepNum: string;
  tag: string;
  title: string;
  problem: string;
  solution: string;
  badge: string;
  preview: {
    title: string;
    subtitle: string;
    metrics: { label: string; value: string; isHighlighted?: boolean }[];
    highlightText: string;
  };
}

const ITEMS: ComparisonItem[] = [
  {
    id: "verifier",
    stepNum: "01",
    tag: "Kepercayaan Portofolio",
    title: "Banjir Portofolio AI",
    problem:
      "Kode makin mudah disalin dalam hitungan detik. Rekruter mulai meragukan keaslian proyek GitHub dan klaim pada CV.",
    solution:
      "Careevo merekam proses pengerjaan secara otomatis dengan tanda tangan kriptografis HMAC-SHA256, membuktikan keaslian proses berpikir tanpa kamera pengawas.",
    badge: "HMAC Attestation",
    preview: {
      title: "Verifikasi Alur Kerja Kandidat",
      subtitle: "Bukti pengerjaan tugas bertanda tangan kriptografis",
      metrics: [
        { label: "Metode Bukti", value: "HMAC-SHA256 Canonical Digest", isHighlighted: true },
        { label: "Privasi Peserta", value: "Nir-Biometrik (Zero-PII)" },
        { label: "Integritas Log", value: "Tercatat Permanen (Append-Only)" },
        { label: "Akses Audit", value: "Tautan Publik Mandiri" },
      ],
      highlightText: "Proses pengerjaan dan komitmen belajar dapat diverifikasi instan oleh tim rekruter.",
    },
  },
  {
    id: "socrates",
    stepNum: "02",
    tag: "Kesiapan Interview",
    title: "Gagap Interview Teknis",
    problem:
      "Banyak kandidat lancar meniru tutorial, namun buntu saat tech lead menguji alasan pemilihan arsitektur dan trade-off kode.",
    solution:
      "Socrates AI bertindak sebagai interviewer teknis yang menantang keputusan kodemu, melatih penalaran kritis dan artikulasi sebelum wawancara nyata.",
    badge: "Socratic Sparring",
    preview: {
      title: "Evaluasi Penalaran Sokratik",
      subtitle: "Uji pertahanan arsitektur dan mitigasi keputusan kode",
      metrics: [
        { label: "Fokus Evaluasi", value: "Pertimbangan Arsitektur & Trade-off", isHighlighted: true },
        { label: "Format Latihan", value: "Tanya Jawab Berbasis Kode Nyata" },
        { label: "Karakter AI", value: "Principal Engineer Sparring Partner" },
        { label: "Hasil Akhir", value: "Kesiapan Artikulasi Interview" },
      ],
      highlightText: "Bukan contekan jawaban instan, melainkan pengasahan logika berpikir mendalam.",
    },
  },
  {
    id: "sentinel",
    stepNum: "03",
    tag: "Keamanan Bursa Kerja",
    title: "Loker Bodong & Pungli",
    problem:
      "Pencari kerja kerap dirugikan oleh lowongan fiktif, ghost jobs, atau modus pungutan biaya tes dan seragam.",
    solution:
      "Agen Sentinel memindai usia domain, rekening transfer pribadi, dan indikasi pungutan biaya secara otonom untuk memastikan bursa kerja bersih.",
    badge: "Sentinel Audit",
    preview: {
      title: "Penyaringan Keamanan Lowongan",
      subtitle: "Audit otonom terhadap legalitas dan pola rekrutmen",
      metrics: [
        { label: "Pemeriksaan Biaya", value: "0 Flags (Bebas Pungutan Liar)", isHighlighted: true },
        { label: "Usia Domain", value: "Terverifikasi Resmi Perusahaan" },
        { label: "Kanal Komunikasi", value: "Bebas Rekening Pribadi & Phishing" },
        { label: "Status Kurasi", value: "Aman untuk Dilamar" },
      ],
      highlightText: "Karantina otomatis pada lowongan mencurigakan sebelum sempat merugikan pelamar.",
    },
  },
  {
    id: "navigator",
    stepNum: "04",
    tag: "Efisiensi Karier",
    title: "Melamar Tanpa Arah",
    problem:
      "Mengirim ratusan lamaran secara buta tanpa pernah mengetahui kriteria apa yang kurang saat menerima email penolakan.",
    solution:
      "Navigator menganalisis profilmu terhadap kebutuhan lowongan valid, memetakan celah kompetensi, dan menyusun tantangan latihan terarah.",
    badge: "Gap Analysis",
    preview: {
      title: "Pemetaan Kesenjangan Kompetensi",
      subtitle: "Pencocokan profil terhadap kualifikasi loker terverifikasi",
      metrics: [
        { label: "Kesesuaian Profil", value: "Analisis Semantik Kualifikasi", isHighlighted: true },
        { label: "Deteksi Gap", value: "Identifikasi Kebutuhan Riil Industri" },
        { label: "Rekomendasi", value: "Tantangan Terfokus Penutup Celah" },
        { label: "Efisiensi", value: "Lamaran Terarah Sesuai Standar" },
      ],
      highlightText: "Setiap latihan yang dikerjakan langsung menjawab kebutuhan spesifik lowongan incaran.",
    },
  },
];

export function MarketingProblemsSolutions() {
  const [active, setActive] = useState(0);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const handleScroll = () => {
      const triggerY = window.innerHeight * 0.45;

      for (let i = cardRefs.current.length - 1; i >= 0; i--) {
        const el = cardRefs.current[i];
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= triggerY) {
            setActive(i);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const current = ITEMS[active] ?? ITEMS[0];

  return (
    <section id="solusi" className="bg-white py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 lg:px-6">
        {/* Section Header */}
        <div className="mx-auto mb-14 max-w-3xl text-center lg:mb-16">
          <Reveal>
            <h2 className="mb-4 text-4xl font-medium -tracking-[1.9px] text-gray-900 lg:text-6xl">
              Portofolio bisa dibuat AI. Kompetensi berpikir tidak.
            </h2>
          </Reveal>
          <Reveal delay={80}>
            <p className="text-base text-gray-500">
              Ketika kode makin mudah disalin, rekruter mencari proses berpikir asli.
              Careevo membuktikan kompetensimu melalui alur terverifikasi dari belajar sampai siap kerja.
            </p>
          </Reveal>
        </div>

        {/* Editorial Quote Card (Dario Amodei) */}
        <Reveal delay={120}>
          <div className="mb-14 rounded-2xl bg-white p-6 shadow-feature-card border border-gray-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3 max-w-3xl">
                <Quote className="size-5 shrink-0 text-[#388AF3] mt-1" />
                <div className="space-y-1.5">
                  <p className="text-sm sm:text-base text-gray-700 italic leading-relaxed">
                    &ldquo;In a world where AI can generate anything, having basic critical thinking skills may be the most important thing to success. You don&rsquo;t want to fall for things that are fake, and you don&rsquo;t want to get scammed.&rdquo;
                  </p>
                  <p className="text-xs text-gray-400">
                    Dario Amodei, CEO &amp; Co-founder Anthropic
                  </p>
                </div>
              </div>
              <a
                href="https://x.com/vikktorrrre/status/2102446813714293039"
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium text-[#388AF3] hover:underline"
              >
                <span>Lihat di X</span>
                <ArrowRight className="size-3.5" />
              </a>
            </div>
          </div>
        </Reveal>

        {/* 2-Column Split: Left Scrolls, Right Sticky Preview */}
        <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
          {/* Left Column: Interactive Cards */}
          <div className="lg:col-span-5 space-y-6">
            {ITEMS.map((item, index) => {
              const isActive = active === index;

              return (
                <div
                  key={item.id}
                  ref={(el) => {
                    cardRefs.current[index] = el;
                  }}
                  onClick={() => setActive(index)}
                  className={cn(
                    "cursor-pointer rounded-2xl bg-white p-6 transition-all duration-200 border",
                    isActive
                      ? "border-[#388AF3] shadow-feature-card"
                      : "border-gray-100 hover:border-gray-200",
                  )}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-gray-400">
                      {item.stepNum} · {item.tag}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-medium",
                        isActive
                          ? "bg-blue-50 text-[#388AF3]"
                          : "bg-gray-100 text-gray-500",
                      )}
                    >
                      {item.badge}
                    </span>
                  </div>

                  <h3 className="text-xl font-medium text-gray-900 mb-2">
                    {item.title}
                  </h3>

                  <div className="space-y-2 text-sm">
                    <p className="text-gray-500 leading-relaxed">
                      <strong className="font-medium text-gray-700">Tantangan: </strong>
                      {item.problem}
                    </p>
                    <p className="text-gray-700 leading-relaxed">
                      <strong className="font-medium text-[#388AF3]">Solusi Careevo: </strong>
                      {item.solution}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Sticky Visual Showcase */}
          <div className="lg:col-span-7 sticky top-28 self-start w-full">
            <div className="rounded-2xl bg-white p-3 shadow-feature-card border border-gray-100">
              <div className="rounded-xl bg-[#F8FAFC] border border-gray-150 p-6 sm:p-8">
                {/* Header Strip inside Card */}
                <div className="flex items-center justify-between border-b border-gray-200/80 pb-4 mb-6">
                  <div>
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Prinsip Verifikasi Careevo
                    </span>
                    <h4 className="text-lg font-medium text-gray-900 mt-0.5">
                      {current.preview.title}
                    </h4>
                    <p className="text-xs text-gray-500">
                      {current.preview.subtitle}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200/60 px-2.5 py-1 text-xs text-emerald-700 font-medium">
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    <span>Terverifikasi</span>
                  </div>
                </div>

                {/* Structured Metrics Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                  {current.preview.metrics.map((m) => (
                    <div
                      key={m.label}
                      className={cn(
                        "rounded-xl bg-white p-4 border transition-colors",
                        m.isHighlighted
                          ? "border-blue-200/80 shadow-xs"
                          : "border-gray-150",
                      )}
                    >
                      <span className="block text-xs text-gray-400 mb-1">
                        {m.label}
                      </span>
                      <span
                        className={cn(
                          "block text-sm font-medium",
                          m.isHighlighted ? "text-[#388AF3]" : "text-gray-800",
                        )}
                      >
                        {m.value}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Highlight Notice */}
                <div className="rounded-xl bg-blue-50/70 border border-blue-100 p-4 flex items-start gap-3">
                  <CheckCircle2 className="size-4 text-[#388AF3] shrink-0 mt-0.5" />
                  <p className="text-xs text-gray-700 leading-relaxed">
                    {current.preview.highlightText}
                  </p>
                </div>

                {/* Bottom Action Footer */}
                <div className="mt-6 pt-4 border-t border-gray-200/80 flex items-center justify-between">
                  <span className="text-xs text-gray-400">
                    Proses belajar autentik yang diakui industri
                  </span>
                  <Link
                    href="/daftar"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[#388AF3] hover:underline"
                  >
                    <span>Mulai Sekarang</span>
                    <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
