"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ChevronRight,
  Search,
  Star,
  ArrowRight,
  Rocket,
  TrendingUp,
  Binoculars,
  Award,
  Mountain,
  GraduationCap,
  Briefcase,
  Sparkles,
  Code2,
  Laptop,
  HeartPulse,
  Globe,
  Users,
  Palette,
  FlaskConical,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { closestPromoIndex } from "@/lib/learning/hero-promo";
import { DitheredHeroBackdrop } from "./dithered-hero-backdrop";
import { LandingBtnLink } from "@/components/ui/landing-btn";
import { CatalogCourseCard } from "@/components/ui/catalog-course-card";
import type { ResourceFixture, TaskFixture } from "@/lib/fixtures";

export interface KursusTerdaftar {
  id: string;
  slug: string;
  title: string;
  provider: string;
  progres: number;
  selesai: number;
  total: number;
}

type EntriSumber = ResourceFixture & { slug?: string };

const HOME_SECTION_HEADING_CLASS =
  "text-4xl font-medium -tracking-[1.9px] text-[#0a3d62] sm:text-5xl lg:text-6xl";

type HeroPromoTone = "ink" | "blue" | "mist";

interface HeroPromoCard {
  eyebrow: string;
  title: string;
  description: string;
  cta: string;
  href: string;
  image: string;
  imagePosition: string;
  tone: HeroPromoTone;
}

const HERO_PROMO_CARDS: HeroPromoCard[] = [
  {
    eyebrow: "Kursus AI",
    title: "Kuasai AI untuk kerja nyata",
    description:
      "Kursus dan sertifikat dari praktisi yang membangun teknologi.",
    cta: "Jelajahi kursus AI",
    href: "/explore/most-popular-courses",
    image: "/images/customer-stories/taskrabbit-cover.webp",
    imagePosition: "object-[68%_center]",
    tone: "ink",
  },
  {
    eyebrow: "Jalur belajar",
    title: "Mulai, beralih, atau majukan karier",
    description:
      "Pilih langkah belajar yang sesuai dengan tujuanmu berikutnya.",
    cta: "Mulai gratis",
    href: "/belajar",
    image: "/images/customer-stories/modal-cover.webp",
    imagePosition: "object-[72%_center]",
    tone: "blue",
  },
  {
    eyebrow: "Karya nyata",
    title: "Bangun kemampuan yang terverifikasi",
    description:
      "Selesaikan proyek course dan tunjukkan bukti karyamu kepada dunia kerja.",
    cta: "Lihat progresmu",
    href: "/progres",
    image: "/images/customer-stories/railway-cover.webp",
    imagePosition: "object-[60%_center]",
    tone: "mist",
  },
];

const HERO_PROMO_THEMES: Record<
  HeroPromoTone,
  {
    surface: string;
    text: string;
    muted: string;
    eyebrow: string;
    button: string;
    overlay: string;
    orb: string;
  }
> = {
  ink: {
    surface: "bg-[#101820]",
    text: "text-white",
    muted: "text-white/72",
    eyebrow: "text-[#b9ddff]",
    button: "bg-white text-[#0056D2]",
    overlay: "bg-gradient-to-r from-[#101820] via-[#101820]/92 to-[#101820]/10",
    orb: "border-[#4c8dff]/55",
  },
  blue: {
    surface: "bg-[#0b6fd3]",
    text: "text-white",
    muted: "text-white/80",
    eyebrow: "text-[#d9f0ff]",
    button: "bg-white text-[#0056D2]",
    overlay: "bg-gradient-to-r from-[#0b6fd3] via-[#0b6fd3]/92 to-[#0b6fd3]/12",
    orb: "border-[#f5b9d3]/85",
  },
  mist: {
    surface: "bg-[#eef6fb]",
    text: "text-[#12324a]",
    muted: "text-[#4e6879]",
    eyebrow: "text-[#0056D2]",
    button: "bg-[#0056D2] text-white",
    overlay: "bg-gradient-to-r from-[#eef6fb] via-[#eef6fb]/94 to-[#eef6fb]/18",
    orb: "border-[#0056D2]/25",
  },
};

