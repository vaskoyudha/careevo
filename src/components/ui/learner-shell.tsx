"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, LogOut, Menu, Search, Settings, X } from "lucide-react";
import { logoutAction } from "@/actions/auth";
import { ExploreMenu } from "./explore-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { cn } from "@/lib/utils";
import type { SessionPayload } from "@/lib/auth/types";

const NAV_LINKS = [
  { href: "/belajar", label: "Belajar" },
  { href: "/loker", label: "Loker" },
  { href: "/careevo-plus", label: "Plus" },
] as const;

function isActiveLink(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function AccountMenu({ session }: { session: SessionPayload }) {
  const [isPending, startTransition] = useTransition();
  const roleLabel =
    session.role === "admin"
      ? "Admin"
      : session.role === "verifikator"
        ? "Verifikator"
        : "Peserta";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Buka menu akun"
          className="group flex items-center gap-1.5 rounded-full p-1 transition-colors select-none hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0056D2]/40"
        >
          <span
            className="grid size-8 place-items-center rounded-full bg-[#0056D2] text-xs font-bold text-white uppercase"
            aria-hidden="true"
          >
            {session.nama.charAt(0)}
          </span>
          <ChevronDown
            className="h-3.5 w-3.5 shrink-0 text-gray-500 transition-transform duration-200 group-data-[state=open]:rotate-180"
            strokeWidth={2}
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-60">
        <DropdownMenuLabel className="flex flex-col gap-0.5 py-2">
          <span className="truncate text-[13px] font-medium text-foreground">
            {session.nama}
          </span>
          <span className="truncate text-[12px] font-normal text-muted-foreground">
            {session.email}
          </span>
          <span className="mt-1 w-fit rounded-full bg-[#0056D2]/10 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-[#0056D2] uppercase">
            {roleLabel}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link
            href="/dashboard"
            className="flex w-full cursor-pointer items-center gap-2 text-[13px]"
          >
            Dashboard
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link
            href="/pengaturan"
            className="flex w-full cursor-pointer items-center gap-2 text-[13px]"
          >
            <Settings className="h-4 w-4" strokeWidth={1.5} />
            Pengaturan
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={isPending}
          onSelect={() => {
            startTransition(() => {
              void logoutAction();
            });
          }}
          className="flex cursor-pointer items-center gap-2 text-[13px]"
        >
          <LogOut className="h-4 w-4" strokeWidth={1.5} />
          Keluar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const FOOTER_GROUPS: { heading: string; links: { label: string; href: string }[] }[] = [
  {
    heading: "Belajar",
    links: [
      { label: "Katalog kursus", href: "/belajar" },
      { label: "Careevo Plus", href: "/careevo-plus" },
      { label: "Paket tim", href: "/careevo-plus#paket" },
    ],
  },
  {
    heading: "Karier",
    links: [
      { label: "Loker", href: "/loker" },
      { label: "Dashboard", href: "/dashboard" },
      { label: "Pengaturan", href: "/pengaturan" },
    ],
  },
];

export function LearnerShell({
  session,
  queryAwal = "",
  children,
}: {
  session: SessionPayload;
  queryAwal?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900 antialiased">
      <a href="#main" className="skip-link">
        Lewati ke konten utama
      </a>

      <header className="sticky top-0 z-50 border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-2 px-4 sm:px-6 lg:px-8">
          <Link
            href="/belajar"
            className="shrink-0 text-xl font-bold tracking-tight text-gray-900"
            aria-label="Careevo Belajar"
          >
            careevo
            <span className="text-[#0056D2]">.</span>
          </Link>

          <div className="hidden shrink-0 sm:block">
            <ExploreMenu />
          </div>

          <form
            role="search"
            action="/belajar"
            method="get"
            className="mx-2 hidden min-w-0 flex-1 items-center md:flex"
          >
            <label htmlFor="learner-search" className="sr-only">
              Cari kursus
            </label>
            <div className="flex h-11 w-full max-w-xl items-center gap-2 rounded-full border border-gray-400 bg-white pr-1.5 pl-4 focus-within:border-[#0056D2]">
              <Search className="h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
              <input
                id="learner-search"
                name="q"
                type="search"
                autoComplete="off"
                defaultValue={queryAwal}
                key={queryAwal}
                placeholder="Mau belajar apa?"
                className="w-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-500"
              />
              <button
                type="submit"
                className="shrink-0 cursor-pointer rounded-full bg-[#0056D2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#00419e]"
              >
                Cari
              </button>
            </div>
          </form>

          <nav aria-label="Navigasi belajar" className="ml-auto hidden shrink-0 items-center gap-1 lg:flex">
            {NAV_LINKS.map((item) => {
              const active = isActiveLink(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "text-[#0056D2]"
                      : "text-gray-700 hover:bg-gray-100 hover:text-gray-900",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="hidden shrink-0 lg:block">
            <AccountMenu session={session} />
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Tutup menu navigasi" : "Buka menu navigasi"}
            className="ml-auto shrink-0 rounded-md p-2 text-gray-700 hover:bg-gray-100 lg:hidden"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {menuOpen ? (
          <div className="border-t border-gray-200 bg-white px-4 pt-3 pb-5 sm:px-6 lg:hidden">
            <form role="search" action="/belajar" method="get" className="md:hidden">
              <label htmlFor="learner-search-mobile" className="sr-only">
                Cari kursus
              </label>
              <div className="flex h-11 items-center gap-2 rounded-full border border-gray-400 pr-1.5 pl-4 focus-within:border-[#0056D2]">
                <Search className="h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
                <input
                  id="learner-search-mobile"
                  name="q"
                  type="search"
                  autoComplete="off"
                  defaultValue={queryAwal}
                  key={queryAwal}
                  placeholder="Mau belajar apa?"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-gray-500"
                />
                <button
                  type="submit"
                  className="shrink-0 cursor-pointer rounded-full bg-[#0056D2] px-4 py-2 text-sm font-semibold text-white"
                >
                  Cari
                </button>
              </div>
            </form>
            <nav aria-label="Navigasi seluler" className="mt-2 flex flex-col">
              {NAV_LINKS.map((item) => {
                const active = isActiveLink(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "rounded-md px-2 py-2.5 text-sm font-medium",
                      active ? "text-[#0056D2]" : "text-gray-700 hover:bg-gray-100",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
              <Link
                href="/dashboard"
                onClick={() => setMenuOpen(false)}
                className="rounded-md px-2 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Dashboard
              </Link>
              <Link
                href="/pengaturan"
                onClick={() => setMenuOpen(false)}
                className="rounded-md px-2 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Pengaturan
              </Link>
              <button
                type="button"
                disabled={isPending}
                onClick={() =>
                  startTransition(() => {
                    void logoutAction();
                  })
                }
                className="mt-1 cursor-pointer rounded-md px-2 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
              >
                Keluar
              </button>
            </nav>
          </div>
        ) : null}
      </header>

      <main id="main">{children}</main>

      <footer className="border-t border-gray-200 bg-[#f5f7fa]">
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 sm:grid-cols-3 sm:px-6 lg:px-8">
          <div>
            <p className="text-lg font-bold tracking-tight text-gray-900">
              careevo<span className="text-[#0056D2]">.</span>
            </p>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-gray-600">
              Belajar terukur, challenge praktik, dan karya terverifikasi — satu
              alur sampai siap kerja.
            </p>
          </div>
          {FOOTER_GROUPS.map((group) => (
            <nav key={group.heading} aria-label={`Footer ${group.heading}`}>
              <h2 className="text-sm font-semibold tracking-wide text-gray-900 uppercase">
                {group.heading}
              </h2>
              <ul className="mt-3 space-y-2">
                {group.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-gray-600 hover:text-[#0056D2] hover:underline"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="border-t border-gray-200">
          <p className="mx-auto w-full max-w-7xl px-4 py-4 text-xs text-gray-500 sm:px-6 lg:px-8">
            © 2026 Careevo · Prototipe fixture — tanpa database.
          </p>
        </div>
      </footer>
    </div>
  );
}
