"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowRight, Quote } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { Reveal } from "./primitives";

interface ProblemItem {
  id: string;
  problemTitle: string;
  problemDescription: string;
  solutionShort: string;
  solutionTitle: string;
  solutionDescription: string;
  image: string;
}

const PROBLEMS: ProblemItem[] = [
  {
    id: "verifier",
    problemTitle: "Banjir Portofolio AI yang Seragam",
    problemDescription:
      "Kode makin mudah disalin dalam hitungan detik. Rekruter dibanjiri repo GitHub identik dan mulai meragukan keaslian kode di CV pelamar.",
    solutionShort: "Attestation kriptografis HMAC-SHA256 untuk memverifikasi proses pengerjaan asli; kamera dirancang hanya aktif di dalam sesi terverifikasi yang kamu setujui, dan belum berjalan di aplikasi ini.",
    solutionTitle: "Bukti Alur Kerja Kriptografis (HMAC-SHA256)",
    solutionDescription:
      "Alur pengerjaan dan komitmen belajarmu terekam otomatis dan ditandatangani secara kriptografis. Rekruter cukup membuka satu tautan publik untuk memverifikasi keaslian karya tanpa merekam ketukan tombol, tanpa geolokasi, dan tanpa deteksi identitas.",
    image:
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&q=80",
  },
  {
    id: "socrates",
    problemTitle: "Tutorial Hell & Gagap Interview Teknis",
    problemDescription:
      "Banyak kandidat lancar meniru modul terpandu, namun buntu saat interviewer menanyakan trade-off arsitektur dan penanganan edge-case.",
    solutionShort: "Sparring penalaran berbasis dialog Sokratik untuk melatih pertahanan logika kode sebelum interview nyata.",
    solutionTitle: "Sparring Logika & Arsitektur dengan Socrates AI",
    solutionDescription:
      "Socrates tidak memberi jawaban instan. Socrates bertindak layaknya Principal Engineer yang menguji alasan di balik setiap keputusan kodemu dan melatih artikulasi teknismu.",
    image:
      "https://images.unsplash.com/photo-1531482615713-2afd69097998?w=1200&q=80",
  },
  {
    id: "sentinel",
    problemTitle: "Loker Bodong & Modus Pungutan Biaya",
    problemDescription:
      "Pencari kerja kerap tertipu lowongan kerja fiktif, ghost jobs, atau oknum yang meminta biaya seragam dan tes lewat transfer rekening pribadi.",
    solutionShort: "Audit otonom memindai usia domain dan pola biaya, menjamin bursa lowongan 100% aman dan bersih.",
    solutionTitle: "Audit Loker Otonom & Penyaringan Ketat",
    solutionDescription:
      "Sentinel memindai usia domain perusahaan, nomor rekening transfer, dan pola pungutan biaya pada setiap lowongan. Loker mencurigakan langsung dikarantina sebelum sempat kamu lamar.",
    image:
      "https://images.unsplash.com/photo-1563986768609-322da13575f3?w=1200&q=80",
  },
  {
    id: "navigator",
    problemTitle: "Melamar Buta Tanpa Tahu Celah Skill",
    problemDescription:
      "Mengirim puluhan lamaran tanpa feedback yang jelas mengapa ditolak atau materi apa yang harus dipelajari untuk memenuhi ekspektasi industri.",
    solutionShort: "Analisis skill gap otomatis mencocokkan profil dengan lowongan dan memberi roadmap latihan penutup.",
    solutionTitle: "Pemetaan Skill Gap & Tantangan Terarah",
    solutionDescription:
      "Navigator membandingkan kualifikasimu dengan kebutuhan loker valid, mendeteksi kriteria yang belum terpenuhi, dan menyusun tantangan latihan terarah untuk menutup celah tersebut.",
    image:
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&q=80",
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

  const current = PROBLEMS[active] ?? PROBLEMS[0];

  return (
    <section id="solusi" className="bg-white py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 lg:px-6">
        {/* Section Header */}
        <div className="mx-auto mb-14 max-w-3xl text-center lg:mb-16">
          <Reveal>
            <h2 className="mb-4 text-4xl font-medium -tracking-[1.9px] text-gray-900 lg:text-6xl">
              Masalah nyata yang dihadapi, solusi nyata yang kami bangun
            </h2>
          </Reveal>
          <Reveal delay={80}>
            <p className="text-base text-gray-500">
              Kandidat terjebak dalam banjir kode AI dan lowongan kerja penipuan.
              Careevo menjembatani proses belajar autentik hingga siap membuktikan kompetensi di dunia kerja.
            </p>
          </Reveal>
        </div>

        {/* 2-Column Split: Left Scrolls, Right Centered Sticky Preview */}
        <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 xl:gap-20 items-start">
          {/* Left Column: Quote + Narrative Cards with increased vertical spacing */}
          <div className="lg:col-span-6 space-y-16 lg:space-y-24">
            {/* Dario Amodei Quote Card */}
            <Reveal delay={100}>
              <div className="rounded-2xl bg-white p-6 sm:p-7 shadow-feature-card border border-gray-100">
                <Quote className="size-5 text-[#388AF3] mb-3" />
                <p className="text-sm sm:text-base text-gray-700 italic leading-relaxed">
                  &ldquo;In a world where AI can generate anything, having basic critical thinking skills may be the most important thing to success. You don&rsquo;t want to fall for things that are fake, and you don&rsquo;t want to get scammed.&rdquo;
                </p>
                <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3 text-xs">
                  <div>
                    <span className="font-medium text-gray-900">Dario Amodei</span>
                    <span className="text-gray-500">, CEO Anthropic</span>
                  </div>
                  <a
                    href="https://x.com/vikktorrrre/status/2102446813714293039"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-[#388AF3] hover:underline"
                  >
                    <span>Lihat di X</span>
                    <ArrowRight className="size-3" />
                  </a>
                </div>
              </div>
            </Reveal>

            {/* Scrollable Problem Cards: Focused card stays full opacity, unfocused cards dim */}
            {PROBLEMS.map((item, index) => {
              const isActive = active === index;

              return (
                <motion.div
                  key={item.id}
                  ref={(el) => {
                    cardRefs.current[index] = el;
                  }}
                  onClick={() => setActive(index)}
                  animate={{
                    opacity: isActive ? 1 : 0.35,
                    scale: isActive ? 1 : 0.98,
                  }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                  className={cn(
                    "cursor-pointer rounded-2xl bg-white p-7 sm:p-8 lg:p-9 border-l-4 shadow-feature-card transition-colors duration-200",
                    isActive
                      ? "border-[#388AF3] ring-1 ring-[#388AF3]/20 shadow-md"
                      : "border-transparent hover:opacity-60",
                  )}
                >
                  <h3 className="text-2xl font-medium text-gray-900 mb-3">
                    {item.problemTitle}
                  </h3>

                  <p className="text-base text-gray-500 leading-relaxed mb-5">
                    {item.problemDescription}
                  </p>

                  <div className="border-t border-gray-100 pt-4">
                    <p className="text-xs font-medium text-[#388AF3] uppercase tracking-wider mb-1.5">
                      Solusi Careevo
                    </p>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {item.solutionShort}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Right Column: Centered Sticky Visual Showcase */}
          <div className="lg:col-span-6 sticky top-[16vh] lg:top-[20vh] self-start w-full">
            <div className="rounded-2xl bg-white p-3 shadow-feature-card">
              {/* Active Image */}
              <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl bg-gray-100">
                {PROBLEMS.map((item, index) => (
                  <Image
                    key={item.id}
                    src={item.image}
                    alt={item.solutionTitle}
                    fill
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className={cn(
                      "object-cover transition-opacity duration-300",
                      active === index ? "opacity-100" : "opacity-0 pointer-events-none",
                    )}
                  />
                ))}
              </div>

              {/* Text Caption Matching Features & Use-Cases */}
              <div className="p-6">
                <h3 className="text-2xl font-medium text-gray-900 mb-2">
                  {current.solutionTitle}
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  {current.solutionDescription}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
