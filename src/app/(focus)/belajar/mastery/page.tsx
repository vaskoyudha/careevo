import type { Metadata } from "next";
import { getSession } from "@/lib/auth/session";
import { getProfile } from "@/lib/onboarding/store";
import { katalogBelajar } from "@/lib/courses/katalog";
import { listPendaftaran } from "@/lib/courses/enrollment";
import { bangunJalurPersonalisasi } from "@/lib/learning/personalized-path";
import { listMasteryTopics, getMasteryTopic } from "@/lib/mastery/store";
import { hitungPenguasaan, antreanJatuhTempo, bangunAntreanTinjauan } from "@/lib/mastery/scoring";
import { MasteryIndex } from "@/components/features/mastery/mastery-index";

export const metadata: Metadata = { title: "Jalur Penguasaan" };

/**
 * The learner's mastery paths.
 *
 * A focus-mode page in `(focus)`, so the `(focus)` layout owns the auth and
 * profile gate and this page only reads data.
 */
export default async function MasteryIndexPage() {
  const session = await getSession();
  if (!session) return null;

  const [profile, catalog, enrollments, topics] = await Promise.all([
    getProfile(session.email),
    katalogBelajar(),
    listPendaftaran(session.email),
    listMasteryTopics(session.email),
  ]);

  // One clock read per request: every comparison below then agrees on
  // what "now" means. `new Date()` rather than `Date.now()` to match the
  // rest of the server components here (see p/[username]/page.tsx) — the
  // React compiler lint flags the bare `Date.now()` call as render-time
  // impurity even though this is an async server component, once per request.
  const now: number = new Date().getTime();
  // The due count is per topic, so this reads each bundle. Topics are few and
  // each is one small file; the alternative is a summary file that can drift.
  const bundles = await Promise.all(
    topics.map(async (topic) => ({ topic, bundle: await getMasteryTopic(session.email, topic.id) })),
  );

  const cards = bundles.flatMap(({ topic, bundle }) => {
    if (!bundle) return [];
    const attemptsByPoint = new Map<string, boolean[]>();
    for (const attempt of bundle.progress.attempts) {
      const list = attemptsByPoint.get(attempt.knowledgePointId) ?? [];
      list.push(attempt.correct);
      attemptsByPoint.set(attempt.knowledgePointId, list);
    }
    const perPoint = bundle.points.map((point) => ({
      id: point.id,
      name: point.name,
      type: point.type,
      mastery: hitungPenguasaan(attemptsByPoint.get(point.id) ?? []),
    }));
    const attempted = perPoint.filter((point) => point.mastery > 0);
    const overall =
      perPoint.length === 0
        ? 0
        : attempted.reduce((sum, point) => sum + point.mastery, 0) / perPoint.length;
    const due = antreanJatuhTempo(
      bangunAntreanTinjauan(
        bundle.progress.states,
        bundle.progress.knowledgeTypes,
        bundle.progress.errorPointIds,
      ),
      now,
      10,
    ).length;

    return [{ topic, pointCount: perPoint.length, overall, due, points: perPoint }];
  });

  const path = profile ? bangunJalurPersonalisasi({ profile, catalog, enrollments }) : null;
  const suggested = path?.course ?? null;

  return <MasteryIndex cards={cards} suggestedCourse={suggested} hasProfile={Boolean(profile)} />;
}
