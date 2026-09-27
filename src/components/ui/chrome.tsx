"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { MoreVertical } from "lucide-react";
import { Building2, Briefcase, Compass, GraduationCap, MessageSquare, Sparkle } from "./icons";
import { ExploreMenu } from "./explore-menu";
import { AccountMenu, DashboardButton } from "./chrome-parts";
import { MobileNavDrawer, type MobileNavItem } from "./mobile-nav-drawer";
import type { SessionPayload } from "@/lib/auth/types";
import { onScrollFrame } from "@/lib/scroll/scroll-frame";

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  iconOnly?: boolean;
};

const navItems: NavItem[] = [
  {
    href: "/belajar",
    label: "Belajar",
    icon: <GraduationCap size={15} strokeWidth={1.5} aria-hidden="true" />,
  },
  {
    href: "/ai-mastery",
    label: "AI Mastery",
    icon: <MessageSquare size={15} strokeWidth={1.5} aria-hidden="true" />,
  },
  {
    href: "/loker",
    label: "Loker",
    icon: <Briefcase size={15} strokeWidth={1.5} aria-hidden="true" />,
  },
  {
    href: "/careevo-plus",
    label: "Careevo Plus",
    icon: <Sparkle size={15} strokeWidth={1.5} aria-hidden="true" />,
  },
  {
    href: "/business",
    label: "Bisnis",
    icon: <Building2 size={15} strokeWidth={1.5} aria-hidden="true" />,
  },
];

/**
 * Navbar marketing/publik.
 *
 * `session` datang dari **server component** (`getSession()` di layout
 * `(public)` / `(marketing)`) dan menentukan isi `.chrome-actions`:
 * masuk → `DashboardButton` + `AccountMenu`, belum masuk → Masuk/Daftar.
 *
 * Sebelumnya kedua tombol itu ditulis mati di sini, sehingga setiap route
 * publik — termasuk `/loker` dan `/kerja` yang memang boleh dibaca sambil
 * masuk — menampilkan "Masuk / Daftar" kepada orang yang sudah punya sesi
 * aktif. Menitipkan sesinya ke layout, bukan ke komponen client, penting:
 * `getSession()` menyentuh database dan tidak boleh masuk ke bundle browser.
 * Null di-drop (`bacaTokenSesi` yang mengembalikan null tidak membuka
 * koneksi), jadi pengunjung tanpa cookie tetap dilayani tanpa satu pun query.
 *
 * `navItems` di file ini **sengaja** berbeda dari `learnerNavItems` di
 * `chrome-parts.tsx` dan tidak boleh digabung — lihat catatan di sana. Yang
 * dipinjam dari `chrome-parts` hanya atom akunnya.
 */
export function Chrome({ session = null }: { session?: SessionPayload | null }) {
  const pathname = usePathname();
  const onHome = pathname === "/";
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileItems: MobileNavItem[] = [
    { href: "/courses", label: "Explore", icon: <Compass size={18} aria-hidden="true" /> },
    ...navItems.map(({ href, label, icon }) => ({ href, label, icon })),
  ];
  /**
   * Halaman yang hero-nya gelap, jadi navbar transparan di atasnya harus
   * membalik ink-nya jadi putih.
   *
   * `/explore/most-popular-courses` masuk daftar karena hero-nya `#0060EB` solid:
   * tanpa ini link navbar jatuh ke hitam di atas biru itu (terukur 3.77:1,
   * di bawah AA untuk teks 15px) dan menabrak aturan "page tops under the
   * transparent bar must be light". Syarat `!scrolled` tetap berlaku: begitu
   * digeser, bar jadi pil kaca terang dan mode ini harus mati.
   */
  const isDarkHero =
    (pathname === "/loker" ||
      pathname === "/kerja" ||
      pathname === "/explore/most-popular-courses") &&
    !scrolled;

  // `onScrollFrame`, not a bare `scroll` listener: under Lenis a scroll event
  // lands in the same task as the scroll write, so a layout read here is a
  // forced reflow. Coalesced to one read per frame — see
  // `src/lib/scroll/scroll-frame.ts` for the measurements.
  useEffect(() => onScrollFrame(() => setScrolled(window.scrollY > 24)), []);

  const resolveHref = (href: string) => {
    if (!href.startsWith("#")) return href;
    if (href === "#main") return onHome ? "#main" : "/";
    return onHome ? href : `/${href}`;
  };

  const isActive = (href: string) => {
    if (href === "#main") return onHome;
    if (href.startsWith("/")) {
      return pathname === href || pathname.startsWith(`${href}/`);
    }
    return false;
  };

  return (
    <>
      <a href={onHome ? "#main" : "/"} className="skip-link">
        Lewati ke konten utama
      </a>
      <div
        className={`chrome relative ${scrolled ? "is-scrolled" : "is-top"} ${
          isDarkHero ? "is-dark-hero" : ""
        }`}
      >
        <button
          ref={mobileMenuTriggerRef}
          type="button"
          className="mobile-nav-trigger"
          aria-label="Buka menu navigasi"
          aria-expanded={mobileMenuOpen}
          aria-controls="public-mobile-navigation"
          onClick={() => setMobileMenuOpen((value) => !value)}
        >
          <MoreVertical size={20} strokeWidth={2} aria-hidden="true" />
        </button>
        <Link className="chrome-brand" href={onHome ? "#main" : "/"} aria-label="Careevo">
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
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={resolveHref(item.href)}
                className={active ? "nav-item is-active" : "nav-item"}
                aria-current={active ? "page" : undefined}
              >
                {item.icon}
                {item.iconOnly ? (
                  <span className="sr-only">{item.label}</span>
                ) : (
                  item.label
                )}
              </Link>
            );
          })}
        </nav>
        <div className="chrome-actions">
          {session ? (
            <>
              <DashboardButton />
              <AccountMenu session={session} />
            </>
          ) : (
            <>
              <Link
                className="chrome-btn chrome-btn-text chrome-btn-ghost"
                href="/masuk"
                aria-current={pathname === "/masuk" ? "page" : undefined}
              >
                Masuk
              </Link>
              <Link
                className="chrome-btn chrome-btn-brand"
                href="/daftar"
                aria-current={pathname === "/daftar" ? "page" : undefined}
              >
                Daftar
              </Link>
            </>
          )}
        </div>
      </div>
      <MobileNavDrawer
        id="public-mobile-navigation"
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        triggerRef={mobileMenuTriggerRef}
        items={mobileItems}
        session={session}
        title="Navigasi Careevo"
      />
    </>
  );
}
