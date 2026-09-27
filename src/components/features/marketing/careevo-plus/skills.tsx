"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Reveal } from "../primitives";

const TABS = [
  {
    label: "Web Development",
    cards: [
      {
        badge: "Paling populer",
        badgeColor: "bg-amber-50 text-amber-700",
        provider: "Careevo Academy",
        logo: "C",
        logoColor: "bg-blue-700 text-white",
        title: "Fullstack Web Development: Next.js 15 & React 19",
        rating: "4.9",
        reviews: "420 siswa",
        level: "Dasar",
        type: "Kursus",
        tags: ["Gratis"],
      },
      {
        badge: "Menengah",
        badgeColor: "bg-blue-50 text-blue-600",
        provider: "Careevo Academy",
        logo: "C",
        logoColor: "bg-blue-700 text-white",
        title: "Membangun REST API Modern dengan Node.js",
        rating: "4.8",
        reviews: "285 siswa",
        level: "Menengah",
        type: "Kursus",
        tags: ["Gratis"],
      },
      {
        badge: "Menengah",
        badgeColor: "bg-blue-50 text-blue-600",
        provider: "Careevo Academy",
        logo: "C",
        logoColor: "bg-blue-700 text-white",
        title: "Automated Testing: Vitest & Playwright E2E",
        rating: "4.9",
        reviews: "210 siswa",
        level: "Menengah",
        type: "Kursus",
        tags: ["Gratis"],
      },
    ],
  },
  {
    label: "Data & AI",
    cards: [
      {
        badge: "Paling populer",
        badgeColor: "bg-amber-50 text-amber-700",
        provider: "Careevo Academy",
        logo: "C",
        logoColor: "bg-indigo-700 text-white",
        title: "Dasar Analisis Data & Visualisasi Python",
        rating: "4.8",
        reviews: "340 siswa",
        level: "Dasar",
        type: "Kursus",
        tags: ["Gratis"],
      },
      {
        badge: "Bootcamp",
        badgeColor: "bg-indigo-50 text-indigo-700",
        provider: "Careevo Academy",
        logo: "C",
        logoColor: "bg-indigo-700 text-white",
        title: "Machine Learning & AI Prompt Engineering",
        rating: "4.9",
        reviews: "152 siswa",
        level: "Menengah",
        type: "Bootcamp",
        tags: ["Plus"],
      },
    ],
  },
  {
    label: "Keamanan Siber",
    cards: [
      {
        badge: "Lanjut",
        badgeColor: "bg-rose-50 text-rose-700",
        provider: "Careevo Academy",
        logo: "C",
        logoColor: "bg-rose-700 text-white",
        title: "Web Security & OWASP Top 10 Defense",
        rating: "4.9",
        reviews: "198 siswa",
        level: "Lanjut",
        type: "Kursus",
        tags: ["Gratis"],
      },
      {
        badge: "Menengah",
        badgeColor: "bg-blue-50 text-blue-600",
        provider: "Careevo Academy",
        logo: "C",
        logoColor: "bg-rose-700 text-white",
        title: "Keamanan Aplikasi: Praktik Dasar",
        rating: "5.0",
        reviews: "Baru",
        level: "Menengah",
        type: "Kursus",
        tags: ["Gratis"],
      },
      {
        badge: "Lanjut",
        badgeColor: "bg-rose-50 text-rose-700",
        provider: "Careevo Academy",
        logo: "C",
        logoColor: "bg-rose-700 text-white",
        title: "Implementasi Arsitektur HMAC Attestation & Zero-Knowledge",
        rating: "5.0",
        reviews: "45 siswa",
        level: "Lanjut",
        type: "Kursus",
        tags: ["Segera"],
      },
    ],
  },
  {
    label: "Game Development",
    cards: [
      {
        badge: "Dasar",
        badgeColor: "bg-emerald-50 text-emerald-700",
        provider: "Careevo Academy",
        logo: "C",
        logoColor: "bg-emerald-700 text-white",
        title: "Game Development 2D dengan Godot Engine",
        rating: "4.9",
        reviews: "175 siswa",
        level: "Dasar",
        type: "Kursus",
        tags: ["Gratis"],
      },
    ],
  },
];

const THUMBS = [
  "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=576&h=320&q=80&fit=crop",
  "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=576&h=320&q=80&fit=crop",
  "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=576&h=320&q=80&fit=crop",
  "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=576&h=320&q=80&fit=crop",
  "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=576&h=320&q=80&fit=crop",
  "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=576&h=320&q=80&fit=crop",
];

