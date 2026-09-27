"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { TrendingUp, ArrowRight } from "lucide-react";
import { HeroSubNav } from "@/components/ui/hero-subnav";
import { HARGA, rupiah } from "@/lib/pricing";

/**
 * Isi `/explore/most-popular-courses`, dipisah dari `page.tsx` karena ia
 * butuh `useRef` untuk hero: `HeroSubNav` memicunya dari elemen hero yang
 * benar-benar keluar dari viewport, bukan dari angka scroll tetap, karena
 * tinggi hero ikut berubah saat copy dan gambar membungkus. `page.tsx` tetap
 * server component supaya bisa mengekspor `metadata`.
 */

interface ExploreCard {
  title: string;
  provider: string;
  providerLogo: string;
  type: string;
  imageUrl: string;
  href: string;
  category: "Business" | "Data Science" | "Computer Science" | "Information Technology";
  trending?: boolean;
  freeTrial?: boolean;
}

const TRENDING_COURSES: ExploreCard[] = [
  {
    title: "Google Project Management",
    provider: "Google",
    providerLogo:
      "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/http://coursera-university-assets.s3.amazonaws.com/92/d0d1ee4a844037be9a2d349ee5f59d/GoogleG_FullColor_RGB.png?auto=format%2Ccompress&dpr=3&w=24&h=24",
    type: "Professional Certificate",
    imageUrl:
      "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://d15cw65ipctsrr.cloudfront.net/64/2c23361e8c42a680e3e34c57db8e27/GCC-Coursera-thumbnail-PM-foundations-emilio-cert-level.png?auto=format%2C%20compress%2C%20enhance&dpr=1&w=320&h=180&fit=crop&q=50&crop=focalpoint&fp-y=0.48",
    href: "/professional-certificates/google-project-management",
    category: "Business",
    trending: true,
    freeTrial: true,
  },
  {
    title: "Google Data Analytics",
    provider: "Google",
    providerLogo:
      "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/http://coursera-university-assets.s3.amazonaws.com/92/d0d1ee4a844037be9a2d349ee5f59d/GoogleG_FullColor_RGB.png?auto=format%2Ccompress&dpr=3&w=24&h=24",
    type: "Professional Certificate",
    imageUrl:
      "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://d15cw65ipctsrr.cloudfront.net/60/097644c12e4aeba0c3420de571cac1/GCC-Coursera-thumbnail-DA-foundations-tony-cert-level.png?auto=format%2C%20compress%2C%20enhance&dpr=1&w=320&h=180&fit=crop&q=50&crop=focalpoint&fp-y=0.48",
    href: "/professional-certificates/google-data-analytics",
    category: "Data Science",
    trending: true,
    freeTrial: true,
  },
  {
    title: "Google IT Support",
    provider: "Google",
    providerLogo:
      "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/http://coursera-university-assets.s3.amazonaws.com/92/d0d1ee4a844037be9a2d349ee5f59d/GoogleG_FullColor_RGB.png?auto=format%2Ccompress&dpr=3&w=24&h=24",
    type: "Professional Certificate",
    imageUrl:
      "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://d15cw65ipctsrr.cloudfront.net/87/a6fe9eac464f3d93cb68689fb4edab/GCC-Coursera-thumbnail-IT-tech-support-fundamentals-kevin-cert-level.png?auto=format%2C%20compress%2C%20enhance&dpr=1&w=320&h=180&fit=crop&q=50&crop=focalpoint&fp-y=0.48",
    href: "/professional-certificates/google-it-support",
    category: "Information Technology",
    trending: true,
    freeTrial: true,
  },
  {
    title: "Google UX Design",
    provider: "Google",
    providerLogo:
      "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/http://coursera-university-assets.s3.amazonaws.com/92/d0d1ee4a844037be9a2d349ee5f59d/GoogleG_FullColor_RGB.png?auto=format%2Ccompress&dpr=3&w=24&h=24",
    type: "Professional Certificate",
    imageUrl:
      "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://d15cw65ipctsrr.cloudfront.net/7d/13e379b4d3490ead26fd4f89a31136/UX-Design.png?auto=format%2C%20compress%2C%20enhance&dpr=1&w=320&h=180&fit=crop&q=50&crop=focalpoint&fp-y=0.48",
    href: "/professional-certificates/google-ux-design",
    category: "Computer Science",
    trending: true,
    freeTrial: true,
  },
  {
    title: "Google Cybersecurity",
    provider: "Google",
    providerLogo:
      "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/http://coursera-university-assets.s3.amazonaws.com/92/d0d1ee4a844037be9a2d349ee5f59d/GoogleG_FullColor_RGB.png?auto=format%2Ccompress&dpr=3&w=24&h=24",
    type: "Professional Certificate",
    imageUrl:
      "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://d15cw65ipctsrr.cloudfront.net/1b/cf7188df91422ca7ffe0ba00848482/Cybersecurity.png?auto=format%2C%20compress%2C%20enhance&dpr=1&w=320&h=180&fit=crop&q=50&crop=focalpoint&fp-y=0.48",
    href: "/professional-certificates/google-cybersecurity",
    category: "Information Technology",
    trending: true,
    freeTrial: true,
  },
  {
    title: "Google Digital Marketing & E-commerce",
    provider: "Google",
    providerLogo:
      "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/http://coursera-university-assets.s3.amazonaws.com/92/d0d1ee4a844037be9a2d349ee5f59d/GoogleG_FullColor_RGB.png?auto=format%2Ccompress&dpr=3&w=24&h=24",
    type: "Professional Certificate",
    imageUrl:
      "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://d15cw65ipctsrr.cloudfront.net/91/e424f15b9d4626a10b1088573092e0/DME.png?auto=format%2C%20compress%2C%20enhance&dpr=1&w=320&h=180&fit=crop&q=50&crop=focalpoint&fp-y=0.48",
    href: "/professional-certificates/google-digital-marketing-ecommerce",
    category: "Business",
    trending: true,
    freeTrial: true,
  },
  {
    title: "Google IT Automation with Python",
    provider: "Google",
    providerLogo:
      "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/http://coursera-university-assets.s3.amazonaws.com/92/d0d1ee4a844037be9a2d349ee5f59d/GoogleG_FullColor_RGB.png?auto=format%2Ccompress&dpr=3&w=24&h=24",
    type: "Professional Certificate",
    imageUrl:
      "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://d15cw65ipctsrr.cloudfront.net/6a/13981d577743e89f9cfe8e12808876/GCC-Coursera-thumbnail-ITwithPython-crash-course-python-christine-cert-level.png?auto=format%2C%20compress%2C%20enhance&dpr=1&w=320&h=180&fit=crop&q=50&crop=focalpoint&fp-y=0.48",
    href: "/professional-certificates/google-it-automation",
    category: "Information Technology",
    trending: true,
    freeTrial: true,
  },
  {
    title: "Google AI Essentials",
    provider: "Google",
    providerLogo:
      "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/http://coursera-university-assets.s3.amazonaws.com/92/d0d1ee4a844037be9a2d349ee5f59d/GoogleG_FullColor_RGB.png?auto=format%2Ccompress&dpr=3&w=24&h=24",
    type: "Specialization",
    imageUrl:
      "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://d15cw65ipctsrr.cloudfront.net/07/eced232a07415eb3d77c788ae5754e/AIE.png?auto=format%2C%20compress%2C%20enhance&dpr=1&w=320&h=180&fit=crop&q=50&crop=focalpoint&fp-y=0.48",
    href: "/specializations/ai-essentials-google",
    category: "Computer Science",
    trending: true,
    freeTrial: true,
  },
];

