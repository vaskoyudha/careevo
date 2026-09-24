import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { AppShell } from "@/components/ui/app-shell";
import { PageHead } from "@/components/ui/page-head";
import { KursusDetail } from "@/components/features/admin/courses/kursus-detail";
import { getCourseById, listKuis } from "@/lib/courses/store";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const kursus = await getCourseById(id);
  return { title: kursus ? `Kelola: ${kursus.title}` : "Kelola Kursus" };
}

export default async function AdminKursusDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) return null;

  const { id } = await params;
  const kursus = await getCourseById(id);
  if (!kursus) notFound();

  // Bank soal dimuat di sini, bukan di dalam editor, supaya panel kuis tiap
  // modul memakai daftar yang sama — satu pembacaan untuk seluruh halaman.
  const bank = await listKuis();

  return (
    <AppShell session={session} current={`/admin/courses/${kursus.id}`}>
      <PageHead
        eyebrow="Area Admin"
        title="Kurikulum Kursus"
        lead="Susun modul, materinya, halamannya, dan kuisnya di sini. Kursus tanpa modul tersimpan tetap memakai kurikulum turunan otomatis."
      />
      <KursusDetail course={kursus} bank={bank} />
    </AppShell>
  );
}
