import { BarRow } from "@/components/ui/progress-bar";
import { StatusBadge } from "@/components/ui/status-badge";
import { CheckinWidget } from "./checkin-widget";
import { jalankanNavigator } from "@/lib/agents/navigator";
import { getTask, tasks, profile, cleanJobs } from "@/lib/fixtures";

export function DashboardView() {
  const completedTaskIds = tasks
    .filter((task) => task.status === "passed")
    .map((task) => task.id);

  const trendingTags = [...new Set(cleanJobs().flatMap((job) => job.tags))].slice(0, 8);

  const { recommendations } = jalankanNavigator({
    scoreJadwal: profile.scores[0].value,
    scoreKarya: profile.scores[1].value,
    scoreValidasi: profile.scores[2].value,
    completedTaskIds,
    trendingTags,
  });

  const hoursThisWeek = 7;
  const weeklyTarget = 10;

  return (
    <div className="grid-app">
      <div className="grid-4">
        <div className="stat-box">
          <span className="stat-box-label">Skor total</span>
          <span className="stat-box-value">{profile.score_total}</span>
          <p className="stat-box-note">Jadwal + Karya + Validasi</p>
        </div>
        <div className="stat-box">
          <span className="stat-box-label">Streak</span>
          <span className="stat-box-value">5 hari</span>
          <p className="stat-box-note">Kepatuhan jadwal 82%</p>
        </div>
        <div className="stat-box">
          <span className="stat-box-label">Jam minggu ini</span>
          <span className="stat-box-value">
            {hoursThisWeek}/{weeklyTarget}
          </span>
          <p className="stat-box-note">Target minimal 10 jam</p>
        </div>
        <div className="stat-box">
          <span className="stat-box-label">Badge aktif</span>
          <span className="stat-box-value">{profile.badges.length}</span>
          <p className="stat-box-note">Terverifikasi HMAC</p>
        </div>
      </div>

      <div className="grid-2">
        <section className="card" aria-labelledby="checkin-title">
          <div className="card-head">
            <div>
              <h2 className="card-title" id="checkin-title">
                Sesi belajar hari ini
              </h2>
              <p className="card-sub">Jadwal 19.00 - 21.00, target 2 jam</p>
            </div>
            <StatusBadge status="clean" label="Hari ini" />
          </div>
          <CheckinWidget />
        </section>

        <section className="card" aria-labelledby="skor-title">
          <div className="card-head">
            <div>
              <h2 className="card-title" id="skor-title">
                Rincian skor
              </h2>
              <p className="card-sub">Skor 0 sampai 100, terbuka dan bisa dijelaskan</p>
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
          <p className="caption muted" style={{ marginTop: "1rem" }}>
            Karya dinilai rubrik 5 kriteria oleh verifikator. Validasi butuh approve verifikator dan Socrates.
          </p>
        </section>
      </div>

      <section className="card" aria-labelledby="nav-title">
        <div className="card-head">
          <div>
            <h2 className="card-title" id="nav-title">
              Rekomendasi Navigator
            </h2>
            <p className="card-sub">
              Rule-based dari skill gap vs tren loker. Navigator tidak mengubah skor.
            </p>
          </div>
          <span className="status status-info">{recommendations.length} task</span>
        </div>
        <ul className="list-app" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {recommendations.map((rec) => {
            const task = getTask(rec.task_id);
            if (!task) return null;
            return (
              <li className="list-app-row" key={rec.task_id}>
                <a className="row-title" href={`/challenge/${task.id}`}>
                  {task.title}
                </a>
                <span className="row-aside">
                  <span className="tag">{task.level}</span>
                  <span className="tag">{task.estimate_min} menit</span>
                </span>
                <span className="row-meta">{rec.reason}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card" aria-labelledby="badge-title">
        <div className="card-head">
          <div>
            <h2 className="card-title" id="badge-title">
              Badge terbaru
            </h2>
            <p className="card-sub">Setiap badge punya attestation publik di /verify</p>
          </div>
        </div>
        <ul className="list-app" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {profile.badges.map((badge) => (
            <li className="list-app-row" key={badge.id}>
              <span className="row-title">{badge.task_title}</span>
              <span className="row-aside">
                <span className="mono">{badge.score}/100</span>
                <StatusBadge status="approved" label="Terverifikasi" />
              </span>
              <span className="row-meta">
                {badge.track} · {badge.issued_at}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
