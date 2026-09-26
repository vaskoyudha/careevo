"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import {
  Briefcase,
  Building2,
  ChevronDown,
  GraduationCap,
  LogOut,
  Search,
  Settings,
  Sparkle,
  Route,
  UserRound,
} from "./icons";
import { logoutAction } from "@/actions/auth";
import { ExploreMenu } from "./explore-menu";
import { SiJagoLink } from "./sijago-link";
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
    icon: <GraduationCap size={15} strokeWidth={1.5} aria-hidden="true" />,
  },
  {
    href: "/belajar/jalur",
    label: "Jalur Belajar",
    icon: <Route size={15} strokeWidth={1.5} aria-hidden="true" />,
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

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <a href="#main" className="skip-link">
        Lewati ke konten utama
      </a>
      <div className={`chrome relative ${scrolled ? "is-scrolled" : "is-top"}`}>
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
          {navItems.map((item) => {
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
          <SiJagoLink />
          <AccountMenu session={session} />
        </div>
      </div>
    </>
  );
}
