"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { Compass, ChevronDown } from "./icons";
import {
  ROLES,
  CATEGORIES,
  CERTIFICATES,
  DEGREES,
  TRENDING_SKILLS,
  CERTIFICATION_PREP_VIEW_ALL,
  EXPLORE_FALLBACKS,
} from "@/lib/courses/explore-taxonomy";

export function ExploreMenu({ isDarkBg = false }: { isDarkBg?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCloseTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const open = useCallback(() => {
    clearCloseTimeout();
    setIsOpen(true);
  }, [clearCloseTimeout]);

  const scheduleClose = useCallback(() => {
    clearCloseTimeout();
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 180);
  }, [clearCloseTimeout]);

  const closeImmediately = useCallback(() => {
    clearCloseTimeout();
    setIsOpen(false);
  }, [clearCloseTimeout]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      clearCloseTimeout();
    };
  }, [clearCloseTimeout]);

  // Close on click outside or escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        closeImmediately();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeImmediately();
        buttonRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, closeImmediately]);

  const columnClass = "flex flex-col justify-start mb-6 min-w-[149px]";
  const headingClass = "mb-2 text-base leading-7 font-normal text-[#0D0F12]";
  // Coursera: a { padding: 8px 0 } + li { padding: 0 0 4px } -> tinggi item
  // 20+16 = 36px, tapi jarak antar teks item = 24px (8+16). Pitch.item
  // di DOM asli: 24px. Pakai pt-2 pb-1 (8+4) supaya pitch = 24px.
  const listClass = "flex flex-col";
  const itemClass =
    "block pt-2 pb-1 text-sm leading-5 font-normal text-[#0D0F12] transition-colors hover:bg-[#F0F6FF] hover:text-[#0B408B] hover:no-underline";
  const viewAllClass =
    "mt-4 inline-block text-sm leading-5 font-normal text-[#0D0F12] underline underline-offset-2 hover:text-[#0B408B]";

  return (
    <div
      ref={containerRef}
      className="static"
      onMouseEnter={open}
      onMouseLeave={scheduleClose}
    >
      {/* Explore Trigger Button inside center nav-float:
          - Automatically selected and opens on hover
          - No border when not selected
          - Uses border when selected (open)
          - Features icon, text, and chevron matching other nav items
      */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          if (isOpen) {
            closeImmediately();
          } else {
            open();
          }
        }}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label="Explore menu"
        className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-[8px] px-2 text-sm font-normal transition-colors duration-200 cursor-pointer ${
          isOpen || !isDarkBg
            ? "bg-[#F0F6FF] text-[#0B408B] hover:bg-[#E1EDFF]"
            : "text-white/90 hover:bg-white/15 hover:text-white"
        }`}
      >
        <Compass
          size={15}
          strokeWidth={1.5}
          className="shrink-0"
          aria-hidden="true"
        />
        <span>Explore</span>
        <ChevronDown
          size={12}
          strokeWidth={1.5}
          className={`shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {/* Mega Dropdown Panel — Solid opaque white background */}
      {isOpen && (
        <>
          {/* Scrim penutup layar: fixed, rgba(0,0,0,0.2) - sama seperti Coursera */}
          <div
            aria-hidden="true"
            onClick={closeImmediately}
            className="explore-scrim fixed inset-0 z-[70] bg-black/20"
          />

          {/* Panel: fixed, lebar penuh, radius 0, tanpa border, tanpa shadow */}
          <div
            role="dialog"
            aria-label="Explore catalog"
            onMouseEnter={open}
            onMouseLeave={scheduleClose}
            className="explore-mega-menu fixed inset-x-0 top-[104px] z-[80] max-h-[calc(100vh-104px)] overflow-y-auto bg-white [-ms-overflow-style:none] [scrollbar-width:thin]"
          >
          {/* Row: max-w 1200, space-between, 6 kolom, gap-x 24px.
              Kolom diberi lebar min sepadat Coursera supaya tinggi baris rata. */}
          <div className="mx-auto flex max-w-[1200px] flex-nowrap items-start justify-between gap-x-6 px-[32.5px] pt-4">
            {/* COLUMN 1: Explore roles */}
            <div className={columnClass}>
              <h3 className={headingClass}>
                <Link
                  href={EXPLORE_FALLBACKS.viewAllRoles}
                  onClick={closeImmediately}
                  className={itemClass}
                >
                  Explore roles
                </Link>
              </h3>
              <ul className={listClass}>
                {ROLES.map((item) => (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      onClick={closeImmediately}
                      className={itemClass}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                href="/career-academy"
                onClick={closeImmediately}
                className={viewAllClass}
              >
                View all
              </Link>
            </div>

            {/* COLUMN 2: Explore categories */}
            <div className={columnClass}>
              <h3 className={headingClass}>
                <Link
                  href={EXPLORE_FALLBACKS.browseAll}
                  onClick={closeImmediately}
                  className={itemClass}
                >
                  Explore categories
                </Link>
              </h3>
              <ul className={listClass}>
                {CATEGORIES.map((item) => (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      onClick={closeImmediately}
                      className={itemClass}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                href="/browse"
                onClick={closeImmediately}
                className={viewAllClass}
              >
                View all
              </Link>
            </div>

            {/* COLUMN 3: Certificates & Degrees */}
            <div className="flex min-w-[205px] flex-col">
              {/* Group A: Earn a Professional Certificate */}
              <div>
                <h3 className={headingClass}>
                  <Link
                    href="/search?productType=Professional+Certificate"
                    onClick={closeImmediately}
                    className={itemClass}
                  >
                    Earn a Professional Certificate
                  </Link>
                </h3>
                <ul className={listClass}>
                  {CERTIFICATES.map((item) => (
                    <li key={item.label}>
                      <Link
                        href={item.href}
                        onClick={closeImmediately}
                        className={itemClass}
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/search?productType=Professional+Certificate"
                  onClick={closeImmediately}
                  className={viewAllClass}
                >
                  View all
                </Link>
              </div>

              {/* Group B: Earn an online degree */}
              <div>
                <h3 className={headingClass}>
                  <Link
                    href="/degrees"
                    onClick={closeImmediately}
                    className={itemClass}
                  >
                    Earn an online degree
                  </Link>
                </h3>
                <ul className={listClass}>
                  {DEGREES.map((item) => (
                    <li key={item.label}>
                      <Link
                        href={item.href}
                        onClick={closeImmediately}
                        className={itemClass}
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/degrees"
                  onClick={closeImmediately}
                  className={viewAllClass}
                >
                  View all
                </Link>
              </div>
            </div>

            {/* COLUMN 4: Trending Skills & Certification Prep */}
            <div className="flex min-w-[214px] flex-col">
              {/* Group A: Explore trending skills */}
              <div>
                <h3 className={headingClass}>Explore trending skills</h3>
                <ul className={listClass}>
                  {TRENDING_SKILLS.map((item) => (
                    <li key={item.label}>
                      <Link
                        href={item.href}
                        onClick={closeImmediately}
                        className={itemClass}
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Group B: Prepare for a certification exam */}
              <div>
                <h3 className={headingClass}>Prepare for a certification exam</h3>
                <Link
                  href={CERTIFICATION_PREP_VIEW_ALL}
                  onClick={closeImmediately}
                  className={viewAllClass}
                >
                  View all
                </Link>
              </div>
            </div>
          </div>

          {/* Footer strip: padding 24px 0 16px, tanpa border atas, font 14px.
              Saudara dari row kolom, bukan anaknya. */}
          <div className="px-[32.5px] pt-6 pb-4">
            <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-1.5 text-sm leading-5 text-[#0D0F12]">
              <span>Not sure where to begin?</span>
              <Link
                href="/courses?query=free"
                onClick={closeImmediately}
                className="underline underline-offset-2 transition-colors hover:text-[#0B408B]"
              >
                Browse free courses
              </Link>
              <span>or</span>
              <Link
                href="/careevo-plus"
                onClick={closeImmediately}
                className="inline-flex items-center gap-1 underline underline-offset-2 transition-colors hover:text-[#0B408B]"
              >
                <span>Learn more about</span>
                <span className="font-bold text-[#0B408B]">Careevo</span>
                {/* Badge Plus asli Coursera: 32x12px (dari DOM), bukan teks tiruan */}
                <span
                  className="inline-block h-[12px] w-[32px] shrink-0 bg-contain bg-center bg-no-repeat"
                  style={{
                    backgroundImage:
                      "url(https://coursera_assets.s3.amazonaws.com/coursera_plus/coursera-plus-badge-blue.png)",
                  }}
                  role="img"
                  aria-label="Careevo Plus"
                />
              </Link>
            </div>
          </div>
          </div>
        </>
        )}
    </div>
  );
}