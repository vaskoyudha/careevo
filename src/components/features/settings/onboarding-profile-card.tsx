import Link from "next/link";
import { LABELS, type OnboardingProfile } from "@/lib/onboarding/types";
import { ResetOnboardingButton } from "./reset-onboarding-button";

/**
 * Read-only summary of the learner's onboarding profile with a reset control.
 * Server component; the reset button is a small client island.
 */
export function OnboardingProfileCard({ profile }: { profile: OnboardingProfile }) {
  const rows: Array<[string, string]> = [
    ["Pengalaman", LABELS.experience[profile.experience]],
    ["Latar belakang", LABELS.background[profile.background]],
    [
      "Minat",
      profile.interests.map((i) => LABELS.interest[i]).join(", "),
    ],
    ["Tujuan", LABELS.goal[profile.goal as keyof typeof LABELS.goal] ?? profile.goal],
    ["Target belajar", `${profile.weeklyHours} jam/minggu`],
    ["Preferensi kerja", LABELS.workPreference[profile.workPreference]],
  ];

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2 className="card-title">Preferensi belajar &amp; karier</h2>
          <p className="card-sub">
            Dipakai untuk menyusun rekomendasi kursus dan loker.
          </p>
        </div>
        <Link className="row-title text-sm font-medium" href="/onboarding?edit=1">
          Ubah
        </Link>
      </div>

      <dl className="grid gap-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-wrap gap-x-2 text-sm">
            <dt className="text-muted-foreground">{label}:</dt>
            <dd className="font-medium text-foreground">{value || "—"}</dd>
          </div>
        ))}
      </dl>

      <div style={{ marginTop: "1rem" }}>
        <ResetOnboardingButton />
      </div>
    </div>
  );
}
