import Image from "next/image";
import Link from "next/link";
import {
  ChevronRight,
  Home,
  Star,
  Award,
  Sparkles,
  Info,
  Globe2,
  ShieldCheck,
  Check,
  ArrowRight,
} from "lucide-react";
import type { ProgramDetails } from "@/lib/courses/catalog-data";

export function ProgramDetailView({ program }: { program: ProgramDetails }) {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Hero Section with Concentric Arcs Background */}
      <header className="relative bg-linear-to-b from-[#F0F5FA] via-[#F4F8FC] to-[#EBF3FA] border-b border-gray-200 pt-20 sm:pt-24 pb-0">
        {/* Concentric Geometric Arcs Graphic on Right */}
        <div className="pointer-events-none absolute right-0 top-0 h-full w-2/5 overflow-hidden opacity-40 hidden md:block">
          <svg
            className="absolute -right-20 -top-20 h-[650px] w-[650px] text-[#0056D2]/20"
            viewBox="0 0 650 650"
            fill="none"
          >
            <circle cx="325" cy="325" r="120" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
            <circle cx="325" cy="325" r="200" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="325" cy="325" r="280" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="325" cy="325" r="360" stroke="currentColor" strokeWidth="2" strokeDasharray="6 6" />
          </svg>
        </div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Top Breadcrumb Trail inside Hero */}
          <nav aria-label="Breadcrumb" className="mb-6">
            <ol className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-gray-600">
              <li className="flex items-center gap-1.5">
                <Link href="/" className="flex items-center gap-1 text-gray-500 hover:text-gray-900 transition-colors">
                  <Home className="size-3.5" />
                  <span className="sr-only">Home</span>
                </Link>
                <ChevronRight className="size-3 text-gray-400" />
              </li>
              <li className="flex items-center gap-1.5">
                <Link href="/explore/most-popular-courses" className="hover:text-gray-900 transition-colors">
                  Categories
                </Link>
                <ChevronRight className="size-3 text-gray-400" />
              </li>
              <li className="flex items-center gap-1.5">
                <Link href="/explore/most-popular-courses" className="hover:text-gray-900 transition-colors">
                  {program.category}
                </Link>
                <ChevronRight className="size-3 text-gray-400" />
              </li>
              <li className="text-gray-900 font-medium truncate max-w-[200px] sm:max-w-none">
                {program.subcategory}
              </li>
            </ol>
          </nav>

          <div className="max-w-3xl">
            {/* Banner Graphic or Org Logo */}
            <div className="mb-5 flex items-center gap-3">
              {program.bannerGraphic ? (
                <div className="relative h-12 w-48 overflow-hidden">
                  <Image
                    src={program.bannerGraphic}
                    alt={program.provider}
                    fill
                    sizes="192px"
                    className="object-contain object-left"
                    unoptimized
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2.5">
                  <div className="relative size-10 overflow-hidden">
                    <Image
                      src={program.providerLogo}
                      alt={program.provider}
                      fill
                      sizes="40px"
                      className="object-contain"
                      unoptimized
                    />
                  </div>
                  <span className="font-bold text-gray-900 text-base">{program.provider}</span>
                </div>
              )}
              <span className="rounded-full bg-blue-100/80 px-2.5 py-0.5 text-xs font-semibold text-[#0056D2]">
                {program.type}
              </span>
            </div>

            {/* Title H1 */}
            <h1 className="text-2xl font-extrabold tracking-tight text-[#1F1F1F] sm:text-4xl lg:text-[40px] leading-[1.18]">
              {program.title}
            </h1>

            {/* Subtitle */}
            <p className="mt-3.5 text-base sm:text-lg text-gray-700 leading-relaxed">
              {program.subtitle}
            </p>

            {/* Instructor Line */}
            <div className="mt-5 flex items-center gap-2.5">
              <div className="relative size-7 shrink-0 overflow-hidden rounded-full border border-gray-200">
                <Image
                  src={program.instructorAvatar}
                  alt={program.instructor}
                  fill
                  sizes="28px"
                  className="object-cover"
                  unoptimized
                />
              </div>
              <span className="text-sm text-gray-700">
                Instructor:{" "}
                <Link href="#instructor" className="font-semibold text-[#0056D2] hover:underline">
                  {program.instructor}
                </Link>
              </span>
            </div>

            {/* CTA & Social Proof */}
            <div className="mt-7 flex flex-wrap items-center gap-4">
              <Link
                href="/daftar"
                className="inline-flex flex-col items-center justify-center rounded-lg bg-[#0056D2] px-8 py-3 text-white shadow-md transition-all hover:bg-[#00419e] active:scale-[0.98]"
              >
                <span className="text-base font-bold leading-tight">Enroll for free</span>
                <span className="text-xs text-blue-100">{program.startDate}</span>
              </Link>

              <span className="text-sm text-gray-700">
                <strong className="text-gray-900 font-bold">{program.enrolled}</strong> already enrolled
              </span>
            </div>

            {/* Included with Careevo PLUS */}
            <div className="mt-4 flex items-center gap-2 text-xs sm:text-sm text-gray-600">
              <span>
                Included with <strong className="text-[#00255D] font-bold">careevo PLUS</strong>
              </span>
              <span className="text-gray-400">•</span>
              <Link href="/careevo-plus" className="font-semibold text-[#0056D2] hover:underline">
                Learn more
              </Link>
            </div>
          </div>

          {/* Overlapping 4-Column Metric Card - Exactly 50% overlapping hero bottom border */}
          <div className="relative z-20 mt-10 sm:mt-12 translate-y-1/2">
            <div className="grid grid-cols-1 divide-y sm:divide-y-0 sm:divide-x divide-gray-200 rounded-xl border border-gray-200 bg-white p-2 shadow-lg shadow-gray-900/5 sm:grid-cols-2 lg:grid-cols-4">
              {/* Column 1: Course series */}
              <div className="p-4 sm:p-5">
                <div className="text-base font-bold text-gray-900 underline decoration-gray-300 underline-offset-4">
                  {program.seriesCount} course series
                </div>
                <p className="mt-1 text-xs text-gray-500 leading-normal">
                  Earn a career credential that demonstrates your expertise
                </p>
              </div>

              {/* Column 2: Rating & Reviews */}
              <div className="p-4 sm:p-5">
                <div className="flex items-center gap-1.5 text-base font-bold text-gray-900">
                  <span>{program.rating || 4.8}</span>
                  <Star className="size-4 fill-amber-400 text-amber-400" />
                </div>
                <p className="mt-1 text-xs text-gray-500 leading-normal">
                  from {program.reviews || "10,000+"} reviews of courses in this program
                </p>
              </div>

              {/* Column 3: Level */}
              <div className="p-4 sm:p-5">
                <div className="flex items-center gap-1.5 text-base font-bold text-gray-900">
                  <span>{program.level}</span>
                  <Info className="size-4 text-gray-400" />
                </div>
                <p className="mt-1 text-xs text-gray-500 leading-normal">
                  Recommended experience
                </p>
              </div>

              {/* Column 4: Schedule */}
              <div className="p-4 sm:p-5">
                <div className="text-base font-bold text-gray-900">
                  {program.pace || "Flexible schedule"}
                </div>
                <p className="mt-1 text-xs text-gray-500 leading-normal">
                  {program.durationWeeks} weeks at {program.hoursPerWeek} hours a week
                </p>
                <p className="mt-0.5 text-xs text-gray-400">
                  Learn at your own pace
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Spacer for bottom half of overlapping card */}
      <div className="h-16 sm:h-20 bg-white" aria-hidden="true" />

      {/* Tab Navigation Bar: About, Outcomes, Courses, Testimonials, Reviews */}
      <nav aria-label="Course section tabs" className="border-b border-gray-200 bg-white sticky top-16 z-10 backdrop-blur-md bg-white/95">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 py-3 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Link
              href="#about"
              className="rounded-full bg-[#EBF3FF] px-4 py-1.5 text-sm font-semibold text-[#0056D2]"
            >
              About
            </Link>
            <Link
              href="#outcomes"
              className="rounded-full px-4 py-1.5 text-sm font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            >
              Outcomes
            </Link>
            <Link
              href="#courses"
              className="rounded-full px-4 py-1.5 text-sm font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            >
              Courses
            </Link>
            <Link
              href="#testimonials"
              className="rounded-full px-4 py-1.5 text-sm font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            >
              Testimonials
            </Link>
            <Link
              href="#reviews"
              className="rounded-full px-4 py-1.5 text-sm font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            >
              Reviews
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
          {/* Main Column */}
          <div className="lg:col-span-8 space-y-10">
            {/* What you'll learn */}
            <section id="about" aria-labelledby="what-learn-heading" className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-2xs">
              <h2 id="what-learn-heading" className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">
                What you&apos;ll learn
              </h2>
              <div className="mt-6 space-y-4">
                {program.whatYouWillLearn.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <Check className="size-5 shrink-0 text-[#0056D2] mt-0.5" />
                    <p className="text-sm sm:text-base text-gray-700 leading-relaxed">{item}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Skills & Tools Section */}
            <section id="outcomes" className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-2xs space-y-8">
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-gray-900">Skills you&apos;ll gain</h3>
                <div className="mt-4 flex flex-wrap gap-2">
                  {program.skills.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-full border border-gray-200 bg-[#F5F7FA] px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-gray-800"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              <div className="border-t border-gray-100 pt-6">
                <h3 className="text-lg sm:text-xl font-bold text-gray-900">Tools you&apos;ll learn</h3>
                <div className="mt-4 flex flex-wrap gap-2">
                  {program.tools.map((tool) => (
                    <span
                      key={tool}
                      className="rounded-full border border-blue-200 bg-blue-50/70 px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-[#0056D2]"
                    >
                      {tool}
                    </span>
                  ))}
                </div>
              </div>
            </section>

            {/* Courses in this Specialization */}
            <section id="courses" aria-labelledby="courses-heading" className="space-y-6">
              <div>
                <h2 id="courses-heading" className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
                  Courses in this {program.type}
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  This program contains {program.seriesCount} courses that prepare you for verified mastery.
                </p>
              </div>

              <div className="space-y-4">
                {program.courses.map((c) => (
                  <div
                    key={c.number}
                    className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-2xs sm:flex-row sm:items-center sm:justify-between transition-all hover:border-gray-300 hover:shadow-xs"
                  >
                    <div className="flex items-start gap-4">
                      <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-xl bg-gray-100 border border-gray-200">
                        <Image
                          src={c.thumbnail}
                          alt={c.title}
                          fill
                          sizes="112px"
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 text-xs font-semibold text-[#0056D2]">
                          <span>Course {c.number}</span>
                          <span>•</span>
                          <span className="text-gray-500">{c.hours}</span>
                        </div>
                        <h4 className="mt-1 text-base font-bold text-gray-900 leading-snug">
                          {c.title}
                        </h4>
                        <p className="mt-1.5 line-clamp-2 text-xs sm:text-sm text-gray-600">
                          {c.description}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center justify-between sm:flex-col sm:items-end gap-2 border-t border-gray-100 pt-3 sm:border-0 sm:pt-0">
                      <div className="flex items-center gap-1 text-xs">
                        <Star className="size-3.5 fill-amber-500 text-amber-500" />
                        <span className="font-bold text-gray-900">{c.rating}</span>
                      </div>
                      <Link
                        href="/daftar"
                        className="text-xs font-bold text-[#0056D2] hover:underline"
                      >
                        Explore course →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Instructor Section */}
            <section id="instructor" className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-2xs">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">
                Instructor
              </h2>
              <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-start">
                <div className="relative size-20 shrink-0 overflow-hidden rounded-full border border-gray-200">
                  <Image
                    src={program.instructorAvatar}
                    alt={program.instructor}
                    fill
                    sizes="80px"
                    className="object-cover"
                    unoptimized
                  />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{program.instructor}</h3>
                  <p className="text-xs font-medium text-gray-500">{program.instructorRole}</p>
                  <p className="mt-3 text-sm text-gray-700 leading-relaxed">
                    {program.instructorBio}
                  </p>
                </div>
              </div>
            </section>
          </div>

          {/* Right Sidebar Info Card */}
          <aside className="lg:col-span-4 space-y-6">
            <div className="sticky top-28 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Program Details</h3>
                <p className="mt-1 text-xs text-gray-500">Everything you need to know before starting.</p>
              </div>

              <div className="space-y-4 border-t border-gray-100 pt-4 text-sm">
                <div className="flex items-start gap-3">
                  <Award className="size-5 shrink-0 text-[#0056D2] mt-0.5" />
                  <div>
                    <strong className="block text-gray-900 font-semibold">Shareable Certificate</strong>
                    <span className="text-xs text-gray-600">Add directly to your LinkedIn profile or Careevo Attestation CV.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Globe2 className="size-5 shrink-0 text-[#0056D2] mt-0.5" />
                  <div>
                    <strong className="block text-gray-900 font-semibold">Taught in English</strong>
                    <span className="text-xs text-gray-600">Subtitles and transcripts available in multiple languages.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Sparkles className="size-5 shrink-0 text-[#0056D2] mt-0.5" />
                  <div>
                    <strong className="block text-gray-900 font-semibold">Updated Regularly</strong>
                    <span className="text-xs text-gray-600">Current syllabus featuring modern AI tools and practical frameworks.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <ShieldCheck className="size-5 shrink-0 text-[#0056D2] mt-0.5" />
                  <div>
                    <strong className="block text-gray-900 font-semibold">HMAC Attestation Verified</strong>
                    <span className="text-xs text-gray-600">Tamper-proof completion attestations verifiable by employers.</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-5">
                <Link
                  href="/daftar"
                  className="chrome-btn chrome-btn-brand w-full !h-12 !text-base"
                >
                  <span>Enroll in Program</span>
                  <ArrowRight className="size-4" />
                </Link>
                <p className="mt-2 text-center text-xs text-gray-500">
                  Try free for 7 days, cancel anytime.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
