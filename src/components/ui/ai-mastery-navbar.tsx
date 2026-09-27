"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Search } from "./icons";
import { ExploreMenu } from "./explore-menu";
import { AccountMenu, DashboardButton, learnerNavItems } from "./chrome-parts";
import type { SessionPayload } from "@/lib/auth/types";

/**
 * The AI Mastery navbar: the light learner bar with a winged top edge, pinned
 * to the top of the page.
 *
 * The only difference from `LearnerChrome` is the silhouette. The colour,
 * the items, the search field and the account menu are the same light glass
 * the rest of the site uses — the wing is the feature, not a restyle.
 *
 * Two deliberate departures from the `.chrome` morph that the other navbars use,
 * both forced by the page rather than chosen for looks:
 *
 * - **No `is-scrolled` state.** The framed app owns its own scrolling, so the
 *   document never scrolls and a scroll-triggered morph would have exactly two
 *   states with one of them unreachable. It is `is-top` forever.
 * - **The silhouette is an SVG, not a `border-radius`.** The swept top edge is
 *   the point of the design, and a radius cannot express it. The path stretches
 *   with `preserveAspectRatio="none"`, so the curve stays fluid from 360px to
 *   ultrawide instead of pinching at one breakpoint.
 *
 * The bar reuses `.chrome`, `.nav-item` and `.chrome-btn` rather than
 * restyling them — `globals.css` holds the wing path and its drop-shadow.
 *
 * `pageLabel` and `sidebarToggle` are the dashboard shell's extras: `AppShell`
 * used to render a second, separate topbar for the page title and the sidebar
 * toggle; both now live here so there is one chrome instead of two.
 */
export function AiMasteryNavbar({
  session,
  pageLabel,
  sidebarToggle,
  showSearch = true,
}: {
  session: SessionPayload;
  /** Page name shown in the chip beside the brand (dashboard shell only). */
  pageLabel?: string;
  /** Control rendered in `.chrome-actions` before the account menu (dashboard
   *  shell's sidebar toggle; omitted on `/ai-mastery`). */
  sidebarToggle?: ReactNode;
  /** The dashboard shell hides the search field — a search box beside a page
   *  that already has its own navigation reads as a second command surface. */
  showSearch?: boolean;
}) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <a href="#main" className="skip-link">
        Lewati ke konten utama
      </a>
      <div className="chrome is-winged relative is-top">
        <div className="flex min-w-0 items-center gap-2">
          <Link className="chrome-brand" href="/" aria-label="Careevo">
            <Image
              src="/careevo-logo.png"
              alt="Careevo"
              width={250}
              height={64}
              priority
              className="h-10 w-auto object-contain transition-transform duration-300 hover:scale-105"
            />
          </Link>
          {pageLabel ? (
            <>
              <span className="chrome-page-sep hidden sm:inline" aria-hidden="true">
                /
              </span>
              <span className="chrome-page-label hidden sm:inline-flex">
                {pageLabel}
              </span>
            </>
          ) : null}
        </div>
        <nav className="nav-float" aria-label="Navigasi utama">
          <ExploreMenu />
          {learnerNavItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={active ? "nav-item is-active" : "nav-item"}
                aria-current={active ? "page" : undefined}
              >
                {item.icon}
                <span className="max-lg:sr-only">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="chrome-actions">
          {showSearch ? (
            <form
              role="search"
              action="/belajar"
              method="get"
              className="learner-search hidden min-w-0 flex-1 items-center md:flex"
            >
              <label htmlFor="ai-mastery-search" className="sr-only">
                Cari kursus
              </label>
              <div className="flex h-10 w-full max-w-xs items-center gap-2 rounded-full border border-black/15 bg-white/80 pr-1 pl-3.5 focus-within:border-[#0056D2]">
                <Search className="h-4 w-4 shrink-0 text-black/50" aria-hidden="true" />
                <input
                  id="ai-mastery-search"
                  name="q"
                  type="search"
                  autoComplete="off"
                  placeholder="Mau belajar apa?"
                  className="w-full bg-transparent text-[13.5px] text-black outline-none placeholder:text-black/45"
                />
                <button
                  type="submit"
                  className="brand-fill shrink-0 cursor-pointer rounded-full px-3.5 py-1.5 text-[13px] font-semibold"
                >
                  Cari
                </button>
              </div>
            </form>
          ) : null}
          {sidebarToggle}
          <DashboardButton />
          <AccountMenu session={session} />
        </div>
      </div>
    </>
  );
}
