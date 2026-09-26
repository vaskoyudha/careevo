"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

/**
 * Careevo Plus promo banner — sleek deep-navy ribbon matching the original
 * "Ends today! Grow on your schedule with big savings..." banner in Coursera Plus.
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
        <span className="font-bold text-white">Berakhir hari ini!</span>
        <span className="text-blue-100/90">
          Berkembang sesuai jadwalmu dengan diskon besar untuk Careevo Plus.{" "}
        </span>
        <Link
          href={href}
          className="font-semibold text-white underline underline-offset-2 transition-opacity hover:opacity-85"
        >
          Hemat 40% selama 3 bulan
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
 * Careevo Plus sub-navigation — sticky on scroll only.
 * In the Coursera Plus reference, the top view transitions straight from
 * the promo banner to the vibrant royal blue hero. The subnav bar slides
 * in as a sticky header when scrolling down past the hero.
 */
export function CareevoPlusSubNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 360);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (!scrolled) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 border-b border-gray-200 bg-white/95 shadow-sm backdrop-blur-md transition-all duration-300">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 lg:px-6">
        <Link
          href="#main"
          className="flex items-center gap-1.5 text-lg font-bold tracking-tight text-gray-900"
        >
          <span>Care<span className="text-[#0056D2]">evo</span></span>
          <span className="rounded-[3px] border border-[#0056D2] px-1 text-[10px] font-bold text-[#0056D2]">
            PLUS
          </span>
        </Link>
        <Link
          href="#paket"
          className="inline-flex h-9 items-center justify-center rounded-lg bg-[#0056D2] px-5 text-sm font-semibold text-white shadow-xs transition-colors duration-200 hover:bg-[#0046ab]"
        >
          Hemat 40% sekarang
        </Link>
      </div>
    </div>
  );
}
