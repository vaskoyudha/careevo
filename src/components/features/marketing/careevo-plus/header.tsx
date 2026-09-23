"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * Careevo Plus promo banner — dark bar matching the original
 * "Ends today! Grow on your schedule..." ribbon.
 */
export function CareevoPlusPromoBanner() {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <div className="relative bg-gray-900">
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 px-4 py-2.5 pr-10 text-center text-sm lg:px-6">
        <span className="font-semibold text-white">Berakhir hari ini!</span>
        <span className="text-gray-300">
          Berkembang sesuai jadwalmu dengan diskon besar untuk Careevo Plus.{" "}
        </span>
        <Link
          href="#paket"
          className="font-medium text-white underline underline-offset-2 transition-opacity hover:opacity-75"
        >
          Hemat 40% selama 3 bulan
        </Link>
      </div>
      <button
        type="button"
        onClick={() => setVisible(false)}
        className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-gray-400 transition-colors hover:text-white"
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
 * Careevo Plus sub-navigation — logo left, CTA button right.
 * Mirrors the secondary bar on the original page.
 */
export function CareevoPlusSubNav() {
  return (
    <div className="border-b border-gray-100 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 lg:px-6">
        <Link
          href="#main"
          className="shrink-0 text-lg font-semibold tracking-tight text-gray-900"
        >
          Care<span className="text-blue-500">evo</span> Plus
        </Link>
        <Link
          href="#paket"
          className="grad-btn rounded-lg px-5 py-2.5 text-sm font-medium transition duration-300 ease-in-out"
        >
          Hemat 40% sekarang
        </Link>
      </div>
    </div>
  );
}