const CATEGORY_COURSES: Record<string, ExploreCard[]> = {
  "Data Science": [
    {
      title: "Google Data Analytics",
      provider: "Google",
      providerLogo:
        "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/http://coursera-university-assets.s3.amazonaws.com/92/d0d1ee4a844037be9a2d349ee5f59d/GoogleG_FullColor_RGB.png?auto=format%2Ccompress&dpr=3&w=24&h=24",
      type: "Professional Certificate",
      imageUrl:
        "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://d15cw65ipctsrr.cloudfront.net/60/097644c12e4aeba0c3420de571cac1/GCC-Coursera-thumbnail-DA-foundations-tony-cert-level.png?auto=format%2C%20compress%2C%20enhance&dpr=1&w=320&h=180&fit=crop&q=50&crop=focalpoint&fp-y=0.48",
      href: "/professional-certificates/google-data-analytics",
      category: "Data Science",
      trending: true,
      freeTrial: true,
    },
    {
      title: "Machine Learning",
      provider: "DeepLearning.AI & Stanford Online",
      providerLogo:
        "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/http://coursera-university-assets.s3.amazonaws.com/b4/5cb90bb92f420b99bf323a0356f451/Icon.png?auto=format%2Ccompress&dpr=3&w=24&h=24",
      type: "Specialization",
      imageUrl:
        "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://d15cw65ipctsrr.cloudfront.net/3a/9d2a7af297483a845340bcfbac6f1e/MLS.course-banners-01_Course-Logo-.png?auto=format%2C%20compress%2C%20enhance&dpr=1&w=320&h=180&fit=crop&q=50",
      href: "/specializations/machine-learning-introduction",
      category: "Data Science",
      trending: true,
      freeTrial: true,
    },
    {
      title: "IBM Data Science",
      provider: "IBM",
      providerLogo:
        "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/http://coursera-university-assets.s3.amazonaws.com/bb/f5ced2bdd4437aa79f00eb1bf7fbf0/IBM-Logo-Blk---Square.png?auto=format%2Ccompress&dpr=3&w=24&h=24",
      type: "Professional Certificate",
      imageUrl:
        "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://d15cw65ipctsrr.cloudfront.net/6c/1510973eca4293ba9eb71d8b28f86f/BC-5768_VisMerch-Phase-3-Assets_ProCerts_IBM_DataScience.png?auto=format%2C%20compress%2C%20enhance&dpr=1&w=320&h=180&fit=crop&q=50",
      href: "/professional-certificates/ibm-data-science",
      category: "Data Science",
      trending: true,
      freeTrial: true,
    },
    {
      title: "IBM Data Analyst",
      provider: "IBM",
      providerLogo:
        "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/http://coursera-university-assets.s3.amazonaws.com/bb/f5ced2bdd4437aa79f00eb1bf7fbf0/IBM-Logo-Blk---Square.png?auto=format%2Ccompress&dpr=3&w=24&h=24",
      type: "Professional Certificate",
      imageUrl:
        "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://d15cw65ipctsrr.cloudfront.net/f8/a9b8a9547948789bd154efafcd114e/BC-5768_VisMerch-Phase-3-Assets_ProCerts_IBM_DataAnalyst.png?auto=format%2C%20compress%2C%20enhance&dpr=1&w=320&h=180&fit=crop&q=50",
      href: "/professional-certificates/ibm-data-analyst",
      category: "Data Science",
      trending: true,
      freeTrial: true,
    },
  ],
};

