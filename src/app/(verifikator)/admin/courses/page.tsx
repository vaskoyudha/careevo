import type { Metadata } from "next";
import { getSession } from "@/lib/auth/session";
import { AppShell } from "@/components/ui/app-shell";
import { PageHead } from "@/components/ui/page-head";
import { CourseManager } from "@/components/features/admin/courses/course-manager";
import { listCourses, getCourseStats } from "@/lib/courses/store";

export const metadata: Metadata = {
  title: "Kelola Kursus",
};

export default async function AdminCoursesPage() {
  const session = await getSession();
  if (!session) return null;

  const courses = await listCourses();
  const stats = await getCourseStats();

  return (
    <AppShell session={session} current="/admin/courses">
      <PageHead
        eyebrow="Area Admin"
        title="Kelola Kursus & Kurikulum"
        lead="Buat, perbarui, dan pantau kurikulum kursus terverifikasi, jalur kompetensi, serta materi pelatihan peserta."
      />
      <CourseManager initialCourses={courses} initialStats={stats} />
    </AppShell>
  );
}
