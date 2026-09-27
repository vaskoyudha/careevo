"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { logoutAction } from "@/actions/auth";
import { cn } from "@/lib/utils";
import { isStaffRole } from "@/lib/auth/roles";
import type { SessionPayload } from "@/lib/auth/types";
import {
  LayoutDashboard,
  Compass,
  Briefcase,
  Settings,
  LogOut,
  ClipboardCheck,
  ShieldCheck,
  ChevronRight,
  BookOpen,
  ListChecks,
  UserRound,
  BarChart3,
  ShieldAlert,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

export type SidebarNavItem = {
  href: string;
  title: string;
  icon: React.ElementType;
  children?: SidebarNavItem[];
};

export type SidebarNavGroup = {
  heading?: string;
  items: SidebarNavItem[];
};

/**
 * Navigasi learner.
 *
 * `Progres` pindah dari navbar (`learnerNavItems` di `chrome-parts`) ke sini;
 * `Project` semula juga ada di sini, tetapi **sejak submission terikat course**,
 * ia tidak lagi menjadi destinasi `AppShell`: surface-nya hidup di dalam setiap
 * course (`/belajar/[slug]/karya`), jadi pintu masuknya adalah panel Project di
 * halaman course, bukan sidebar. `Progres` menjaga posisi lamanya (mendahului
 * `Jelajah`).
 *
 * **`Belajar` sengaja tidak ada di sini, dan itu bukan kelalaian.** `/belajar`
 * adalah halaman `LearnerShell` yang memakai navbar sendiri, jadi entri sidebar
 * kedua hanya mengulang pintu masuk yang sudah ada di navbar atas. Sidebar untuk
 * halaman `AppShell`; navbar yang mengurus halaman `LearnerShell`. `Belajar`
 * tetap hidup di `learnerNavItems` (`chrome-parts.tsx`) — jangan menambahkan
 * `Belajar` kembali ke sini tanpa alasan yang lebih baik daripada "konsisten
 * dengan daftar di navbar".
 *
 * `Progres` dulu bernama `Jalur Belajar` dan beralamat `/belajar/jalur`. Isinya
 * berubah: halaman itu menampilkan satu jalur personal ke satu kursus, sedangkan
 * yang dipakai di sini adalah daftar semua kursus yang diambil beserta persennya
 * — jadi nama dan rutenya ikut pindah ke `/progres` (rute lama masih redirect).
 *
 * Hanya tampil di `AppShell` (dashboard). Halaman `LearnerShell` (`/belajar`,
 * `/profil`) punya navbar sendiri tanpa sidebar, jadi `/progres` tidak punya
 * pintu masuk dari sana — pintu masuknya dari sidebar dashboard, section
 * "Pembelajaran saya" di `/belajar`, dan link in-page.
 */
const USER_GROUPS: SidebarNavGroup[] = [
  {
    items: [
      { href: "/dashboard", title: "Dashboard", icon: LayoutDashboard },
      { href: "/progres", title: "Progres", icon: BarChart3 },
      { href: "/jelajah", title: "Jelajah", icon: Compass },
      { href: "/loker", title: "Loker", icon: Briefcase },
    ],
  },
];

const STAFF_GROUPS: SidebarNavGroup[] = [
  {
    heading: "Admin",
    items: [
      { href: "/admin/courses", title: "Kelola Kursus", icon: BookOpen },
      { href: "/admin/kuis", title: "Kelola Kuis", icon: ListChecks },
    ],
  },
  {
    heading: "Verifikator",
    items: [
      { href: "/review", title: "Review", icon: ClipboardCheck },
      { href: "/audit", title: "Audit", icon: ShieldCheck },
      { href: "/performa", title: "Laporan Belajar", icon: BarChart3 },
      {
        href: "/performa/integritas",
        title: "Laporan Integritas",
        icon: ShieldAlert,
      },
    ],
  },
];

function isActiveHref(current: string, href: string) {
  return current === href || current.startsWith(`${href}/`);
}

function NavItem({
  item,
  current,
  onNavigate,
  level = 0,
}: {
  item: SidebarNavItem;
  current: string;
  onNavigate?: () => void;
  level?: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const hasChildren = !!item.children?.length;
  const isActive = isActiveHref(current, item.href);
  const Icon = item.icon;

  // Pill rows, matching the AI Mastery sidebar: a full-radius control with one
  // tonal fill for the current page. The active state is a solid --accent
  // rather than a gradient wash, and the icon carries the state through weight
  // (1.9 vs 1.6) so it survives a greyscale or a colour-vision difference.
  const rowClass = cn(
    "group flex min-h-9 w-full items-center justify-between rounded-full px-3 text-left transition-colors duration-200 select-none cursor-pointer",
    isActive
      ? "bg-[var(--accent)] font-medium text-[var(--accent-foreground)]"
      : "text-muted-foreground hover:bg-[var(--muted)] hover:text-foreground",
  );

  const indent = { paddingLeft: `calc(0.75rem + ${level} * 0.875rem)` };

  const content = (
    <>
      <div className="flex items-center gap-2.5">
        <Icon
          className="h-[16px] w-[16px] shrink-0 transition-colors"
          strokeWidth={isActive ? 1.9 : 1.6}
        />
        <span className="truncate text-[13px]">{item.title}</span>
      </div>
      {hasChildren ? (
        <ChevronRight
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-muted-foreground/50 transition-transform duration-200",
            isOpen && "rotate-90",
          )}
          strokeWidth={2}
        />
      ) : null}
    </>
  );

  if (hasChildren) {
    return (
      <div className="flex w-full flex-col">
        <div
          className={rowClass}
          style={indent}
          onClick={() => setIsOpen((open) => !open)}
          aria-expanded={isOpen}
        >
          {content}
        </div>
        <div
          className={cn(
            "grid transition-[grid-template-rows,opacity] duration-300 ease-in-out",
            isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
          )}
        >
          <div className="relative mt-0.5 flex min-h-0 flex-col gap-0.5 overflow-hidden">
            <div
              className="absolute top-0 bottom-0 border-l border-[var(--border)]"
              style={{ left: `calc(0.75rem + ${level} * 0.875rem + 0.7rem)` }}
            />
            {item.children!.map((child) => (
              <NavItem
                key={child.href}
                item={child}
                current={current}
                onNavigate={onNavigate}
                level={level + 1}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      className={rowClass}
      style={indent}
      onClick={onNavigate}
      aria-current={isActive ? "page" : undefined}
    >
      {content}
    </Link>
  );
}

/** Icon-only row for the collapsed rail. */
function RailItem({
  item,
  current,
  onNavigate,
}: {
  item: SidebarNavItem;
  current: string;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const isActive = isActiveHref(current, item.href);

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={item.title}
      aria-label={item.title}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-colors duration-200",
        isActive
          ? "bg-[var(--accent)] text-[var(--accent-foreground)] shadow-sm"
          : "text-muted-foreground hover:bg-[var(--muted)] hover:text-foreground",
      )}
    >
      <Icon className="h-[16px] w-[16px]" strokeWidth={isActive ? 1.9 : 1.6} />
    </Link>
  );
}

export function DashboardSidebar({
  session,
  current,
  mobileOpen = false,
  collapsed = false,
  onToggleCollapse,
  onNavigate,
  className,
}: {
  session: SessionPayload;
  current: string;
  mobileOpen?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
  className?: string;
}) {
  const staff = isStaffRole(session.role);
  const groups = staff ? STAFF_GROUPS : USER_GROUPS;
  const homeHref =
    session.role === "admin" ? "/admin/courses" : staff ? "/review" : "/dashboard";
  const roleLabel =
    session.role === "admin"
      ? "Admin"
      : session.role === "verifikator"
        ? "Verifikator"
        : "Peserta";

  // The rail is a desktop affordance. Below 1024px the sidebar is a drawer that
  // the navbar hamburger + scrim already own, so the collapse state is ignored
  // there and the full panel renders.
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const railCollapsed = collapsed && isDesktop;

  if (railCollapsed) {
    const railItems = groups.flatMap((group) => group.items);

    return (
      <aside
        className={cn("dashboard-sidebar-aside", className)}
        data-open={mobileOpen}
      >
        <div className="dashboard-sidebar-panel dashboard-sidebar-rail">
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Buka sidebar"
            title="Buka sidebar"
            className="mx-auto mb-2 grid h-9 w-9 shrink-0 place-items-center rounded-[10px] text-muted-foreground transition-colors hover:bg-[var(--muted)] hover:text-foreground"
          >
            <PanelLeftOpen className="h-[18px] w-[18px]" strokeWidth={1.6} />
          </button>

          <Link
            href={homeHref}
            onClick={onNavigate}
            aria-label={session.nama}
            title={session.nama}
            className="mx-auto mb-2 grid h-9 w-9 shrink-0 place-items-center rounded-full text-[12px] font-semibold text-white uppercase"
            style={{
              background: "var(--brand-grad)",
              border: "1px solid var(--brand-border)",
              boxShadow: "var(--brand-shadow)",
            }}
          >
            {session.nama.charAt(0)}
          </Link>

          <div className="flex w-full flex-1 flex-col items-center gap-1 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {railItems.map((item) => (
              <RailItem
                key={item.href}
                item={item}
                current={current}
                onNavigate={onNavigate}
              />
            ))}
          </div>

          <div className="mt-auto flex w-full flex-col items-center gap-1 border-t border-[var(--border)] pt-3">
            <RailItem
              item={{ href: "/profil", title: "Profil", icon: UserRound }}
              current={current}
              onNavigate={onNavigate}
            />
            <RailItem
              item={{ href: "/pengaturan", title: "Pengaturan", icon: Settings }}
              current={current}
              onNavigate={onNavigate}
            />
            <form action={logoutAction}>
              <button
                type="submit"
                aria-label="Keluar"
                title="Keluar"
                className="grid h-9 w-9 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-[var(--muted)] hover:text-foreground"
              >
                <LogOut className="h-[16px] w-[16px]" strokeWidth={1.6} />
              </button>
            </form>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside
      className={cn("dashboard-sidebar-aside", className)}
      data-open={mobileOpen}
    >
      <div className="dashboard-sidebar-panel">
        {/* Header: profile card + collapse toggle (desktop only, top-right). */}
        <div className="mb-4 flex items-center gap-1.5">
          <Link
            href={homeHref}
            onClick={onNavigate}
            className="group flex min-w-0 flex-1 items-center justify-between rounded-full border border-[var(--border)] bg-[var(--muted)] px-2.5 py-1.5 transition-colors select-none hover:bg-[var(--accent)]"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold uppercase text-white"
                style={{
                  background: "var(--brand-grad)",
                  border: "1px solid var(--brand-border)",
                  boxShadow: "var(--brand-shadow)",
                }}
              >
                {session.nama.charAt(0)}
              </div>
              <div className="flex min-w-0 flex-col overflow-hidden">
                <span className="mb-0.5 max-w-[120px] truncate text-[13px] font-medium leading-none text-foreground">
                  {session.nama}
                </span>
                <span className="text-[11px] leading-none text-muted-foreground">
                  {roleLabel}
                </span>
              </div>
            </div>
            <ChevronRight
              className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-foreground/70"
              strokeWidth={1.5}
            />
          </Link>
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Ciutkan sidebar"
            title="Ciutkan sidebar"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] text-muted-foreground transition-colors hover:bg-[var(--muted)] hover:text-foreground max-lg:hidden"
          >
            <PanelLeftClose className="h-[18px] w-[18px]" strokeWidth={1.6} />
          </button>
        </div>

        <div className="mt-2 flex flex-1 flex-col gap-4 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {groups.map((group) => (
            <div key={group.heading ?? group.items[0]?.href} className="flex flex-col gap-0.5">
              {group.heading ? (
                <span className="mb-1 px-2.5 text-[11px] font-semibold tracking-wider text-muted-foreground/50 uppercase">
                  {group.heading}
                </span>
              ) : null}
              {group.items.map((item) => (
                <NavItem
                  key={item.href}
                  item={item}
                  current={current}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          ))}
        </div>

        <div className="mt-auto flex flex-col gap-0.5 border-t border-[var(--border)] pt-4">
          <NavItem
            item={{ href: "/profil", title: "Profil", icon: UserRound }}
            current={current}
            onNavigate={onNavigate}
          />
          <NavItem
            item={{ href: "/pengaturan", title: "Pengaturan", icon: Settings }}
            current={current}
            onNavigate={onNavigate}
          />
          {/* Same pill vocabulary as NavItem — a control that looks different
              next to its neighbours reads as a different kind of control. */}
          <form action={logoutAction}>
            <button
              type="submit"
              className="group flex min-h-9 w-full items-center gap-2.5 rounded-full px-3 text-left text-[13px] text-muted-foreground transition-colors duration-200 select-none hover:bg-[var(--muted)] hover:text-foreground"
            >
              <LogOut className="h-[16px] w-[16px] shrink-0" strokeWidth={1.6} />
              Keluar
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
