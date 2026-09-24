import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getProfile } from "@/lib/onboarding/store";
import { katalogBelajar } from "@/lib/courses/katalog";
import { listPendaftaran } from "@/lib/courses/enrollment";
import { bangunJalurPersonalisasi } from "@/lib/learning/personalized-path";
import { LearnerShell } from "@/components/ui/learner-shell";
import { JalurBelajarView } from "@/components/features/learning/jalur-belajar-view";

export const metadata: Metadata = { title: "Jalur Belajar" };

export default async function JalurBelajarPage() {
  const session = await getSession();
  if (!session) return null;

  const [profile, catalog, enrollments] = await Promise.all([
    getProfile(session.email),
    katalogBelajar(),
    listPendaftaran(session.email),
  ]);

  if (!profile) notFound();

  const path = bangunJalurPersonalisasi({ profile, catalog, enrollments });

  return (
    <LearnerShell session={session}>
      <JalurBelajarView path={path} profile={profile} />
    </LearnerShell>
  );
}
