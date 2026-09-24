import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getProfile } from "@/lib/onboarding/store";
import { katalogBelajar } from "@/lib/courses/katalog";
import { listPendaftaran } from "@/lib/courses/enrollment";
import { readStudyChatSnapshot } from "@/lib/learning/chat-store";
import { bangunJalurPersonalisasi } from "@/lib/learning/personalized-path";
import { LearnerShell } from "@/components/ui/learner-shell";
import { JalurBelajarView } from "@/components/features/learning/jalur-belajar-view";
import { StudyChat } from "@/components/features/learning/study-chat";

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
  const snapshot = await readStudyChatSnapshot(session.email);
  const currentModule = path.modules.find((module) => module.status === "current");

  const chatContext = {
    courseId: path.course?.id ?? null,
    courseSlug: path.course?.slug,
    courseTitle: path.course?.title,
    moduleId: currentModule?.id,
    moduleTitle: currentModule?.title,
    completedModuleIds: path.modules
      .filter((module) => module.status === "completed")
      .map((module) => module.id),
    pathSource: path.source,
  };

  return (
    <LearnerShell session={session}>
      <JalurBelajarView
        path={path}
        profile={profile}
        chat={<StudyChat initialSnapshot={snapshot} context={chatContext} />}
      />
    </LearnerShell>
  );
}
