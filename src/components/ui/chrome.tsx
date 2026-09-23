"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
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
    icon: (
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M22 10 12 5 2 10l10 5 10-5z" />
        <path d="M6 12v5c0 1 2.7 2.5 6 2.5s6-1.5 6-2.5v-5" />
      </svg>
    ),
  },
  {
    href: "/loker",
    label: "Loker",
    icon: (
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      </svg>
    ),
  },
  {
    href: "/careevo-plus",
    label: "Careevo Plus",
    icon: (
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 3l2.4 5.6L20 10l-4.4 3.4L17 20l-5-3-5 3 1.4-6.6L4 10l5.6-1.4z" />
      </svg>
    ),
  },
];

export function Chrome() {
  const pathname = usePathname();
  const onHome = pathname === "/";

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
      <div className="chrome relative">
        <Link className="chrome-brand" href={onHome ? "#main" : "/"}>
          Care<span>evo</span>
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
                title={item.label}
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
