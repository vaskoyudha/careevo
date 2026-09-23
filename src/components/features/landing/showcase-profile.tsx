import { AxInner, AxLabel, AxSection } from "@/components/ui/section";
import { Chip } from "@/components/ui/chip";

const SCORES = [
  { label: "Jadwal", value: "30", max: "/30" },
  { label: "Karya", value: "40", max: "/40" },
  { label: "Validasi", value: "30", max: "/30" },
];

const TIMELINE = [
  {
    step: "01",
    title: "Check-in dan task terekam",
    body: "Sesi belajar, snapshot, dan prompt log tercatat sebagai data proses.",
  },
  {
    step: "02",
    title: "Auto-check dan Socrates",
    body: "Playwright dan Lighthouse lolos, pertanyaan nalar dijawab dalam 48 jam.",
  },
  {
    step: "03",
    title: "Badge dan attestation terbit",
    body: "Rubrik 5 kriteria disahkan verifikator, HMAC-SHA256 ditandatangani.",
  },
];

export function ShowcaseProfile() {
  return (
    <AxSection labelledBy="profile-title">
      <AxInner>
        <AxLabel>Profil publik</AxLabel>
        <h2 id="profile-title" className="ax-h2">
          Portofolio yang bisa diverifikasi
        </h2>
        <p className="ax-lead">
          Halaman /p/[username] read-only, tanpa login, tanpa data pribadi sensitif.
        </p>

        <div className="focal-card profile-card">
          <div className="profile-head">
            <div>
              <p className="profile-username">@nadia.dev</p>
              <p className="caption profile-path">/p/nadia.dev</p>
            </div>
            <Chip ok>Terverifikasi</Chip>
          </div>

          <div className="profile-scores">
            {SCORES.map((score) => (
              <div className="profile-score" key={score.label}>
                <span className="profile-score-label">{score.label}</span>
                <span className="profile-score-value">{score.value}</span>
                <span className="profile-score-max">{score.max}</span>
              </div>
            ))}
          </div>

          <ol className="timeline">
            {TIMELINE.map((item) => (
              <li key={item.step}>
                <span className="step-num">{item.step}</span>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </li>
            ))}
          </ol>

          <div className="profile-work">
            <div>
              <div className="ax-row-title">Rebuild Challenge: Async Pagination</div>
              <div className="ax-row-meta">Web Dev · track MVP</div>
            </div>
            <Chip ok>HMAC OK</Chip>
          </div>

          <p className="caption profile-caption">
            Zero-PII: tanpa KTP, tanpa foto, tanpa email. Identitas berbasis username dan key.
          </p>
        </div>
      </AxInner>
    </AxSection>
  );
}
