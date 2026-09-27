"use client";

import { useState } from "react";
import Link from "next/link";
import { ScrollSubNav } from "@/components/ui/scroll-subnav";

/**
 * Careevo Plus promo banner — a deep-navy ribbon announcing the annual
 * "2 bulan gratis" saving. No countdown, no fixed expiry: the saving is a
 * standing property of the annual plan, not a campaign.
 */
export function CareevoPlusPromoBanner({
  href = "#paket",
}: {
  href?: string;
}) {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <div className="relative bg-[#001738] border-b border-white/10">
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 px-4 py-2.5 pr-10 text-center text-xs sm:text-sm lg:px-6">
        <span className="font-bold text-white">Hemat 2 bulan</span>
        <span className="text-blue-100/90">
          dengan langganan tahunan Careevo Plus.{" "}
        </span>
        <Link
          href={href}
          className="font-semibold text-white underline underline-offset-2 transition-opacity hover:opacity-85"
        >
          Lihat paket Plus
        </Link>
      </div>
      <button
        type="button"
        onClick={() => setVisible(false)}
        className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer p-1 text-blue-200/70 transition-colors hover:text-white"
        aria-label="Tutup banner"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M1 1l12 12" />
          <path d="M13 1 1 13" />
        </svg>
      </button>
    </div>
  );
}

/**
 * Careevo Plus sub-navigation — appears as a sticky header once the hero has
 * scrolled past.
 *
 * In the Coursera Plus reference, the top view transitions straight from
 * the promo banner to the vibrant royal blue hero. The subnav bar slides
 * in as a sticky header when scrolling down past the hero.
 *
 * The reveal itself belongs to `ScrollSubNav` (shared with `/belajar/[slug]`);
 * this file only supplies the contents. The threshold stays the one this page
 * was built around (the hero is ~360px tall) — the course page, whose header
 * height varies with the course title, measures its own instead.
 */
export function CareevoPlusSubNav() {
  return (
    <ScrollSubNav ambang={360}>
      <Link
        href="#main"
        className="flex min-w-0 shrink items-center gap-1.5 text-lg font-bold tracking-tight text-gray-900"
      >
        <span>Care<span className="text-[#0056D2]">evo</span></span>
        <span className="shrink-0 rounded-[3px] border border-[#0056D2] px-1 text-[10px] font-bold text-[#0056D2]">
          PLUS
        </span>
      </Link>
      {/* The CTA keeps its `shrink-0` but tightens its padding on the narrowest
          screens: full desktop padding overflowed `subnav-inner` by ~1px at
          320px. */}
      <Link
        href="#paket"
        className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-[#0056D2] px-3 text-sm font-semibold whitespace-nowrap text-white shadow-xs transition-colors duration-200 hover:bg-[#0046ab] sm:px-5"
      >
        Lihat paket Plus
      </Link>
    </ScrollSubNav>
  );
}
