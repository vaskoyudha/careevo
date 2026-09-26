"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search } from "./icons";
import { ExploreMenu } from "./explore-menu";
import { AccountMenu, learnerNavItems } from "./chrome-parts";
import type { SessionPayload } from "@/lib/auth/types";

/**
 * The AI Mastery navbar: a dark, winged bar pinned to the top.
 *
 * `/ai-mastery` frames another origin, so this page has a reason to look like
 * its own surface rather than the site chrome: the frame below is a full-bleed
 * application, and a translucent white bar floating over it reads as a leftover
 * from the host site. The near-black winged bar gives the frame a lid.
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
 * The bar reuses `.chrome`, `.nav-item`, `.chrome-btn` and the dead
 * `.is-dark-hero` light-on-dark rules rather than restyling them — see
 * `ai-mastery-wing.css` for the shape and the search-field inversion.
 */
export function AiMasteryNavbar({ session }: { session: SessionPayload }) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <a href="#main" className="skip-link">
        Lewati ke konten utama
      </a>
      <div className="chrome is-winged is-dark-hero relative is-top">
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
          <form
            role="search"
            action="/belajar"
            method="get"
            className="learner-search hidden min-w-0 flex-1 items-center md:flex"
          >
            <label htmlFor="ai-mastery-search" className="sr-only">
              Cari kursus
            </label>
            <div className="flex h-10 w-full max-w-xs items-center gap-2 rounded-full border border-white/20 bg-white/10 pr-1 pl-3.5 focus-within:border-white/60">
              <Search
                className="h-4 w-4 shrink-0 text-white/70"
                aria-hidden="true"
              />
              <input
                id="ai-mastery-search"
                name="q"
                type="search"
                autoComplete="off"
                placeholder="Mau belajar apa?"
                className="w-full bg-transparent text-[13.5px] text-white outline-none placeholder:text-white/55"
              />
              <button
                type="submit"
                className="brand-fill shrink-0 cursor-pointer rounded-full px-3.5 py-1.5 text-[13px] font-semibold"
              >
                Cari
              </button>
            </div>
          </form>
          <AccountMenu session={session} tone="dark" />
        </div>
      </div>
    </>
  );
}
