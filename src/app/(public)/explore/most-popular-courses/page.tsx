import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Star, ArrowRight, Sparkles } from "lucide-react";

export const metadata: Metadata = {
  title: "Most popular courses and skills | Careevo",
  description: "Explore our top courses and skills, loved by learners and developed by leading experts.",
};

interface ExploreCourse {
  title: string;
  provider: string;
  providerLogo: string;
  type: string;
  rating: number;
  reviews: string;
  thumbnail: string;
  statusBadge?: string;
  href: string;
  category: "Data Science" | "Business" | "Computer Science" | "Information Technology";
}

const TRENDING_COURSES: ExploreCourse[] = [
  {
    title: "Google Project Management",
    provider: "Google",
    providerLogo: "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/http://coursera-university-assets.s3.amazonaws.com/92/d0d1ee4a844037be9a2d349ee5f59d/GoogleG_FullColor_RGB.png?auto=format%2Ccompress&dpr=3&w=24&h=24",
    type: "Professional Certificate",
    rating: 4.8,
    reviews: "120K",
    thumbnail: "https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=640&q=80",
    statusBadge: "Trending right now",
    href: "/belajar/crs-2",
    category: "Business",
  },
  {
    title: "Google Data Analytics",
    provider: "Google",
    providerLogo: "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/http://coursera-university-assets.s3.amazonaws.com/92/d0d1ee4a844037be9a2d349ee5f59d/GoogleG_FullColor_RGB.png?auto=format%2Ccompress&dpr=3&w=24&h=24",
    type: "Professional Certificate",
    rating: 4.8,
    reviews: "140K",
    thumbnail: "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://d15cw65ipctsrr.cloudfront.net/60/097644c12e4aeba0c3420de571cac1/GCC-Coursera-thumbnail-DA-foundations-tony-cert-level.png?auto=format%2C%20compress%2C%20enhance&dpr=1&w=320&h=180&fit=crop&q=50&crop=focalpoint&fp-y=0.48",
    statusBadge: "Trending right now",
    href: "/belajar/crs-4",
    category: "Data Science",
  },
  {
    title: "Google IT Support",
    provider: "Google",
    providerLogo: "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/http://coursera-university-assets.s3.amazonaws.com/92/d0d1ee4a844037be9a2d349ee5f59d/GoogleG_FullColor_RGB.png?auto=format%2Ccompress&dpr=3&w=24&h=24",
    type: "Professional Certificate",
    rating: 4.8,
    reviews: "180K",
    thumbnail: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=640&q=80",
    statusBadge: "Trending right now",
    href: "/belajar/r7",
    category: "Information Technology",
  },
  {
    title: "Google UX Design",
    provider: "Google",
    providerLogo: "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/http://coursera-university-assets.s3.amazonaws.com/92/d0d1ee4a844037be9a2d349ee5f59d/GoogleG_FullColor_RGB.png?auto=format%2Ccompress&dpr=3&w=24&h=24",
    type: "Professional Certificate",
    rating: 4.8,
    reviews: "95K",
    thumbnail: "https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?auto=format&fit=crop&w=640&q=80",
    statusBadge: "Trending right now",
    href: "/belajar/r8",
    category: "Computer Science",
  },
  {
    title: "Google Cybersecurity",
    provider: "Google",
    providerLogo: "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/http://coursera-university-assets.s3.amazonaws.com/92/d0d1ee4a844037be9a2d349ee5f59d/GoogleG_FullColor_RGB.png?auto=format%2Ccompress&dpr=3&w=24&h=24",
    type: "Professional Certificate",
    rating: 4.8,
    reviews: "45K",
    thumbnail: "https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=640&q=80",
    statusBadge: "Trending right now",
    href: "/belajar/r7",
    category: "Information Technology",
  },
  {
    title: "Google Digital Marketing & E-commerce",
    provider: "Google",
    providerLogo: "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/http://coursera-university-assets.s3.amazonaws.com/92/d0d1ee4a844037be9a2d349ee5f59d/GoogleG_FullColor_RGB.png?auto=format%2Ccompress&dpr=3&w=24&h=24",
    type: "Professional Certificate",
    rating: 4.8,
    reviews: "75K",
    thumbnail: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=640&q=80",
    statusBadge: "Trending right now",
    href: "/belajar/crs-2",
    category: "Business",
  },
  {
    title: "Google IT Automation with Python",
    provider: "Google",
    providerLogo: "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/http://coursera-university-assets.s3.amazonaws.com/92/d0d1ee4a844037be9a2d349ee5f59d/GoogleG_FullColor_RGB.png?auto=format%2Ccompress&dpr=3&w=24&h=24",
    type: "Professional Certificate",
    rating: 4.8,
    reviews: "52K",
    thumbnail: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=640&q=80",
    statusBadge: "Trending right now",
    href: "/belajar/crs-4",
    category: "Information Technology",
  },
  {
    title: "Google AI Essentials",
    provider: "Google",
    providerLogo: "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/http://coursera-university-assets.s3.amazonaws.com/92/d0d1ee4a844037be9a2d349ee5f59d/GoogleG_FullColor_RGB.png?auto=format%2Ccompress&dpr=3&w=24&h=24",
    type: "Specialization",
    rating: 4.8,
    reviews: "60K",
    thumbnail: "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://d15cw65ipctsrr.cloudfront.net/07/eced232a07415eb3d77c788ae5754e/AIE.png?auto=format%2C%20compress%2C%20enhance&dpr=1&w=320&h=180&fit=crop&q=50&crop=focalpoint&fp-y=0.48",
    statusBadge: "Top AI program",
    href: "/belajar/r1",
    category: "Computer Science",
  },
];

