"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";

interface ExploreMenuItem {
  label: string;
  href: string;
}

const ROLES: ExploreMenuItem[] = [
  { label: "Data Analyst", href: "/belajar" },
  { label: "Project Manager", href: "/belajar" },
  { label: "Cyber Security Analyst", href: "/belajar" },
  { label: "Data Scientist", href: "/belajar" },
  { label: "Business Intelligence Analyst", href: "/belajar" },
  { label: "Digital Marketing Specialist", href: "/belajar" },
  { label: "UI / UX Designer", href: "/belajar" },
  { label: "Machine Learning Engineer", href: "/belajar" },
  { label: "Social Media Specialist", href: "/belajar" },
  { label: "Computer Support Specialist", href: "/belajar" },
];

const CATEGORIES: ExploreMenuItem[] = [
  { label: "Artificial Intelligence", href: "/belajar" },
  { label: "Business", href: "/belajar" },
  { label: "Data Science", href: "/belajar" },
  { label: "Information Technology", href: "/belajar" },
  { label: "Computer Science", href: "/belajar" },
  { label: "Healthcare", href: "/belajar" },
  { label: "Physical Science and Engineering", href: "/belajar" },
  { label: "Personal Development", href: "/belajar" },
  { label: "Social Sciences", href: "/belajar" },
  { label: "Language Learning", href: "/belajar" },
  { label: "Arts and Humanities", href: "/belajar" },
];

const CERTIFICATES: ExploreMenuItem[] = [
  { label: "Business", href: "/belajar" },
  { label: "Computer Science", href: "/belajar" },
  { label: "Data Science", href: "/belajar" },
  { label: "Information Technology", href: "/belajar" },
];

const DEGREES: ExploreMenuItem[] = [
  { label: "Bachelor's Degrees", href: "/belajar" },
  { label: "Master's Degrees", href: "/belajar" },
  { label: "University Certificates", href: "/belajar" },
];

const TRENDING_SKILLS: ExploreMenuItem[] = [
  { label: "Python", href: "/belajar" },
  { label: "Artificial Intelligence", href: "/belajar" },
  { label: "Excel", href: "/belajar" },
  { label: "Machine Learning", href: "/belajar" },
  { label: "SQL", href: "/belajar" },
  { label: "Project Management", href: "/belajar" },
  { label: "Power BI", href: "/belajar" },
  { label: "Marketing", href: "/belajar" },
];

