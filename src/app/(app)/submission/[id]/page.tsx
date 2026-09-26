import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { AppShell } from "@/components/ui/app-shell";
import { PageHead } from "@/components/ui/page-head";
import { StatusBadge, statusSubmission } from "@/components/ui/status-badge";
import { listSubmissionDb } from "@/lib/review/service";
import { ambilTokenAttestationSubmission, ambilVersiTerkini, listReviewSubmission } from "@/lib/review/repository";
import { TransisiSubmission } from "@/components/features/submission/submission-actions";

export const metadata: Metadata = {
  title: "Submission",
};

/** Waktu dari kolom timestamp — `null` ditampilkan sebagai "—", bukan tanggal karangan. */
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

export default async function SubmissionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session?.userId) return null;

  const { id } = await params;

  // `listSubmissionDb` hanya mengembalikan baris milik principal, jadi submission
  // orang lain tidak akan pernah ketemu di sini.
  const daftar = await listSubmissionDb(session);
  const submission = daftar.find((baris) => baris.id === id);
  if (!submission || submission.userId !== session.userId) notFound();

  const [review, versi, token] = await Promise.all([
    listReviewSubmission(submission.id),
    ambilVersiTerkini(submission.id),
    submission.status === "approved" ? ambilTokenAttestationSubmission(submission.id) : Promise.resolve(null),
  ]);
  const snapshot = versi?.contentSnapshot as { judul?: string | null; catatan?: string | null } | undefined;

  return (
    <AppShell session={session} current="/belajar">
      <PageHead
        eyebrow="Submission"
        title={`Submission ${submission.id.slice(0, 8)}`}
        lead="Ringkasan status submission dan riwayat keputusan review."
        actions={<StatusBadge status={statusSubmission(submission.status)} />}
      />

      <section className="card" aria-labelledby="ringkasan-title">
        <div className="card-head">
          <div>
            <h2 className="card-title" id="ringkasan-title">
              Ringkasan
            </h2>
            <p className="card-sub">Status dan versi submission saat ini</p>
          </div>
        </div>
        <ul className="list-app" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          <li className="list-app-row">
            <span className="row-title">Status</span>
            <span className="row-aside">
              <StatusBadge status={statusSubmission(submission.status)} />
            </span>
          </li>
          <li className="list-app-row">
            <span className="row-title">Versi saat ini</span>
            <span className="row-aside">{submission.currentVersion}</span>
          </li>
          <li className="list-app-row">
            <span className="row-title">Disubmit</span>
            <span className="row-aside">{formatWaktu(submission.submittedAt)}</span>
          </li>
          <li className="list-app-row">
            <span className="row-title">Terakhir diperbarui</span>
            <span className="row-aside">{formatWaktu(submission.updatedAt)}</span>
          </li>
        </ul>
      </section>

      <section className="card" style={{ marginTop: "1.25rem" }} aria-labelledby="karya-title">
        <h2 className="card-title" id="karya-title">{snapshot?.judul ?? "Karya tanpa judul"}</h2>
        <p style={{ whiteSpace: "pre-wrap" }}>{snapshot?.catatan ?? "Tidak ada catatan."}</p>
        {submission.status === "draft" && <TransisiSubmission submissionId={submission.id} jenis="kirim" />}
        {token && <p><Link href={`/verify/${token}`}>Lihat credential terverifikasi</Link></p>}
      </section>

      <section className="card" style={{ marginTop: "1.25rem" }} aria-labelledby="riwayat-title">
        <div className="card-head">
          <div>
            <h2 className="card-title" id="riwayat-title">
              Riwayat review
            </h2>
            <p className="card-sub">Keputusan verifikator atas submission ini</p>
          </div>
        </div>
        {review.length === 0 ? (
          <p className="caption muted">Belum ada review tercatat.</p>
        ) : (
          <ul className="list-app" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {review.map((item) => (
              <li className="list-app-row" key={item.id}>
                <span className="row-title">
                  <StatusBadge status={statusSubmission(item.decision)} />
                  <span style={{ marginLeft: "0.5rem" }}>
                    {item.score === null ? "belum dinilai" : `${item.score}/100`}
                  </span>
                </span>
                <span className="row-meta">{formatWaktu(item.createdAt)}</span>
                <span className="row-meta">{item.rationale}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
