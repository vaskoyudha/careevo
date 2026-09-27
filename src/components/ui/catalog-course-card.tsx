"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ResourceFixture } from "@/lib/fixtures";
import { levelLabel } from "@/lib/onboarding/types";

/**
 * Kartu katalog kursus — komponen bersama untuk semua halaman yang menampilkan
 * entri katalog (`/belajar`, `/jelajah`). Anatominya diambil verbatim dari kartu
 * `CourseraCourseCard` di belajar-home: sampul 4:3 dengan pill kredensial,
 * baris penyedia (logo + nama), judul tebal yang membiru saat hover, baris
 * rating, satu baris meta, lalu footer dengan pill topik dan status akses.
 *
 * Data tidak pernah ditebak di sini: `CourseCardShell` hanya merender field
 * yang diberikan. `CatalogCourseCard` mengisi field itu lewat `courseMetaFor`
 * (tabel meta katalog + fallback berdasarkan id yang sama yang dipakai
 * `/belajar`), jadi kedua halaman menampilkan nilai yang sama untuk entri yang
 * sama.
 */

export interface CourseMeta {
  thumbnail: string;
  providerLogo?: string;
  credentialType:
    | "Sertifikat Profesional"
    | "Spesialisasi"
    | "Kursus"
    | "Proyek Terpandu";
  rating: number;
  reviews: string;
  skills: string[];
}

