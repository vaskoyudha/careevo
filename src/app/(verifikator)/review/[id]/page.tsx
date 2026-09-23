import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { AppShell } from "@/components/ui/app-shell";
import { PageHead } from "@/components/ui/page-head";
import { StatusBadge } from "@/components/ui/status-badge";
import { BarRow } from "@/components/ui/progress-bar";
import { ReviewForm } from "@/components/features/review/review-form";
import { reviewQueue, submission } from "@/lib/fixtures";

export const metadata: Metadata = {
  title: "Review Detail",
};

export default async function ReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) return null;

  const { id } = await params;
  const item = reviewQueue.find((entry) => entry.id === id) ?? reviewQueue[0];
  if (!item) notFound();

  const passed = submission.autocheck.tests.filter((test) => test.passed).length;
  const total = submission.autocheck.tests.length;

  return (
    <AppShell session={session} current="/review">
        <PageHead
          eyebrow={`Review #${item.id} · @${item.username}`}
          title={item.task_title}
          lead="Periksa report di bawah, lalu isi rubrik dan beri keputusan dengan alasan."
          actions={<StatusBadge status={item.status} />}
        />

        <div className="grid-2">
          <section className="card" aria-labelledby="rpt-title">
            <div className="card-head">
              <div>
                <h2 className="card-title" id="rpt-title">
                  Report
                </h2>
                <p className="card-sub">
                  Auto-check {passed}/{total} lulus · VTS {submission.vts.score}
                </p>
              </div>
            </div>
            {submission.vts.components.map((component) => (
              <BarRow key={component.label} label={component.label} value={component.value} max={component.max} />
            ))}
            <div className="alert alert-warn" style={{ marginTop: "1rem" }}>
              Dua test gagal: alt text gambar dan skor aksesibilitas 88 dari target 90.
            </div>
            <h3 className="card-title" style={{ fontSize: "0.95rem", marginTop: "1rem" }}>
              Socrates
            </h3>
            <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
              {submission.socrates.questions.map((question) => (
                <li key={question} style={{ marginBottom: "0.5rem" }}>
                  {question}
                </li>
              ))}
            </ul>
          </section>

          <ReviewForm submission={submission} username={item.username} />
        </div>
    </AppShell>
  );
}
