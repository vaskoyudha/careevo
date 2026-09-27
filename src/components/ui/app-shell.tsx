"use client";

import { useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import { DashboardSidebar } from "./dashboard-sidebar";
import { AiMasteryNavbar } from "./ai-mastery-navbar";
import type { SessionPayload } from "@/lib/auth/types";

const PAGE_LABELS: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/jelajah": "Jelajah",
  "/belajar": "Belajar",
  "/submission": "Project",
  "/loker": "Loker",
  "/profil": "Profil",
  "/pengaturan": "Pengaturan",
  "/review": "Review",
  "/audit": "Audit",
  "/admin/courses": "Kelola Kursus",
  "/admin/kuis": "Kelola Kuis",
};

/**
 * Judul halaman dari path.
 *
 * Pencocokan persis dulu, lalu awalan terpanjang — tanpa langkah kedua,
 * halaman bersarang seperti `/admin/courses/<id>` akan diam-diam berlabel
 * "Dashboard" karena tidak ada kunci yang sama persis.
 */
function pageLabel(current: string): string {
  const persis = PAGE_LABELS[current];
  if (persis) return persis;

  let cocok: string | null = null;
  for (const kunci of Object.keys(PAGE_LABELS)) {
    if ((current === kunci || current.startsWith(`${kunci}/`)) && (!cocok || kunci.length > cocok.length)) {
      cocok = kunci;
    }
  }
  return cocok ? PAGE_LABELS[cocok] : "Dashboard";
}

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

  const label = pageLabel(current);

  // Mobile: the navbar keeps a hamburger to open the drawer. Desktop: the
  // collapse/expand controls live inside the sidebar itself (top-right corner),
  // not in the navbar.
  const mobileMenuToggle = (
    <button
      type="button"
      onClick={() => setMobileOpen((value) => !value)}
      aria-label="Buka menu navigasi"
      className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] border border-white/80 bg-white/70 text-muted-foreground shadow-sm transition-colors hover:bg-white hover:text-foreground lg:hidden"
    >
      <Menu className="h-[18px] w-[18px]" strokeWidth={1.5} />
    </button>
  );

  return (
    <>
      <AiMasteryNavbar
        session={session}
        pageLabel={label}
        sidebarToggle={mobileMenuToggle}
        showSearch={false}
      />
      <div className="dashboard-shell" data-collapsed={collapsed}>
        <DashboardSidebar
          session={session}
          current={current}
          mobileOpen={mobileOpen}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((value) => !value)}
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
          <main id="main" className="app-main">
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
