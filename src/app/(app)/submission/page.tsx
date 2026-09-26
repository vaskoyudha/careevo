import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { AppShell } from "@/components/ui/app-shell";
import { PageHead } from "@/components/ui/page-head";
import { StatusBadge, statusSubmission } from "@/components/ui/status-badge";
import { BuatSubmissionForm } from "@/components/features/submission/submission-actions";
import { daftarKursusSubmission, listSubmissionDb } from "@/lib/review/service";

export const metadata: Metadata = { title: "Karya Saya" };

export default async function SubmissionListPage() {
  const session = await getSession();
  if (!session?.userId) return null;
  const [pilihan, submissions] = await Promise.all([
    daftarKursusSubmission(session),
    listSubmissionDb(session),
  ]);

  return (
    <AppShell session={session} current="/belajar">
      <PageHead eyebrow="Karya" title="Submission saya" lead="Kirim hasil karya dari kursus yang selesai dan terverifikasi." />
      <BuatSubmissionForm pilihan={pilihan} />
      <section className="card" style={{ marginTop: "1.25rem" }} aria-labelledby="daftar-submission">
        <h2 id="daftar-submission" className="card-title">Karya tersimpan</h2>
        {submissions.length === 0 ? <p className="caption muted">Belum ada karya.</p> : (
          <ul className="list-app" style={{ listStyle: "none", padding: 0 }}>
            {submissions.map((submission) => (
              <li key={submission.id} className="list-app-row">
                <Link href={`/submission/${submission.id}`} className="row-title">Submission {submission.id.slice(0, 8)}</Link>
                <StatusBadge status={statusSubmission(submission.status)} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
