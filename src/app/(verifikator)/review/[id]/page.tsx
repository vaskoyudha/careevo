import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { AppShell } from "@/components/ui/app-shell";
import { PageHead } from "@/components/ui/page-head";
import { StatusBadge } from "@/components/ui/status-badge";
import { ReviewForm } from "@/components/features/review/review-form";
import { listSubmissionStaf } from "@/lib/review/repository";

export const metadata: Metadata = {
  title: "Review Detail",
};

/** Badge hanya mengerti `revision`; `changes_requested` dipetakan ke sana. */
function statusBadge(status: string): string {
  return status === "changes_requested" ? "revision" : status;
}

/** Waktu dari kolom timestamp — `null` ditampilkan "—", bukan tanggal karangan. */
function formatWaktu(nilai: Date | null): string {
  if (!nilai) return "—";
  const tanggal = new Date(nilai);
  if (Number.isNaN(tanggal.getTime())) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(tanggal);
}

export default async function ReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session?.userId) return null;

  const { id } = await params;

  // Belum ada pembaca satu-submission-dengan-pemilik di repository, jadi daftar
  // staf difilter di sini. Cukup untuk halaman ini; pindahkan ke repository kalau
  // jumlah submission sudah membuat pemindaian seluruh tabel terasa.
  const submissions = await listSubmissionStaf();
  const baris = submissions.find((entry) => entry.submission.id === id);
  if (!baris) notFound();

  const { submission, owner } = baris;

  return (
    <AppShell session={session} current="/review">
        <PageHead
          eyebrow={`Review #${submission.id.slice(0, 8)} · ${owner.nama}`}
          title={`Submission ${submission.id.slice(0, 8)}`}
          lead="Ringkasan submission dari database. Auto-check, VTS, dan Socrates belum punya padanan di database, jadi tidak ditampilkan."
          actions={<StatusBadge status={statusBadge(submission.status)} />}
        />

        <div className="grid-2">
          <section className="card" aria-labelledby="rpt-title">
            <div className="card-head">
              <div>
                <h2 className="card-title" id="rpt-title">
                  Ringkasan
                </h2>
                <p className="card-sub">Status dan versi submission saat ini</p>
              </div>
            </div>
            <ul className="list-app" style={{ listStyle: "none", margin: 0, padding: 0 }}>
              <li className="list-app-row">
                <span className="row-title">Pemilik</span>
                <span className="row-meta">
                  {owner.nama} · {owner.email}
                </span>
              </li>
              <li className="list-app-row">
                <span className="row-title">Status</span>
                <span className="row-aside">
                  <StatusBadge status={statusBadge(submission.status)} />
                </span>
              </li>
              <li className="list-app-row">
                <span className="row-title">Versi saat ini</span>
                <span className="row-meta">v{submission.currentVersion}</span>
              </li>
              <li className="list-app-row">
                <span className="row-title">Disubmit</span>
                <span className="row-meta">{formatWaktu(submission.submittedAt)}</span>
              </li>
              <li className="list-app-row">
                <span className="row-title">Terakhir diperbarui</span>
                <span className="row-meta">{formatWaktu(submission.updatedAt)}</span>
              </li>
            </ul>
          </section>

          <ReviewForm submissionId={submission.id} username={owner.email} />
        </div>
    </AppShell>
  );
}
