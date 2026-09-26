"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Building2, Briefcase, GraduationCap, MessageSquare, Sparkle } from "./icons";
import { ExploreMenu } from "./explore-menu";

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

export function Chrome() {
  const pathname = usePathname();
  const onHome = pathname === "/";
  const [scrolled, setScrolled] = useState(false);
  const isDarkHero = (pathname === "/loker" || pathname === "/kerja") && !scrolled;

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 24);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
        </div>
      </div>
    </>
  );
}
