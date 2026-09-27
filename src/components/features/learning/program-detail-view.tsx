"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
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
import { HeroSubNav } from "@/components/ui/hero-subnav";
import { DitheredHeroBackdrop } from "@/components/features/learning/dithered-hero-backdrop";
import type { ProgramDetails } from "@/lib/courses/catalog-data";
import {
  kategoriProgram,
  kredensialProgram,
  keterampilanProgram,
  levelProgram,
  mulaiProgram,
  subkategoriProgram,
} from "@/components/features/dashboard/jelajah/format";

export function ProgramDetailView({ program }: { program: ProgramDetails }) {
  return <ProgramDetail program={program} />;
}

/**
 * Isi halaman. Wrapper client hanya untuk `useRef` hero: `HeroSubNav`
 * memicunya dari elemen hero yang benar-benar keluar dari viewport, karena
 * tinggi hero di sini berubah-ubah mengikuti judul program dan jumlah seri.
 *
 * Kolom `type`, `level`, `startDate`, `category`, `subcategory`, dan `skills`
 * **tidak pernah dirender apa adanya** — semuanya lewat `format.ts`. Nilai di
 * `catalog-data.ts` sengaja tetap bahasa Inggris karena `explore-queries.ts`
 * mencocokkannya dengan string literal untuk `/browse`, `/search`, dan
 * `/career-academy/roles`; dengan menambahkan idiom Indonesia di sini, halaman
 * ini berhenti menjadi satu-satunya tempat yang menampilkan "Beginner level".
 */
