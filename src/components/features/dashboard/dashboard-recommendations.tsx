import Link from "next/link";
import { ArrowRight, Compass } from "lucide-react";
import { LABELS, type OnboardingProfile } from "@/lib/onboarding/types";
import { rekomendasiUntukProfil } from "@/lib/onboarding/rekomendasi";

/**
 * Personalized recommendation strip for the dashboard.
 *
 * Renders the top courses and jobs for the learner's stored profile, straight
 * from the live catalog (`katalogBelajar`) and job fixtures (`visibleJobs`).
 * Server component — data is scoped to the signed profile passed in.
 */
export async function DashboardRecommendations({
  profile,
}: {
  profile: OnboardingProfile;
}) {
  const { kursus, loker } = await rekomendasiUntukProfil(profile);

  const interestLabels = profile.interests.map((i) => LABELS.interest[i]).join(", ");

  return (
    <section className="card" aria-labelledby="personal-title">
      <div className="card-head">
        <div>
          <h2 className="card-title" id="personal-title">
            Dipilih untukmu
          </h2>
          <p className="card-sub">
            Berdasarkan minat: {interestLabels} · target {profile.weeklyHours} jam/minggu
          </p>
        </div>
        <Link
          href="/onboarding?edit=1"
          className="row-title inline-flex items-center gap-1 text-sm font-medium"
        >
          Ubah minat
          <ArrowRight className="size-3.5" />
        </Link>
      </div>

      {kursus.length === 0 && loker.length === 0 ? (
        <p className="caption muted">
          Belum ada rekomendasi yang cocok. Coba tambah minat di Pengaturan.
        </p>
      ) : null}

      {kursus.length > 0 ? (
        <div className="mb-6">
          <p className="section-label mb-2 flex items-center gap-1.5">
            <Compass className="size-3.5" />
            Kursus
          </p>
          <ul className="list-app" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {kursus.map((entry) => (
              <li className="list-app-row" key={entry.slug}>
                <Link className="row-title" href={`/belajar/${entry.slug}`}>
                  {entry.title}
                </Link>
                <span className="row-aside">
                  <span className="tag">{entry.level}</span>
                  <span className="tag">{entry.is_free ? "Gratis" : "Berbayar"}</span>
                </span>
                <span className="row-meta">
                  {entry.provider} · {entry.duration_min} menit
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {loker.length > 0 ? (
        <div>
          <p className="section-label mb-2 flex items-center gap-1.5">
            <Compass className="size-3.5" />
            Loker
          </p>
          <ul className="list-app" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {loker.map((job) => (
              <li className="list-app-row" key={job.id}>
                <Link className="row-title" href={`/loker/${job.id}`}>
                  {job.title}
                </Link>
                <span className="row-aside">
                  <span className="tag">{job.level}</span>
                  {job.salary_range ? <span className="mono">{job.salary_range}</span> : null}
                </span>
                <span className="row-meta">
                  {job.company} · {job.location}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
