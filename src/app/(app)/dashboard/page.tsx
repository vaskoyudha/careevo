import type { Metadata } from "next";
import { getSession } from "@/lib/auth/session";
import { getProfile } from "@/lib/onboarding/store";
import { AppShell } from "@/components/ui/app-shell";
import { PageHead } from "@/components/ui/page-head";
import { DashboardRecommendations } from "@/components/features/dashboard/dashboard-recommendations";
import { JobInboxCard } from "@/components/features/dashboard/job-inbox-card";

export const metadata: Metadata = {
  title: "Dashboard",
};

/**
 * Dashboard peserta.
 *
 * Permukaan ini hanya menampilkan yang bisa ditelusuri ke akun yang sedang
 * masuk: rekomendasi dari profil onboarding yang ditandatangani, dan tautan ke
 * inbox lowongan. Skor, hitungan hari beruntun, dan absensi **tidak** ada di
 * sini — angka tersebut dibangun dari `learning_runs` di
 * `docs/superpowers/plans/2026-09-27-real-attendance-and-jadwal-score.md`.
 *
 * `dashboard-integritas.test.ts` menjaga batas ini. Pindaiannya membaca seluruh
 * isi berkas — komentar termasuk — jadi nama blok yang dihapus tidak boleh
 * ditulis di sini.
 */
export default async function DashboardPage() {
  const session = await getSession();
  if (!session) return null;

  const profile = await getProfile(session.email);

  return (
    <AppShell session={session} current="/dashboard">
      <PageHead
        title={`Halo, ${session.nama}`}
        lead="Rekomendasi belajar dan lowongan yang sudah disesuaikan dengan minatmu."
      />
      {profile ? (
        <div className="mb-6">
          <DashboardRecommendations profile={profile} />
        </div>
      ) : null}
      <JobInboxCard />
    </AppShell>
  );
}
