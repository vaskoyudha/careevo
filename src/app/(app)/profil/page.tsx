import type { Metadata } from "next";
import { getSession } from "@/lib/auth/session";
import { getProfile } from "@/lib/onboarding/store";
import { getEditableProfile } from "@/lib/profile/store";
import { rekomendasiUntukProfil } from "@/lib/onboarding/rekomendasi";
import { LearnerShell } from "@/components/ui/learner-shell";
import { ProfileView } from "@/components/features/profile/profile-view";

export const metadata: Metadata = {
  title: "Profil",
  description: "Profil publik, preferensi belajar, dan rekomendasi personal Careevo.",
};

/**
 * /profil — the learner's own profile.
 *
 * Renders inside `LearnerShell` (the same chrome as /belajar) so it looks like
 * part of the product. Gathers three data sources: the session (identity), the
 * onboarding profile (personalization), and the editable public profile
 * (photo/bio/website), then ranks real courses/jobs for the recommendation
 * strip.
 */
export default async function ProfilPage() {
  const session = await getSession();
  if (!session) return null;

  const [profile, editable] = await Promise.all([
    getProfile(session.email),
    getEditableProfile(session.email),
  ]);

  const { kursus, loker } = profile
    ? await rekomendasiUntukProfil(profile)
    : { kursus: [], loker: [] };

  return (
    <LearnerShell session={session}>
      <ProfileView
        session={session}
        profile={profile}
        editable={editable}
        kursus={kursus}
        loker={loker}
      />
    </LearnerShell>
  );
}