function CompassIcon({ className }: { className?: string }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  );
}

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
        className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-[8px] px-3.5 py-1.5 text-[13.5px] font-medium transition-all duration-200 cursor-pointer ${
          isOpen
            ? "border border-blue-500/80 bg-white text-black shadow-xs"
            : isDarkBg
              ? "border border-transparent text-white/90 hover:text-white hover:bg-white/15"
              : "border border-transparent text-black hover:bg-white/85 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"
        }`}
      >
        <CompassIcon className={`size-[15px] shrink-0 ${isOpen ? "text-black" : isDarkBg ? "text-white" : "text-black"}`} />
        <span>Explore</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-blue-600" : isDarkBg ? "text-white/80" : "text-black/60"
          }`}
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {/* Mega Dropdown Panel — Solid opaque white background */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Explore catalog"
          onMouseEnter={open}
          onMouseLeave={scheduleClose}
          className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 max-h-[82vh] overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 text-gray-900 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.2),0_10px_20px_-5px_rgba(0,0,0,0.08)] sm:p-8 lg:p-9 before:absolute before:-top-3 before:left-0 before:right-0 before:h-3 before:content-[''] [-ms-overflow-style:none] [scrollbar-width:thin]"
        >
          {/* 4-COLUMN CONTENT GRID */}
          <div className="grid grid-cols-1 gap-8 text-left sm:grid-cols-2 lg:grid-cols-4 lg:gap-10">
            {/* COLUMN 1: Explore roles */}
            <div>
              <h3 className="mb-3 text-[14px] font-bold tracking-tight text-gray-900">
                Explore roles
              </h3>
              <ul className="space-y-1.5">
                {ROLES.map((item) => (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      onClick={closeImmediately}
                      className="block text-[13px] text-gray-700 transition-colors hover:text-[#0056D2] hover:underline"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                href="/belajar"
                onClick={closeImmediately}
                className="mt-3.5 inline-block text-xs font-semibold text-[#0056D2] underline underline-offset-2 transition-colors hover:text-[#003d99]"
              >
                View all
              </Link>
            </div>

            {/* COLUMN 2: Explore categories */}
            <div>
              <h3 className="mb-3 text-[14px] font-bold tracking-tight text-gray-900">
                Explore categories
              </h3>
              <ul className="space-y-1.5">
                {CATEGORIES.map((item) => (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      onClick={closeImmediately}
                      className="block text-[13px] text-gray-700 transition-colors hover:text-[#0056D2] hover:underline"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                href="/belajar"
                onClick={closeImmediately}
                className="mt-3.5 inline-block text-xs font-semibold text-[#0056D2] underline underline-offset-2 transition-colors hover:text-[#003d99]"
              >
                View all
              </Link>
            </div>

            {/* COLUMN 3: Certificates & Degrees */}
            <div className="space-y-6">
              {/* Group A: Earn a Professional Certificate */}
              <div>
                <h3 className="mb-3 text-[14px] font-bold tracking-tight text-gray-900">
                  Earn a Professional Certificate
                </h3>
                <ul className="space-y-1.5">
                  {CERTIFICATES.map((item) => (
                    <li key={item.label}>
                      <Link
                        href={item.href}
                        onClick={closeImmediately}
                        className="block text-[13px] text-gray-700 transition-colors hover:text-[#0056D2] hover:underline"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/belajar"
                  onClick={closeImmediately}
                  className="mt-3.5 inline-block text-xs font-semibold text-[#0056D2] underline underline-offset-2 transition-colors hover:text-[#003d99]"
                >
                  View all
                </Link>
              </div>

              {/* Group B: Earn an online degree */}
              <div>
                <h3 className="mb-3 text-[14px] font-bold tracking-tight text-gray-900">
                  Earn an online degree
                </h3>
                <ul className="space-y-1.5">
                  {DEGREES.map((item) => (
                    <li key={item.label}>
                      <Link
                        href={item.href}
                        onClick={closeImmediately}
                        className="block text-[13px] text-gray-700 transition-colors hover:text-[#0056D2] hover:underline"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/belajar"
                  onClick={closeImmediately}
                  className="mt-3.5 inline-block text-xs font-semibold text-[#0056D2] underline underline-offset-2 transition-colors hover:text-[#003d99]"
                >
                  View all
                </Link>
              </div>
            </div>

            {/* COLUMN 4: Trending Skills & Certification Prep */}
            <div className="space-y-6">
              {/* Group A: Explore trending skills */}
              <div>
                <h3 className="mb-3 text-[14px] font-bold tracking-tight text-gray-900">
                  Explore trending skills
                </h3>
                <ul className="space-y-1.5">
                  {TRENDING_SKILLS.map((item) => (
                    <li key={item.label}>
                      <Link
                        href={item.href}
                        onClick={closeImmediately}
                        className="block text-[13px] text-gray-700 transition-colors hover:text-[#0056D2] hover:underline"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Group B: Prepare for a certification exam */}
              <div>
                <h3 className="mb-2 text-[14px] font-bold tracking-tight text-gray-900">
                  Prepare for a certification exam
                </h3>
                <Link
                  href="/challenge/1"
                  onClick={closeImmediately}
                  className="mt-1 inline-block text-xs font-semibold text-[#0056D2] underline underline-offset-2 transition-colors hover:text-[#003d99]"
                >
                  View all
                </Link>
              </div>
            </div>
          </div>

          {/* BOTTOM PROMO STRIP matching Coursera Plus banner in Image 1 */}
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-gray-200 pt-4 text-xs sm:text-sm text-gray-600">
            <div className="flex flex-wrap items-center gap-1.5">
              <span>Not sure where to begin?</span>
              <Link
                href="/belajar"
                onClick={closeImmediately}
                className="font-medium text-gray-900 underline underline-offset-2 transition-colors hover:text-[#0056D2]"
              >
                Browse free courses
              </Link>
              <span>or</span>
              <Link
                href="/careevo-plus"
                onClick={closeImmediately}
                className="inline-flex items-center gap-1 font-medium text-gray-900 underline underline-offset-2 transition-colors hover:text-[#0056D2]"
              >
                <span>Learn more about</span>
                <span className="font-bold text-[#0056D2]">Careevo</span>
                <span className="rounded-[3px] bg-[#0056D2] px-1 py-0.2 text-[9px] font-bold tracking-wider text-white uppercase no-underline">
                  PLUS
                </span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