function CourseCard({
  card,
  image,
}: {
  card: (typeof TABS)[0]["cards"][0];
  image: string;
}) {
  return (
    <div className="w-64 shrink-0 overflow-hidden rounded-xl bg-white shadow-[0_2px_12px_rgba(0,0,0,0.08)] lg:w-72">
      {/* thumbnail placeholder */}
      <div className="relative h-40 bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100">
        <Image
          className="size-full object-cover"
          alt={`Ilustrasi course ${card.title}`}
          src={image}
          width={576}
          height={320}
          loading="lazy"
        />
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/40 to-transparent p-2 text-right text-2xl font-bold text-white/90">
          {card.logo}
        </span>
      </div>
      <div className="p-4">
        <div className="mb-1 flex items-center gap-2 text-xs text-gray-500">
          <span
            className={cn(
              "inline-flex size-5 items-center justify-center rounded-sm text-[10px] font-bold",
              card.logoColor,
            )}
          >
            {card.logo}
          </span>
          {card.provider}
        </div>
        <h3 className="mb-1 text-sm font-semibold text-gray-900 line-clamp-2">
          {card.title}
        </h3>
        <p className="mb-2 text-xs text-gray-500">
          ★ {card.rating} ({card.reviews}) · {card.level} · {card.type}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {card.badge && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                card.badgeColor,
              )}
            >
              {card.badge}
            </span>
          )}
          {card.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex rounded-full border border-gray-200 px-2 py-0.5 text-[11px] font-medium text-gray-600"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * "Raih keahlian yang dicari perusahaan" — two-column layout matching the
 * original: left column (heading, paragraph, CTA link), right column
 * (category tabs + course card carousel with left/right arrows).
 */
export function CareevoPlusSkills() {
  const [active, setActive] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);

  const scroll = (dir: -1 | 1) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: dir * 300, behavior: "smooth" });
  };

  return (
    <section id="keahlian" className="bg-white pb-14 lg:pb-20">
      <div className="mx-auto max-w-7xl px-4 lg:px-6">
        <div className="rounded-3xl bg-[#f2f5fa] px-6 py-12 lg:px-10 lg:py-16">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[280px_1fr] lg:gap-8">
            {/* Left column: copy + CTA */}
            <Reveal delay={120} className="min-w-0">
              <div className="lg:sticky lg:top-24 lg:self-start">
                <h2 className="mb-3 text-3xl font-medium leading-tight -tracking-[1px] text-gray-900">
                  Raih keahlian yang
                  <br />
                  dicari perusahaan
                </h2>
                <p className="mb-5 max-w-xs text-base leading-relaxed text-gray-500">
                  Latihan yang meniru soal interview beneran, tutor yang menanya
                  alasan di balik jawabanmu, dan portofolio yang bisa dibuka
                  rekruter lewat satu tautan.
                </p>
                <Link
                  href="#paket"
                  className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600"
                >
                  Lihat paket Plus
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </Reveal>

            {/* Right column: tabs + course cards carousel */}
            <Reveal delay={160} className="min-w-0">
              <div className="relative min-w-0">
                {/* Tabs */}
                <div className="mb-5 flex flex-wrap gap-2">
                  {TABS.map((tab, i) => (
                    <button
                      key={tab.label}
                      type="button"
                      onClick={() => setActive(i)}
                      aria-pressed={active === i}
                      className={cn(
                        "cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition-colors duration-300",
                        active === i
                          ? "bg-gray-900 text-white"
                          : "bg-white text-gray-600 hover:bg-gray-50",
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Nav arrows */}
                <button
                  type="button"
                  aria-label="Sebelumnya"
                  onClick={() => scroll(-1)}
                  className="absolute -left-3 top-1/2 z-10 flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm transition-colors hover:bg-gray-50"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                </button>
                <button
                  type="button"
                  aria-label="Berikutnya"
                  onClick={() => scroll(1)}
                  className="absolute -right-3 top-1/2 z-10 flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm transition-colors hover:bg-gray-50"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>

                {/* Cards */}
                <div
                  ref={scroller}
                  className="flex gap-4 overflow-x-auto pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  {TABS[active].cards.map((card, index) => (
                    <CourseCard
                      key={card.title}
                      card={card}
                      image={THUMBS[index % THUMBS.length]}
                    />
                  ))}
                </div>

                {/* "Show more" button */}
                <div className="mt-4">
                  <button
                    type="button"
                    className="rounded-full border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    Tampilkan 5 lagi
                  </button>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
