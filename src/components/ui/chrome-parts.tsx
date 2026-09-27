"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition, type ReactNode } from "react";
import {
  Briefcase,
  Building2,
  ChevronDown,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  MessageSquare,
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
 * Navbar atoms shared by the three bars that render a signed-in learner.
 *
 * `LearnerChrome` (light glass, morphs on scroll), `AiMasteryNavbar` (dark
 * winged bar), and `Chrome` (marketing/public) are different bars, but they
 * show the same account affordances to the same signed-in learner, and the
 * account menu is a server-action logout plus four links. Duplicating either
 * would let the three drift — the failure mode this repo has already paid for
 * once, when the navbar grew a `ModeToggle` that competed with `Belajar`
 * instead of complementing it.
 *
 * `Chrome` is now the third consumer, because it used to print a hardcoded
 * `Masuk`/`Daftar` pair to people who already had a session. Before that it
 * never looked at auth at all, so "signed in" simply did not exist as an input
 * to it.
 *
 * Deliberately NOT shared with `Chrome`: the `learnerNavItems` list itself.
 * It currently holds the same five destinations as `Chrome`'s `navItems` — but
 * only by coincidence. They were once different (the learner bar carried
 * `/progres`, since moved to the dashboard sidebar; `/submission` was once
 * here too, and now lives inside each course at `/belajar/[slug]/karya`),
 * and they are free to diverge again: one list is signed-in
 * wayfinding, the other is a marketing bar deciding at render time whether the
 * visitor has a session. Two lists that look alike are not the same list — do
 * not merge them.
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
  // AI Mastery is a destination, not a utility, so it belongs in this row with a
  // visible name beside the icon like every other item. It used to be an
  // icon-only button parked in `.chrome-actions`; read next to `Cari` and the
  // avatar it looked like a control, and being `xl:block` it disappeared
  // entirely on phones — where the nav collapses to icons and it now stays
  // reachable. `MessageSquare` matches the "Belajar di AI Mastery" link in
  // `mastery-topic-view.tsx`; `Sparkle`/`Sparkles` were the alternatives and
  // both read as a near-duplicate of `Careevo Plus` a few items away.
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
 * "Dashboard" action button, parked in `.chrome-actions` right beside the
 * account menu (the "profile") on the learner navbars. Icon-only, matching the
 * compact nav vocabulary: the label is kept for screen readers and surfaced on
 * wide screens only if the bar has room.
 */
export function DashboardButton() {
  const pathname = usePathname();
  const active =
    pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  return (
    <Link
      href="/dashboard"
      aria-current={active ? "page" : undefined}
      className={active ? "nav-item is-active" : "nav-item"}
    >
      <LayoutDashboard size={15} strokeWidth={1.5} aria-hidden="true" />
      <span className="sr-only">Dashboard</span>
    </Link>
  );
}

export function AccountMenu({ session }: { session: SessionPayload }) {
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
