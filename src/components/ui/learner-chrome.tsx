"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { ChevronDown, LogOut, Route, Search, Settings, UserRound } from "lucide-react";
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
import type { SessionPayload } from "@/lib/auth/types";

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
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
  { href: "/belajar/jalur", label: "Jalur Belajar",
    icon: <Route width={15} height={15} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" /> },
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
          className="group flex cursor-pointer items-center gap-1 rounded-full p-1 select-none hover:bg-white/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0056D2]/40"
        >
          <span
            className="grid size-8 place-items-center rounded-full bg-[#0056D2] text-xs font-bold text-white uppercase"
            aria-hidden="true"
          >
            {session.nama.charAt(0)}
          </span>
          <ChevronDown
            className="h-3.5 w-3.5 shrink-0 text-black/60 transition-transform duration-200 group-data-[state=open]:rotate-180"
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
            href="/profil"
            className="flex w-full cursor-pointer items-center gap-2 text-[13px]"
          >
            <UserRound className="h-4 w-4" strokeWidth={1.5} />
            Profil
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

export function LearnerChrome({
  session,
  queryAwal = "",
}: {
  session: SessionPayload;
  queryAwal?: string;
}) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 24);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const activeHref = navItems.filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`)).sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <>
      <a href="#main" className="skip-link">
        Lewati ke konten utama
      </a>
      <div className={`chrome relative ${scrolled ? "is-scrolled" : "is-top"}`}>
        <Link className="chrome-brand" href="/">
          Care<span>evo</span>
        </Link>
        <nav className="nav-float" aria-label="Navigasi utama">
          <ExploreMenu />
          {navItems.map((item) => {
            const active = item.href === activeHref;
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
                className="shrink-0 cursor-pointer rounded-full bg-[#0056D2] px-3.5 py-1.5 text-[13px] font-semibold text-white hover:bg-[#00419e]"
              >
                Cari
              </button>
            </div>
          </form>
          <AccountMenu session={session} />
        </div>
      </div>
    </>
  );
}
