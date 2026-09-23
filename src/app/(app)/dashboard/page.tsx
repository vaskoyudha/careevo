import type { Metadata } from "next";
import { getSession } from "@/lib/auth/session";
import { AppShell } from "@/components/ui/app-shell";
import { PageHead } from "@/components/ui/page-head";
import { DashboardView } from "@/components/features/dashboard/dashboard-view";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) return null;

  return (
    <AppShell session={session} current="/dashboard">
      <PageHead
        eyebrow="Dashboard"
        title={`Halo, ${session.nama}`}
        lead="Jadwal, streak, rekomendasi Navigator, dan skor terverifikasi dalam satu tempat."
      />
      <DashboardView />
    </AppShell>
  );
}