const COURSE_METAS: Record<string, CourseMeta> = {
  r1: {
    thumbnail: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=640&q=80",
    credentialType: "Kursus",
    rating: 4.8,
    reviews: "34k",
    skills: ["HTML5", "CSS3", "Responsive Design", "Flexbox"],
  },
  r2: {
    thumbnail: "https://images.unsplash.com/photo-1579468118864-1b9ea3c0db4a?auto=format&fit=crop&w=640&q=80",
    credentialType: "Spesialisasi",
    rating: 4.9,
    reviews: "48k",
    skills: ["JavaScript", "Promises", "Async/Await", "ES6+"],
  },
  r3: {
    thumbnail: "https://images.unsplash.com/photo-1633356122544-f134324a6cee?auto=format&fit=crop&w=640&q=80",
    credentialType: "Sertifikat Profesional",
    rating: 4.9,
    reviews: "52k",
    skills: ["React", "Hooks", "Component Lifecycle", "JSX"],
  },
  r4: {
    thumbnail: "https://images.unsplash.com/photo-1516116211227-bbc66e855a90?auto=format&fit=crop&w=640&q=80",
    providerLogo: "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://images.ctfassets.net/00atxywtfxvd/11pJTA8yOZPwVRMKnSKPRz/340cf59915e8ce0d3b993d39959972d6/eded33b5eb1694336861de4bfda6d36bf72b7780.png?auto=format%2Ccompress&dpr=1&w=24&h=24",
    credentialType: "Kursus",
    rating: 4.8,
    reviews: "29k",
    skills: ["TypeScript", "Generics", "Type Inference", "Interfaces"],
  },
  r5: {
    thumbnail: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=640&q=80",
    credentialType: "Proyek Terpandu",
    rating: 4.8,
    reviews: "15k",
    skills: ["Vitest", "Unit Testing", "TDD", "Mocking"],
  },
  r6: {
    thumbnail: "https://images.unsplash.com/photo-1618401471353-b98afee0b2eb?auto=format&fit=crop&w=640&q=80",
    credentialType: "Kursus",
    rating: 4.9,
    reviews: "67k",
    skills: ["Git", "GitHub", "Branching", "Merge Conflicts"],
  },
  r7: {
    thumbnail: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=640&q=80",
    credentialType: "Sertifikat Profesional",
    rating: 4.8,
    reviews: "41k",
    skills: ["Node.js", "Express", "RESTful API", "Middleware"],
  },
  r8: {
    thumbnail: "https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?auto=format&fit=crop&w=640&q=80",
    credentialType: "Kursus",
    rating: 4.7,
    reviews: "12k",
    skills: ["WCAG 2.2", "ARIA", "Screen Readers", "Color Contrast"],
  },
  r9: {
    thumbnail: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=640&q=80",
    providerLogo: "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://images.ctfassets.net/00atxywtfxvd/11pJTA8yOZPwVRMKnSKPRz/340cf59915e8ce0d3b993d39959972d6/eded33b5eb1694336861de4bfda6d36bf72b7780.png?auto=format%2Ccompress&dpr=1&w=24&h=24",
    credentialType: "Proyek Terpandu",
    rating: 4.9,
    reviews: "19k",
    skills: ["Playwright", "E2E Testing", "Browser Automation"],
  },
  r10: {
    thumbnail: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=640&q=80",
    credentialType: "Spesialisasi",
    rating: 4.8,
    reviews: "22k",
    skills: ["Zustand", "Jotai", "State Management", "React"],
  },
  r11: {
    thumbnail: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=640&q=80",
    credentialType: "Sertifikat Profesional",
    rating: 4.9,
    reviews: "38k",
    skills: ["Next.js 15", "App Router", "Server Actions", "Streaming"],
  },
  r12: {
    thumbnail: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=640&q=80",
    providerLogo: "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://images.ctfassets.net/00atxywtfxvd/3ZIhQ7yxmgGMFZGtlqpCG6/0d0f40bc5133948bb3805cab25af62ba/Google-G_360x360.png?auto=format%2Ccompress&dpr=1&w=24&h=24",
    credentialType: "Kursus",
    rating: 4.8,
    reviews: "26k",
    skills: ["Lighthouse", "Core Web Vitals", "LCP", "CLS"],
  },
  r13: {
    thumbnail: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=640&q=80",
    credentialType: "Kursus",
    rating: 4.9,
    reviews: "31k",
    skills: ["Tailwind CSS", "Design Tokens", "Design System"],
  },
  r14: {
    thumbnail: "https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=640&q=80",
    credentialType: "Spesialisasi",
    rating: 4.9,
    reviews: "44k",
    skills: ["Web Security", "OWASP Top 10", "XSS", "CSRF"],
  },
  r15: {
    thumbnail: "https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&w=640&q=80",
    credentialType: "Sertifikat Profesional",
    rating: 4.95,
    reviews: "58k",
    skills: ["Algoritma", "Struktur Data", "Interview Tech", "Big-O"],
  },
  "crs-1": {
    thumbnail: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=640&q=80",
    credentialType: "Sertifikat Profesional",
    rating: 4.9,
    reviews: "42k",
    skills: ["Next.js 15", "React 19", "Fullstack", "Tailwind v4"],
  },
  "crs-2": {
    thumbnail: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=640&q=80",
    credentialType: "Spesialisasi",
    rating: 4.8,
    reviews: "28k",
    skills: ["Node.js", "Express", "HMAC Auth", "Zod"],
  },
  "crs-3": {
    thumbnail: "https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=640&q=80",
    credentialType: "Sertifikat Profesional",
    rating: 4.95,
    reviews: "35k",
    skills: ["OWASP Top 10", "Penetration Testing", "Audit", "Cryptography"],
  },
  "crs-4": {
    thumbnail: "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://d15cw65ipctsrr.cloudfront.net/60/097644c12e4aeba0c3420de571cac1/GCC-Coursera-thumbnail-DA-foundations-tony-cert-level.png?auto=format%2C%20compress%2C%20enhance&dpr=1&w=320&h=180&fit=crop&q=50",
    providerLogo: "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://images.ctfassets.net/00atxywtfxvd/3ZIhQ7yxmgGMFZGtlqpCG6/0d0f40bc5133948bb3805cab25af62ba/Google-G_360x360.png?auto=format%2Ccompress&dpr=1&w=24&h=24",
    credentialType: "Sertifikat Profesional",
    rating: 4.8,
    reviews: "89k",
    skills: ["Python", "Pandas", "Matplotlib", "Data Analytics"],
  },
  "crs-5": {
    thumbnail: "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://coursera-course-photos.s3.amazonaws.com/87/f53a62e6c84b5c9be99db814e19f00/juleswhite_3d_colorful_volumeric_organic_rounded_vibrant_highly_ed068faa-2a26-4d84-94b6-5cbfb2614a39.png?auto=format%2C%20compress%2C%20enhance&dpr=1&w=320&h=180&fit=crop&q=50",
    providerLogo: "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://images.ctfassets.net/00atxywtfxvd/B6gbch3CrIAfBm9F0GpE5/51c6f4fbaf2b25ef11fce8ef9563b7d9/Icon.png?auto=format%2Ccompress&dpr=1&w=24&h=24",
    credentialType: "Sertifikat Profesional",
    rating: 4.9,
    reviews: "62k",
    skills: ["Machine Learning", "Prompt Engineering", "LLM Evaluation", "RAG"],
  },
};

