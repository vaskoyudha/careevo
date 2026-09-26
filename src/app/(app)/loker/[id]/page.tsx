import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { AppShell } from "@/components/ui/app-shell";
import { PageHead } from "@/components/ui/page-head";
import { StatusBadge } from "@/components/ui/status-badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { EvaluasiPanel } from "@/components/features/jobs/evaluasi-panel";
import { ambilLokerById } from "@/lib/jobs/cache";
import { labelSinyal } from "@/lib/agents/sentinel";
import { TrackerLoker } from "@/components/features/jobs/tracker-loker";
import { ambilStatusLamaran } from "@/actions/tracker";
import { urutanLifecycle } from "@/lib/career-ops/states";

export const metadata: Metadata = {
  title: "Detail Loker",
};

export default async function LokerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) return null;

  const { id } = await params;
  // `ambilLokerById` refuses `rejected` postings, so a direct URL to a scam
  // listing 404s instead of rendering an apply flow for it.
  const job = await ambilLokerById(id);
  if (!job) notFound();

  // Resolve this posting to its canonical tracker row (if any). Server-side so
  // the tracker read never leaves the signed-in session's data root.
  const statusLamaran = await ambilStatusLamaran(id);

  // Lifecycle states are read SERVER-SIDE: the tracker component is a client
  // chunk and must not import templates/states.yml (node:fs). Only the plain
  // label/id/aliases data crosses into the browser.
  const states = urutanLifecycle();

  return (
    <AppShell session={session} current="/loker">
        <PageHead
          eyebrow={`${job.source} · ${job.external_id}`}
          title={job.title}
          lead={`${job.company} · ${job.location}`}
          actions={<StatusBadge status={job.sentinel_status} />}
        />

        <div className="grid-2">
          <section className="card" aria-labelledby="desc-title">
            <div className="card-head">
              <h2 className="card-title" id="desc-title">
                Deskripsi
              </h2>
              {job.salary_range ? <span className="status status-info">{job.salary_range}</span> : null}
            </div>
            <p style={{ marginTop: 0 }}>{job.description}</p>
            <div className="tag-row" style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.75rem" }}>
              {job.tags.map((tag) => (
                <span className="tag" key={tag}>
                  {tag}
                </span>
              ))}
            </div>
            <p className="caption muted" style={{ marginTop: "0.75rem" }}>
              Level {job.level} · {job.work_type} · diposting {job.posted_at}
            </p>
          </section>

          <section className="card" aria-labelledby="sentinel-title">
            <div className="card-head">
              <div>
                <h2 className="card-title" id="sentinel-title">
                  Hasil audit Sentinel
                </h2>
                <p className="card-sub">
                  Rule-based: usia domain, pola fee, regex transfer pribadi, kepercayaan URL
                </p>
              </div>
              <StatusBadge status={job.sentinel_status} />
            </div>
            <ProgressBar
              value={job.trust_score}
              max={100}
              tone={job.trust_score >= 90 ? "ok" : job.trust_score >= 60 ? "warn" : "danger"}
              label="Skor kepercayaan"
            />
            <p className="caption muted" style={{ marginTop: "0.5rem" }}>
              Skor kepercayaan URL {job.trust_score}/100 (level {job.trust_level}) — memeriksa
              struktur link, link pendek, dan kecocokan domain dengan nama perusahaan.
            </p>
            {job.flags.length === 0 ? (
              <p className="alert alert-ok">Tidak ada sinyal scam terdeteksi. Loker aman untuk dilamar.</p>
            ) : (
              <ul className="list-app" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {job.flags.map((flag) => (
                  <li className="log-line" key={flag}>
                    <span>{labelSinyal(flag)}</span>
                    <span className="status status-danger">flag</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="caption muted" style={{ marginTop: "0.75rem" }}>
              Sinyal ini bahan pertimbangan, bukan tuduhan. Karantina bisa dibanding. Keputusan akhir
              ada di verifikator, bukan agen.
            </p>
          </section>
        </div>

        <div className="grid-2" style={{ marginTop: "1.25rem" }}>
          <section className="card" aria-labelledby="fit-title">
            <div className="card-head">
              <div>
                <h2 className="card-title" id="fit-title">
                  Kecocokan A–H
                </h2>
                <p className="card-sub">
                  Penilaian AI terhadap profilmu: kecocokan CV, target, kompensasi, budaya, red flag
                </p>
              </div>
            </div>
            <EvaluasiPanel jobId={job.id} />
          </section>

          <section className="card" aria-labelledby="tracker-title">
            <div className="card-head">
              <h2 className="card-title" id="tracker-title">
                Apply dan tracker
              </h2>
            </div>
            <TrackerLoker job={job} awal={statusLamaran} states={states} />
          </section>
        </div>
    </AppShell>
  );
}
