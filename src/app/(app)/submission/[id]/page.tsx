import type { Metadata } from "next";
import { getSession } from "@/lib/auth/session";
import { AppShell } from "@/components/ui/app-shell";
import { PageHead } from "@/components/ui/page-head";
import { StatusBadge } from "@/components/ui/status-badge";
import { BarRow } from "@/components/ui/progress-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { submission } from "@/lib/fixtures";

export const metadata: Metadata = {
  title: "Submission",
};

export default async function SubmissionPage() {
  const session = await getSession();
  if (!session) return null;

  const passed = submission.autocheck.tests.filter((test) => test.passed).length;
  const total = submission.autocheck.tests.length;
  const lh = submission.autocheck.lighthouse;

  return (
    <AppShell session={session} current="/belajar">
        <PageHead
          eyebrow={`Submission versi ${submission.task_id}`}
          title={submission.task_title}
          lead={`Disubmit ${submission.submitted_at}. Report terbentuk otomatis dari artefak proses.`}
          actions={<StatusBadge status={submission.status} />}
        />

        <div className="grid-2">
          <section className="card" aria-labelledby="autocheck-title">
            <div className="card-head">
              <div>
                <h2 className="card-title" id="autocheck-title">
                  Auto-check
                </h2>
                <p className="card-sub">
                  {passed}/{total} test lulus · Playwright dan Lighthouse
                </p>
              </div>
            </div>
            <ul className="list-app" style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {submission.autocheck.tests.map((test) => (
                <li className="log-line" key={test.name}>
                  <span>
                    {test.name}
                    {test.error ? <span className="muted"> · {test.error}</span> : null}
                  </span>
                  <span className={`status status-${test.passed ? "ok" : "danger"}`}>
                    {test.passed ? "lulus" : "gagal"}
                  </span>
                </li>
              ))}
            </ul>
            <div style={{ marginTop: "1rem" }}>
              <BarRow label="Performance" value={lh.performance} max={100} tone={lh.performance >= 85 ? "ok" : "warn"} />
              <BarRow label="Accessibility" value={lh.accessibility} max={100} tone={lh.accessibility >= 90 ? "ok" : "warn"} />
              <BarRow label="Best practices" value={lh.best_practices} max={100} tone="ok" />
              <BarRow label="SEO" value={lh.seo} max={100} tone="ok" />
            </div>
          </section>

          <section className="card" aria-labelledby="vts-title">
            <div className="card-head">
              <div>
                <h2 className="card-title" id="vts-title">
                  Vibe Transparency Score
                </h2>
                <p className="card-sub">Transparansi proses, bukan vonis</p>
              </div>
              <span className="score-hero">
                <b>{submission.vts.score}</b>
                <span>/100</span>
              </span>
            </div>
            {submission.vts.components.map((component) => (
              <BarRow
                key={component.label}
                label={component.label}
                value={component.value}
                max={component.max}
                tone="info"
              />
            ))}
          </section>
        </div>

        <div className="grid-2" style={{ marginTop: "1.25rem" }}>
          <section className="card" aria-labelledby="socrates-title">
            <div className="card-head">
              <div>
                <h2 className="card-title" id="socrates-title">
                  Socrates Defense
                </h2>
                <p className="card-sub">
                  Draft score {submission.socrates.draft_score} · jawaban batas {submission.socrates.deadline}
                </p>
              </div>
              <StatusBadge status={submission.socrates.answered ? "clean" : "waiting_socrates"} label={submission.socrates.answered ? "Dijawab" : "Menunggu"} />
            </div>
            <ol style={{ margin: 0, paddingLeft: "1.1rem" }}>
              {submission.socrates.questions.map((question) => (
                <li key={question} style={{ marginBottom: "0.6rem" }}>
                  {question}
                </li>
              ))}
            </ol>
          </section>

          <section className="card" aria-labelledby="timeline-title">
            <div className="card-head">
              <div>
                <h2 className="card-title" id="timeline-title">
                  Timeline report
                </h2>
                <p className="card-sub">Semua aktor tercatat: manusia dan agen</p>
              </div>
            </div>
            <ul className="list-app" style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {submission.timeline.map((item) => (
                <li className="list-app-row" key={`${item.at}-${item.action}`}>
                  <span className="row-title" style={{ fontSize: "0.92rem" }}>
                    {item.summary}
                  </span>
                  <span className="row-aside">
                    <span className="tag">{item.actor_type}</span>
                  </span>
                  <span className="row-meta">
                    {item.at} · {item.actor_id}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section className="card" style={{ marginTop: "1.25rem" }} aria-labelledby="decision-title">
          <div className="card-head">
            <div>
              <h2 className="card-title" id="decision-title">
                Keputusan verifikator
              </h2>
              <p className="card-sub">Keputusan wajib disertai alasan. Tidak ada silent reject.</p>
            </div>
            <StatusBadge status={submission.decision.status} />
          </div>
          {submission.decision.reason ? (
            <p className="alert alert-warn">{submission.decision.reason}</p>
          ) : (
            <EmptyState title="Menunggu keputusan verifikator" />
          )}
          <p className="caption muted" style={{ marginTop: "0.75rem" }}>
            Total skor karya sementara: {submission.decision.total}. Validasi menunggu approve verifikator dan Socrates.
          </p>
        </section>
    </AppShell>
  );
}
