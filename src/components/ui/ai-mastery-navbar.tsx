"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { MoreVertical } from "lucide-react";
import { ExploreMenu } from "./explore-menu";
import { AccountMenu, DashboardButton, learnerNavItems } from "./chrome-parts";
import { MobileNavDrawer, type MobileNavItem } from "./mobile-nav-drawer";
import type { SessionPayload } from "@/lib/auth/types";

/**
 * The AI Mastery navbar: the light learner bar with a winged top edge, pinned
 * to the top of the page.
 *
 * The only difference from `LearnerChrome` is the silhouette. The colour,
 * the items and the account menu are the same light glass the rest of the site
 * uses — the wing is the feature, not a restyle. Neither bar carries a search
 * field; `/belajar` owns the one search surface.
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
}: {
  session: SessionPayload;
  /** Page name shown in the chip beside the brand (dashboard shell only). */
  pageLabel?: string;
  /** Control rendered in `.chrome-actions` before the account menu (dashboard
   *  shell's sidebar toggle; omitted on `/ai-mastery`). */
  sidebarToggle?: ReactNode;
}) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileItems: MobileNavItem[] = learnerNavItems.map(({ href, label, icon }) => ({
    href,
    label,
    icon,
  }));

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <a href="#main" className="skip-link">
        Lewati ke konten utama
      </a>
      <div className="chrome is-winged relative is-top">
        {sidebarToggle ? (
          <div className="mobile-sidebar-toggle">{sidebarToggle}</div>
        ) : (
          <button
            type="button"
            ref={mobileMenuTriggerRef}
            className="mobile-nav-trigger"
            aria-label="Buka menu navigasi"
            aria-expanded={mobileMenuOpen}
            aria-controls="ai-mastery-mobile-navigation"
            onClick={() => setMobileMenuOpen((value) => !value)}
          >
            <MoreVertical size={20} strokeWidth={2} aria-hidden="true" />
          </button>
        )}
        {/* `flex-1` is load-bearing, not spacing: the brand is wrapped in a div
            (it carries the optional page-label chip), and that div is what the
            bar lays out as its left flank. Without the grow it collapses to the
            logo's width while `.chrome-actions` keeps `flex: 1 1 0` on the
            right, so the nav row is laid out off-centre — measured 97px left of
            the viewport centre at 1280px. Growing both flanks equally is what
            centres `.nav-float`, which is `flex: 0 0 auto`. */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
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
          <DashboardButton />
          <AccountMenu session={session} />
        </div>
      </div>
      {!sidebarToggle ? (
        <MobileNavDrawer
          id="ai-mastery-mobile-navigation"
          open={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
          triggerRef={mobileMenuTriggerRef}
          items={mobileItems}
          session={session}
          title="Navigasi belajar"
        />
      ) : null}
    </>
  );
}