function ProgramDetail({ program }: { program: ProgramDetails }) {
  const heroRef = useRef<HTMLElement>(null);

  return (
    // `under-chrome`, bukan margin negatif yang diketik manual: navbar
    // `position: sticky` memakan tinggi sungguhan di flow, dan hero di sini
    // harus mulai tepat di y=0 agar bar transparan mengambang di atasnya. Angka
    // yang dipakai sebelumnya (60) bukan tinggi bar — 66px di desktop, 62px di
    // mobile — jadi enam piksel latar halaman tersingkap sebagai pita putih di
    // atas layar. Satu pengukuran ada di `--chrome-h`; lihat `.under-chrome`.
    <div className="under-chrome relative min-h-screen bg-white text-gray-900 overflow-x-hidden">
      <HeroSubNav
        trigger={heroRef}
        badge={kredensialProgram(program.type)}
        title={program.title}
        subtitle={`${program.seriesCount} seri kursus · ${levelProgram(program.level)}`}
        cta={{ href: "/daftar", label: "Daftar gratis" }}
      />
      {/* Hero Section: dithered bit field (lihat catatan di `detail-kursus.tsx`) */}
      <header
        ref={heroRef}
        className="relative z-10 w-full border-b border-gray-200/80 pt-36 sm:pt-32 md:pt-36 lg:pt-40 pb-0"
      >
        <div className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-hidden select-none">
          {/* Ground: gradien biru langit + dot grid sebagai fallback dither */}
          <div className="absolute inset-0 z-0 bg-[linear-gradient(170deg,#8FC0F2_0%,#7DD3FC_20%,#BAE6FD_46%,#DDEEFE_76%,#F2F9FF_100%)]" />
          <div className="absolute inset-0 z-0 bg-[size:3px_3px] [background-image:radial-gradient(rgba(10,61,98,0.16)_1px,transparent_1px)]" />

          {/* Dither: Bayer ordered-dither + posterise, grid dikunci ke piksel canvas */}
          <DitheredHeroBackdrop
            videoSrc="/videos/hero-sterly.mp4"
            levels={4}
            ditherScale={2}
            zoom={1}
            focusY={0.45}
          />

          {/* Halo lembut supaya teks tinta tetap terbaca di atas stipple */}
          <div className="absolute inset-0 z-10 bg-[radial-gradient(ellipse_78%_62%_at_50%_38%,rgba(255,255,255,0.78)_0%,rgba(255,255,255,0.34)_52%,transparent_84%)]" />

          {/* Transisi bawah ke badan halaman putih */}
          <div className="absolute inset-x-0 bottom-0 z-10 h-20 sm:h-28 bg-gradient-to-t from-white via-white/75 to-transparent" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Top Breadcrumb Trail inside Hero */}
          <nav aria-label="Jejak navigasi" className="mb-6">
            <ol className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-gray-600">
              <li className="flex items-center gap-1.5">
                <Link href="/" className="flex items-center gap-1 text-gray-500 hover:text-gray-900 transition-colors">
                  <Home className="size-3.5" />
                  <span className="sr-only">Beranda</span>
                </Link>
                <ChevronRight className="size-3 text-gray-400" />
              </li>
              <li className="flex items-center gap-1.5">
                <Link href="/explore/most-popular-courses" className="hover:text-gray-900 transition-colors">
                  Kategori
                </Link>
                <ChevronRight className="size-3 text-gray-400" />
              </li>
              <li className="flex items-center gap-1.5">
                <Link href="/explore/most-popular-courses" className="hover:text-gray-900 transition-colors">
                  {kategoriProgram(program.category)}
                </Link>
                <ChevronRight className="size-3 text-gray-400" />
              </li>
              <li className="text-gray-900 font-medium truncate max-w-[200px] sm:max-w-none">
                {subkategoriProgram(program.subcategory)}
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
                {kredensialProgram(program.type)}
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
                Pengajar:{" "}
                <Link href="#instructor" className="font-semibold text-[#0056D2]">
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
                <span className="text-base font-bold leading-tight">Daftar gratis</span>
                <span className="text-xs text-blue-100">{mulaiProgram(program.startDate)}</span>
              </Link>

              <span className="text-sm text-gray-700">
                <strong className="text-gray-900 font-bold">{program.enrolled}</strong> sudah mendaftar
              </span>
            </div>

            {/* Included with Careevo PLUS */}
            <div className="mt-4 flex items-center gap-2 text-xs sm:text-sm text-gray-600">
              <span>
                Termasuk dalam <strong className="text-[#00255D] font-bold">careevo PLUS</strong>
              </span>
              <span className="text-gray-400">•</span>
              <Link href="/careevo-plus" className="font-semibold text-[#0056D2]">
                Selengkapnya
              </Link>
            </div>
          </div>

          {/* Overlapping 4-Column Metric Card - Exactly 50% overlapping hero bottom border */}
          <div className="relative z-20 mt-10 sm:mt-12 translate-y-1/2">
            <div className="grid grid-cols-1 divide-y sm:divide-y-0 sm:divide-x divide-gray-200 rounded-xl border border-gray-200 bg-white p-2 shadow-lg shadow-gray-900/5 sm:grid-cols-2 lg:grid-cols-4">
              {/* Column 1: Course series */}
              <div className="p-4 sm:p-5">
                <div className="text-base font-bold text-gray-900 underline decoration-gray-300 underline-offset-4">
                  {program.seriesCount} seri kursus
                </div>
                <p className="mt-1 text-xs text-gray-500 leading-normal">
                  Dapatkan kredensial karier yang membuktikan keahlianmu
                </p>
              </div>

              {/* Column 2: Rating & Reviews */}
              <div className="p-4 sm:p-5">
                <div className="flex items-center gap-1.5 text-base font-bold text-gray-900">
                  <span>{program.rating || 4.8}</span>
                  <Star className="size-4 fill-amber-400 text-amber-400" />
                </div>
                <p className="mt-1 text-xs text-gray-500 leading-normal">
                  dari {program.reviews || "10,000+"} ulasan kursus dalam program ini
                </p>
              </div>

              {/* Column 3: Level */}
              <div className="p-4 sm:p-5">
                <div className="flex items-center gap-1.5 text-base font-bold text-gray-900">
                  <span>{levelProgram(program.level)}</span>
                  <Info className="size-4 text-gray-400" />
                </div>
                <p className="mt-1 text-xs text-gray-500 leading-normal">
                  Pengalaman yang disarankan
                </p>
              </div>

              {/* Column 4: Schedule */}
              <div className="p-4 sm:p-5">
                <div className="text-base font-bold text-gray-900">
                  {program.pace || "Jadwal fleksibel"}
                </div>
                <p className="mt-1 text-xs text-gray-500 leading-normal">
                  {program.durationWeeks} minggu, {program.hoursPerWeek} jam per minggu
                </p>
                <p className="mt-0.5 text-xs text-gray-400">
                  Belajar dengan kecepatanmu sendiri
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Spacer for bottom half of overlapping card */}
      <div className="h-16 sm:h-20 bg-white" aria-hidden="true" />

      {/* Tab Navigation Bar: About, Outcomes, Courses, Testimonials, Reviews */}
      {/* `subnav-sticky-flush`, bukan `top-16`: 64px adalah tinggi navbar versi
          lama, sedangkan pil mengambang berakhir di 78px — jadi strip ini sudah
          tersembunyi sebagian di bawah navbar, dan ditambah sub-header jadi
          lebih buruk. Flush tanpa celah karena strip ini lanjutan dari satu
          stack yang sama, bukan pita tersendiri. */}
      <nav
        aria-label="Tab bagian program"
        className="subnav-sticky-flush border-b border-gray-200 bg-white/95 sticky z-10 backdrop-blur-md"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 py-3 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Link
              href="#about"
              className="rounded-full bg-[#EBF3FF] px-4 py-1.5 text-sm font-semibold text-[#0056D2]"
            >
              Tentang
            </Link>
            <Link
              href="#outcomes"
              className="rounded-full px-4 py-1.5 text-sm font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            >
              Hasil Belajar
            </Link>
            <Link
              href="#courses"
              className="rounded-full px-4 py-1.5 text-sm font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            >
              Kursus
            </Link>
            <Link
              href="#testimonials"
              className="rounded-full px-4 py-1.5 text-sm font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            >
              Testimoni
            </Link>
            <Link
              href="#reviews"
              className="rounded-full px-4 py-1.5 text-sm font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            >
              Ulasan
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
            <section id="about" aria-labelledby="what-learn-heading" className="subnav-scroll-mt-deep rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-2xs">
              <h2 id="what-learn-heading" className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">
                Yang akan kamu kuasai
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
            <section id="outcomes" className="subnav-scroll-mt-deep rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-2xs space-y-8">
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-gray-900">Keterampilan yang kamu dapatkan</h3>
                <div className="mt-4 flex flex-wrap gap-2">
                  {keterampilanProgram(program.skills).map((skill) => (
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
                <h3 className="text-lg sm:text-xl font-bold text-gray-900">Perangkat yang akan kamu pakai</h3>
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
            <section id="courses" aria-labelledby="courses-heading" className="subnav-scroll-mt-deep space-y-6">
              <div>
                <h2 id="courses-heading" className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
                  Kursus dalam {kredensialProgram(program.type)} ini
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  Program ini berisi {program.seriesCount} kursus yang disiapkan untuk penguasaan terverifikasi.
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
                          <span>Kursus {c.number}</span>
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
                        className="text-xs font-bold text-[#0056D2]"
                      >
                        Lihat kursus →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Instructor Section */}
            <section id="instructor" className="subnav-scroll-mt-deep rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-2xs">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">
                Pengajar
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
            {/* `subnav-sticky-deep`, bukan `top-28`: kolom ini diam di bawah
                strip tab yang juga lengket, jadi harus consenting clearance
                navbar + sub-header + strip. `top-28` (112px) dan
                `subnav-sticky-top` (147px) keduanya jatuh di dalam strip
                (131-188px) dan menutupi 53px kepalanya. */}
            <div className="subnav-sticky-deep sticky rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Detail Program</h3>
                <p className="mt-1 text-xs text-gray-500">Semua yang perlu kamu tahu sebelum mulai.</p>
              </div>

              <div className="space-y-4 border-t border-gray-100 pt-4 text-sm">
                <div className="flex items-start gap-3">
                  <Award className="size-5 shrink-0 text-[#0056D2] mt-0.5" />
                  <div>
                    <strong className="block text-gray-900 font-semibold">Sertifikat untuk Portofolio</strong>
                    <span className="text-xs text-gray-600">Tambahkan langsung ke profil LinkedIn atau CV Atestasi Careevo.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Globe2 className="size-5 shrink-0 text-[#0056D2] mt-0.5" />
                  <div>
                    <strong className="block text-gray-900 font-semibold">Materi dalam Bahasa Inggris</strong>
                    <span className="text-xs text-gray-600">Subtitle dan transkrip tersedia dalam beberapa bahasa.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Sparkles className="size-5 shrink-0 text-[#0056D2] mt-0.5" />
                  <div>
                    <strong className="block text-gray-900 font-semibold">Diperbarui Rutin</strong>
                    <span className="text-xs text-gray-600">Silabus terkini dengan perangkat AI modern dan kerangka kerja praktis.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <ShieldCheck className="size-5 shrink-0 text-[#0056D2] mt-0.5" />
                  <div>
                    <strong className="block text-gray-900 font-semibold">Atestasi HMAC Terverifikasi</strong>
                    <span className="text-xs text-gray-600">Atestasi penyelesaian yang tahan diubah dan dapat diverifikasi oleh perekrut.</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-5">
                <Link
                  href="/daftar"
                  className="chrome-btn chrome-btn-brand w-full !h-12 !text-base"
                >
                  <span>Daftar ke Program</span>
                  <ArrowRight className="size-4" />
                </Link>
                <p className="mt-2 text-center text-xs text-gray-500">
                  Coba gratis 7 hari, batalkan kapan saja.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