const FALLBACK_THUMBNAILS = [
  "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=640&q=80",
  "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=640&q=80",
  "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=640&q=80",
  "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=640&q=80",
];

export function courseMetaFor(resource: ResourceFixture): CourseMeta {
  // Sampul unggahan admin menang atas apa pun yang hardcoded di bawah: kalau
  // admin sudah mengganti gambar kursus, thumbnail bawaan harus mengalah.
  if (resource.cover_image) {
    const bawaan = COURSE_METAS[resource.id];
    const hash = resource.id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return {
      thumbnail: resource.cover_image,
      providerLogo: bawaan?.providerLogo,
      credentialType: bawaan?.credentialType ?? "Kursus",
      rating: bawaan?.rating ?? 4.8,
      reviews: bawaan?.reviews ?? `${(hash % 40) + 12}k`,
      skills: bawaan?.skills ?? resource.tags.slice(0, 3),
    };
  }
  if (COURSE_METAS[resource.id]) return COURSE_METAS[resource.id];
  const hash = resource.id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return {
    thumbnail: FALLBACK_THUMBNAILS[hash % FALLBACK_THUMBNAILS.length],
    credentialType: "Kursus",
    rating: 4.8,
    reviews: `${(hash % 40) + 12}k`,
    skills: resource.tags.slice(0, 3),
  };
}

/** Logo penyedia; jatuh ke inisial merek saat logo tidak ada atau gagal dimuat. */
function ProviderMark({ logo, provider }: { logo?: string; provider: string }) {
  const [errored, setErrored] = useState(false);

  if (logo && !errored) {
    return (
      <div className="relative size-5 shrink-0 overflow-hidden rounded-sm">
        <Image
          src={logo}
          alt={provider}
          fill
          sizes="20px"
          className="object-contain"
          onError={() => setErrored(true)}
        />
      </div>
    );
  }

  return (
    <span
      aria-hidden="true"
      className="inline-flex size-5 shrink-0 items-center justify-center rounded-sm bg-[#0056D2] text-[10px] font-bold text-white uppercase"
    >
      {provider.charAt(0)}
    </span>
  );
}

/**
 * Sampul 16:9; jatuh ke blok merek penyedia saat gambar tidak ada atau gagal.
 *
 * Diekspor supaya kartu progres di `/progres` memakai aturan yang sama — satu
 * tempat yang menentukan apa yang terjadi ketika sampul hilang atau host-nya
 * tidak bisa dimuat, bukan dua.
 */
export function ThumbMedia({
  src,
  alt,
  provider,
  sizes,
}: {
  src?: string;
  alt: string;
  provider: string;
  sizes: string;
}) {
  const [errored, setErrored] = useState(false);

  if (src && !errored) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        className="object-cover transition-transform duration-300 group-hover:scale-105"
        onError={() => setErrored(true)}
      />
    );
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-linear-to-br from-[#e2eef4] via-[#ecf3f7] to-[#cbe6ef] p-5">
      <span className="line-clamp-2 text-center text-[13px] leading-snug font-semibold text-[#0a3d62]">
        {provider}
      </span>
    </div>
  );
}

