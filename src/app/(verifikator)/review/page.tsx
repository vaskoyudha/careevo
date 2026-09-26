import type { Metadata } from "next";
import { getSession } from "@/lib/auth/session";
import { AppShell } from "@/components/ui/app-shell";
import { PageHead } from "@/components/ui/page-head";
import {
  ReviewQueue,
  type ReviewQueueItem,
} from "@/components/features/review/review-queue";
import { listSubmissionStaf } from "@/lib/review/repository";

export const metadata: Metadata = {
  title: "Review Queue",
};

export default async function ReviewPage() {
  // Gerbang role ada di `(verifikator)/layout.tsx`; diulang di sini supaya
  // halaman ini tidak pernah membuka record lintas-peserta kalau dipindah.
  const session = await getSession();
  if (!session?.userId) return null;

  const submissions = await listSubmissionStaf();
  // Baris database diubah ke bentuk serializable di sini — komponen antrean
  // client tidak boleh menyentuh repository (ia menarik driver Postgres).
  const items: ReviewQueueItem[] = submissions.map(({ submission, owner }) => ({
    id: submission.id,
    ownerNama: owner.nama,
    ownerEmail: owner.email,
    status: submission.status,
    currentVersion: submission.currentVersion,
    submittedAt: submission.submittedAt?.toISOString() ?? null,
    updatedAt: submission.updatedAt.toISOString(),
    assignedReviewerUserId: submission.assignedReviewerUserId,
  }));

  return (
    <AppShell session={session} current="/review">
        <PageHead
          eyebrow="Area verifikator"
          title="Antrean review"
          lead="Seluruh submission lintas peserta dari database. Keputusan wajib disertai alasan, dan credential diterbitkan dari record server-side."
        />
        <div className="card">
          <ReviewQueue items={items} currentUserId={session.userId} />
        </div>
    </AppShell>
  );
}
