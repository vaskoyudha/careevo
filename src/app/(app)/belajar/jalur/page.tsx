import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { normalizeOwner } from "@/lib/auth/types";
import { getProfile } from "@/lib/onboarding/store";
import { katalogBelajar } from "@/lib/courses/katalog";
import type { Pendaftaran } from "@/lib/courses/enrollment";
import { pastikanBackfill } from "@/lib/learning/backfill-lazy";
import { listKursusTerdaftarDb, progresKursusDb } from "@/lib/learning/service";
import { readStudyChatSnapshot } from "@/lib/learning/chat-store";
import { bangunJalurPersonalisasi } from "@/lib/learning/personalized-path";
import { LearnerShell } from "@/components/ui/learner-shell";
import { JalurBelajarView } from "@/components/features/learning/jalur-belajar-view";
import { StudyChat } from "@/components/features/learning/study-chat";

export const metadata: Metadata = { title: "Jalur Belajar" };

export default async function JalurBelajarPage() {
  const session = await getSession();
  if (!session) return null;

  // Migrasi lazy sebelum membaca, sama seperti halaman belajar lain: enrollment
  // cookie pemilik ini dipindahkan ke database sekali saja.
  await pastikanBackfill(session);

  const [profile, catalog, terdaftar] = await Promise.all([
    getProfile(session.email),
    katalogBelajar(),
    listKursusTerdaftarDb(session),
  ]);

  if (!profile) notFound();

  // `bangunJalurPersonalisasi` masih memakai bentuk `Pendaftaran[]` dari cookie.
  // Bentuk itu dibangun ulang dari baris database, bukan dengan mengubah
  // algoritmanya: id modul selesai tetap dibaca service (`progresKursusDb`),
  // dan `owner` diisi email principal supaya penyaringan di dalamnya cocok.
  const owner = normalizeOwner(session.email);
  const enrollments: Pendaftaran[] = [];
  for (const pendaftaran of terdaftar) {
    const { selesai } = await progresKursusDb(session, pendaftaran.courseId);
    enrollments.push({
      course_id: pendaftaran.courseId,
      slug:
        catalog.find((entri) => entri.id === pendaftaran.courseId)?.slug ??
        pendaftaran.courseId,
      owner,
      enrolled_at:
        pendaftaran.enrolledAt instanceof Date
          ? pendaftaran.enrolledAt.toISOString()
          : String(pendaftaran.enrolledAt),
      selesai_modul: selesai,
    });
  }

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
