"use client";

import { useState } from "react";
import Link from "next/link";
import { logoutAction } from "@/actions/auth";
import { cn } from "@/lib/utils";
import { isStaffRole } from "@/lib/auth/roles";
import type { SessionPayload } from "@/lib/auth/types";
import {
  LayoutDashboard,
  GraduationCap,
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

const USER_GROUPS: SidebarNavGroup[] = [
  {
    items: [
      { href: "/dashboard", title: "Dashboard", icon: LayoutDashboard },
      { href: "/belajar", title: "Belajar", icon: GraduationCap },
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

  const rowClass = cn(
    "group flex w-full items-center justify-between rounded-[6px] px-2.5 py-[7px] text-left transition-all duration-200 select-none cursor-pointer",
    isActive
      ? "bg-black/5 text-foreground font-medium"
      : "text-muted-foreground hover:bg-black/5 hover:text-foreground/90",
  );

  const content = (
    <>
      <div className="flex items-center gap-2.5">
        <Icon
          className={cn(
            "h-[16px] w-[16px] shrink-0 transition-colors",
            isActive
              ? "text-foreground"
              : "text-muted-foreground/70 group-hover:text-foreground/70",
          )}
          strokeWidth={1.5}
        />
        <span className="truncate text-[13px] tracking-wide">{item.title}</span>
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
          style={{ paddingLeft: `${level * 12 + 10}px` }}
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
              className="absolute top-0 bottom-0 border-l border-black/5"
              style={{ left: `${level * 12 + 17.5}px` }}
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
      style={{ paddingLeft: `${level * 12 + 10}px` }}
      onClick={onNavigate}
      aria-current={isActive ? "page" : undefined}
    >
      {content}
    </Link>
  );
}

export function DashboardSidebar({
  session,
  current,
  mobileOpen = false,
  onNavigate,
  className,
}: {
  session: SessionPayload;
  current: string;
  mobileOpen?: boolean;
  onNavigate?: () => void;
  className?: string;
}) {
  const staff = isStaffRole(session.role);
  const groups = staff ? STAFF_GROUPS : USER_GROUPS;

  return (
    <aside
      className={cn("dashboard-sidebar-aside", className)}
      data-open={mobileOpen}
    >
      <div className="flex h-full w-[260px] flex-col border-r border-border/50 bg-card/50 p-3 font-sans">
        <Link
          href={session.role === "admin" ? "/admin/courses" : staff ? "/review" : "/dashboard"}
          onClick={onNavigate}
          className="group mb-4 flex items-center justify-between rounded-lg px-2 py-2 transition-colors select-none hover:bg-black/5"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-[6px] bg-primary text-[13px] font-semibold uppercase text-primary-foreground shadow-sm">
              {session.nama.charAt(0)}
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="mb-1 max-w-[120px] truncate text-[13px] font-medium leading-none text-foreground">
                {session.nama}
              </span>
              <span className="text-[11px] leading-none text-muted-foreground">
                {session.role === "admin" ? "Admin" : staff ? "Verifikator" : "Peserta"}
              </span>
            </div>
          </div>
          <ChevronRight
            className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-foreground/70"
            strokeWidth={1.5}
          />
        </Link>

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

        <div className="mt-auto flex flex-col gap-0.5 border-t border-border/50 pt-4">
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
          <form action={logoutAction}>
            <button
              type="submit"
              className="group flex w-full items-center gap-2.5 rounded-[6px] px-2.5 py-[7px] text-left text-[13px] tracking-wide text-muted-foreground transition-all duration-200 select-none hover:bg-black/5 hover:text-foreground/90"
              style={{ paddingLeft: "10px" }}
            >
              <LogOut
                className="h-[16px] w-[16px] shrink-0 text-muted-foreground/70 transition-colors group-hover:text-foreground/70"
                strokeWidth={1.5}
              />
              Keluar
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
