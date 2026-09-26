"use client";

import Link from "next/link";
import { useTransition, type ReactNode } from "react";
import {
  Briefcase,
  Building2,
  ChevronDown,
  GraduationCap,
  LogOut,
  Route,
  Settings,
  Sparkle,
  UserRound,
} from "./icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { logoutAction } from "@/actions/auth";
import type { SessionPayload } from "@/lib/auth/types";

/**
 * Navbar atoms shared by the two learner navbars.
 *
 * `LearnerChrome` (light glass, morphs on scroll) and `AiMasteryNavbar` (dark
 * winged bar) are different bars, but they show the same destinations to the
 * same signed-in learner, and the account menu is a server-action logout plus
 * four links. Duplicating either would let the two drift — the failure mode
 * this repo has already paid for once, when the navbar grew a `ModeToggle` that
 * competed with `Belajar` instead of complementing it.
 *
 * Deliberately NOT shared with `Chrome` (the marketing bar): its `navItems` is a
 * different, shorter list without `/belajar/jalur`. Two lists that look alike
 * are not the same list — do not merge them.
 */

export type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
};

export const learnerNavItems: NavItem[] = [
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

/**
 * `tone` is the bar's surface, not a colour scheme: the dropdown is portalled
 * and always light, so only the trigger adapts. It is a prop rather than a
 * `.is-winged` descendant selector because the trigger's chevron is an icon
 * with no stable class to hang a rule on, and a wrong guess there is a
 * black-on-black chevron rather than a visible bug.
 */
export function AccountMenu({
  session,
  tone = "light",
}: {
  session: SessionPayload;
  tone?: "light" | "dark";
}) {
  const [isPending, startTransition] = useTransition();
  const dark = tone === "dark";
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
          className={`group flex cursor-pointer items-center gap-1 rounded-full p-1 select-none focus-visible:outline-none focus-visible:ring-2 ${
            dark
              ? "hover:bg-white/15 focus-visible:ring-white/50"
              : "hover:bg-white/85 focus-visible:ring-[#0056D2]/40"
          }`}
        >
          <span
            className="grid size-8 place-items-center rounded-full bg-[#0056D2] text-xs font-bold text-white uppercase"
            aria-hidden="true"
          >
            {session.nama.charAt(0)}
          </span>
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180 ${
              dark ? "text-white/75" : "text-black/60"
            }`}
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
