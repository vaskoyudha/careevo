import type { Metadata } from "next";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/status-badge";
import { BarRow } from "@/components/ui/progress-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { getProfile } from "@/lib/fixtures";
import { buildToken } from "@/lib/attestation/token";
import type { AttestationPayload } from "@/lib/attestation/sign";

export const metadata: Metadata = {
  title: "Profil Publik",
};

export default async function ProfilPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const profile = getProfile(decodeURIComponent(username));

  if (!profile) {
    return (
      <section className="section" aria-label="Profil tidak ditemukan">
        <div className="container section-inner">
          <EmptyState title={`Profil @${decodeURIComponent(username)} tidak ditemukan`}>
            Username tidak terdaftar. Profil publik Careevo bersifat read-only dan Zero-PII.
          </EmptyState>
        </div>
      </section>
    );
  }

  const payload: AttestationPayload = {
    username: profile.username,
    task_id: "b1",
    task_title: profile.badges[0]?.task_title ?? "Rebuild Landing Page",
    track: profile.track,
    level: profile.badges[0]?.level ?? "dasar",
    score: profile.score_total,
    issued_at: new Date().toISOString(),
  };
  const token = buildToken(payload);

  return (
    <section className="section" aria-labelledby="profil-title">
      <div className="container section-inner">
        <p className="section-label">Profil publik</p>
        <div className="card" style={{ marginTop: "0.5rem" }}>
          <div className="card-head">
            <div>
              <h1 className="page-title" id="profil-title" style={{ marginBottom: "0.2rem" }}>
                {profile.display_name}
              </h1>
              <p className="muted" style={{ margin: 0 }}>
                @{profile.username} · {profile.track} · terverifikasi {profile.verified_at}
              </p>
            </div>
            <span className="score-hero">
              <b>{profile.score_total}</b>
              <span>/100</span>
            </span>
          </div>

          {profile.scores.map((score) => (
            <BarRow
              key={score.label}
              label={score.label}
              value={score.value}
              max={score.max}
              tone={score.value / score.max >= 0.8 ? "ok" : "warn"}
            />
          ))}

          <p className="caption muted" style={{ marginTop: "0.75rem" }}>
            Zero-PII: tanpa KTP, tanpa foto, tanpa email. Identitas berbasis username dan key.{" "}
            <Link href={`/verify/${token}`}>Verifikasi attestation publik</Link>.
          </p>
        </div>

        <div className="grid-2" style={{ marginTop: "1.25rem" }}>
          <section className="card" aria-labelledby="badge-title">
            <div className="card-head">
              <h2 className="card-title" id="badge-title">
                Badge terverifikasi
              </h2>
            </div>
            <ul className="list-app" style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {profile.badges.map((badge) => (
                <li className="list-app-row" key={badge.id}>
                  <span className="row-title">{badge.task_title}</span>
                  <span className="row-aside">
                    <span className="mono muted">{badge.score}</span>
                    <StatusBadge status="approved" label="HMAC OK" />
                  </span>
                  <span className="row-meta">
                    {badge.track} · {badge.level} · {badge.issued_at}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="card" aria-labelledby="work-title">
            <div className="card-head">
              <h2 className="card-title" id="work-title">
                Karya
              </h2>
            </div>
            <ul className="list-app" style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {profile.works.map((work) => (
                <li className="list-app-row" key={work.id}>
                  <a className="row-title" href={work.demo_url} target="_blank" rel="noreferrer">
                    {work.title}
                  </a>
                  <span className="row-aside">
                    <StatusBadge status={work.status} />
                  </span>
                  <span className="row-meta">
                    <a href={work.raw_url} target="_blank" rel="noreferrer">
                      file mentah
                    </a>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section className="card" style={{ marginTop: "1.25rem" }} aria-labelledby="timeline-title">
          <div className="card-head">
            <h2 className="card-title" id="timeline-title">
              Timeline proses
            </h2>
            <span className="status status-info">read-only</span>
          </div>
          <ul className="list-app" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {profile.timeline.map((item) => (
              <li className="list-app-row" key={`${item.at}-${item.title}`}>
                <span className="row-title" style={{ fontSize: "0.92rem" }}>
                  {item.title}
                </span>
                <span className="row-aside">
                  <span className="tag">{item.actor}</span>
                </span>
                <span className="row-meta">{item.at}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </section>
  );
}
