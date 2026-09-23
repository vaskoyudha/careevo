import type { Metadata } from "next";
import { getSession } from "@/lib/auth/session";
import { getProfile } from "@/lib/onboarding/store";
import { AppShell } from "@/components/ui/app-shell";
import { PageHead } from "@/components/ui/page-head";
import { DashboardView } from "@/components/features/dashboard/dashboard-view";
import { DashboardRecommendations } from "@/components/features/dashboard/dashboard-recommendations";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) return null;

  const profile = await getProfile();

  return (
    <AppShell session={session} current="/dashboard">
      <PageHead
        eyebrow="Dashboard"
        title={`Halo, ${session.nama}`}
        lead="Jadwal, streak, rekomendasi Navigator, dan skor terverifikasi dalam satu tempat."
      />
      {profile ? (
        <div className="mb-6">
          <DashboardRecommendations profile={profile} />
        </div>
      ) : null}
      <DashboardView />
    </AppShell>
  );
}
