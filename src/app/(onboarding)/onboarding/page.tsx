import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getProfile } from "@/lib/onboarding/store";
import { homeForRole } from "@/lib/auth/roles";
import { OnboardingFlow } from "@/components/features/onboarding/onboarding-flow";

export const metadata: Metadata = {
  title: "Onboarding",
  description: "Personalisasi Careevo: minat, latar belakang, dan tujuan belajar.",
};

/**
 * Onboarding page.
 *
 * Auth-gated here (not via a shared layout) because the redirect target
 * depends on profile state: a logged-in learner without a profile lands here;
 * one who already onboarded is sent home. Anonymous visitors go to /masuk.
 */
export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/masuk");

  const { edit } = await searchParams;
  const isEdit = edit === "1";
  const profile = await getProfile(session.email);

  if (profile && !isEdit) redirect(homeForRole(session.role));

  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center gap-6 bg-background px-4 py-10">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <span className="grid size-7 place-items-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
          C
        </span>
        Careevo
      </div>
      <OnboardingFlow nama={session.nama} initial={profile ?? undefined} />
      <p className="max-w-md text-center text-xs text-muted-foreground">
        Jawabanmu hanya dipakai untuk menyusun rekomendasi kursus dan loker.
        Bisa diubah kapan saja lewat Pengaturan.
      </p>
    </main>
  );
}
