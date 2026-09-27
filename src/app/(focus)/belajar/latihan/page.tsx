import type { Metadata } from "next";
import { getSession } from "@/lib/auth/session";
import { getProfile } from "@/lib/onboarding/store";
import { katalogBelajar } from "@/lib/courses/katalog";
import { listPendaftaran } from "@/lib/courses/enrollment";
import { bangunJalurPersonalisasi } from "@/lib/learning/personalized-path";
import { hasLlm } from "@/lib/llm/port";
import { getLatihan, listLatihan } from "@/lib/latihan/store";
import { hitungStatistik } from "@/lib/latihan/nilai";
import { LatihanIndex, type KartuLatihan } from "@/components/features/latihan/latihan-index";

export const metadata: Metadata = { title: "Latihan Soal" };

/**
 * The learner's practice quizzes.
 *
 * A focus-mode page in `(focus)`, so the `(focus)` layout owns the auth and
 * profile gate and this page only reads data.
 */
export default async function LatihanIndexPage() {
  const session = await getSession();
  if (!session) return null;

  const [profile, catalog, enrollments, latihan] = await Promise.all([
    getProfile(session.userId, session.email),
    katalogBelajar(),
    listPendaftaran(session.email),
    listLatihan(session.email),
  ]);

  // Each quiz is one small file, and the score is derived from its attempts.
  // A summary index would have to be kept in step with every write, so it is
  // read from the source instead.
  const bundles = await Promise.all(
    latihan.map(async (item) => await getLatihan(session.email, item.id)),
  );

  const kartu: KartuLatihan[] = bundles.flatMap((bundle) => {
    if (!bundle) return [];
    const statistik = hitungStatistik(bundle.soal, bundle.percobaan);
    return [
      {
        latihan: bundle.latihan,
        jumlahSoal: bundle.soal.length,
        nilaiPersen: statistik.nilaiPersen,
        dijawab: statistik.dijawab,
      },
    ];
  });

  const path = profile ? bangunJalurPersonalisasi({ profile, catalog, enrollments }) : null;

  return (
    <LatihanIndex
      kartu={kartu}
      katalog={catalog}
      courseIdPilihan={path?.course?.id ?? null}
      hasProfile={Boolean(profile)}
      pakaiModel={hasLlm()}
    />
  );
}