function HeroPromoCards() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const updateActiveSlide = () => {
      const scrollerRect = scroller.getBoundingClientRect();
      const cards = Array.from(
        scroller.querySelectorAll<HTMLElement>("[data-promo-card]"),
      ).map((card) => {
        const cardRect = card.getBoundingClientRect();
        return {
          left: scroller.scrollLeft + cardRect.left - scrollerRect.left,
          width: cardRect.width,
        };
      });

      setActiveSlide(
        closestPromoIndex(scroller.scrollLeft, scroller.clientWidth, cards),
      );
    };

    updateActiveSlide();
    scroller.addEventListener("scroll", updateActiveSlide, { passive: true });
    window.addEventListener("resize", updateActiveSlide);

    return () => {
      scroller.removeEventListener("scroll", updateActiveSlide);
      window.removeEventListener("resize", updateActiveSlide);
    };
  }, []);

  const scrollToSlide = (index: number) => {
    const scroller = scrollerRef.current;
    const card =
      scroller?.querySelectorAll<HTMLElement>("[data-promo-card]")[index];
    if (!scroller || !card) return;

    const scrollerRect = scroller.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const maxScroll = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    const cardCenterInScroll =
      scroller.scrollLeft +
      cardRect.left -
      scrollerRect.left +
      cardRect.width / 2;
    const left = Math.min(
      maxScroll,
      Math.max(0, cardCenterInScroll - scroller.clientWidth / 2),
    );
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    setActiveSlide(index);
    scroller.scrollTo({ left, behavior: reduceMotion ? "auto" : "smooth" });
  };

  return (
    <section
      aria-label="Pilihan belajar"
      className="relative z-20 -mt-14 sm:-mt-20 lg:-mt-24"
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[1.5rem] bg-white p-2.5 shadow-[0_24px_70px_-42px_rgba(10,61,98,0.48)] ring-1 ring-[#dbe5ea] sm:p-3">
          <div
            ref={scrollerRef}
            role="region"
            aria-label="Kartu promosi belajar"
            tabIndex={0}
            className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {HERO_PROMO_CARDS.map((card) => {
              const theme = HERO_PROMO_THEMES[card.tone];

              return (
                <Link
                  key={card.title}
                  data-promo-card
                  href={card.href}
                  className={cn(
                    "group relative isolate min-h-[15rem] w-[86vw] max-w-[34rem] shrink-0 snap-start overflow-hidden rounded-[1.15rem] transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:no-underline hover:shadow-[0_18px_34px_-24px_rgba(10,61,98,0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0056D2] focus-visible:ring-offset-2 motion-reduce:transform-none sm:h-[17rem] sm:w-[68vw] sm:max-w-none sm:basis-[70%] lg:basis-[47%]",
                    theme.surface,
                  )}
                >
                  <Image
                    src={card.image}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 86vw, (max-width: 1024px) 68vw, 47vw"
                    className={cn(
                      "object-cover transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04] motion-reduce:transform-none",
                      card.imagePosition,
                    )}
                    priority={card.tone === "ink"}
                  />
                  <div className={cn("absolute inset-0", theme.overlay)} />
                  <div
                    aria-hidden="true"
                    className={cn(
                      "absolute -top-20 -right-20 size-64 rounded-full border-[26px]",
                      theme.orb,
                    )}
                  />
                  <div
                    aria-hidden="true"
                    className={cn(
                      "absolute -right-8 -bottom-24 size-48 rounded-full border-[18px]",
                      theme.orb,
                    )}
                  />

                  <div
                    className={cn(
                      "relative z-10 flex min-h-[15rem] max-w-[66%] flex-col justify-between p-5 sm:min-h-[17rem] sm:p-6",
                      theme.text,
                    )}
                  >
                    <div>
                      <p
                        className={cn(
                          "text-[10px] font-semibold tracking-[0.18em] uppercase",
                          theme.eyebrow,
                        )}
                      >
                        {card.eyebrow}
                      </p>
                      <h2
                        className={cn(
                          "mt-3 max-w-[22rem] text-xl leading-[1.08] font-semibold tracking-[-0.03em] sm:text-2xl",
                          card.tone === "mist"
                            ? "!text-[#12324a]"
                            : "!text-white",
                        )}
                      >
                        {card.title}
                      </h2>
                      <p
                        className={cn(
                          "mt-3 max-w-[21rem] text-xs leading-relaxed sm:text-sm",
                          theme.muted,
                        )}
                      >
                        {card.description}
                      </p>
                    </div>

                    <span
                      className={cn(
                        "mt-5 inline-flex min-h-10 w-fit items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold shadow-[0_8px_18px_-12px_rgba(10,61,98,0.45)] transition-transform duration-200 group-hover:-translate-y-0.5 motion-reduce:transform-none",
                        theme.button,
                      )}
                    >
                      {card.cta}
                      <ArrowRight className="size-3.5" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="mt-3 flex items-center gap-1.5 px-1">
            {HERO_PROMO_CARDS.map((card, index) => (
              <button
                key={card.title}
                type="button"
                onClick={() => scrollToSlide(index)}
                aria-label={`Tampilkan promo ${index + 1}: ${card.title}`}
                aria-current={activeSlide === index ? "true" : undefined}
                className={cn(
                  "h-1.5 cursor-pointer rounded-full p-0 transition-[width,background-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0056D2] focus-visible:ring-offset-2",
                  activeSlide === index
                    ? "w-5 bg-[#0a3d62]"
                    : "w-1.5 bg-[#b7c8d2] hover:bg-[#8fa8b7]",
                )}
              />
            ))}
            <span className="sr-only" aria-live="polite">
              Promo {activeSlide + 1} dari {HERO_PROMO_CARDS.length}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

const PARTNERS = [
  {
    name: "Google",
    logo: "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://images.ctfassets.net/00atxywtfxvd/3ZIhQ7yxmgGMFZGtlqpCG6/0d0f40bc5133948bb3805cab25af62ba/Google-G_360x360.png?auto=format%2Ccompress&dpr=1&w=24&h=24",
  },
  {
    name: "IBM",
    logo: "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://images.ctfassets.net/00atxywtfxvd/7iLJYdbTLExBFAgVoHe2Pc/1735062f2f3a6df1dca8cfd9f1815098/ibm-logo.png?auto=format%2Ccompress&dpr=1&w=120&h=40",
  },
  {
    name: "Microsoft",
    logo: "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://images.ctfassets.net/00atxywtfxvd/11pJTA8yOZPwVRMKnSKPRz/340cf59915e8ce0d3b993d39959972d6/eded33b5eb1694336861de4bfda6d36bf72b7780.png?auto=format%2Ccompress&dpr=1&w=24&h=24",
  },
  {
    name: "University of Illinois",
    logo: "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://images.ctfassets.net/00atxywtfxvd/1BjGzhrTBjvvOPuzuqQDHS/81bdfa5d44c5ec8c0364e8ee4761ccff/200x48-illinois.png?auto=format%2Ccompress&dpr=1&w=160&h=40",
  },
  {
    name: "OpenAI",
    logo: "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://images.ctfassets.net/00atxywtfxvd/88r0gwMY5y55z3J0h1T4M/e80fdcb65ff8681943c5394c670f6b7d/OAI_MVP_01_OpenAI_Logo_Black.png?auto=format%2Ccompress&dpr=1&w=160&h=40",
  },
  {
    name: "Anthropic",
    logo: "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://images.ctfassets.net/00atxywtfxvd/2qT888LE5BPxxD8d4pfXmJ/89b8eb03eaebe5ff116f509333f24fb5/Anthropic-logo.png?auto=format%2Ccompress&dpr=1&w=160&h=40",
  },
  {
    name: "DeepLearning.AI",
    logo: "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://images.ctfassets.net/00atxywtfxvd/B6gbch3CrIAfBm9F0GpE5/51c6f4fbaf2b25ef11fce8ef9563b7d9/Icon.png?auto=format%2Ccompress&dpr=1&w=24&h=24",
  },
  {
    name: "Stanford University",
    logo: "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://images.ctfassets.net/00atxywtfxvd/1s6p4WQHsv79stjgyiWBtI/d55f3608a884d6d1e48f78935b73362f/3c8a16b167a785920d061664a6512c3a60cdb30e.png?auto=format%2Ccompress&dpr=1&w=24&h=24",
  },
  {
    name: "Univ. of Pennsylvania",
    logo: "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://images.ctfassets.net/00atxywtfxvd/3Y7rH8FUwg4eai7LK5j9u3/880203b6e241e81112bf48f252ca8e72/Penn-badge.png?auto=format%2Ccompress&dpr=1&w=24&h=24",
  },
  {
    name: "Univ. of Michigan",
    logo: "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://images.ctfassets.net/00atxywtfxvd/7sWcR45W6I4bvFrJfCmb5d/2dff9bbefe50a9fcbcf89b2e5ee7032e/umich.png?auto=format%2Ccompress&dpr=1&w=24&h=24",
  },
];

function CourseraCourseCard({ resource }: { resource: EntriSumber }) {
  return (
    <CatalogCourseCard
      resource={resource}
      href={`/belajar/${resource.slug ?? resource.id}`}
      className="w-[270px] shrink-0 sm:w-[280px]"
    />
  );
}

function HeroSection({
  nextTask,
  query,
  onQuery,
}: {
  nextTask?: TaskFixture;
  query: string;
  onQuery: (value: string) => void;
}) {
  return (
    <section
      aria-labelledby="belajar-hero-title"
      className="relative isolate min-h-[36rem] overflow-hidden bg-[#f7fbfc] lg:min-h-[41rem]"
    >
      <DitheredHeroBackdrop
        videoSrc="/videos/hero-sterly.mp4"
        levels={4}
        ditherScale={2}
        zoom={1}
        focusY={0.5}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#f7fbfc] via-[#f7fbfc]/55 to-transparent"
      />
      {/* Localised soft halo so ink text stays crisp over the bright dithered
          stipple. Not a full-surface scrim — the backdrop stays visible
          around it and the edges. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[24rem] w-[min(52rem,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-[4rem] bg-white/55 blur-3xl sm:h-[26rem] sm:w-[min(58rem,88vw)]"
      />

      <div className="relative mx-auto flex min-h-[36rem] w-full max-w-6xl flex-col items-center justify-center px-4 pb-20 pt-[calc(5rem+var(--learner-chrome-height,0px))] text-center sm:px-6 lg:min-h-[41rem] lg:px-8 lg:pb-24 lg:pt-[calc(6rem+var(--learner-chrome-height,0px))]">
        {nextTask ? (
          <Link
            href={`/challenge/${nextTask.id}`}
            aria-label={`Lanjutkan challenge: ${nextTask.title}`}
            className="group inline-flex min-h-11 w-full max-w-xl items-center justify-center gap-2 rounded-full border-2 border-white bg-white px-2 py-1 text-sm font-medium text-[#111827] shadow-[0_10px_24px_-12px_rgba(0,86,210,0.45)] transition-[background-color,border-color,transform] duration-200 hover:bg-[#f7fbff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0056D2] focus-visible:ring-offset-2 active:scale-[0.98] sm:w-auto sm:justify-start"
          >
            <span className="shrink-0 rounded-full bg-gradient-to-br from-[#4da3ff] to-[#b9ddff] px-2 py-1 text-xs font-medium tracking-[0.12em] text-white uppercase">
              Lanjutkan
            </span>
            <span className="min-w-0 truncate">{nextTask.title}</span>
            <ArrowRight className="size-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
        ) : null}

        <h1
          id="belajar-hero-title"
          className="mt-7 max-w-4xl text-balance text-4xl font-medium tracking-tight text-[#1e293b] sm:text-5xl md:text-6xl"
        >
          Belajar tanpa batas
        </h1>
        <p className="mt-6 max-w-3xl text-pretty text-base leading-relaxed text-[#1e293b] sm:text-lg lg:text-xl">
          Mulai, beralih, atau percepat kariermu dengan lebih dari 7.000 kursus,
          Sertifikat Profesional, dan gelar dari universitas dan perusahaan
          kelas dunia.
        </p>

        <div className="mt-8 flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:items-center">
          <LandingBtnLink href="/dashboard" className="w-full sm:w-auto">
            Mulai belajar
          </LandingBtnLink>
          <LandingBtnLink
            href="/progres"
            variant="secondary"
            className="w-full sm:w-auto"
          >
            Lihat progres
          </LandingBtnLink>
        </div>

        <form
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            document
              .getElementById("katalog")
              ?.scrollIntoView({ behavior: "smooth" });
          }}
          className="mt-5 flex w-full max-w-xl items-center rounded-full border border-white/90 bg-white/80 p-1 shadow-[0_14px_34px_-24px_rgba(12,63,94,0.5)] backdrop-blur-md focus-within:ring-2 focus-within:ring-[#0056D2] focus-within:ring-offset-2"
        >
          <label htmlFor="belajar-search" className="sr-only">
            Cari topik atau kursus
          </label>
          <div className="flex min-h-11 min-w-0 flex-1 items-center px-3">
            <Search className="size-4 shrink-0 text-[#6f8491]" />
            <input
              id="belajar-search"
              value={query}
              onChange={(event) => onQuery(event.target.value)}
              placeholder="Mau belajar apa?"
              className="ml-2 min-w-0 flex-1 bg-transparent text-base text-[#172b3a] outline-none placeholder:text-[#7d909c]"
            />
          </div>
          <button
            type="submit"
            className="min-h-11 rounded-full bg-[#0056D2] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#00419e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0056D2] focus-visible:ring-offset-2"
          >
            Cari
          </button>
        </form>
      </div>
    </section>
  );
}

function PartnersAndCategories() {
  const navCards = [
    {
      title: "Mulai karier baru",
      icon: Award,
      href: "/explore/most-popular-courses",
    },
    {
      title: "Coba Careevo untuk Bisnis",
      icon: Mountain,
      href: "mailto:bisnis@careevo.id",
    },
    {
      title: "Raih gelar akademik",
      icon: GraduationCap,
      href: "#gelar",
    },
  ];

  return (
    <section
      aria-labelledby="mitra-heading"
      className="border-b border-[#dbe5ea] bg-[#f7fbfc] py-14 sm:py-20"
    >
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 border-t border-l border-[#dbe5ea] bg-white shadow-[0_24px_70px_-52px_rgba(12,63,94,0.5)] sm:grid-cols-3 lg:grid-cols-[minmax(13rem,1.15fr)_repeat(4,minmax(0,1fr))]">
          <div className="col-span-2 flex min-h-32 items-center justify-center border-r border-b border-[#dbe5ea] px-6 py-8 sm:col-span-3 lg:col-span-1 lg:row-span-2">
            <h2
              id="mitra-heading"
              className="text-center text-[11px] leading-relaxed font-medium tracking-[0.12em] text-[#6a7f8c] uppercase"
            >
              Belajar bersama
              <span className="mt-1 block text-base font-bold tracking-[-0.02em] text-[#213847] normal-case">
                mitra terpercaya
              </span>
            </h2>
          </div>

          {PARTNERS.slice(0, 8).map((partner) => (
            <div
              key={partner.name}
              className="flex min-h-28 items-center justify-center border-r border-b border-[#dbe5ea] px-5 py-7 sm:min-h-32"
            >
              <div className="relative h-8 w-28 grayscale sm:w-32">
                <Image
                  src={partner.logo}
                  alt={partner.name}
                  fill
                  sizes="128px"
                  className="object-contain opacity-65 transition-opacity duration-200 hover:opacity-100"
                  unoptimized
                />
              </div>
            </div>
          ))}
        </div>

        {/* Section 2: Navigation Action Cards */}
        {/* No bottom margin: this used to space itself from the category chips,
            and the section's own `py-*` now does that against the banner. */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-3">
          {navCards.map((c) => {
            const Icon = c.icon;
            return (
              <Link
                key={c.title}
                href={c.href}
                className="group flex items-center justify-between rounded-2xl bg-[#F0F4F8] p-6 sm:p-7 shadow-2xs transition-all duration-200 hover:bg-[#E6EEF5] hover:no-underline hover:shadow-xs active:scale-[0.99]"
              >
                <span className="max-w-[190px] text-lg sm:text-xl font-bold leading-snug text-[#1f1f1f] group-hover:text-[#0056D2] transition-colors">
                  {c.title}
                </span>
                <div className="relative flex size-14 sm:size-16 shrink-0 rotate-6 items-center justify-center rounded-2xl bg-[#E9E4F5] shadow-2xs transition-transform duration-200 group-hover:rotate-12">
                  <Icon className="size-7 sm:size-8 stroke-[1.75] text-[#0056D2] -rotate-6" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/**
 * The 11 category pills — one per `/browse/<slug>` route that actually exists.
 *
 * Slugs are duplicated from `CATEGORY_MATCHERS` (explore-queries) on purpose:
 * importing the matcher map here would pull the whole program registry into
 * the client bundle, and the component is `"use client"`. `careevo-review`: a
 * new field needs its matcher added in both places, or the pill 404s.
 *
 * "Math and Logic" is intentionally absent — it had no matcher, so it had no
 * `/browse` page to link to. A pill that 404s is worse than no pill.
 *
 * `slug` is a URL and stays English; `name` is what the learner reads, so it is
 * Indonesian. The two are deliberately decoupled — renaming a slug would break
 * every `/browse/<slug>` link and its matcher in `CATEGORY_MATCHERS`.
 */
const CATEGORY_PILLS = [
  { slug: "business", name: "Bisnis", icon: Briefcase },
  {
    slug: "artificial-intelligence",
    name: "Kecerdasan Buatan",
    icon: Sparkles,
  },
  { slug: "data-science", name: "Ilmu Data", icon: TrendingUp },
  { slug: "computer-science", name: "Ilmu Komputer", icon: Code2 },
  {
    slug: "information-technology",
    name: "Teknologi Informasi",
    icon: Laptop,
  },
  { slug: "personal-development", name: "Pengembangan Pribadi", icon: Rocket },
  { slug: "health", name: "Kesehatan", icon: HeartPulse },
  { slug: "language-learning", name: "Belajar Bahasa", icon: Globe },
  { slug: "social-sciences", name: "Ilmu Sosial", icon: Users },
  { slug: "arts-and-humanities", name: "Seni & Kemanusaan", icon: Palette },
  {
    slug: "physical-science-and-engineering",
    name: "Ilmu Pengetahuan Alam & Teknik",
    icon: FlaskConical,
  },
] as const satisfies readonly {
  slug: string;
  name: string;
  icon: LucideIcon;
}[];

/**
 * The one field that is not its own category: "Artificial Intelligence" is a
 * Computer Science listing with a topic filter, exactly as `CATEGORIES` in
 * `explore-taxonomy` already spells it for the Explore menu.
 */
const FIELD_HREF: Record<string, string> = {
  "artificial-intelligence":
    "/browse/computer-science?topic=artificial-intelligence",
};

/**
 * The pill's active treatment (hover, and focus-visible for parity), shared by
 * every pill so one edit moves all of them.
 *
 * This was a solid `#0A3D62` fill with white type. It now washes from a light
 * blue into white instead, so the active pill reads as part of the banner's
 * pastel gradient rather than as a hole punched in it.
 *
 * The type stays `#0A3D62` for the same reason the fill got lighter: white text
 * on the white end of the gradient would be invisible. The darkest stop
 * (`#7FB8F0`) keeps the navy label at 5.4:1, so contrast holds across the whole
 * wash and not just at its light end.
 */
const PILL_AKTIF =
  "hover:border-[#2F7ED1] hover:bg-[linear-gradient(100deg,#7FB8F0_0%,#B7DAF9_50%,#FFFFFF_100%)] hover:shadow-[0_12px_22px_-16px_rgba(31,105,194,0.85)] focus-visible:border-[#2F7ED1] focus-visible:bg-[linear-gradient(100deg,#7FB8F0_0%,#B7DAF9_50%,#FFFFFF_100%)]";

/**
 * "Explore categories" banner: the 11 category pills are one horizontally
 * scrollable row, labelled by plain uppercase text.
 *
 * Where that row sits depends on the breakpoint, and both placements are
 * deliberate — read the container's classes before "fixing" either one:
 * below `sm` (640px) it stacks UNDER the label (`flex-col`); from `sm` up it
 * sits BESIDE it on the same line (`sm:flex-row sm:items-center`). Measured at
 * 1440px the row is beside the label; at 390px it is under it.
 *
 * The label is plain text, not a filled pill, because a filled pill on the
 * heading's line reads as the banner's headline and the heading as its
 * subtitle.
 *
 * The two fades on the row are left/right SCROLL-EDGE affordances, each shown
 * only when there is actually something under it. There is no bottom fade; the
 * artwork column is masked into the gradient instead.
 *
 * The artwork is 2167x726 (≈3:1) with the subject at 55–80% width and an empty
 * pale LEFT half, so it is built for a wide banner with copy beside the subject,
 * not as a full-bleed background. It is therefore a right-hand column with its
 * left edge masked into the gradient, and the copy column is capped (26rem,
 * 30rem at `xl`) so the two never collide. Two `<Image>` elements rather than
 * one `fill`: on mobile the box is short and wide, where `object-cover` on a
 * full-height box would zoom into a few pixels of the source, so mobile gets a
 * cropped strip under the copy instead. Same `src`, so it is fetched once.
 */
function ExploreCategoriesBanner() {
  const pillRowRef = useRef<HTMLUListElement>(null);
  const [pillScroll, setPillScroll] = useState({ start: false, end: false });

  // The chevron and the edge fades are driven by real scroll state, so the
  // control disappears at the end of the row instead of being a dead button
  // that scrolls by 0px. A 4px threshold absorbs sub-pixel layout rounding.
  const syncPillScroll = useCallback(() => {
    const el = pillRowRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setPillScroll({ start: el.scrollLeft > 4, end: el.scrollLeft < max - 4 });
  }, []);

  // The row is `flex-1` in a layout whose width changes with the viewport, so
  // the available scroll distance is not known at mount. ResizeObserver rather
  // than a resize listener: this also catches the pill row reflowing when a
  // font finishes loading.
  useEffect(() => {
    syncPillScroll();
    const el = pillRowRef.current;
    if (!el) return;
    const observer = new ResizeObserver(syncPillScroll);
    observer.observe(el);
    return () => observer.disconnect();
  }, [syncPillScroll]);

  const geserPill = (arah: 1 | -1) => {
    const el = pillRowRef.current;
    if (!el) return;
    el.scrollBy({
      left: arah * Math.max(220, el.clientWidth * 0.7),
      behavior: "smooth",
    });
  };

  /**
   * Drag-to-scroll, mouse only.
   *
   * Touch already pans natively, and taking the pointer there would trade
   * momentum scrolling for a 1:1 drag, so `pointerType` is the gate. Three
   * details are load-bearing:
   *
   * - a 6px threshold before anything moves, so an ordinary click on a pill is
   *   never mistaken for a drag;
   * - capture is taken on the FIRST drag move, not on pointerdown. Capturing
   *   early retargets the synthesised click to the capturing element, so a
   *   plain click on a pill stopped navigating at all — capture has to wait
   *   until we know this is a drag;
   * - the click that lands after a drag is swallowed (`tangkapKlik`): without
   *   it, releasing over a pill navigates to that pill;
   * - `el.scrollLeft = …` rather than `scrollBy`, since the browser has already
   *   applied its own drag delta by the time `pointermove` lands.
   */
  const [seret, setSeret] = useState({ geser: false });
  const seretRef = useRef({ pointerId: -1, x: 0, scrollLeft: 0, geser: false });

  const mulaiSeret = (event: React.PointerEvent<HTMLUListElement>) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    const el = pillRowRef.current;
    if (!el) return;
    seretRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      scrollLeft: el.scrollLeft,
      geser: false,
    };
  };

  const seretPill = (event: React.PointerEvent<HTMLUListElement>) => {
    const state = seretRef.current;
    if (state.pointerId !== event.pointerId) return;
    const el = pillRowRef.current;
    if (!el) return;
    const dx = event.clientX - state.x;
    if (!state.geser) {
      if (Math.abs(dx) < 6) return;
      state.geser = true;
      // Only now, once this is known to be a drag, is capture safe to take.
      el.setPointerCapture(event.pointerId);
      setSeret({ geser: true });
    }
    el.scrollLeft = state.scrollLeft - dx;
  };

  const selesaiSeret = (event: React.PointerEvent<HTMLUListElement>) => {
    const state = seretRef.current;
    if (state.pointerId !== event.pointerId) return;
    const el = pillRowRef.current;
    if (el?.hasPointerCapture(event.pointerId)) {
      el.releasePointerCapture(event.pointerId);
    }
    seretRef.current = { pointerId: -1, x: 0, scrollLeft: 0, geser: false };
    setSeret({ geser: false });
  };

  const tangkapKlik = (event: React.MouseEvent<HTMLUListElement>) => {
    if (!seretRef.current.geser) return;
    event.preventDefault();
    event.stopPropagation();
    seretRef.current.geser = false;
  };

  return (
    <section
      aria-labelledby="explore-categories-heading"
      className="bg-white pt-8 pb-14 sm:pt-10 sm:pb-20"
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative isolate overflow-hidden rounded-3xl bg-[linear-gradient(115deg,#DCEAFB_0%,#E8F4FE_42%,#DFF6EA_100%)] p-5 shadow-[0_28px_70px_-46px_rgba(10,61,98,0.55)] sm:p-7 lg:p-9">
          {/* Illustration, desktop: right-hand column, left edge masked away so
              it melts into the banner gradient instead of showing a seam.
              Anchored to the top and stopped short of the bottom, so the pill
              row below sits on bare gradient rather than across her torso. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 hidden w-[58%] overflow-hidden lg:block xl:w-[62%] [mask-image:linear-gradient(90deg,transparent,#000_30%)]"
          >
            <Image
              src="/images/belajar/explore-categories-hero.webp"
              alt=""
              fill
              unoptimized
              sizes="60vw"
              className="object-cover object-[68%_22%]"
            />
          </div>
          {/* Fades the artwork out before the pill row, which is the same job the
              mask does on the left edge. Without it a pill crossing her reads as
              a collision rather than a layer. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-28 bg-gradient-to-t from-[#DFF6EA] via-[#E4F3EC]/70 to-transparent lg:block"
          />

          {/* `relative` is load-bearing, same reason as the AI banner below: a
              positioned descendant paints after every in-flow one, so this
              wrapper is what keeps the artwork behind the pills and the copy. */}
          <div className="relative">
            <div className="mt-8 max-w-[26rem] sm:mt-10 xl:max-w-[30rem]">
              <h2
                id="explore-categories-heading"
                className="text-3xl font-extrabold tracking-tight text-[#0A3D62] text-balance sm:text-4xl lg:text-[2.5rem] lg:leading-[1.1] xl:text-[2.75rem]"
              >
                Bidang yang kamu tuju — dan keterampilan untuk mencapainya
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[#17455F]/85 sm:text-[15px]">
                Pilih bidangmu. Kami susun program, sertifikat, dan proyek yang
                cocok — dari modul pertama sampai portofolio yang bisa kamu
                tunjukkan.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-2.5">
                {/* Primary CTA, in the same light-blue-to-white wash as an active
                    category pill (see `PILL_AKTIF`): a solid `#0A3D62` fill
                    punched a dark hole in a pastel banner, and the two sat side by
                    side as competing dark pills. The type is `#0A3D62` because
                    white type would disappear at the white end of the wash.
                    Hierarchy over the secondary below is now carried by weight,
                    the `#2F7ED1` border and the shadow — not by brightness. */}
                <Link
                  href="/browse"
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#2F7ED1] bg-[linear-gradient(100deg,#7FB8F0_0%,#B7DAF9_50%,#FFFFFF_100%)] px-5 text-sm font-bold text-[#0A3D62] shadow-[0_12px_24px_-14px_rgba(31,105,194,0.8)] transition-[background-image,border-color,box-shadow,transform] hover:shadow-[0_16px_30px_-14px_rgba(31,105,194,0.9)] active:scale-[0.98]"
                >
                  Jelajahi semua bidang
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
                <Link
                  href="/explore/most-popular-courses"
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#0A3D62]/20 bg-white/75 px-5 text-sm font-semibold text-[#0A3D62] transition-colors hover:bg-white active:scale-[0.98]"
                >
                  Program populer
                </Link>
              </div>
            </div>

            {/* The category row: one line, full width, mouse-draggable. No
                label — an earlier pass had "EXPLORE CATEGORIES" inline here and
                it both stole width from the pills and read as a second
                headline. The heading above already says what this is. */}
            <div className="relative mt-8 sm:mt-10">
              {/* `tabIndex` on a scroll container is the documented way to make
                  it keyboard-scrollable; arrow keys otherwise do nothing here. */}
              <ul
                ref={pillRowRef}
                tabIndex={0}
                aria-label="Kategori"
                onScroll={syncPillScroll}
                onPointerDown={mulaiSeret}
                onPointerMove={seretPill}
                onPointerUp={selesaiSeret}
                onPointerCancel={selesaiSeret}
                onClickCapture={tangkapKlik}
                onDragStart={(event) => event.preventDefault()}
                className={cn(
                  "flex flex-nowrap items-center gap-2.5 overflow-x-auto py-1 pr-10 select-none",
                  "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                  // A mouse has no native drag-to-scroll, so `grab` is the only
                  // cue that the row moves. Touch keeps its native momentum.
                  "touch-pan-x cursor-grab",
                  seret.geser && "cursor-grabbing",
                )}
              >
                {CATEGORY_PILLS.map((pill) => {
                  const Icon = pill.icon;
                  return (
                    <li key={pill.slug} className="shrink-0">
                      <Link
                        href={FIELD_HREF[pill.slug] ?? `/browse/${pill.slug}`}
                        draggable={false}
                        className={cn(
                          "group inline-flex min-h-11 items-center gap-2 rounded-full border border-[#0A3D62]/15 bg-white/85 py-2.5 pr-5 pl-3.5 text-sm font-semibold text-[#0A3D62] shadow-2xs backdrop-blur-sm transition-[background-image,border-color,box-shadow] duration-200 sm:text-[15px]",
                          PILL_AKTIF,
                        )}
                      >
                        <Icon
                          className="size-4.5 shrink-0 opacity-70 transition-opacity group-hover:opacity-100"
                          aria-hidden
                        />
                        {pill.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>

              {/* Edge fades double as the "there is more" affordance, so each one
                  only appears when there is actually something under it. The
                  right one is white, not the banner's mint: that side sits over
                  the artwork, and a mint veil there tinted the image. */}
              <div
                aria-hidden
                className={cn(
                  "pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-[#DCEAFB] to-transparent transition-opacity duration-200",
                  pillScroll.start ? "opacity-100" : "opacity-0",
                )}
              />
              <div
                aria-hidden
                className={cn(
                  "pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-white/80 to-transparent transition-opacity duration-200",
                  pillScroll.end ? "opacity-100" : "opacity-0",
                )}
              />

              <button
                type="button"
                onClick={() => geserPill(1)}
                disabled={!pillScroll.end}
                aria-label="Geser kategori ke kanan"
                className={cn(
                  "absolute top-1/2 right-0 grid size-11 -translate-y-1/2 place-items-center rounded-full border border-[#0A3D62]/15 bg-white text-[#0A3D62] shadow-sm transition-[opacity,background-color,color,transform] duration-200 hover:bg-[#0A3D62] hover:text-white active:scale-95 disabled:pointer-events-none",
                  pillScroll.end ? "opacity-100" : "opacity-0",
                )}
              >
                <ChevronRight className="size-4" aria-hidden />
              </button>
            </div>

            {/* Illustration, below the copy on mobile: a cropped strip, so no
                text ever sits on the artwork. */}
            <div
              aria-hidden
              className="relative mt-7 h-28 overflow-hidden rounded-2xl sm:h-40 lg:hidden"
            >
              <Image
                src="/images/belajar/explore-categories-hero.webp"
                alt=""
                fill
                unoptimized
                sizes="100vw"
                className="object-cover object-[70%_24%]"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const ROLE_TABS = [
  "Ahli AI",
  "Pengembang Perangkat Lunak",
  "Analis Data",
  "Manajer Proyek",
  "Pemimpin Bisnis",
  "Pemasar Digital",
] as const;

interface AiBannerCard {
  title: string;
  partner: string;
  partnerLogo: string;
  thumbnail: string;
  rating: string;
  reviews: string;
  type: string;
  href: string;
}

const AI_BANNER_DATA: Record<string, AiBannerCard[]> = {
  "Ahli AI": [
    {
      title: "IBM Generative AI Engineering",
      partner: "IBM",
      partnerLogo:
        "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/http://coursera-university-assets.s3.amazonaws.com/bb/f5ced2bdd4437aa79f00eb1bf7fbf0/IBM-Logo-Blk---Square.png?auto=format%2Ccompress&dpr=3&w=24&h=24",
      thumbnail:
        "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://d15cw65ipctsrr.cloudfront.net/fc/56cf025e474d27970ae7caabe04a2e/200859-Logo-image.png?auto=format%2C%20compress%2C%20enhance&dpr=1&w=320&h=180&fit=crop&q=50",
      rating: "4.7",
      reviews: "101K",
      type: "Sertifikat Profesional",
      href: "/professional-certificates/ibm-generative-ai",
    },
    {
      title: "AI Agents and Agentic AI with Python & Generative AI",
      partner: "Vanderbilt University",
      partnerLogo:
        "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/http://coursera-university-assets.s3.amazonaws.com/89/63fef0315140268d5c0f66eee8e85e/VU_360x360.png?auto=format%2Ccompress&dpr=3&w=24&h=24",
      thumbnail:
        "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://coursera-course-photos.s3.amazonaws.com/87/f53a62e6c84b5c9be99db814e19f00/juleswhite_3d_colorful_volumeric_organic_rounded_vibrant_highly_ed068faa-2a26-4d84-94b6-5cbfb2614a39.png?auto=format%2C%20compress%2C%20enhance&dpr=1&w=320&h=180&fit=crop&q=50",
      rating: "4.6",
      reviews: "479",
      type: "Kursus",
      href: "/specializations/ai-agents-python",
    },
    {
      title: "Deep Learning",
      partner: "DeepLearning.AI",
      partnerLogo:
        "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/http://coursera-university-assets.s3.amazonaws.com/b4/5cb90bb92f420b99bf323a0356f451/Icon.png?auto=format%2Ccompress&dpr=3&w=24&h=24",
      thumbnail:
        "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://d15cw65ipctsrr.cloudfront.net/0f/7b5e2c1622426e830b6b833156bc2b/BC-5768_VisMerch-Phase-3-Assets_Youtube_DeepLearning.png?auto=format%2C%20compress%2C%20enhance&dpr=1&w=320&h=180&fit=crop&q=50",
      rating: "4.8",
      reviews: "147K",
      type: "Spesialisasi",
      href: "/specializations/deep-learning",
    },
    {
      title: "Machine Learning",
      partner: "Berbagai Pengajar",
      partnerLogo:
        "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/http://coursera-university-assets.s3.amazonaws.com/b4/5cb90bb92f420b99bf323a0356f451/Icon.png?auto=format%2Ccompress&dpr=3&w=24&h=24",
      thumbnail:
        "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://d15cw65ipctsrr.cloudfront.net/3a/9d2a7af297483a845340bcfbac6f1e/MLS.course-banners-01_Course-Logo-.png?auto=format%2C%20compress%2C%20enhance&dpr=1&w=320&h=180&fit=crop&q=50",
      rating: "4.9",
      reviews: "39K",
      type: "Spesialisasi",
      href: "/specializations/machine-learning-introduction",
    },
  ],
  "Pengembang Perangkat Lunak": [
    {
      title: "Fullstack Web Development: Next.js 15 & React 19",
      partner: "Meta",
      partnerLogo:
        "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/http://coursera-university-assets.s3.amazonaws.com/92/d0d1ee4a844037be9a2d349ee5f59d/GoogleG_FullColor_RGB.png?auto=format%2Ccompress&dpr=3&w=24&h=24",
      thumbnail:
        "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=640&q=80",
      rating: "4.9",
      reviews: "52K",
      type: "Sertifikat Profesional",
      href: "/belajar/r8",
    },
    {
      title: "Python for Everybody",
      partner: "University of Michigan",
      partnerLogo:
        "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://images.ctfassets.net/00atxywtfxvd/7sWcR45W6I4bvFrJfCmb5d/2dff9bbefe50a9fcbcf89b2e5ee7032e/umich.png?auto=format%2Ccompress&dpr=1&w=24&h=24",
      thumbnail:
        "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=640&q=80",
      rating: "4.8",
      reviews: "67K",
      type: "Spesialisasi",
      href: "/belajar/crs-4",
    },
    {
      title: "JavaScript Modern: Async & Full-Stack Architecture",
      partner: "Careevo Academy",
      partnerLogo:
        "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://images.ctfassets.net/00atxywtfxvd/11pJTA8yOZPwVRMKnSKPRz/340cf59915e8ce0d3b993d39959972d6/eded33b5eb1694336861de4bfda6d36bf72b7780.png?auto=format%2Ccompress&dpr=1&w=24&h=24",
      thumbnail:
        "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=640&q=80",
      rating: "4.9",
      reviews: "48K",
      type: "Spesialisasi",
      href: "/belajar/crs-1",
    },
    {
      title: "Membangun REST API Modern dengan Node.js",
      partner: "IBM",
      partnerLogo:
        "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/http://coursera-university-assets.s3.amazonaws.com/bb/f5ced2bdd4437aa79f00eb1bf7fbf0/IBM-Logo-Blk---Square.png?auto=format%2Ccompress&dpr=3&w=24&h=24",
      thumbnail:
        "https://images.unsplash.com/photo-1504639725590-34d0984388bd?auto=format&fit=crop&w=640&q=80",
      rating: "4.8",
      reviews: "41K",
      type: "Kursus",
      href: "/belajar/r2",
    },
  ],
  "Analis Data": [
    {
      title: "Google Data Analytics",
      partner: "Google",
      partnerLogo:
        "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/http://coursera-university-assets.s3.amazonaws.com/92/d0d1ee4a844037be9a2d349ee5f59d/GoogleG_FullColor_RGB.png?auto=format%2Ccompress&dpr=3&w=24&h=24",
      thumbnail:
        "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://d15cw65ipctsrr.cloudfront.net/60/097644c12e4aeba0c3420de571cac1/GCC-Coursera-thumbnail-DA-foundations-tony-cert-level.png?auto=format%2C%20compress%2C%20enhance&dpr=1&w=320&h=180&fit=crop&q=50&crop=focalpoint&fp-y=0.48",
      rating: "4.8",
      reviews: "140K",
      type: "Sertifikat Profesional",
      href: "/belajar/crs-4",
    },
    {
      title: "IBM Data Analyst",
      partner: "IBM",
      partnerLogo:
        "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/http://coursera-university-assets.s3.amazonaws.com/bb/f5ced2bdd4437aa79f00eb1bf7fbf0/IBM-Logo-Blk---Square.png?auto=format%2Ccompress&dpr=3&w=24&h=24",
      thumbnail:
        "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://d15cw65ipctsrr.cloudfront.net/23/f74c5a9a9c4110b78909194abbdc7a/BC-5768_VisMerch-Phase-3-Assets_ProCerts_IBM_DataAnalyst.png?auto=format%2Ccompress&dpr=1&w=320&h=180&fit=crop&q=50",
      rating: "4.6",
      reviews: "85K",
      type: "Sertifikat Profesional",
      href: "/belajar/crs-2",
    },
    {
      title: "Microsoft Data Analysis with SQL, Excel & Power BI",
      partner: "Microsoft",
      partnerLogo:
        "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://images.ctfassets.net/00atxywtfxvd/11pJTA8yOZPwVRMKnSKPRz/340cf59915e8ce0d3b993d39959972d6/eded33b5eb1694336861de4bfda6d36bf72b7780.png?auto=format%2Ccompress&dpr=1&w=24&h=24",
      thumbnail:
        "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://d15cw65ipctsrr.cloudfront.net/cf/9c0c8b66804a80b15cf7208ff9553f/Hero_1200x600_v1.png?auto=format%2C%20compress%2C%20enhance&dpr=1&w=320&h=180&fit=crop&q=50",
      rating: "4.6",
      reviews: "38K",
      type: "Spesialisasi",
      href: "/belajar/crs-1",
    },
    {
      title: "Data Visualization with Tableau & Python",
      partner: "UC Davis",
      partnerLogo:
        "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/http://coursera-university-assets.s3.amazonaws.com/92/d0d1ee4a844037be9a2d349ee5f59d/GoogleG_FullColor_RGB.png?auto=format%2Ccompress&dpr=3&w=24&h=24",
      thumbnail:
        "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=640&q=80",
      rating: "4.8",
      reviews: "29K",
      type: "Spesialisasi",
      href: "/belajar/crs-3",
    },
  ],
  "Manajer Proyek": [
    {
      title: "Google Project Management",
      partner: "Google",
      partnerLogo:
        "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/http://coursera-university-assets.s3.amazonaws.com/92/d0d1ee4a844037be9a2d349ee5f59d/GoogleG_FullColor_RGB.png?auto=format%2Ccompress&dpr=3&w=24&h=24",
      thumbnail:
        "https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=640&q=80",
      rating: "4.8",
      reviews: "120K",
      type: "Sertifikat Profesional",
      href: "/belajar/crs-2",
    },
    {
      title: "IBM Project Management Professional",
      partner: "IBM",
      partnerLogo:
        "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/http://coursera-university-assets.s3.amazonaws.com/bb/f5ced2bdd4437aa79f00eb1bf7fbf0/IBM-Logo-Blk---Square.png?auto=format%2Ccompress&dpr=3&w=24&h=24",
      thumbnail:
        "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=640&q=80",
      rating: "4.8",
      reviews: "34K",
      type: "Sertifikat Profesional",
      href: "/belajar/r7",
    },
    {
      title: "Agile with Atlassian Jira",
      partner: "Atlassian",
      partnerLogo:
        "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/http://coursera-university-assets.s3.amazonaws.com/92/d0d1ee4a844037be9a2d349ee5f59d/GoogleG_FullColor_RGB.png?auto=format%2Ccompress&dpr=3&w=24&h=24",
      thumbnail:
        "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=640&q=80",
      rating: "4.7",
      reviews: "45K",
      type: "Kursus",
      href: "/belajar/r8",
    },
    {
      title: "Engineering Project Management",
      partner: "Rice University",
      partnerLogo:
        "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/http://coursera-university-assets.s3.amazonaws.com/89/63fef0315140268d5c0f66eee8e85e/VU_360x360.png?auto=format%2Ccompress&dpr=3&w=24&h=24",
      thumbnail:
        "https://images.unsplash.com/photo-1507537297725-24a1c029d3ca?auto=format&fit=crop&w=640&q=80",
      rating: "4.7",
      reviews: "18K",
      type: "Spesialisasi",
      href: "/belajar/crs-1",
    },
  ],
  "Pemimpin Bisnis": [
    {
      title: "AI for Everyone",
      partner: "DeepLearning.AI",
      partnerLogo:
        "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/http://coursera-university-assets.s3.amazonaws.com/b4/5cb90bb92f420b99bf323a0356f451/Icon.png?auto=format%2Ccompress&dpr=3&w=24&h=24",
      thumbnail:
        "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=640&q=80",
      rating: "4.8",
      reviews: "89K",
      type: "Kursus",
      href: "/belajar/crs-3",
    },
    {
      title: "Digital Transformation & Strategic AI Leadership",
      partner: "University of Virginia",
      partnerLogo:
        "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/http://coursera-university-assets.s3.amazonaws.com/92/d0d1ee4a844037be9a2d349ee5f59d/GoogleG_FullColor_RGB.png?auto=format%2Ccompress&dpr=3&w=24&h=24",
      thumbnail:
        "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=640&q=80",
      rating: "4.7",
      reviews: "22K",
      type: "Spesialisasi",
      href: "/belajar/r1",
    },
    {
      title: "Leading People and Teams",
      partner: "University of Michigan",
      partnerLogo:
        "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://images.ctfassets.net/00atxywtfxvd/7sWcR45W6I4bvFrJfCmb5d/2dff9bbefe50a9fcbcf89b2e5ee7032e/umich.png?auto=format%2Ccompress&dpr=1&w=24&h=24",
      thumbnail:
        "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=640&q=80",
      rating: "4.8",
      reviews: "31K",
      type: "Spesialisasi",
      href: "/belajar/crs-2",
    },
    {
      title: "Business Analytics Specialization",
      partner: "Wharton School",
      partnerLogo:
        "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://images.ctfassets.net/00atxywtfxvd/3Y7rH8FUwg4eai7LK5j9u3/880203b6e241e81112bf48f252ca8e72/Penn-badge.png?auto=format%2Ccompress&dpr=1&w=24&h=24",
      thumbnail:
        "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=640&q=80",
      rating: "4.7",
      reviews: "40K",
      type: "Spesialisasi",
      href: "/belajar/crs-4",
    },
  ],
  "Pemasar Digital": [
    {
      title: "Google Digital Marketing & E-commerce",
      partner: "Google",
      partnerLogo:
        "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/http://coursera-university-assets.s3.amazonaws.com/92/d0d1ee4a844037be9a2d349ee5f59d/GoogleG_FullColor_RGB.png?auto=format%2Ccompress&dpr=3&w=24&h=24",
      thumbnail:
        "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=640&q=80",
      rating: "4.8",
      reviews: "75K",
      type: "Sertifikat Profesional",
      href: "/belajar/crs-2",
    },
    {
      title: "Meta Social Media Marketing",
      partner: "Meta",
      partnerLogo:
        "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/http://coursera-university-assets.s3.amazonaws.com/92/d0d1ee4a844037be9a2d349ee5f59d/GoogleG_FullColor_RGB.png?auto=format%2Ccompress&dpr=3&w=24&h=24",
      thumbnail:
        "https://images.unsplash.com/photo-1611162617474-5b21e879e113?auto=format&fit=crop&w=640&q=80",
      rating: "4.9",
      reviews: "60K",
      type: "Sertifikat Profesional",
      href: "/belajar/crs-1",
    },
    {
      title: "Marketing Analytics Foundation",
      partner: "Meta",
      partnerLogo:
        "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/http://coursera-university-assets.s3.amazonaws.com/92/d0d1ee4a844037be9a2d349ee5f59d/GoogleG_FullColor_RGB.png?auto=format%2Ccompress&dpr=3&w=24&h=24",
      thumbnail:
        "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=640&q=80",
      rating: "4.8",
      reviews: "25K",
      type: "Spesialisasi",
      href: "/belajar/r7",
    },
    {
      title: "Search Engine Optimization (SEO) Specialization",
      partner: "UC Davis",
      partnerLogo:
        "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/http://coursera-university-assets.s3.amazonaws.com/92/d0d1ee4a844037be9a2d349ee5f59d/GoogleG_FullColor_RGB.png?auto=format%2Ccompress&dpr=3&w=24&h=24",
      thumbnail:
        "https://images.unsplash.com/photo-1571786256017-aee7a0c009b6?auto=format&fit=crop&w=640&q=80",
      rating: "4.6",
      reviews: "19K",
      type: "Spesialisasi",
      href: "/belajar/r8",
    },
  ],
};

const CAREER_PROGRAMS = [
  {
    role: "Insinyur Machine Learning",
    salary: "$136,000",
    openings: "18,400+ lowongan",
    image:
      "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://images.ctfassets.net/00atxywtfxvd/599o30wORCv3HfGL69jCc3/6f765c21b0030a065e71dfdf14686764/Machine_Learning_Engineer-role-card_2x.png?auto=format%2Ccompress&dpr=1&w=305&h=125",
    cert: "Machine Learning & AI Prompt Engineering",
    provider: "DeepLearning.AI",
  },
  {
    role: "Ilmuwan Data",
    salary: "$124,000",
    openings: "24,800+ lowongan",
    image:
      "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://images.ctfassets.net/00atxywtfxvd/2okXQwMsMaDLsff3uh3uUz/c619cf8860813538a005dbea25425df5/Data_Scientist-role-card_2x.png?auto=format%2Ccompress&dpr=1&w=305&h=125",
    cert: "Dasar Analisis Data & Visualisasi Python",
    provider: "Google",
  },
  {
    role: "Analis Data",
    salary: "$92,000",
    openings: "36,000+ lowongan",
    image:
      "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://images.ctfassets.net/00atxywtfxvd/1Z2h61l00YMxiMD8Xu7sHw/669880819cd3c5eac5a5fd08606679d1/data-analyst-role-card_2x.png?auto=format%2Ccompress&dpr=1&w=305&h=125",
    cert: "Google Data Analytics Professional Certificate",
    provider: "Google",
  },
  {
    role: "Pengembang Frontend",
    salary: "$105,000",
    openings: "29,500+ lowongan",
    image:
      "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://images.ctfassets.net/00atxywtfxvd/2C1nzPfmiVmVk5ElvQeoKV/aa4e79a26fcd538c8ded0de64823a812/content-creator-role-card_1X.png?auto=format%2Ccompress&dpr=1&w=305&h=125",
    cert: "Fullstack Web Development: Next.js 15 & React 19",
    provider: "Meta & Careevo",
  },
];

const DEGREES = [
  {
    title: "Master of Computer Science",
    school: "University of Illinois Urbana-Champaign",
    logo: "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://images.ctfassets.net/00atxywtfxvd/1BjGzhrTBjvvOPuzuqQDHS/81bdfa5d44c5ec8c0364e8ee4761ccff/200x48-illinois.png?auto=format%2Ccompress&dpr=1&w=24&h=24",
    duration: "12–36 Bulan",
    badge: "100% Online",
    description:
      "Program pascasarjana ilmu komputer peringkat teratas dengan kurikulum kecerdasan buatan, sistem komputasi, dan rekayasa perangkat lunak.",
  },
  {
    title: "Master of Science in Data Science",
    school: "University of Pennsylvania",
    logo: "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://images.ctfassets.net/00atxywtfxvd/3Y7rH8FUwg4eai7LK5j9u3/880203b6e241e81112bf48f252ca8e72/Penn-badge.png?auto=format%2Ccompress&dpr=1&w=24&h=24",
    duration: "16–40 Bulan",
    badge: "Gelar Ivy League",
    description:
      "Dirancang oleh Penn Engineering untuk mempersiapkan praktisi data terdepan dalam machine learning, analisis terapan, dan big data.",
  },
  {
    title: "Bachelor of Science in Computer Science",
    school: "University of London",
    logo: "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://images.ctfassets.net/00atxywtfxvd/7sWcR45W6I4bvFrJfCmb5d/2dff9bbefe50a9fcbcf89b2e5ee7032e/umich.png?auto=format%2Ccompress&dpr=1&w=24&h=24",
    duration: "3–6 Tahun",
    badge: "Terakreditasi Global",
    description:
      "Gelar sarjana sarat keahlian komputasi praktis dengan arahan langsung akademisi Goldsmiths University of London.",
  },
];

interface CompactCardItem {
  title: string;
  org: string;
  orgLogo: string;
  type: string;
  rating?: string;
  thumbnail: string;
  href: string;
}

const NEW_AND_POPULAR_COLUMNS: {
  category: string;
  categoryHref: string;
  items: CompactCardItem[];
}[] = [
  {
    category: "Paling populer",
    categoryHref: "/explore/most-popular-courses",
    items: [
      {
        title: "Google Data Analytics",
        org: "Google",
        orgLogo:
          "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/http://coursera-university-assets.s3.amazonaws.com/92/d0d1ee4a844037be9a2d349ee5f59d/GoogleG_FullColor_RGB.png?auto=format%2Ccompress&dpr=3&w=24&h=24",
        type: "Sertifikat Profesional",
        rating: "4.8",
        thumbnail:
          "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://d15cw65ipctsrr.cloudfront.net/60/097644c12e4aeba0c3420de571cac1/GCC-Coursera-thumbnail-DA-foundations-tony-cert-level.png?auto=format%2C%20compress%2C%20enhance&dpr=1&w=320&h=180&fit=crop&q=50&crop=focalpoint&fp-y=0.48",
        href: "/professional-certificates/google-data-analytics",
      },
      {
        title: "IBM Data Analyst",
        org: "IBM",
        orgLogo:
          "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://images.ctfassets.net/00atxywtfxvd/7iLJYdbTLExBFAgVoHe2Pc/1735062f2f3a6df1dca8cfd9f1815098/ibm-logo.png?auto=format%2Ccompress&dpr=1&w=24&h=24",
        type: "Sertifikat Profesional",
        rating: "4.6",
        thumbnail:
          "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://d15cw65ipctsrr.cloudfront.net/23/f74c5a9a9c4110b78909194abbdc7a/BC-5768_VisMerch-Phase-3-Assets_ProCerts_IBM_DataAnalyst.png?auto=format%2Ccompress&dpr=1&w=320&h=180&fit=crop&q=50",
        href: "/professional-certificates/ibm-data-analyst",
      },
      {
        title: "Google AI Essentials",
        org: "Google",
        orgLogo:
          "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/http://coursera-university-assets.s3.amazonaws.com/92/d0d1ee4a844037be9a2d349ee5f59d/GoogleG_FullColor_RGB.png?auto=format%2Ccompress&dpr=3&w=24&h=24",
        type: "Spesialisasi",
        rating: "4.8",
        thumbnail:
          "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://coursera-course-photos.s3.amazonaws.com/64/1dd26fb7e24637b91b119764d08e01/GCC-Coursera-thumbnail-DA-foundations-tony.png?auto=format%2C%20compress%2C%20enhance&dpr=1&w=320&h=180&fit=crop&q=50&crop=faces",
        href: "/specializations/ai-essentials-google",
      },
    ],
  },
  {
    category: "Rilisan terbaru",
    categoryHref: "/explore/most-popular-courses",
    items: [
      {
        title: "The Complete Claude Code & Claude Cowork Masterclass",
        org: "Dr. Ryan Ahmed",
        orgLogo:
          "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/http://coursera-university-assets.s3.amazonaws.com/8e/7ca56107974898be41dca49b5aff74/Digital_360x360.png?auto=format%2Ccompress&dpr=3&w=24&h=24",
        type: "Spesialisasi",
        thumbnail:
          "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://d15cw65ipctsrr.cloudfront.net/26/26ea676ea74cf09e0540737ab855b8/Coursera_Specialization_600x600.png?auto=format%2C%20compress%2C%20enhance&dpr=1&w=320&h=64&fit=clip&q=50",
        href: "/specializations/complete-claude-code-claude-cowork-masterclass",
      },
      {
        title: "AWS Security Engineer Advanced",
        org: "Amazon Web Services",
        orgLogo:
          "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/http://coursera-university-assets.s3.amazonaws.com/a4/7cd68a658840ddbb95c38cdd0bbc8e/aws-logo-icon-PNG-Transparent-Background.png?auto=format%2Ccompress&dpr=3&w=24&h=24",
        type: "Sertifikat Profesional",
        thumbnail:
          "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://d15cw65ipctsrr.cloudfront.net/de/1d3ba587274f8cb6694947d8f76fef/AWS_logo_square_1200x1200.png?auto=format%2C%20compress%2C%20enhance&dpr=1&w=320&h=64&fit=clip&q=50",
        href: "/professional-certificates/aws-security-engineer",
      },
      {
        title: "Microsoft Data Analysis with SQL, Excel & Power BI",
        org: "Microsoft",
        orgLogo:
          "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/http://coursera-university-assets.s3.amazonaws.com/cc/61dbdf2c1c475d82d3b8bf8eee1bda/MSFT-stacked-logo_FINAL.png?auto=format%2Ccompress&dpr=3&w=24&h=24",
        type: "Spesialisasi",
        rating: "4.6",
        thumbnail:
          "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://d15cw65ipctsrr.cloudfront.net/8c/625f6802494c73be844b9e745d4d4d/Microsoft-Data-Analysis-with-SQL-Excel-Power-BI.png?auto=format%2C%20compress%2C%20enhance&dpr=1&w=320&h=64&fit=clip&q=50",
        href: "/specializations/microsoft-data-analysis",
      },
    ],
  },
  {
    category: "Kursus AI populer",
    categoryHref: "/explore/most-popular-courses",
    items: [
      {
        title: "AWS Generative AI Developer Advanced",
        org: "Amazon Web Services",
        orgLogo:
          "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/http://coursera-university-assets.s3.amazonaws.com/a4/7cd68a658840ddbb95c38cdd0bbc8e/aws-logo-icon-PNG-Transparent-Background.png?auto=format%2Ccompress&dpr=3&w=24&h=24",
        type: "Sertifikat Profesional",
        thumbnail:
          "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://d15cw65ipctsrr.cloudfront.net/e4/71610c146f478c82f76469455e1080/AWS_logo_square_1200x1200.png?auto=format%2C%20compress%2C%20enhance&dpr=1&w=320&h=64&fit=clip&q=50",
        href: "/professional-certificates/aws-generative-ai",
      },
      {
        title: "Machine Learning",
        org: "Berbagai Pengajar",
        orgLogo:
          "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/http://coursera-university-assets.s3.amazonaws.com/b4/5cb90bb92f420b99bf323a0356f451/Icon.png?auto=format%2Ccompress&dpr=3&w=24&h=24",
        type: "Spesialisasi",
        rating: "4.9",
        thumbnail:
          "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://d15cw65ipctsrr.cloudfront.net/3a/9d2a7af297483a845340bcfbac6f1e/MLS.course-banners-01_Course-Logo-.png?auto=format%2C%20compress%2C%20enhance&dpr=1&w=320&h=64&fit=clip&q=50",
        href: "/specializations/machine-learning-introduction",
      },
      {
        title: "Google AI Essentials",
        org: "Google",
        orgLogo:
          "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/http://coursera-university-assets.s3.amazonaws.com/92/d0d1ee4a844037be9a2d349ee5f59d/GoogleG_FullColor_RGB.png?auto=format%2Ccompress&dpr=3&w=24&h=24",
        type: "Spesialisasi",
        rating: "4.8",
        thumbnail:
          "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://d15cw65ipctsrr.cloudfront.net/07/eced232a07415eb3d77c788ae5754e/AIE.png?auto=format%2C%20compress%2C%20enhance&dpr=1&w=320&h=180&fit=crop&q=50&crop=focalpoint&fp-y=0.48",
        href: "/specializations/ai-essentials-google",
      },
    ],
  },
];

const TRENDING_COLUMNS: {
  category: string;
  categoryHref: string;
  items: CompactCardItem[];
}[] = [
  {
    category: "Python",
    categoryHref: "#katalog",
    items: [
      {
        title: "Microsoft Python Development",
        org: "Microsoft",
        orgLogo:
          "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://images.ctfassets.net/00atxywtfxvd/11pJTA8yOZPwVRMKnSKPRz/340cf59915e8ce0d3b993d39959972d6/eded33b5eb1694336861de4bfda6d36bf72b7780.png?auto=format%2Ccompress&dpr=1&w=24&h=24",
        type: "Sertifikat Profesional",
        rating: "★ 4.4",
        thumbnail:
          "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=320&q=85",
        href: "/belajar/crs-4",
      },
      {
        title: "Python for Everybody",
        org: "University of Michigan",
        orgLogo:
          "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://images.ctfassets.net/00atxywtfxvd/7sWcR45W6I4bvFrJfCmb5d/2dff9bbefe50a9fcbcf89b2e5ee7032e/umich.png?auto=format%2Ccompress&dpr=1&w=24&h=24",
        type: "Spesialisasi",
        rating: "★ 4.8",
        thumbnail:
          "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=320&q=80",
        href: "/belajar/crs-4",
      },
      {
        title: "Python 3 Programming",
        org: "University of Michigan",
        orgLogo:
          "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://images.ctfassets.net/00atxywtfxvd/7sWcR45W6I4bvFrJfCmb5d/2dff9bbefe50a9fcbcf89b2e5ee7032e/umich.png?auto=format%2Ccompress&dpr=1&w=24&h=24",
        type: "Spesialisasi",
        rating: "★ 4.8",
        thumbnail:
          "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://d2j5ihb19pt1hq.cloudfront.net/sdp_page/s12n_logos/python.jpg?auto=format%2C%20compress%2C%20enhance&dpr=1&w=320&h=180&fit=crop&q=50",
        href: "/belajar/crs-4",
      },
    ],
  },
  {
    category: "Analitika Data",
    categoryHref: "#katalog",
    items: [
      {
        title: "Excel Skills for Business",
        org: "Macquarie University",
        orgLogo:
          "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://images.ctfassets.net/00atxywtfxvd/3Y7rH8FUwg4eai7LK5j9u3/880203b6e241e81112bf48f252ca8e72/Penn-badge.png?auto=format%2Ccompress&dpr=1&w=24&h=24",
        type: "Spesialisasi",
        rating: "★ 4.9",
        thumbnail:
          "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=320&q=80",
        href: "/belajar/r12",
      },
      {
        title: "Microsoft Power BI Data Analyst",
        org: "Microsoft",
        orgLogo:
          "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://images.ctfassets.net/00atxywtfxvd/11pJTA8yOZPwVRMKnSKPRz/340cf59915e8ce0d3b993d39959972d6/eded33b5eb1694336861de4bfda6d36bf72b7780.png?auto=format%2Ccompress&dpr=1&w=24&h=24",
        type: "Sertifikat Profesional",
        rating: "★ 4.6",
        thumbnail:
          "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=320&q=85",
        href: "/belajar/crs-4",
      },
      {
        title: "Google Data Analytics",
        org: "Google",
        orgLogo:
          "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://images.ctfassets.net/00atxywtfxvd/3ZIhQ7yxmgGMFZGtlqpCG6/0d0f40bc5133948bb3805cab25af62ba/Google-G_360x360.png?auto=format%2Ccompress&dpr=1&w=24&h=24",
        type: "Sertifikat Profesional",
        rating: "★ 4.8",
        thumbnail:
          "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://d15cw65ipctsrr.cloudfront.net/60/097644c12e4aeba0c3420de571cac1/GCC-Coursera-thumbnail-DA-foundations-tony-cert-level.png?auto=format%2C%20compress%2C%20enhance&dpr=1&w=320&h=180&fit=crop&q=50&crop=focalpoint&fp-y=0.48",
        href: "/belajar/crs-4",
      },
    ],
  },
  {
    category: "Manajemen Proyek",
    categoryHref: "#katalog",
    items: [
      {
        title: "Project Management Principles and Practices",
        org: "University of California, Irvine",
        orgLogo:
          "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://images.ctfassets.net/00atxywtfxvd/1s6p4WQHsv79stjgyiWBtI/d55f3608a884d6d1e48f78935b73362f/3c8a16b167a785920d061664a6512c3a60cdb30e.png?auto=format%2Ccompress&dpr=1&w=24&h=24",
        type: "Spesialisasi",
        rating: "★ 4.7",
        thumbnail:
          "https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=320&q=80",
        href: "/belajar/r6",
      },
      {
        title: "IBM Project Manager",
        org: "IBM",
        orgLogo:
          "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://images.ctfassets.net/00atxywtfxvd/7iLJYdbTLExBFAgVoHe2Pc/1735062f2f3a6df1dca8cfd9f1815098/ibm-logo.png?auto=format%2Ccompress&dpr=1&w=24&h=24",
        type: "Sertifikat Profesional",
        rating: "★ 4.8",
        thumbnail:
          "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=320&q=80",
        href: "/belajar/crs-2",
      },
      {
        title: "Microsoft Project Management: Build Job-Ready...",
        org: "Microsoft",
        orgLogo:
          "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://images.ctfassets.net/00atxywtfxvd/11pJTA8yOZPwVRMKnSKPRz/340cf59915e8ce0d3b993d39959972d6/eded33b5eb1694336861de4bfda6d36bf72b7780.png?auto=format%2Ccompress&dpr=1&w=24&h=24",
        type: "Sertifikat Profesional",
        rating: "★ 4.6",
        thumbnail:
          "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=320&h=180&q=80",
        href: "/belajar/r7",
      },
    ],
  },
];

const INTENTS_DATA = [
  {
    id: "career",
    label: "Mulai karier saya",
    icon: <Rocket className="size-4.5" />,
  },
  {
    id: "change",
    label: "Ganti jalur karier",
    icon: (
      <svg
        className="size-4.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M16 3h5v5" />
        <path d="M4 20L21 3" />
        <path d="M21 16v5h-5" />
        <path d="M15 15l6 6" />
        <path d="M4 4l5 5" />
      </svg>
    ),
  },
  {
    id: "grow",
    label: "Tumbuh di posisi sekarang",
    icon: <TrendingUp className="size-4.5" />,
  },
  {
    id: "explore",
    label: "Jelajahi topik di luar pekerjaan",
    icon: <Binoculars className="size-4.5" />,
  },
];

const TESTIMONIALS = [
  {
    name: "Sarah W.",
    role: "Analis Data di Fintech",
    avatar:
      "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://images.ctfassets.net/00atxywtfxvd/5i5srEZb2oOiyBzsckTgCE/9e395a15dc3a0ee381ba8cad950694fa/Sarah_W..jpeg?auto=format%2Ccompress&dpr=1&w=64&h=64&fit=crop",
    text: "Reputasi materi Careevo yang berkualitas tinggi, dipadu struktur belajar yang fleksibel, memudahkan saya mendalami analitika data sembari mengurus keluarga dan pekerjaan harian.",
  },
  {
    name: "Noeris B.",
    role: "Pengembang Perangkat Lunak",
    avatar:
      "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://images.ctfassets.net/00atxywtfxvd/1hutGkdWK4YixkAB4MRESr/6d9020693440cba7c65f2ae12cdc91e8/NoerisB.jpg?auto=format%2Ccompress&dpr=1&w=64&h=64&fit=crop",
    text: "Careevo mengembalikan rasa percaya diri saya dan membuka peluang untuk bermimpi lebih besar. Bukan sekadar menyerap materi—tetapi membuktikan potensi lewat challenge karya nyata.",
  },
  {
    name: "Abdullahi M.",
    role: "Pemimpin Teknis & Mentor",
    avatar:
      "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://images.ctfassets.net/00atxywtfxvd/4Y6jSp1xS4TKuPRNEIYAof/3e3baba688ce331ff7577f5583fc5c87/Abdullahi_M.jpg?auto=format%2Ccompress&dpr=1&w=64&h=64&fit=crop",
    text: "Sekarang saya merasa sangat siap mengambil tanggung jawab kepemimpinan teknis dan telah aktif menjadi mentor bagi rekan kerja baru di kantor.",
  },
  {
    name: "Anas A.",
    role: "Peneliti & Insinyur AI",
    avatar:
      "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://images.ctfassets.net/00atxywtfxvd/3H5hysCHFHUu7JWjv0FXCC/aab7b9f6be57cda1552bb52fcb6f8098/Anas_Alubaidi_pic.JPEG?auto=format%2Ccompress&dpr=1&w=64&h=64&fit=crop",
    text: "Belajar di sini memperluas keahlian profesional saya berkat materi standar industri terkini, studi kasus riil, dan wawasan langsung dari praktisi terkemuka.",
  },
];

/**
 * The "Jelajahi kategori" tiles.
 *
 * `name` is display copy and `query` is the search term, and they are separate
 * fields on purpose. The click handler used to derive the query from the
 * display name (`name.split(" ")[0]`), which quietly coupled Indonesian copy to
 * English catalog tags: "Kecerdasan Buatan & AI" searched for `Kecerdasan` and
 * matched nothing. Each `query` below is a real tag or word in
 * `data/courses.json` + `resources.json`, so the tile now always returns rows.
 *
 * "Pengembangan Pribadi" is the one tile with no dedicated course in the
 * catalog; it maps to `lead` (kepemimpinan), the nearest real tag.
 */
const CATEGORIES = [
  { name: "Kecerdasan Buatan & AI", query: "AI", count: 48, icon: "🤖" },
  { name: "Ilmu Komputer & Web", query: "web", count: 72, icon: "💻" },
  { name: "Ilmu Data & Analitika", query: "data", count: 54, icon: "📊" },
  { name: "Keamanan Siber & Jaringan", query: "security", count: 32, icon: "🔒" },
  { name: "Bisnis & Manajemen Produk", query: "product", count: 40, icon: "📈" },
  { name: "Desain UI/UX & Interaksi", query: "design", count: 28, icon: "🎨" },
  { name: "Cloud & DevOps", query: "devops", count: 36, icon: "☁️" },
  { name: "Pengembangan Pribadi", query: "lead", count: 22, icon: "🚀" },
  { name: "Algoritma & Matematika", query: "algoritma", count: 30, icon: "📐" },
  { name: "Pengembangan Aplikasi Mobile", query: "mobile", count: 26, icon: "📱" },
  { name: "Pengujian & Jaminan Mutu", query: "testing", count: 18, icon: "🧪" },
  { name: "Sistem Basis Data & SQL", query: "sql", count: 24, icon: "🗄️" },
];

const FAQS = [
  {
    q: "Apakah sertifikat Careevo diakui oleh pemberi kerja dan industri?",
    a: "Ya. Setiap sertifikat dan atestasi di Careevo ditandatangani secara kriptografis (HMAC-SHA256) dan dilengkapi bukti submission karya nyata, skor evaluasi, serta tautan repositori publik yang dapat diverifikasi langsung oleh tim perekrut di halaman publik tanpa biaya.",
  },
  {
    q: "Apa itu Careevo Plus dan keuntungan yang didapatkan?",
    a: "Careevo Plus adalah paket keanggotaan menyeluruh yang memberikan akses tanpa batas ke seluruh katalog kursus terakreditasi, challenge praktik premium, penilaian cepat oleh Socrates AI dan verifikator manusia, serta unduhan sertifikat profesional tak terbatas.",
  },
  {
    q: "Apakah ada materi kursus yang bisa saya ikuti secara gratis?",
    a: "Tentu saja. Sebagian besar kurikulum dasar kami bertanda 'Gratis' dan dapat dipelajari secara cuma-cuma dari modul pertama hingga modul terakhir, lengkap dengan materi terkurasi dari MDN, Google, W3C, dan React Docs.",
  },
  {
    q: "Bagaimana alur dari belajar hingga siap disalurkan ke lowongan kerja?",
    a: "Alurnya terstruktur dalam 4 pilar: Belajar materi terkurasi → Kerjakan challenge praktik nyata → Review dan atestasi karya oleh verifikator → Karya otomatis dipamerkan di profil publik Anda dan dipadankan dengan ribuan lowongan resmi di papan Sentinel Kerja.",
  },
  {
    q: "Bagaimana sistem melacak kemajuan dan modul yang telah saya selesaikan?",
    a: "Saat mendaftar di halaman detail kursus, Anda mendapatkan lembar pelacakan seluruh modul kursus tersebut. Setiap kali menandai modul selesai, progres persentase Anda diperbarui seketika dan disimpan secara persisten di sesi belajar Anda.",
  },
];

/**
 * "careevo" + suffix lockup for the promo cards, as TEXT.
 *
 * These two lockups used to be the real Coursera Plus / for Teams PNGs, hotlinked
 * from Coursera's CDN, while their `alt` already said "Careevo Plus" / "Careevo
 * untuk Tim" — so a screen reader and a sighted user were told two different
 * brands by the same element.
 *
 * Text rather than `public/careevo-logo.png`: that asset is the brand's only
 * wordmark and it is dark navy, which is ~1.6:1 on these two card grounds
 * (#0b3fc4, #0a4d3a) and simply disappears. A white variant would be a new
 * binary in the repo, and `brightness-0 invert` would flatten the mark's blue to
 * the same white as the type. Text inherits `--font`, stays sharp at any size,
 * and it drops two third-party image requests from the page.
 */
function PromoLockup({
  suffix,
  boxed = false,
}: {
  suffix: string;
  boxed?: boolean;
}) {
  return (
    <p className="mb-1.5 flex items-center gap-1.5">
      <span className="text-[15px] leading-none font-extrabold tracking-[-0.01em] text-white">
        careevo
      </span>
      {boxed ? (
        <span className="inline-flex h-[13px] items-center rounded-[3px] border border-white/80 px-1 text-[8px] font-bold tracking-[0.06em] text-white uppercase">
          {suffix}
        </span>
      ) : (
        <span className="text-[13px] leading-none font-medium text-white/85">
          {suffix}
        </span>
      )}
    </p>
  );
}

export function BelajarHome({
  resources,
  tasks,
  terdaftar = [],
  queryAwal = "",
}: {
  resources: EntriSumber[];
  tasks: TaskFixture[];
  terdaftar?: KursusTerdaftar[];
  queryAwal?: string;
}) {
  const [query, setQuery] = useState(queryAwal);
  const [role, setRole] = useState<(typeof ROLE_TABS)[number]>("Ahli AI");
  const [goal, setGoal] = useState<string>("Mulai karier saya");
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [story, setStory] = useState(0);

  const nextTask = tasks.find(
    (t) => t.status === "available" || t.status === "review",
  );

  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return resources;
    return resources.filter((r) =>
      [r.title, r.provider, ...r.tags].join(" ").toLowerCase().includes(q),
    );
  }, [resources, query]);

  return (
    <div className="min-w-0 overflow-x-clip bg-white text-gray-900">
      <HeroSection nextTask={nextTask} query={query} onQuery={setQuery} />
      <HeroPromoCards />

      <PartnersAndCategories />
      <ExploreCategoriesBanner />

      {terdaftar.length > 0 ? (
        <section
          aria-labelledby="pembelajaran-saya"
          className="border-b border-gray-200 bg-white py-12"
        >
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2
                  id="pembelajaran-saya"
                  className={HOME_SECTION_HEADING_CLASS}
                >
                  Pembelajaran saya
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  Lanjutkan modul dan tantangan kursus yang sedang kamu tempuh.
                </p>
              </div>
              <Link
                href="/dashboard"
                className="text-sm font-semibold text-[#0056D2]"
              >
                Lihat semua di dashboard →
              </Link>
            </div>

            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {terdaftar.map((kursus) => (
                <Link
                  key={kursus.id}
                  href={`/belajar/${kursus.slug}`}
                  className="group relative flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-5 shadow-xs transition-all hover:border-[#0056D2] hover:no-underline hover:shadow-md"
                >
                  <div>
                    <span className="text-xs font-semibold text-gray-500 uppercase">
                      {kursus.provider}
                    </span>
                    <h3 className="mt-1 line-clamp-2 text-base font-bold text-gray-900 group-hover:text-[#0056D2]">
                      {kursus.title}
                    </h3>
                  </div>

                  <div className="mt-5">
                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <span className="font-semibold text-gray-900">
                        {kursus.progres}% selesai
                      </span>
                      <span>
                        {kursus.selesai}/{kursus.total} modul
                      </span>
                    </div>
                    <div
                      role="progressbar"
                      aria-label={`Progres ${kursus.title}`}
                      aria-valuenow={kursus.progres}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100"
                    >
                      <div
                        className="h-full rounded-full bg-[#0056D2] transition-all duration-300"
                        style={{ width: `${kursus.progres}%` }}
                      />
                    </div>
                    <p className="mt-3 text-xs font-semibold text-[#0056D2]">
                      {kursus.progres === 100
                        ? "Lihat sertifikat dan atestasi →"
                        : "Lanjutkan modul berikutnya →"}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* Baru dan populer — tiga kolom koleksi ringkas */}
      <section aria-labelledby="baru-populer" className="bg-white py-12">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-6">
            <h2 id="baru-populer" className={HOME_SECTION_HEADING_CLASS}>
              Baru dan populer
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {NEW_AND_POPULAR_COLUMNS.map((col) => (
              <div
                key={col.category}
                className="flex flex-col rounded-2xl bg-[#E3EEFF] p-5"
              >
                <Link
                  href={col.categoryHref}
                  className="group mb-4 inline-flex items-center text-base font-bold text-[#111827] hover:text-[#0056D2]"
                >
                  <span>{col.category}</span>
                  <span className="ml-1.5 transition-transform group-hover:translate-x-1">
                    →
                  </span>
                </Link>

                <div className="flex flex-col gap-3">
                  {col.items.map((item) => (
                    <Link
                      key={item.title}
                      href={item.href}
                      className="group flex items-center gap-3.5 rounded-xl border border-transparent bg-white p-3 shadow-2xs transition-all duration-200 hover:border-gray-200 hover:no-underline hover:shadow-xs active:scale-[0.98]"
                    >
                      <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                        <Image
                          src={item.thumbnail}
                          alt={item.title}
                          fill
                          sizes="64px"
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <div className="relative size-3.5 shrink-0 overflow-hidden">
                            <Image
                              src={item.orgLogo}
                              alt={item.org}
                              fill
                              sizes="14px"
                              className="object-contain"
                              unoptimized
                            />
                          </div>
                          <span className="truncate text-xs font-normal text-[#4B5563]">
                            {item.org}
                          </span>
                        </div>
                        <h4 className="mt-0.5 line-clamp-2 text-xs sm:text-sm font-bold text-[#111827] leading-snug group-hover:text-[#0056D2]">
                          {item.title}
                        </h4>
                        <div className="mt-1 flex items-center gap-1 text-xs text-[#4B5563]">
                          <span>{item.type}</span>
                          {item.rating && (
                            <>
                              <span className="text-gray-400">·</span>
                              <Star className="size-3 fill-amber-500 text-amber-500 shrink-0 inline-block" />
                              <span className="font-semibold text-gray-900">
                                {item.rating}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI for the work you do— and the career you want (Coursera Split Banner) */}
      <section aria-labelledby="ai-banner-heading" className="bg-white py-12">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div
            className="relative isolate overflow-hidden rounded-3xl p-6 sm:p-8 lg:p-9 shadow-xl"
            style={{
              /* Blue → white ramp. The heading and sub-copy on the left are white,
                 so the ramp has to START dark (10:1 at the left edge) and stay
                 dark enough through ~30% where that column ends. The right side
                 carries white cards and white pills, which is why the pale end
                 only goes to a blue-tinted white — a true #fff tail would make
                 them disappear. The cards and pills below carry a hairline
                 border for the same reason. It doubles as the ground under the
                 dithered field, and is all that shows when WebGL is missing. */
              background:
                "linear-gradient(90deg, #0A3D8F 0%, #1259C8 30%, #3B82F6 55%, #7FB2F0 80%, #DCEBFD 100%)",
            }}
          >
            {/* Dithered field — the belajar header's backdrop — faded in over the
                PALE zone only, and "pale zone" moves with the layout. Desktop puts
                the white copy in a 260px LEFT column and the cards on the right,
                so the fade runs left→right from 30% (measured: the copy ends at
                316px of 1216, so it is never touched). Stacked, the copy is
                full-width at the TOP and would sit on the pale field, where white
                text is ~1.1:1 — so below `lg` the fade runs top→bottom from
                300px instead (measured: the copy's bottom edge is 189px at 320px
                wide, 138px at 390, 102px at 1023). Everything above the fade keeps
                the bare ramp, so the ramp's contrast contract is untouched.
                Deliberately NOT the header's look wholesale: the header is a dark
                field read against ink text, and 4 levels over a near-white ground
                posterises into grey, not blue. So the ramp is held inside the pale
                half of this container's own gradient (mid/deep are its own 100%
                and 80% stops) and quantisation goes to 6 levels, which keeps the
                hue and leaves a fine blue-white stipple. Procedural source, so
                there is no second video decode on a page that already has one.
                Trade-off, mobile only: a vertical fade also covers the ramp's dark
                LEFT EDGE below the copy, so the stacked container reads dark-top →
                pale-textured-cards instead of carrying a dark strip down its side.
                Nothing legible depended on that strip, but it is a change in the
                design and is the thing to revert first if the phone view is wrong. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-95 [-webkit-mask-image:linear-gradient(180deg,transparent_300px,#000_430px)] [mask-image:linear-gradient(180deg,transparent_300px,#000_430px)] lg:[-webkit-mask-image:linear-gradient(90deg,transparent_30%,#000_72%)] lg:[mask-image:linear-gradient(90deg,transparent_30%,#000_72%)]"
            >
              <DitheredHeroBackdrop
                levels={6}
                ditherScale={2}
                deep="#8FBBEF"
                mid="#CFE4FC"
                accent="#FFFFFF"
              />
            </div>

            {/* `relative` is load-bearing, not decoration. The field above is
                `absolute`, and a positioned descendant paints AFTER every
                in-flow non-positioned one (CSS 2.1 Appendix E) — so with this
                wrapper left static, the field composited OVER the cards and
                pills and veiled the whole right half. Both siblings positioned
                with z-index auto puts the decision back on DOM order, which is
                what the belajar hero already relies on. */}
            <div className="relative flex flex-col gap-8 lg:flex-row lg:items-stretch lg:gap-8">
              {/* Left Column: Heading, Subtitle, CTA Button */}
              <div className="flex flex-col justify-between lg:w-[260px] xl:w-[280px] shrink-0">
                <div>
                  <h2
                    id="ai-banner-heading"
                    className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-[1.18]"
                  >
                    AI untuk pekerjaanmu — dan karier yang kamu tuju
                  </h2>
                  <p className="mt-3 text-sm text-white/95 leading-relaxed">
                    Pilih bidangmu. Pelajari alur kerja, ketajaman penilaian, dan
                    alat yang sedang mengubahnya.
                  </p>
                </div>

                <div className="mt-6 lg:mt-auto pt-2">
                  <Link
                    href="/explore/most-popular-courses"
                    className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-[#0056D2] shadow-xs transition-colors hover:bg-blue-50 active:scale-95"
                  >
                    <span>Jelajahi program</span>
                    <span>→</span>
                  </Link>
                </div>
              </div>

              {/* Right Column: Single Row Tabs + 4 Cards Grid directly underneath */}
              <div className="flex flex-1 flex-col min-w-0">
                {/* Tabs — single horizontal row, aligned with cards */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden flex-nowrap">
                  {ROLE_TABS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      aria-pressed={role === r}
                      className={cn(
                        "cursor-pointer shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all active:scale-95 shadow-2xs whitespace-nowrap",
                        role === r
                          ? "bg-[#1E1E1E] text-white shadow-sm"
                          : "border border-[#0A3D8F]/10 bg-white text-[#1E1E1E] hover:bg-[#F2F7FD]",
                      )}
                    >
                      {r}
                    </button>
                  ))}
                </div>

                {/* 4 Cards Grid directly underneath the tabs */}
                <div className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4 flex-1">
                  {(AI_BANNER_DATA[role] ?? AI_BANNER_DATA["Ahli AI"]).map(
                    (card) => (
                      <Link
                        key={card.title}
                        href={card.href}
                        className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-[#0A3D8F]/10 bg-white p-3 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:no-underline hover:shadow-lg active:scale-[0.98]"
                      >
                        <div>
                          {/* Inset thumbnail with 16:9 aspect ratio */}
                          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-gray-100">
                            <Image
                              src={card.thumbnail}
                              alt={card.title}
                              fill
                              sizes="(max-width: 640px) 100vw, 20vw"
                              className="object-cover transition-transform duration-300 group-hover:scale-105"
                              unoptimized
                            />
                          </div>

                          {/* Partner Logo + Name */}
                          <div className="mt-2.5 flex items-center gap-1.5">
                            <div className="relative size-4 shrink-0 overflow-hidden">
                              <Image
                                src={card.partnerLogo}
                                alt={card.partner}
                                fill
                                sizes="16px"
                                className="object-contain"
                                unoptimized
                              />
                            </div>
                            <span className="truncate text-xs font-medium text-gray-700">
                              {card.partner}
                            </span>
                          </div>

                          {/* Course Title */}
                          <h3 className="mt-1 line-clamp-2 text-xs sm:text-[13px] font-bold text-[#111111] leading-snug group-hover:text-[#0056D2] transition-colors min-h-[34px]">
                            {card.title}
                          </h3>
                        </div>

                        {/* Divider & Rating Metadata */}
                        <div className="mt-2.5 border-t border-gray-100 pt-2">
                          <div className="flex items-center gap-1 text-[11px] text-gray-700">
                            <span className="text-gray-900 font-bold">★</span>
                            <span className="font-semibold text-gray-900">
                              {card.rating}
                            </span>
                            <span>({card.reviews})</span>
                            <span className="text-gray-400">·</span>
                            <span className="truncate text-gray-600">
                              {card.type}
                            </span>
                          </div>
                        </div>
                      </Link>
                    ),
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section aria-label="Bento Promosi Unggulan" className="bg-white py-12">
        <div className="mx-auto grid w-full max-w-7xl gap-5 px-4 sm:px-6 md:grid-cols-2 lg:px-8">
          <div className="relative isolate flex min-h-[9.5rem] flex-col justify-center overflow-hidden rounded-xl bg-[#0b3fc4] p-4 text-white shadow-md sm:min-h-[10rem] sm:p-5">
            <Image
              src="/images/belajar/promo-plus-hero.webp"
              alt=""
              fill
              unoptimized
              sizes="(min-width: 768px) 628px, 100vw"
              className="object-cover object-right"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-r from-black/40 via-black/12 to-transparent"
            />
            <div className="relative md:max-w-[60%]">
              <PromoLockup suffix="Plus" boxed />
              <h3 className="text-base font-bold leading-[1.18] text-balance text-white sm:text-lg">
                Hancurkan hambatan belajar dengan penghematan besar
              </h3>
              <p className="mt-1 text-[11px] leading-[1.45] text-white/85 sm:text-xs">
                Buka akses ke ribuan materi belajar, challenge praktik
                terverifikasi, dan sertifikat profesional tanpa batas.
              </p>
            </div>

            <Link
              href="/careevo-plus"
              className="relative mt-2.5 inline-flex h-8 w-fit items-center gap-1.5 self-start rounded-full bg-white px-3.5 text-[11px] font-semibold text-[#0b3fc4] transition-colors hover:bg-white/90 active:scale-[0.98] sm:text-xs"
            >
              <Sparkles className="size-3 shrink-0" aria-hidden="true" />
              Dapatkan Careevo Plus
              <ArrowRight className="size-3 shrink-0" aria-hidden="true" />
            </Link>
          </div>

          <div className="relative isolate flex min-h-[9.5rem] flex-col justify-center overflow-hidden rounded-xl bg-[#0a4d3a] p-4 text-white shadow-md sm:min-h-[10rem] sm:p-5">
            <Image
              src="/images/belajar/promo-teams-hero.webp"
              alt=""
              fill
              unoptimized
              sizes="(min-width: 768px) 628px, 100vw"
              className="object-cover object-right"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-r from-black/40 via-black/12 to-transparent"
            />
            <div className="relative md:max-w-[60%]">
              <PromoLockup suffix="untuk tim" />
              <h3 className="text-base font-bold leading-[1.18] text-balance text-white sm:text-lg">
                Mulai dengan penghematan untuk tim yang bekerja keras
              </h3>
              <p className="mt-1 text-[11px] leading-[1.45] text-white/85 sm:text-xs">
                Bangun talenta teknologi internal organisasi dengan kurikulum
                terarah, dashboard pelacakan progres, dan jalur evaluasi riil.
              </p>
            </div>

            <Link
              href="/careevo-plus#paket"
              className="relative mt-2.5 inline-flex h-8 w-fit items-center gap-1.5 self-start rounded-full bg-white px-3.5 text-[11px] font-semibold text-[#0a4d3a] transition-colors hover:bg-white/90 active:scale-[0.98] sm:text-xs"
            >
              <Users className="size-3 shrink-0" aria-hidden="true" />
              Lihat paket tim
              <ArrowRight className="size-3 shrink-0" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="siap-kerja-heading"
        className="bg-[#f5f7fa] py-14"
      >
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 id="siap-kerja-heading" className={HOME_SECTION_HEADING_CLASS}>
              Siap kerja untuk karier yang banyak dicari
            </h2>
            <p className="mt-2 text-base text-gray-600">
              Tanpa pengalaman sebelumnya pun kamu bisa memulai. Dapatkan
              keahlian praktis yang langsung bernilai bagi industri.
            </p>
          </div>

          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {CAREER_PROGRAMS.map((program) => (
              <div
                key={program.role}
                className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xs transition-all hover:border-[#0056D2] hover:shadow-md"
              >
                <div className="relative aspect-[2.4/1] w-full bg-gray-50">
                  <Image
                    src={program.image}
                    alt={program.role}
                    fill
                    sizes="(max-width: 640px) 100vw, 25vw"
                    className="object-contain p-2"
                  />
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="text-base font-bold text-gray-900">
                    {program.role}
                  </h3>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-lg font-bold text-[#0056D2]">
                      {program.salary}
                    </span>
                    <span className="text-xs text-gray-500">median gaji</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {program.openings}
                  </p>

                  <div className="mt-4 border-t border-gray-100 pt-3">
                    <p className="text-[11px] font-semibold text-gray-500 uppercase">
                      Sertifikat Rekomendasi:
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs font-medium text-gray-800">
                      {program.cert}
                    </p>
                    <p className="mt-0.5 text-[11px] text-gray-500">
                      {program.provider}
                    </p>
                  </div>

                  <Link
                    href="#katalog"
                    className="mt-4 inline-flex items-center text-xs font-bold text-[#0056D2]"
                  >
                    Pelajari jalur karier{" "}
                    <ArrowRight className="ml-1 size-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="gelar-heading" className="bg-white py-14">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <span className="text-xs font-bold tracking-wider text-[#0056D2] uppercase">
                PENDIDIKAN TINGGI TERAKREDITASI
              </span>
              <h2
                id="gelar-heading"
                className={cn("mt-1", HOME_SECTION_HEADING_CLASS)}
              >
                Raih gelar dari universitas terkemuka dunia
              </h2>
              <p className="mt-2 text-base text-gray-600">
                100% online dengan biaya yang lebih terjangkau. Gelar akademik
                resmi yang diakui global.
              </p>
            </div>
            <Link
              href="#katalog"
              className="inline-flex items-center text-sm font-semibold text-[#0056D2]"
            >
              Lihat seluruh program gelar{" "}
              <ChevronRight className="ml-1 size-4" />
            </Link>
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {DEGREES.map((deg) => (
              <div
                key={deg.title}
                className="flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-6 shadow-xs transition-shadow hover:shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-blue-50 px-2.5 py-2 text-[11px] font-semibold text-[#0056D2]">
                      {deg.badge}
                    </span>
                    <span className="text-xs text-gray-500">
                      {deg.duration}
                    </span>
                  </div>

                  <div className="mt-4 flex items-center gap-2.5">
                    <div className="relative size-6 shrink-0">
                      <Image
                        src={deg.logo}
                        alt={deg.school}
                        fill
                        sizes="24px"
                        className="object-contain"
                      />
                    </div>
                    <span className="text-xs font-semibold text-gray-700">
                      {deg.school}
                    </span>
                  </div>

                  <h3 className="mt-3 text-lg font-bold text-gray-900">
                    {deg.title}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-gray-600">
                    {deg.description}
                  </p>
                </div>

                <div className="mt-6 border-t border-gray-100 pt-4">
                  <Link
                    href="#katalog"
                    className="inline-flex items-center text-xs font-bold text-[#0056D2]"
                  >
                    Informasi pendaftaran{" "}
                    <ArrowRight className="ml-1 size-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        aria-labelledby="trending-searches-heading"
        className="border-t border-gray-200 bg-white py-14"
      >
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2
            id="trending-searches-heading"
            className={cn("mb-6", HOME_SECTION_HEADING_CLASS)}
          >
            Pencarian populer
          </h2>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {TRENDING_COLUMNS.map((col) => (
              <div
                key={col.category}
                className="flex flex-col rounded-2xl bg-[#EBF3FB] p-5"
              >
                <Link
                  href={col.categoryHref}
                  className="group mb-4 inline-flex items-center text-base font-bold text-[#111827] hover:text-[#0056D2]"
                >
                  <span>{col.category}</span>
                  <span className="ml-1.5 transition-transform group-hover:translate-x-1">
                    →
                  </span>
                </Link>

                <div className="flex flex-col gap-3">
                  {col.items.map((item) => (
                    <Link
                      key={item.title}
                      href={item.href}
                      className="group flex items-center gap-3.5 rounded-xl border border-transparent bg-white p-3 shadow-2xs transition-all hover:border-gray-200 hover:no-underline hover:shadow-xs"
                    >
                      <div className="relative size-14 shrink-0 overflow-hidden rounded-md bg-gray-100">
                        <Image
                          src={item.thumbnail}
                          alt={item.title}
                          fill
                          sizes="56px"
                          className="object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <div className="relative size-3.5 shrink-0 overflow-hidden">
                            <Image
                              src={item.orgLogo}
                              alt={item.org}
                              fill
                              sizes="14px"
                              className="object-contain"
                            />
                          </div>
                          <span className="truncate text-xs font-normal text-[#4B5563]">
                            {item.org}
                          </span>
                        </div>
                        <h4 className="mt-0.5 line-clamp-2 text-xs sm:text-sm font-bold text-[#111827] group-hover:text-[#0056D2]">
                          {item.title}
                        </h4>
                        <p className="mt-0.5 text-xs text-[#4B5563]">
                          {item.type} ·{" "}
                          <span className="font-semibold text-gray-900">
                            {item.rating}
                          </span>
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-2xl bg-[#EBF3FB] p-5 sm:p-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <h3 className="shrink-0 text-lg font-bold tracking-tight text-[#111827] sm:text-xl">
                Apa yang membawamu ke Careevo hari ini?
              </h3>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                {INTENTS_DATA.map((item) => {
                  const active = goal === item.label;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => setGoal(item.label)}
                      aria-pressed={active}
                      className={cn(
                        "flex cursor-pointer items-center gap-2.5 rounded-xl border bg-white px-3 py-2 shadow-2xs transition-all hover:border-[#0056D2] hover:shadow-xs active:scale-[0.98]",
                        active
                          ? "border-[#0056D2] ring-2 ring-[#0056D2]/25 font-bold"
                          : "border-gray-200 text-gray-700",
                      )}
                    >
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#0056D2] text-white">
                        {item.icon}
                      </div>
                      <span className="whitespace-nowrap text-xs font-semibold text-[#111827]">
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-xs sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h4 className="text-xl font-bold text-gray-900">
                  Rekomendasi Terarah: {goal}
                </h4>
                <p className="mt-1 text-sm text-gray-600">
                  Kursus dan challenge proyek yang dirancang untuk mendukung
                  sasaran belajarmu.
                </p>
              </div>
              <a
                href="#katalog"
                className="inline-flex rounded-lg bg-[#0056D2] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#00419e]"
              >
                Lihat semua katalog →
              </a>
            </div>

            <div className="mt-6 flex gap-4 overflow-x-auto pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {resources.slice(0, 6).map((r) => (
                <CourseraCourseCard key={r.id} resource={r} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section
        aria-label="Hasil Karier Positif"
        className="border-t border-gray-200 bg-white py-14"
      >
        <div className="mx-auto grid w-full max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-12 lg:px-8">
          <div className="lg:col-span-7">
            <span className="text-xs font-bold tracking-wider text-[#0056D2] uppercase">
              HASIL PEMBELAJAR YANG TERBUKTI
            </span>
            <h2 className={cn("mt-2", HOME_SECTION_HEADING_CLASS)}>
              91% peserta meraih hasil karier yang positif
            </h2>
            <p className="mt-4 text-base leading-relaxed text-gray-600">
              Lulusan Careevo melaporkan tawaran pekerjaan baru, promosi
              kenaikan jabatan, peningkatan produktivitas, serta portofolio
              karya nyata yang tervalidasi.
            </p>

            <div className="mt-6 grid grid-cols-3 gap-4 border-t border-gray-100 pt-6">
              <div>
                <p className="text-2xl font-bold text-[#0056D2] sm:text-3xl">
                  91%
                </p>
                <p className="mt-1 text-xs text-gray-600">
                  Meraih lompatan karier positif
                </p>
              </div>
              <div>
                <p className="text-2xl font-bold text-[#0056D2] sm:text-3xl">
                  84%
                </p>
                <p className="mt-1 text-xs text-gray-600">
                  Peningkatan kepercayaan diri
                </p>
              </div>
              <div>
                <p className="text-2xl font-bold text-[#0056D2] sm:text-3xl">
                  72%
                </p>
                <p className="mt-1 text-xs text-gray-600">
                  Menerapkan skill langsung di tempat kerja
                </p>
              </div>
            </div>

            <div className="mt-8">
              <Link
                href="/careevo-plus"
                className="inline-flex rounded-lg bg-[#0056D2] px-6 py-3 text-sm font-semibold text-white hover:bg-[#00419e] active:scale-[0.98]"
              >
                Pelajari selengkapnya
              </Link>
            </div>
          </div>

          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-[#f5f7fa] p-4 lg:col-span-5">
            <Image
              src="https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://images.ctfassets.net/00atxywtfxvd/2FoYK9aUFG5lwb7ihssz9x/823a1b48f0261955624a7ecf75873b8f/Coursera-graph_2x.png?auto=format%2C%20compress&dpr=1&w=444&h=298&q=40&fit=clip"
              alt="Grafik dampak karier peserta"
              fill
              sizes="(max-width: 1024px) 100vw, 40vw"
              className="object-contain"
            />
          </div>
        </div>
      </section>

      <section
        aria-labelledby="testimoni-heading"
        className="bg-[#f5f7fa] py-14"
      >
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="text-xs font-bold tracking-wider text-[#0056D2] uppercase">
                CERITA SUKSES
              </span>
              <h2
                id="testimoni-heading"
                className={cn("mt-1", HOME_SECTION_HEADING_CLASS)}
              >
                Kenapa peserta memilih Careevo
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Cerita sebelumnya"
                onClick={() =>
                  setStory(
                    (s) => (s + TESTIMONIALS.length - 1) % TESTIMONIALS.length,
                  )
                }
                className="flex size-9 cursor-pointer items-center justify-center rounded-full border border-gray-300 bg-white text-gray-700 shadow-xs hover:bg-gray-50 active:scale-95"
              >
                ‹
              </button>
              <button
                type="button"
                aria-label="Cerita berikutnya"
                onClick={() => setStory((s) => (s + 1) % TESTIMONIALS.length)}
                className="flex size-9 cursor-pointer items-center justify-center rounded-full border border-gray-300 bg-white text-gray-700 shadow-xs hover:bg-gray-50 active:scale-95"
              >
                ›
              </button>
            </div>
          </div>

          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {TESTIMONIALS.map((t, idx) => (
              <div
                key={t.name}
                className={cn(
                  "flex flex-col justify-between rounded-xl border bg-white p-6 shadow-xs transition-all",
                  story === idx
                    ? "border-[#0056D2] ring-2 ring-[#0056D2]/20"
                    : "border-gray-200",
                )}
              >
                <div className="mb-4">
                  <div className="flex items-center gap-3">
                    <div className="relative size-12 shrink-0 overflow-hidden rounded-full border border-gray-200">
                      <Image
                        src={t.avatar}
                        alt={t.name}
                        fill
                        sizes="48px"
                        className="object-cover"
                      />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">
                        {t.name}
                      </h3>
                      <p className="text-xs text-gray-500">{t.role}</p>
                    </div>
                  </div>
                  <p className="mt-4 text-xs leading-relaxed text-gray-700 sm:text-sm">
                    “{t.text}”
                  </p>
                </div>
                <div className="flex text-[#eb8a04]">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="size-3.5 fill-[#eb8a04]" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="kategori-heading" className="bg-white py-14">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 id="kategori-heading" className={HOME_SECTION_HEADING_CLASS}>
            Jelajahi kategori
          </h2>
          <p className="mt-1.5 text-sm text-gray-600">
            Temukan topik sesuai minat dan spesialisasi keahlianmu.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.name}
                type="button"
                onClick={() => {
                  setQuery(cat.query);
                  document
                    .getElementById("katalog")
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
                className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 text-left shadow-2xs transition-colors hover:border-[#0056D2] hover:bg-blue-50/40 active:scale-[0.98]"
              >
                <span className="text-2xl" aria-hidden="true">
                  {cat.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-bold text-gray-900 sm:text-sm">
                    {cat.name}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    {cat.count}+ materi
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section
        id="katalog"
        aria-labelledby="katalog-heading"
        className="scroll-mt-20 border-t border-gray-200 bg-[#f5f7fa] py-14"
      >
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 id="katalog-heading" className={HOME_SECTION_HEADING_CLASS}>
                Katalog lengkap kursus
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Menampilkan {searched.length} dari {resources.length} materi
                {query.trim() ? ` untuk pencarian “${query.trim()}”` : ""}
              </p>
            </div>

            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="text-xs font-semibold text-[#0056D2] sm:text-sm"
              >
                Reset pencarian
              </button>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {searched.map((r) => (
              <CourseraCourseCard key={r.id} resource={r} />
            ))}
          </div>

          {searched.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
              <p className="text-base font-semibold text-gray-800">
                Tidak ada materi yang cocok dengan pencarian “{query.trim()}”.
              </p>
              <p className="mt-1 text-sm text-gray-500">
                Coba gunakan kata kunci umum seperti “HTML”, “React”, “Python”,
                atau “Security”.
              </p>
              <button
                type="button"
                onClick={() => setQuery("")}
                className="mt-4 inline-flex rounded-lg bg-[#0056D2] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#00419e]"
              >
                Tampilkan semua materi
              </button>
            </div>
          ) : null}
        </div>
      </section>

      <section
        aria-labelledby="faq-heading"
        className="border-t border-gray-200 bg-white py-14"
      >
        <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8">
          <h2
            id="faq-heading"
            className={cn("text-center", HOME_SECTION_HEADING_CLASS)}
          >
            Pertanyaan yang sering diajukan
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Semua yang perlu kamu ketahui tentang pembelajaran, akreditasi, dan
            sertifikat di Careevo.
          </p>

          <div className="mt-8 divide-y divide-gray-200 rounded-2xl border border-gray-200 bg-white shadow-xs">
            {FAQS.map((f, i) => {
              const open = openFaq === i;
              const panelId = `faq-panel-${i}`;
              return (
                <div key={f.q}>
                  <button
                    type="button"
                    onClick={() => setOpenFaq(open ? null : i)}
                    aria-expanded={open}
                    aria-controls={panelId}
                    className="flex w-full cursor-pointer items-center justify-between gap-4 px-6 py-5 text-left transition-colors hover:bg-gray-50/60"
                  >
                    <span className="text-sm font-bold text-gray-900 sm:text-base">
                      {f.q}
                    </span>
                    <span
                      aria-hidden="true"
                      className="text-lg font-bold text-gray-400"
                    >
                      {open ? "−" : "+"}
                    </span>
                  </button>
                  {open ? (
                    <p
                      id={panelId}
                      className="px-6 pb-6 text-sm leading-relaxed text-gray-600"
                    >
                      {f.a}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
