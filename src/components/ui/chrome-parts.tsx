"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  Briefcase,
  Building2,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Settings,
  Sparkle,
  UserRound,
  type LucideIcon,
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
 * account menu (the "profile") on the learner navbars. Renders as a styled brand
 * button using the blue-white gradient.
 */
export function DashboardButton() {
  const pathname = usePathname();
  const active =
    pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  return (
    <Link
      href="/dashboard"
      aria-current={active ? "page" : undefined}
      className={cn(
        "chrome-btn chrome-btn-brand gap-1.5",
        active && "ring-2 ring-white/60 shadow-md"
      )}
    >
      <LayoutDashboard size={14} strokeWidth={1.75} aria-hidden="true" />
      <span>Dashboard</span>
    </Link>
  );
}

/**
 * Kartu aksi di dalam panel akun — resep yang sama dengan tile di
 * `explore-menu.tsx` (`rounded-lg border border-border px-3 py-2.5`,
 * `hover:border-primary hover:bg-accent`).
 *
 * Letak di sini, bukan di caller, karena `DropdownMenuItem` STILL membawa
 * `rounded-sm px-2 py-1.5`-nya sendiri dan `cn` di repo ini hanya
 * menyambung string (bukan `tailwind-merge`) — kalau pemanggil menulis
 * `px-3 py-2.5`, dua kelas padding itu jadi rebutan urutan emisi Tailwind,
 * bukan urutan tertulis. Resep di satu tempat, bukan ditimpa diam-diam.
 */
const KARTU_AKUN =
  "w-full cursor-pointer items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-left transition-colors hover:border-primary hover:bg-accent";

/** Avatar bundar untuk kartu menu; `size` dictated by the tile that uses it. */
function InisialAkun({
  nama,
  className,
}: {
  nama: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-[#0056D2] font-bold text-white uppercase",
        className
      )}
      aria-hidden="true"
    >
      {nama.charAt(0)}
    </span>
  );
}

/** `Role` is `user | verifikator | admin`; the badge shows it in Indonesian. */
const LABEL_PERAN: Record<SessionPayload["role"], string> = {
  user: "Peserta",
  verifikator: "Verifikator",
  admin: "Admin",
};

/**
 * Tiga tujuan yang selalu ada, dalam urutan yang sering dipakai: lihat
 * progres dulu, lalu ubah data, lalu ubah setelan. Dinyusun sebagai data
 * supaya kartu dan ikon-ikonnya tidak ditulis ulang tiga kali — setiap
 * penambahan item cukup satu baris, bukan satu blok JSX.
 */
const TUJUAN_AKUN: { href: string; label: string; Ikon: LucideIcon }[] = [
  { href: "/dashboard", label: "Dashboard", Ikon: LayoutDashboard },
  { href: "/profil", label: "Profil", Ikon: UserRound },
  { href: "/pengaturan", label: "Pengaturan", Ikon: Settings },
];

export function AccountMenu({ session }: { session: SessionPayload }) {
  const [isPending, startTransition] = useTransition();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Buka menu akun"
          className="group flex cursor-pointer items-center gap-1 rounded-full p-1 select-none hover:bg-white/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0056D2]/40"
        >
          <InisialAkun nama={session.nama} className="size-8 text-xs" />
          <ChevronDown
            className="h-3.5 w-3.5 shrink-0 text-black/60 transition-transform duration-200 group-data-[state=open]:rotate-180"
            strokeWidth={2}
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        surface="panel"
        className="w-80 max-w-[calc(100vw-1rem)] rounded-2xl border border-border bg-card p-0 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.2),0_10px_20px_-5px_rgba(0,0,0,0.08)]"
      >
        {/* Identitas di atas, dipisah garis — jadi kartu pertama di
            bawahnya tidak pernah Sharing header dengan kartu aksi. */}
        <DropdownMenuLabel
          surface="band"
          className="flex items-center gap-3 border-b border-border px-4 py-3.5"
        >
          <InisialAkun nama={session.nama} className="size-10 text-sm" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium text-foreground">
              {session.nama}
            </span>
            <span className="mt-0.5 block truncate text-[12px] font-normal text-muted-foreground">
              {session.email}
            </span>
          </span>
          <span className="shrink-0 rounded-full bg-[#0056D2]/10 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-[#0056D2] uppercase">
            {LABEL_PERAN[session.role]}
          </span>
        </DropdownMenuLabel>

        <div className="grid gap-2 p-3">
          {TUJUAN_AKUN.map(({ href, label, Ikon }) => (
            <DropdownMenuItem key={href} asChild surface="card">
              <Link href={href} className={KARTU_AKUN}>
                <Ikon
                  size={16}
                  strokeWidth={1.5}
                  className="size-4 shrink-0 text-ocean-deep"
                  aria-hidden="true"
                />
                <span className="truncate text-[13px]">{label}</span>
                <ChevronRight
                  size={14}
                  strokeWidth={1.5}
                  className="ml-auto size-3.5 shrink-0 text-text-tertiary"
                  aria-hidden="true"
                />
              </Link>
            </DropdownMenuItem>
          ))}
        </div>

        <DropdownMenuSeparator className="mx-0" />

        {/* Keluar sendirian di kaki panel: hanya satu aksi yang membatalkan
            sesi, jadi ia tidak boleh berbagi grid dengan tiga tujuan
            navigasi — dan `variant="destructive"` tetap berlaku walau
            permukaannya kartu. */}
        <div className="p-3 pt-2">
          <DropdownMenuItem
            surface="card"
            variant="destructive"
            disabled={isPending}
            onSelect={() => {
              startTransition(() => {
                void logoutAction();
              });
            }}
            className={cn(
              KARTU_AKUN,
              "hover:border-destructive/40 hover:bg-destructive/5"
            )}
          >
            <LogOut
              size={16}
              strokeWidth={1.5}
              className="size-4 shrink-0"
              aria-hidden="true"
            />
            <span className="truncate text-[13px]">
              {isPending ? "Keluar…" : "Keluar"}
            </span>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
