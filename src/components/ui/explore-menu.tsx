"use client";

import { useState, useRef, useEffect, useCallback, useId } from "react";
import { createPortal } from "react-dom";
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

export function ExploreMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [panelTop, setPanelTop] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelId = useId();
  // Set when the panel was opened from the keyboard, so closing can hand focus
  // back to the trigger. A pointer open leaves focus where the user put it.
  const fokusDariKeyboard = useRef(false);

  const clearCloseTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // The panel is portalled to <body> and pinned to the viewport, so only its
  // vertical anchor is measured: it hangs 8px below the trigger, which itself
  // sits lower once the chrome morphs into its floating pill.
  //
  // The horizontal box is deliberately *not* measured. Reading it off
  // `.chrome` made the card edge-to-edge whenever the bar was in the
  // full-width `.is-top` state; it now takes the floating pill's own box in
  // both states, from `.explore-mega-menu` in `globals.css`.
  const measurePanel = useCallback(() => {
    const btn = buttonRef.current;
    if (!btn) return;
    setPanelTop(Math.round(btn.getBoundingClientRect().bottom + 8));
  }, []);

  const open = useCallback(
    (dariKeyboard = false) => {
      clearCloseTimeout();
      fokusDariKeyboard.current = dariKeyboard;
      measurePanel();
      setIsOpen(true);
    },
    [clearCloseTimeout, measurePanel],
  );

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

  // Escape/dismiss closes *and* hands focus back to the trigger, but only when
  // the panel was opened from the keyboard — grabbing focus after a pointer
  // dismissal would yank the caret off whatever the user clicked instead.
  const tutupDanKembalikanFokus = useCallback(() => {
    closeImmediately();
    if (fokusDariKeyboard.current) {
      buttonRef.current?.focus();
      fokusDariKeyboard.current = false;
    }
  }, [closeImmediately]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      clearCloseTimeout();
    };
  }, [clearCloseTimeout]);

  // Close on click outside or escape key.
  // The panel is portalled to <body>, so "outside" means outside BOTH the
  // trigger container and the panel itself — otherwise every click inside the
  // mega-menu would read as outside and close it.
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      closeImmediately();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        tutupDanKembalikanFokus();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, closeImmediately, tutupDanKembalikanFokus]);

  // Re-anchor while open: the chrome is sticky and flips between `.is-top` and
  // `.is-scrolled`, so a box captured at open time goes stale.
  useEffect(() => {
    if (!isOpen) return;
    const remeasure = () => measurePanel();
    window.addEventListener("scroll", remeasure, { passive: true });
    window.addEventListener("resize", remeasure);
    return () => {
      window.removeEventListener("scroll", remeasure);
      window.removeEventListener("resize", remeasure);
    };
  }, [isOpen, measurePanel]);

  // Move focus onto the first link when the panel was opened from the keyboard,
  // so Tab walks the menu instead of the page underneath. A pointer open leaves
  // focus on the trigger — no invisible focus jump under the cursor.
  useEffect(() => {
    if (!isOpen || !fokusDariKeyboard.current) return;
    const pertama = panelRef.current?.querySelector<HTMLElement>("a[href]");
    pertama?.focus();
  }, [isOpen, panelTop]);

  const columnClass = "flex w-full min-w-0 flex-col justify-start mb-6 md:w-auto md:min-w-[149px]";
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
      onMouseEnter={() => open(false)}
      onMouseLeave={scheduleClose}
    >
      {/* Explore trigger. Uses the same `.nav-item` system as its siblings so it
          inherits the light, dark-hero, hover and active states from
          `globals.css` — including `.chrome.is-dark-hero .nav-item`, which
          replaces the `isDarkBg` prop this used to branch on in JS.
          `is-active` tracks `isOpen`, so the pill only lights up while open. */}
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          if (isOpen) {
            closeImmediately();
          } else {
            // `detail === 0` on a click means it came from the keyboard
            // (Enter/Space) rather than a pointer, so the panel opens focused.
            open(e.detail === 0);
          }
        }}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-controls={isOpen ? panelId : undefined}
        aria-label="Explore menu"
        className={`nav-item cursor-pointer ${isOpen ? "is-active" : ""}`}
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

      {/* Floating Explore card.

          Rendered through a portal to <body> on purpose. `.chrome` carries
          `backdrop-filter` in its scrolled state, and per CSS an element with
          backdrop-filter becomes the containing block for `position: fixed`
          descendants. Without the portal this card would be anchored to the
          navbar instead of the viewport.

          Only `top` is set inline: it tracks the trigger, which moves as the
          bar morphs. The horizontal box belongs to the floating pill and lives
          in `globals.css` (`.explore-mega-menu`), so the card no longer
          stretches to the full width of the transparent `.is-top` bar. */}
      {isOpen && panelTop !== null && createPortal(
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label="Explore catalog"
          onMouseEnter={() => open(false)}
          onMouseLeave={scheduleClose}
          style={{
            top: panelTop,
            maxHeight: `calc(100vh - ${panelTop}px - 16px)`,
          }}
          className="explore-mega-menu fixed z-[80] overflow-y-auto overflow-x-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_25px_60px_-15px_rgba(0,0,0,0.2),0_10px_20px_-5px_rgba(0,0,0,0.08)] [-ms-overflow-style:none] [scrollbar-width:thin]"
        >
          {/* Row: 4 columns side by side from `md` (max-w 1200, space-between,
              gap-x 24px); a single shrinkable column below it, so the 320px
              card no longer clips a 822px row. */}
          <div className="mx-auto flex max-w-[1200px] flex-col items-start gap-y-1 px-4 pt-4 md:flex-row md:flex-nowrap md:justify-between md:gap-x-6 md:px-[32.5px]">
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
            <div className="flex w-full min-w-0 flex-col md:w-auto md:min-w-[205px]">
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
            <div className="flex w-full min-w-0 flex-col md:w-auto md:min-w-[214px]">
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
          <div className="px-4 pt-6 pb-4 md:px-[32.5px]">
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
          </div>,
        document.body
        )}
    </div>
  );
}