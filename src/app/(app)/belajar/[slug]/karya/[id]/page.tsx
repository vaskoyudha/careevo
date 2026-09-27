import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { LearnerShell } from "@/components/ui/learner-shell";
import { StatusBadge, statusSubmission } from "@/components/ui/status-badge";
import { ambilKaryaPrincipal } from "@/lib/review/service";
import { ambilTokenAttestationSubmission, ambilVersiTerkini, listReviewSubmission } from "@/lib/review/repository";
import { TransisiSubmission } from "@/components/features/submission/submission-actions";
import { cariEntri } from "@/lib/courses/katalog";

export const metadata: Metadata = {
  title: "Project",
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

/**
 * Detail satu submission, **di dalam course pemiliknya**
 * (`/belajar/[slug]/karya/[id]`). Submission milik orang lain, atau yang tidak
 * terikat course ini, ditolak `notFound()` — tidak ada permukaan detail lintas
 * course.
 */
export default async function KaryaDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const session = await getSession();
  if (!session?.userId) return null;

  const { slug, id } = await params;
  const entri = await cariEntri(slug);
  if (!entri) notFound();

  // `ambilKaryaPrincipal` memeriksa kepemilikan; ikatan course diperiksa di
  // sini supaya submission yang tidak terikat course ini tidak bocor lewat URL.
  const submission = await ambilKaryaPrincipal(session, id);
  if (!submission || submission.courseId !== entri.id) notFound();

  const [review, versi, token] = await Promise.all([
    listReviewSubmission(submission.id),
    ambilVersiTerkini(submission.id),
    submission.status === "approved" ? ambilTokenAttestationSubmission(submission.id) : Promise.resolve(null),
  ]);
  const snapshot = versi?.contentSnapshot as { judul?: string | null; catatan?: string | null } | undefined;

  return (
    <LearnerShell session={session}>
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <nav aria-label="Breadcrumb" className="mb-2 text-sm text-gray-500">
          <Link href="/belajar" className="hover:text-[#0056D2]">Belajar</Link>
          <span aria-hidden="true"> / </span>
          <Link href={`/belajar/${entri.slug}`} className="hover:text-[#0056D2]">{entri.title}</Link>
          <span aria-hidden="true"> / </span>
          <Link href={`/belajar/${entri.slug}/karya`} className="hover:text-[#0056D2]">Project</Link>
          <span aria-hidden="true"> / </span>
          <span className="text-gray-800">Submission {submission.id.slice(0, 8)}</span>
        </nav>

        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              Submission {submission.id.slice(0, 8)}
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Ringkasan status submission dan riwayat keputusan review.
            </p>
          </div>
          <StatusBadge status={statusSubmission(submission.status)} />
        </header>

        <section className="rounded-2xl border border-gray-200 bg-white p-5" aria-labelledby="ringkasan-title">
          <h2 className="mb-1 text-lg font-bold tracking-tight text-gray-900" id="ringkasan-title">
            Ringkasan
          </h2>
          <p className="mb-3 text-sm text-gray-500">Status dan versi submission saat ini</p>
          <dl className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-gray-600">Status</dt>
              <dd><StatusBadge status={statusSubmission(submission.status)} /></dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-gray-600">Versi saat ini</dt>
              <dd className="font-medium text-gray-900">{submission.currentVersion}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-gray-600">Disubmit</dt>
              <dd className="font-medium text-gray-900">{formatWaktu(submission.submittedAt)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-gray-600">Terakhir diperbarui</dt>
              <dd className="font-medium text-gray-900">{formatWaktu(submission.updatedAt)}</dd>
            </div>
          </dl>
        </section>

        <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5" aria-labelledby="karya-title">
          <h2 className="mb-1 text-lg font-bold tracking-tight text-gray-900" id="karya-title">
            {snapshot?.judul ?? "Karya tanpa judul"}
          </h2>
          <p className="text-sm whitespace-pre-wrap text-gray-700">{snapshot?.catatan ?? "Tidak ada catatan."}</p>
          <div className="mt-4">
            {submission.status === "draft" && (
              <TransisiSubmission submissionId={submission.id} slug={entri.slug} jenis="kirim" />
            )}
            {token && <p className="mt-3 text-sm"><Link href={`/verify/${token}`} className="font-medium text-[#0056D2]">Lihat credential terverifikasi</Link></p>}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5" aria-labelledby="riwayat-title">
          <h2 className="mb-1 text-lg font-bold tracking-tight text-gray-900" id="riwayat-title">
            Riwayat review
          </h2>
          <p className="mb-3 text-sm text-gray-500">Keputusan verifikator atas submission ini</p>
          {review.length === 0 ? (
            <p className="text-sm text-gray-500">Belum ada review tercatat.</p>
          ) : (
            <ul className="space-y-2">
              {review.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm">
                  <StatusBadge status={statusSubmission(item.decision)} />
                  <span className="font-medium text-gray-900">
                    {item.score === null ? "belum dinilai" : `${item.score}/100`}
                  </span>
                  <span className="text-gray-500">{formatWaktu(item.createdAt)}</span>
                  <span className="min-w-0 flex-1 text-gray-700">{item.rationale}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </LearnerShell>
  );
}
