"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Landing-page menu. These are in-page anchors so visitors can explore the
 * value of the plan (skills, benefits, testimonials, pricing, FAQ) before
 * being sent off to the course/module catalogue.
 */
const NAV_LINKS = [
  { href: "#keahlian", label: "Keahlian" },
  { href: "#keunggulan", label: "Keunggulan" },
  { href: "#testimoni", label: "Testimoni" },
  { href: "#paket", label: "Paket & Harga" },
  { href: "#faq", label: "FAQ" },
];

/**
 * Careevo Plus sub-navigation + promo banner.
 * Mirrors the sticky "Careevo Plus" bar and the "Save 40%" ribbon
 * that sit directly under the global nav on the original page.
 */
export function CareevoPlusSubNav() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="border-b border-gray-100 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 lg:px-6">
        <Link
          href="#main"
          className="shrink-0 text-lg font-semibold tracking-tight text-gray-900"
        >
          Care<span className="text-blue-500">evo</span> Plus
        </Link>

        {/* Desktop section menu */}
        <nav
          aria-label="Navigasi halaman Careevo Plus"
          className="hidden items-center gap-1 lg:flex"
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors duration-300 ease-in-out hover:bg-gray-50 hover:text-gray-900"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="#paket"
            className="grad-btn rounded-lg px-4 py-2 text-sm font-medium transition duration-300 ease-in-out"
          >
            Hemat 40% sekarang
          </Link>

          {/* Mobile menu toggle */}
          <button
            type="button"
            aria-expanded={menuOpen}
            aria-label="Buka menu navigasi"
            onClick={() => setMenuOpen((value) => !value)}
            className="inline-flex size-9 cursor-pointer items-center justify-center rounded-lg border border-gray-200 text-gray-700 transition-colors duration-300 ease-in-out hover:bg-gray-50 lg:hidden"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              {menuOpen ? (
                <>
                  <path d="M6 6l12 12" />
                  <path d="M18 6 6 18" />
                </>
              ) : (
                <>
                  <path d="M4 7h16" />
                  <path d="M4 12h16" />
                  <path d="M4 17h16" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile section menu */}
      <nav
        aria-label="Navigasi halaman Careevo Plus"
        className={cn(
          "overflow-hidden border-t border-gray-100 lg:hidden",
          menuOpen ? "block" : "hidden",
        )}
      >
        <div className="mx-auto flex max-w-7xl flex-col px-4 py-2 lg:px-6">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="rounded-lg px-3 py-3 text-sm font-medium text-gray-600 transition-colors duration-300 ease-in-out hover:bg-gray-50 hover:text-gray-900"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}

export function CareevoPlusPromoBanner() {
  return (
    <div className="border-b border-blue-100 bg-blue-50/70">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-1 px-4 py-2.5 text-center text-sm sm:flex-row sm:justify-center sm:gap-2 lg:px-6">
        <span className="font-semibold text-blue-700">Berakhir hari ini!</span>
        <span className="text-gray-600">
          Berkembang sesuai jadwalmu dengan diskon besar untuk Careevo Plus.
        </span>
        <Link
          href="#paket"
          className="font-medium text-blue-600 underline underline-offset-2 transition-opacity hover:opacity-75"
        >
          Hemat 40% selama 3 bulan
        </Link>
      </div>
    </div>
  );
}
