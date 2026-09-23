"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Reveal } from "../primitives";

const TABS = [
  {
    label: "Data",
    cards: [
      {
        badge: "Top AI program",
        badgeColor: "bg-indigo-50 text-indigo-700",
        university: "Vanderbilt University",
        logo: "V",
        logoColor: "bg-blue-800 text-white",
        title: "Prompt Engineering",
        rating: "4.8",
        reviews: "9.5K",
        level: "Beginer",
        type: "Specialization",
        tags: ["Free trial"],
      },
      {
        badge: "Trending right now",
        badgeColor: "bg-red-50 text-red-600",
        university: "Google",
        logo: "G",
        logoColor: "bg-white text-gray-800 ring-1 ring-gray-200",
        title: "Google Data Analytics",
        rating: "4.8",
        reviews: "182K",
        level: "Beginer",
        type: "Professional Certificate",
        tags: ["Free trial"],
      },
      {
        badge: "Trending right now",
        badgeColor: "bg-red-50 text-red-600",
        university: "Stanford Online",
        logo: "S",
        logoColor: "bg-white text-red-700 ring-1 ring-gray-200",
        title: "Introduction to Statistics",
        rating: "4.6",
        reviews: "4.3K",
        level: "Beginer",
        type: "Course",
        tags: ["Preview"],
      },
    ],
  },
  {
    label: "Business",
    cards: [
      {
        badge: "Trending right now",
        badgeColor: "bg-red-50 text-red-600",
        university: "University of Michigan",
        logo: "M",
        logoColor: "bg-blue-800 text-yellow-400",
        title: "Leading People and Teams",
        rating: "4.8",
        reviews: "12K",
        level: "Beginer",
        type: "Course",
        tags: ["Free trial"],
      },
      {
        badge: "Top seller",
        badgeColor: "bg-amber-50 text-amber-700",
        university: "Google",
        logo: "G",
        logoColor: "bg-white text-gray-800 ring-1 ring-gray-200",
        title: "Google Project Management",
        rating: "4.8",
        reviews: "210K",
        level: "Beginer",
        type: "Professional Certificate",
        tags: ["Free trial"],
      },
      {
        badge: "Trending right now",
        badgeColor: "bg-red-50 text-red-600",
        university: "IESE Business School",
        logo: "I",
        logoColor: "bg-blue-600 text-white",
        title: "International Leadership",
        rating: "4.6",
        reviews: "2.8K",
        level: "Beginer",
        type: "Course",
        tags: ["Preview"],
      },
    ],
  },
  {
    label: "Sales & Marketing",
    cards: [
      {
        badge: "Trending right now",
        badgeColor: "bg-red-50 text-red-600",
        university: "Google",
        logo: "G",
        logoColor: "bg-white text-gray-800 ring-1 ring-gray-200",
        title: "Google Digital Marketing",
        rating: "4.8",
        reviews: "94K",
        level: "Beginer",
        type: "Professional Certificate",
        tags: ["Free trial"],
      },
      {
        badge: "New",
        badgeColor: "bg-blue-50 text-blue-600",
        university: "HubSpot Academy",
        logo: "H",
        logoColor: "bg-orange-500 text-white",
        title: "Content Marketing",
        rating: "4.7",
        reviews: "11K",
        level: "Beginer",
        type: "Course",
        tags: ["Free"],
      },
      {
        badge: "Trending right now",
        badgeColor: "bg-red-50 text-red-600",
        university: "University of Virginia",
        logo: "U",
        logoColor: "bg-blue-800 text-orange-400",
        title: "Digital Marketing Specialization",
        rating: "4.6",
        reviews: "5.2K",
        level: "Beginer",
        type: "Specialization",
        tags: ["Free trial"],
      },
    ],
  },
  {
    label: "IT",
    cards: [
      {
        badge: "Top seller",
        badgeColor: "bg-amber-50 text-amber-700",
        university: "Google",
        logo: "G",
        logoColor: "bg-white text-gray-800 ring-1 ring-gray-200",
        title: "Google IT Support",
        rating: "4.8",
        reviews: "182K",
        level: "Beginer",
        type: "Professional Certificate",
        tags: ["Free trial"],
      },
      {
        badge: "Trending right now",
        badgeColor: "bg-red-50 text-red-600",
        university: "IBM",
        logo: "I",
        logoColor: "bg-blue-600 text-white",
        title: "IBM Cybersecurity Analyst",
        rating: "4.7",
        reviews: "44K",
        level: "Beginer",
        type: "Professional Certificate",
        tags: ["Free trial"],
      },
      {
        badge: "New",
        badgeColor: "bg-blue-50 text-blue-600",
        university: "Microsoft",
        logo: "M",
        logoColor: "bg-gray-900 text-green-400",
        title: "IT Automation with Python",
        rating: "4.6",
        reviews: "7.1K",
        level: "Beginer",
        type: "Professional Certificate",
        tags: ["Free trial"],
      },
    ],
  },
  {
    label: "Software Engineering",
    cards: [
      {
        badge: "Top seller",
        badgeColor: "bg-amber-50 text-amber-700",
        university: "Meta",
        logo: "M",
        logoColor: "bg-blue-600 text-white",
        title: "Meta Front-End Developer",
        rating: "4.8",
        reviews: "42K",
        level: "Beginer",
        type: "Professional Certificate",
        tags: ["Free trial"],
      },
      {
        badge: "Trending right now",
        badgeColor: "bg-red-50 text-red-600",
        university: "IBM",
        logo: "I",
        logoColor: "bg-blue-600 text-white",
        title: "IBM Full Stack Developer",
        rating: "4.7",
        reviews: "28K",
        level: "Beginer",
        type: "Professional Certificate",
        tags: ["Free trial"],
      },
      {
        badge: "Trending right now",
        badgeColor: "bg-red-50 text-red-600",
        university: "Duke University",
        logo: "D",
        logoColor: "bg-blue-800 text-white",
        title: "Introduction to Programming",
        rating: "4.8",
        reviews: "6.4K",
        level: "Beginer",
        type: "Specialization",
        tags: ["Free trial"],
      },
    ],
  },
  {
    label: "AI",
    cards: [
      {
        badge: "New",
        badgeColor: "bg-blue-50 text-blue-600",
        university: "DeepLearning.AI",
        logo: "DL",
        logoColor: "bg-blue-900 text-cyan-300",
        title: "Generative AI for Everyone",
        rating: "4.8",
        reviews: "32K",
        level: "Beginer",
        type: "Course",
        tags: ["Free trial"],
      },
      {
        badge: "Top AI program",
        badgeColor: "bg-indigo-50 text-indigo-700",
        university: "Vanderbilt University",
        logo: "V",
        logoColor: "bg-blue-800 text-white",
        title: "Prompt Engineering",
        rating: "4.8",
        reviews: "9.5K",
        level: "Beginer",
        type: "Specialization",
        tags: ["Free trial"],
      },
      {
        badge: "Trending right now",
        badgeColor: "bg-red-50 text-red-600",
        university: "Google",
        logo: "G",
        logoColor: "bg-white text-gray-800 ring-1 ring-gray-200",
        title: "Google AI Essentials",
        rating: "4.8",
        reviews: "14K",
        level: "Beginer",
        type: "Course",
        tags: ["Free"],
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
          {card.university}
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
                  Bergabung dengan 91% pelajar yang mencapai hasil karier
                  positif, seperti peluang kerja baru, pengetahuan yang
                  bertambah, dan performa kerja yang meningkat.¹
                </p>
                <Link
                  href="#paket"
                  className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:underline"
                >
                  Hemat 40% sekarang
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