export function MostPopularCoursesView() {
  const heroRef = useRef<HTMLElement>(null);

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <HeroSubNav
        trigger={heroRef}
        badge="Explore"
        title="Most popular courses and skills"
        subtitle="Loved by learners, built by leading experts"
        cta={{ href: "/daftar", label: "Start free trial" }}
      />
      {/* Hero Section — Solid Deep Blue #0060EB with Exact Stylized Coursera Graphic */}
      <section ref={heroRef} className="bg-[#0060EB] text-white pt-24 pb-12 sm:pt-28 sm:pb-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-12">
            {/* Left Content */}
            <div className="lg:col-span-7">
              <h1 className="!text-white text-white text-3xl font-extrabold tracking-tight sm:text-5xl lg:text-[44px] leading-[1.12]">
                Most popular courses and skills
              </h1>
              <p className="mt-4 text-base sm:text-lg !text-white text-white/95 leading-relaxed max-w-2xl font-normal">
                Explore our top courses and skills, loved by learners and developed by leading experts.
              </p>
              <div className="mt-7">
                <Link
                  href="/daftar"
                  className="inline-flex items-center justify-center rounded-lg bg-white px-7 py-3 text-base font-bold text-[#0056D2] shadow-sm transition-all hover:bg-gray-100 active:scale-[0.98]"
                >
                  Start 7-day free trial
                </Link>
              </div>
            </div>

            {/* Right Graphic — Stacked paper cards, heart chat, 5-star badge */}
            <div className="lg:col-span-5 flex justify-center lg:justify-end">
              <div className="relative aspect-[16/9] w-full max-w-[480px]">
                <Image
                  src="https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://images.ctfassets.net/00atxywtfxvd/KOVqWiEQZMkOrGH3CamfH/893706cb2d87e556ab7426ab9b384c8b/Frame_1__5_.png?auto=format%2C%20compress&dpr=1&w=1763&h=980&q=40&fit=clip"
                  alt="Most popular courses and skills"
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 480px"
                  className="object-contain"
                  unoptimized
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 1: Learning that’s trending */}
      <section className="py-12 sm:py-16 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h2 className="text-2xl sm:text-[28px] font-bold tracking-tight text-gray-900">
              Learning that’s trending
            </h2>
          </div>

          {/* 8 Cards in 2 Rows of 4 */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {TRENDING_COURSES.map((course) => (
              <Link
                key={course.title}
                href={course.href}
                className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-[#C1CBDB] bg-white shadow-2xs transition-all duration-200 hover:-translate-y-1 hover:border-gray-400 hover:no-underline hover:shadow-md"
              >
                <div>
                  {/* Thumbnail Container */}
                  <div className="relative aspect-[16/9] w-full overflow-hidden bg-gray-100">
                    <Image
                      src={course.imageUrl}
                      alt={course.title}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      unoptimized
                    />
                    {/* Top-left Google G logo badge */}
                    <div className="absolute top-2.5 left-2.5 size-6 rounded bg-white p-1 shadow-xs flex items-center justify-center">
                      <Image
                        src={course.providerLogo}
                        alt="Google"
                        width={18}
                        height={18}
                        className="object-contain"
                        unoptimized
                      />
                    </div>
                  </div>

                  {/* Card Content Area */}
                  <div className="p-4">
                    {/* Partner info */}
                    <div className="flex items-center gap-1.5">
                      <div className="relative size-4 shrink-0 overflow-hidden">
                        <Image
                          src={course.providerLogo}
                          alt={course.provider}
                          fill
                          sizes="16px"
                          className="object-contain"
                          unoptimized
                        />
                      </div>
                      <span className="text-xs font-medium text-gray-700">{course.provider}</span>
                    </div>

                    {/* Course Title */}
                    <h3
                      className="mt-2 line-clamp-2 text-base font-bold text-[#0D0F12] group-hover:text-[#0056D2] transition-colors leading-snug min-h-[44px]"
                    >
                      {course.title}
                    </h3>

                    {/* Product Type */}
                    <p className="mt-1 text-xs text-gray-500 font-normal">
                      {course.type}
                    </p>
                  </div>
                </div>

                {/* Status Tags Row at Bottom */}
                <div className="px-4 pb-4 pt-1 flex flex-wrap items-center gap-1.5">
                  {course.trending && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-[#FCE5E8] px-2 py-0.5 text-[11px] font-semibold text-[#C51E37]">
                      <TrendingUp className="size-3" />
                      <span>Trending right now</span>
                    </span>
                  )}
                  {course.freeTrial && (
                    <span className="inline-flex items-center rounded-md bg-[#F0F6FF] px-2 py-0.5 text-[11px] font-semibold text-[#0D2F60]">
                      Uji coba gratis
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Promotional Bento Section — Exact Coursera Magenta & Navy Banners */}
      <section className="border-t border-gray-100 bg-[#F5F7FA] py-14">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 md:grid-cols-2 lg:px-8">
          {/* Card 1: Coursera Plus Promo */}
          <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl bg-[#C429A8] p-8 text-white shadow-md">
            <div>
              <div className="relative h-4 w-36 overflow-hidden">
                <Image
                  src="https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://images.ctfassets.net/00atxywtfxvd/NxPkwTU0sAEpcAUWZkfR1/f1abc250476ce6841a0faff27924487b/Coursera_Plus_White_Logo.png?auto=format%2Ccompress&dpr=1&h=16"
                  alt="Careevo Plus"
                  fill
                  sizes="144px"
                  className="object-contain object-left"
                  unoptimized
                />
              </div>
              <h3 className="mt-4 text-2xl sm:text-3xl font-bold text-white leading-tight">
                Belajar tanpa batas dengan satu langganan
              </h3>
              <p className="mt-2 text-sm text-pink-100 leading-relaxed">
                Mulai {rupiah(HARGA.plusBulanan)}/bulan · hemat 2 bulan dengan paket tahunan
              </p>
            </div>
            <div className="mt-8 flex items-center justify-between">
              <Link
                href="/careevo-plus"
                className="inline-flex items-center justify-center rounded-lg bg-white px-6 py-2.5 text-sm font-bold text-[#C429A8] shadow-sm transition-all hover:bg-gray-100"
              >
                Lihat Careevo Plus
              </Link>
            </div>
          </div>

          {/* Card 2: Careevo for Teams Promo */}
          <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl bg-[#002761] p-8 text-white shadow-md">
            <div>
              <div className="relative h-4 w-40 overflow-hidden">
                <Image
                  src="https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://images.ctfassets.net/00atxywtfxvd/3OYpxt8mmtxQGEyCZ76oqE/6e4a82d152d8f0dbe770bc0507655853/WES_Coursera_for_Teams_Logo__1_.png?auto=format%2Ccompress&dpr=1&h=18"
                  alt="Careevo for Teams"
                  fill
                  sizes="160px"
                  className="object-contain object-left"
                  unoptimized
                />
              </div>
              <h3 className="mt-4 text-2xl sm:text-3xl font-bold text-white leading-tight">
                Tingkatkan keahlian seluruh tim, dari satu dasbor
              </h3>
              <p className="mt-2 text-sm text-blue-100 leading-relaxed">
                Mulai {rupiah(HARGA.teamsPerKursiBulanan)}/kursi/bulan · minimum 5 kursi
              </p>
            </div>
            <div className="mt-8 flex items-center justify-between">
              <Link
                href="/business"
                className="inline-flex items-center justify-center rounded-lg bg-white px-6 py-2.5 text-sm font-bold text-[#002761] shadow-sm transition-all hover:bg-gray-100"
              >
                Minta penawaran
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Most popular by category */}
      <section className="py-14 sm:py-16 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-6">
            <h2 className="text-2xl sm:text-[28px] font-bold tracking-tight text-gray-900">
              Most popular by category
            </h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {["Data Science", "Business", "Computer Science", "Information Technology"].map((tab, i) => (
                <button
                  key={tab}
                  type="button"
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    i === 0
                      ? "bg-[#1E1E1E] text-white"
                      : "bg-[#F5F7FA] text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {(CATEGORY_COURSES["Data Science"] || []).map((c) => (
              <Link
                key={c.title}
                href={c.href}
                className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-[#C1CBDB] bg-white shadow-2xs transition-all duration-200 hover:-translate-y-1 hover:border-gray-400 hover:no-underline hover:shadow-md"
              >
                <div>
                  <div className="relative aspect-[16/9] w-full overflow-hidden bg-gray-100">
                    <Image
                      src={c.imageUrl}
                      alt={c.title}
                      fill
                      sizes="(max-width: 768px) 100vw, 25vw"
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      unoptimized
                    />
                  </div>
                  <div className="p-4">
                    <div className="flex items-center gap-1.5">
                      <div className="relative size-4 shrink-0 overflow-hidden">
                        <Image
                          src={c.providerLogo}
                          alt={c.provider}
                          fill
                          sizes="16px"
                          className="object-contain"
                          unoptimized
                        />
                      </div>
                      <span className="text-xs font-medium text-gray-700">{c.provider}</span>
                    </div>
                    <h4 className="mt-2 line-clamp-2 text-base font-bold text-[#0D0F12] group-hover:text-[#0056D2] leading-snug min-h-[44px]">
                      {c.title}
                    </h4>
                    <p className="mt-1 text-xs text-gray-500 font-normal">{c.type}</p>
                  </div>
                </div>
                <div className="px-4 pb-4 pt-1 flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-md bg-[#FCE5E8] px-2 py-0.5 text-[11px] font-semibold text-[#C51E37]">
                    <TrendingUp className="size-3" />
                    <span>Trending right now</span>
                  </span>
                  <span className="inline-flex items-center rounded-md bg-[#F0F6FF] px-2 py-0.5 text-[11px] font-semibold text-[#0D2F60]">
                    Uji coba gratis
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Outcome Stat Banner */}
      <section className="border-t border-gray-200 bg-[#001D4A] text-white py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-8 md:flex-row">
            <div className="max-w-xl">
              <h3 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">
                91% of learners achieved a positive career outcome
              </h3>
              <p className="mt-2.5 text-sm sm:text-base text-blue-100/90 leading-relaxed">
                They reported new job opportunities, increased knowledge, improved work performance, and verified attestations employers trust.
              </p>
              <div className="mt-6">
                <Link
                  href="/daftar"
                  className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-2.5 text-sm font-bold text-[#001D4A] transition-colors hover:bg-gray-100"
                >
                  <span>Learn more</span>
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>
            <div className="relative h-44 w-64 shrink-0 overflow-hidden">
              <Image
                src="https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://images.ctfassets.net/00atxywtfxvd/6uWwSiVVLJjYSCROqKk7IN/f6d77dce08e447a6ac8f310827d8931d/Learner_outcome_stat.png?auto=format%2Ccompress&dpr=1&w=350"
                alt="Learner outcome stat"
                fill
                sizes="256px"
                className="object-contain"
                unoptimized
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