export interface CourseCardShellProps {
  href: string;
  title: string;
  provider: string;
  providerLogo?: string;
  thumbnail?: string;
  /** Pill di pojok kiri-atas sampul. */
  credentialType?: string;
  rating?: number;
  reviews?: string;
  /** Satu baris meta di bawah rating, mis. "Pemula · 120 mnt". */
  metaLine?: string;
  /** Pill footer kiri, mis. tag topik. */
  tagLabel?: string;
  /** Teks footer kanan, mis. "Gratis" / "Careevo Plus". */
  footerNote?: string;
  /** Konteks ukuran: rail memakai lebar tetap, grid membiarkan kartu melebar. */
  className?: string;
  titleClassName?: string;
  imageSizes?: string;
}

export function CourseCardShell({
  href,
  title,
  provider,
  providerLogo,
  thumbnail,
  credentialType,
  rating,
  reviews,
  metaLine,
  tagLabel,
  footerNote,
  className,
  titleClassName,
  imageSizes = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw",
}: CourseCardShellProps) {
  return (
    <article
      className={cn(
        "group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xs transition-shadow duration-200 hover:shadow-md",
        className,
      )}
    >
      <Link
        href={href}
        aria-label={`Lihat detail ${title}`}
        className="relative block aspect-[4/3] w-full overflow-hidden bg-gray-100 hover:no-underline"
      >
        <ThumbMedia src={thumbnail} alt={title} provider={provider} sizes={imageSizes} />
        {credentialType ? (
          <span className="absolute top-2.5 left-2.5 rounded-md bg-white/95 px-2 py-0.5 text-[11px] font-semibold text-gray-800 shadow-xs backdrop-blur-xs">
            {credentialType}
          </span>
        ) : null}
      </Link>

      <div className="relative z-10 -mt-8 flex flex-1 flex-col rounded-t-2xl bg-white p-4">
        <div className="mb-2 flex items-center gap-2">
          <ProviderMark logo={providerLogo} provider={provider} />
          <span className="truncate text-xs font-medium text-gray-600">{provider}</span>
        </div>

        <h3
          className={cn(
            "mb-1.5 line-clamp-2 min-h-[2.6rem] text-sm font-bold text-gray-900 group-hover:text-[#0056D2]",
            titleClassName,
          )}
        >
          <Link href={href} className="hover:no-underline">
            {title}
          </Link>
        </h3>

        {rating != null ? (
          <div className="mb-3 flex items-center gap-1.5 text-xs">
            <div className="flex items-center text-[#eb8a04]">
              <Star className="size-3.5 fill-[#eb8a04] text-[#eb8a04]" />
              <span className="ml-1 font-bold text-gray-900">{rating}</span>
            </div>
            <span className="text-gray-400">·</span>
            <span className="text-gray-500">({reviews})</span>
          </div>
        ) : null}

        {metaLine ? <p className="mb-3 text-[11px] text-gray-500">{metaLine}</p> : null}

        <div className="mt-auto flex items-center justify-between border-t border-gray-100 pt-3">
          {tagLabel ? (
            <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-[#0056D2]">
              {tagLabel}
            </span>
          ) : (
            <span aria-hidden="true" />
          )}
          {footerNote ? (
            <span className="text-xs font-semibold text-gray-700">{footerNote}</span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function CatalogCourseCard({
  resource,
  href,
  className,
}: {
  resource: ResourceFixture;
  href: string;
  className?: string;
}) {
  const meta = courseMetaFor(resource);
  return (
    <CourseCardShell
      href={href}
      className={className}
      title={resource.title}
      provider={resource.provider}
      providerLogo={meta.providerLogo}
      thumbnail={meta.thumbnail}
      credentialType={meta.credentialType}
      rating={meta.rating}
      reviews={meta.reviews}
      metaLine={`${levelLabel(resource.level)} · ${resource.duration_min} mnt`}
      tagLabel={resource.tags[0] ?? "Teknologi"}
      footerNote={resource.is_free ? "Gratis" : "Careevo Plus"}
    />
  );
}
