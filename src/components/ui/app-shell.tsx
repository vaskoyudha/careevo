"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import {
  ChevronDown,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  UserRound,
} from "lucide-react";
import { logoutAction } from "@/actions/auth";
import { DashboardSidebar } from "./dashboard-sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import type { SessionPayload } from "@/lib/auth/types";

const PAGE_LABELS: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/belajar": "Belajar",
  "/loker": "Loker",
  "/profil": "Profil",
  "/pengaturan": "Pengaturan",
  "/review": "Review",
  "/audit": "Audit",
  "/admin/courses": "Kelola Kursus",
};

export function AppShell({
  session,
  current,
  children,
}: {
  session: SessionPayload;
  current: string;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const toggle = () => {
    if (window.matchMedia("(min-width: 1024px)").matches) {
      setCollapsed((value) => !value);
    } else {
      setMobileOpen((value) => !value);
    }
  };

  const label = PAGE_LABELS[current] ?? "Dashboard";
  const roleLabel =
    session.role === "admin"
      ? "Admin"
      : session.role === "verifikator"
        ? "Verifikator"
        : "Peserta";

  return (
    <div className="dashboard-shell" data-collapsed={collapsed}>
      <a href="#main" className="skip-link">
        Lewati ke konten utama
      </a>

      <DashboardSidebar
        session={session}
        current={current}
        mobileOpen={mobileOpen}
        onNavigate={() => setMobileOpen(false)}
      />

      {mobileOpen ? (
        <div
          className="dashboard-overlay lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      <div className="dashboard-content">
        <div className="dashboard-topbar">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={toggle}
              aria-label="Buka atau tutup menu navigasi"
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground"
            >
              <Menu className="h-[18px] w-[18px] lg:hidden" strokeWidth={1.5} />
              {collapsed ? (
                <PanelLeftOpen
                  className="hidden h-[18px] w-[18px] lg:block"
                  strokeWidth={1.5}
                />
              ) : (
                <PanelLeftClose
                  className="hidden h-[18px] w-[18px] lg:block"
                  strokeWidth={1.5}
                />
              )}
            </button>
            <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
              <span className="shrink-0">Careevo</span>
              <span className="shrink-0">/</span>
              <span className="truncate font-medium text-foreground">
                {label}
              </span>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Buka menu akun"
                className="group flex items-center gap-2 rounded-full border border-transparent py-1 pr-1.5 pl-2 text-muted-foreground transition-colors select-none hover:border-black/10 hover:bg-black/5 hover:text-foreground data-[state=open]:border-black/10 data-[state=open]:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <span className="hidden text-[13px] sm:inline">
                  @{session.username}
                </span>
                <span
                  className="grid h-8 w-8 place-items-center rounded-full border border-primary/20 bg-primary/10 text-[12px] font-semibold uppercase text-primary"
                  aria-hidden="true"
                >
                  {session.nama.charAt(0)}
                </span>
                <ChevronDown
                  className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60 transition-transform duration-200 group-data-[state=open]:rotate-180"
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
                <span className="mt-1 w-fit rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-primary uppercase">
                  {roleLabel}
                </span>
              </DropdownMenuLabel>

              <DropdownMenuSeparator />

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
        </div>

        <main id="main" className="app-main">
          {children}
        </main>
      </div>
    </div>
  );
}
