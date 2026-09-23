import type { Metadata } from "next";
import { getSession } from "@/lib/auth/session";
import { getProfile } from "@/lib/onboarding/store";
import { AppShell } from "@/components/ui/app-shell";
import { PageHead } from "@/components/ui/page-head";
import { SettingsForm } from "@/components/features/settings/settings-form";
import { OnboardingProfileCard } from "@/components/features/settings/onboarding-profile-card";

export const metadata: Metadata = {
  title: "Pengaturan",
};

export default async function PengaturanPage() {
  const session = await getSession();
  if (!session) return null;

  const profile = await getProfile();

  return (
    <AppShell session={session} current="/pengaturan">
      <PageHead
        eyebrow="Pengaturan"
        title="Profil dan privasi"
        lead="Atur jadwal, kelola persetujuan, dan hapus timeline kapan saja. Kontrol penuh di tangan kamu."
      />
      <div className="grid-app">
        {profile ? <OnboardingProfileCard profile={profile} /> : null}
        <SettingsForm nama={session.nama} email={session.email} username={session.username} />
      </div>
    </AppShell>
  );
}
