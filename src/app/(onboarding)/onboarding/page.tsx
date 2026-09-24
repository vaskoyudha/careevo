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

  return <OnboardingFlow nama={session.nama} initial={profile ?? undefined} />;
}
