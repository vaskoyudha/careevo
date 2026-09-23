"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  iconOnly?: boolean;
};

const navItems: NavItem[] = [
  {
    href: "#segmen",
    label: "Segmen",
    icon: (
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    href: "#agen",
    label: "Agen",
    icon: (
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
      </svg>
    ),
  },
  {
    href: "#loop",
    label: "Loop",
    icon: (
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <path d="M4 6h16M4 12h16M4 18h10" />
      </svg>
    ),
  },
  {
    href: "#verifikasi",
    label: "Verifikasi",
    icon: (
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
  },
  {
    href: "/audit",
    label: "Audit",
    icon: (
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <path d="M4 6h16M4 12h16M4 18h10" />
        <path d="m15 16 2 2 4-4" />
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
      <div className="chrome">
        <Link className="chrome-brand" href={onHome ? "#main" : "/"}>
          Care<span>evo</span>
        </Link>
        <nav className="nav-float" aria-label="Navigasi utama">
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
                {item.iconOnly ? <span className="sr-only">{item.label}</span> : item.label}
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
