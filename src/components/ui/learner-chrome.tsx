"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { MoreVertical } from "lucide-react";
import { Search } from "./icons";
import { MobileNavDrawer, type MobileNavItem } from "./mobile-nav-drawer";
import { ExploreMenu } from "./explore-menu";
import { AccountMenu, DashboardButton, learnerNavItems } from "./chrome-parts";
import type { SessionPayload } from "@/lib/auth/types";
import { onScrollFrame } from "@/lib/scroll/scroll-frame";


export function LearnerChrome({
  session,
  queryAwal = "",
}: {
  session: SessionPayload;
  queryAwal?: string;
}) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileItems: MobileNavItem[] = learnerNavItems.map(({ href, label, icon }) => ({
    href,
    label,
    icon,
  }));

  // Same reasoning as `chrome.tsx`: coalesced to one read per frame, because a
  // bare listener reads layout in the same task as Lenis's scroll write.
  useEffect(() => onScrollFrame(() => setScrolled(window.scrollY > 24)), []);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <a href="#main" className="skip-link">
        Lewati ke konten utama
      </a>
      <div className={`chrome relative ${scrolled ? "is-scrolled" : "is-top"}`}>
        <button
          ref={mobileMenuTriggerRef}
          type="button"
          className="mobile-nav-trigger"
          aria-label="Buka menu navigasi"
          aria-expanded={mobileMenuOpen}
          aria-controls="learner-mobile-navigation"
          onClick={() => setMobileMenuOpen((value) => !value)}
        >
          <MoreVertical size={20} strokeWidth={2} aria-hidden="true" />
        </button>
        <Link className="chrome-brand" href="/" aria-label="Careevo">
          <Image
            src="/careevo-logo.png"
            alt="Careevo"
            width={250}
            height={64}
            priority
            className="h-12 w-auto object-contain transition-transform duration-300 hover:scale-105"
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
            <label htmlFor="learner-search" className="sr-only">
              Cari kursus
            </label>
            <div className="flex h-10 w-full max-w-xs items-center gap-2 rounded-full border border-black/15 bg-white/80 pr-1 pl-3.5 focus-within:border-[#0056D2]">
              <Search className="h-4 w-4 shrink-0 text-black/50" aria-hidden="true" />
              <input
                id="learner-search"
                name="q"
                type="search"
                autoComplete="off"
                defaultValue={queryAwal}
                key={queryAwal}
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
          <DashboardButton />
          <AccountMenu session={session} />
        </div>
      </div>
      <MobileNavDrawer
        id="learner-mobile-navigation"
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        triggerRef={mobileMenuTriggerRef}
        items={mobileItems}
        session={session}
        title="Navigasi belajar"
      />
    </>
  );
}
