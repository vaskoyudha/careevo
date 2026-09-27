import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { LearnerShell } from "@/components/ui/learner-shell";
import { StatusBadge, statusSubmission } from "@/components/ui/status-badge";
import { BuatSubmissionForm } from "@/components/features/submission/submission-actions";
import { kelayakanKursusSubmission, listKaryaCourse } from "@/lib/review/service";
import { cariEntri } from "@/lib/courses/katalog";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const entri = await cariEntri(slug);
  return { title: entri ? `Project · ${entri.title}` : "Project" };
}

/**
 * Project course — surface submission yang **hanya bisa diakses dari dalam
 * course** (`/belajar/[slug]/karya`). Daftar karya di sini hanya milik course
 * ini, dan form buat karyanya terikat course lewat hidden field, bukan dropdown
 * kursus (course tidak bisa dipilih klien).
 */
export default async function KaryaCoursePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await getSession();
  if (!session?.userId) return null;

  const { slug } = await params;
  const entri = await cariEntri(slug);
  if (!entri) notFound();

  const [layak, karya] = await Promise.all([
    kelayakanKursusSubmission(session, entri.id),
    listKaryaCourse(session, entri.id),
  ]);

  const siap = layak !== null;

  return (
    <LearnerShell session={session}>
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <nav aria-label="Breadcrumb" className="mb-2 text-sm text-gray-500">
          <Link href="/belajar" className="hover:text-[#0056D2]">Belajar</Link>
          <span aria-hidden="true"> / </span>
          <Link href={`/belajar/${entri.slug}`} className="hover:text-[#0056D2]">{entri.title}</Link>
          <span aria-hidden="true"> / </span>
          <span className="text-gray-800">Project</span>
        </nav>

        <header className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Project · {entri.title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            {siap
              ? "Kumpulkan karya akhir course ini. Setelah disubmit, verifikator akan mereview dan menerbitkan credential."
              : "Project course ini masih terkunci. Selesaikan semua modul lewat sesi terverifikasi untuk membuka pengumpulan karya."}
          </p>
        </header>

        <BuatSubmissionForm
          courseId={entri.id}
          enrollmentId={layak?.enrollmentId ?? ""}
          slug={entri.slug}
          siap={siap}
        />

        <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5" aria-labelledby="daftar-karya">
          <h2 id="daftar-karya" className="mb-2 text-lg font-bold tracking-tight text-gray-900">
            Karya tersimpan
          </h2>
          {karya.length === 0 ? (
            <p className="text-sm text-gray-500">Belum ada karya untuk course ini.</p>
          ) : (
            <ul className="space-y-2">
              {karya.map((submission) => (
                <li key={submission.id}>
                  <Link
                    href={`/belajar/${entri.slug}/karya/${submission.id}`}
                    className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 transition-colors hover:bg-gray-50"
                  >
                    <span className="min-w-0 truncate text-sm font-medium text-gray-900">
                      Submission {submission.id.slice(0, 8)}
                    </span>
                    <StatusBadge status={statusSubmission(submission.status)} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </LearnerShell>
  );
}
