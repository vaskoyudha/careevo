import type { Metadata } from "next";
import { getSession } from "@/lib/auth/session";
import { AppShell } from "@/components/ui/app-shell";
import { PageHead } from "@/components/ui/page-head";
import { ReviewQueue } from "@/components/features/review/review-queue";
import { reviewQueue } from "@/lib/fixtures";

export const metadata: Metadata = {
  title: "Review Queue",
};

export default async function ReviewPage() {
  const session = await getSession();
  if (!session) return null;

  return (
    <AppShell session={session} current="/review">
        <PageHead
          eyebrow="Area verifikator"
          title="Antrean review"
          lead="Report lengkap, diff, auto-check, dan jawaban Socrates sudah tergabung. Keputusan wajib disertai alasan."
        />
        <div className="card">
          <ReviewQueue items={reviewQueue} />
        </div>
    </AppShell>
  );
}