export default function MostPopularCoursesPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Hero Header */}
      <section className="border-b border-gray-200 bg-linear-to-b from-blue-50/50 to-white pt-24 pb-14 sm:pt-28 sm:pb-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-[#0056D2]">
              <Sparkles className="size-3.5" />
              <span>Program Pilihan Terpopuler</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-5xl">
              Most popular courses and skills
            </h1>
            <p className="mt-4 text-base text-gray-600 sm:text-lg leading-relaxed">
              Explore our top courses and skills, loved by learners and developed by leading experts from Google, IBM, Microsoft, and global institutions.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/daftar"
                className="chrome-btn chrome-btn-brand !h-12 !px-7 !text-base"
              >
                <span>Start 7-day free trial</span>
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/belajar"
                className="chrome-btn chrome-btn-white !h-12 !px-7 !text-base"
              >
                Lihat Semua Katalog
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Section 1: Learning that's trending */}
      <section className="py-14 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
                Learning that’s trending
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Kursus dan sertifikat paling banyak diambil minggu ini oleh para pembelajar aktif.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {TRENDING_COURSES.map((course) => (
              <Link
                key={course.title}
                href={course.href}
                className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-2xs transition-all duration-200 hover:-translate-y-1 hover:border-gray-300 hover:shadow-md active:scale-[0.98]"
              >
                <div>
                  <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-gray-100">
                    <Image
                      src={course.thumbnail}
                      alt={course.title}
                      fill
                      sizes="(max-width: 768px) 100vw, 25vw"
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      unoptimized
                    />
                    {course.statusBadge && (
                      <span className="absolute top-2 left-2 rounded-md bg-[#0056D2] px-2 py-0.5 text-[10px] font-semibold text-white uppercase tracking-wider shadow-xs">
                        {course.statusBadge}
                      </span>
                    )}
                  </div>

                  <div className="mt-4 flex items-center gap-2">
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
                    <span className="text-xs font-medium text-gray-600">{course.provider}</span>
                  </div>

                  <h3
                    className="mt-2 line-clamp-2 text-sm sm:text-base font-bold text-gray-900 group-hover:text-[#0056D2] transition-colors leading-snug"
                    title={course.title}
                  >
                    {course.title}
                  </h3>
                </div>

                <div className="mt-4 border-t border-gray-100 pt-3">
                  <div className="flex items-center gap-1.5 text-xs text-gray-600">
                    <Star className="size-3.5 fill-amber-500 text-amber-500 shrink-0" />
                    <span className="font-semibold text-gray-900">{course.rating}</span>
                    <span>({course.reviews})</span>
                    <span className="text-gray-300">·</span>
                    <span className="truncate">{course.type}</span>
                  </div>
                  <div className="mt-2 text-[11px] font-medium text-emerald-700">
                    Status: Free trial
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Promotional Bento Section */}
      <section className="border-t border-gray-100 bg-[#f5f7fa] py-14">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 md:grid-cols-2 lg:px-8">
          <div className="flex flex-col justify-between rounded-2xl bg-[#00255d] p-8 text-white shadow-md">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-300">
                Careevo Plus
              </span>
              <h3 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
                Break down barriers to learning with big savings
              </h3>
              <p className="mt-3 text-sm text-blue-100/90 leading-relaxed">
                Akses ribuan materi, sertifikat resmi, dan bimbingan Socrates AI tanpa batas dalam satu langganan hemat.
              </p>
            </div>
            <div className="mt-8">
              <Link
                href="/careevo-plus"
                className="chrome-btn chrome-btn-white !h-11 !px-6 !text-sm"
              >
                Get Careevo Plus
              </Link>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-2xl bg-[#0e3b43] p-8 text-white shadow-md">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-teal-300">
                Careevo for Business
              </span>
              <h3 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
                Start with easy savings for hard-working teams
              </h3>
              <p className="mt-3 text-sm text-teal-100/90 leading-relaxed">
                Tingkatkan kapabilitas tim teknik dan analisis data dengan kurikulum berstandar industri dan pelacakan progres terpusat.
              </p>
            </div>
            <div className="mt-8">
              <Link
                href="mailto:bisnis@careevo.id"
                className="chrome-btn chrome-btn-brand !h-11 !px-6 !text-sm"
              >
                Save 30% today
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Most popular by category */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              Most popular by category
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Temukan spesialisasi dan sertifikat terunggul di setiap ranah teknologi.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {TRENDING_COURSES.slice(0, 4).map((c) => (
              <Link
                key={`cat-${c.title}`}
                href={c.href}
                className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-2xs transition-all duration-200 hover:-translate-y-1 hover:border-gray-300 hover:shadow-md"
              >
                <div>
                  <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-gray-100">
                    <Image
                      src={c.thumbnail}
                      alt={c.title}
                      fill
                      sizes="(max-width: 768px) 100vw, 25vw"
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      unoptimized
                    />
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-600">{c.provider}</span>
                  </div>
                  <h4 className="mt-2 line-clamp-2 text-sm sm:text-base font-bold text-gray-900 group-hover:text-[#0056D2]">
                    {c.title}
                  </h4>
                </div>
                <div className="mt-4 border-t border-gray-100 pt-3">
                  <div className="text-xs text-gray-500">{c.type}</div>
                  <div className="mt-1 flex items-center gap-1 text-xs">
                    <Star className="size-3.5 fill-amber-500 text-amber-500" />
                    <span className="font-semibold text-gray-900">{c.rating}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Outcome Stat Banner */}
      <section className="border-t border-gray-200 bg-white py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-6 rounded-2xl bg-blue-50/70 p-8 sm:flex-row sm:p-10 border border-blue-100">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 sm:text-3xl">
                91% of learners achieved a positive career outcome
              </h3>
              <p className="mt-2 text-sm text-gray-600 max-w-2xl leading-relaxed">
                They reported new job opportunities, increased knowledge, improved work performance, and verified attestations employers trust.
              </p>
            </div>
            <Link
              href="/daftar"
              className="chrome-btn chrome-btn-brand shrink-0 !h-11 !px-6 !text-sm"
            >
              Learn more
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
