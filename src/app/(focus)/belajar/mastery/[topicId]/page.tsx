import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { isValidSessionId } from "@/lib/ids";
import { getMasteryTopic } from "@/lib/mastery/store";
import {
  antreanJatuhTempo,
  bangunAntreanTinjauan,
  hitungPenguasaan,
} from "@/lib/mastery/scoring";
import { MasteryTopicView } from "@/components/features/mastery/mastery-topic-view";

export const metadata: Metadata = { title: "Jalur Penguasaan" };

export default async function MasteryTopicPage({
  params,
}: {
  params: Promise<{ topicId: string }>;
}) {
  const session = await getSession();
  if (!session) return null;

  const { topicId } = await params;
  if (!isValidSessionId(topicId)) notFound();

  // A well-formed id that is absent, or owned by someone else, is a 404.
  const bundle = await getMasteryTopic(session.email, topicId);
  if (!bundle) notFound();

  // One clock read per request: every comparison below then agrees on
  // what "now" means. `new Date()` rather than `Date.now()` to match the
  // rest of the server components here (see p/[username]/page.tsx) — the
  // React compiler lint flags the bare `Date.now()` call as render-time
  // impurity even though this is an async server component, once per request.
  const now: number = new Date().getTime();
  const attemptsByPoint = new Map<string, boolean[]>();
  for (const attempt of bundle.progress.attempts) {
    const list = attemptsByPoint.get(attempt.knowledgePointId) ?? [];
    list.push(attempt.correct);
    attemptsByPoint.set(attempt.knowledgePointId, list);
  }

  const points = bundle.points.map((point) => {
    const attempts = attemptsByPoint.get(point.id) ?? [];
    return {
      ...point,
      mastery: hitungPenguasaan(attempts),
      attempts: attempts.length,
      nextReviewAt: bundle.progress.states[point.id]?.nextReviewAt ?? null,
    };
  });

  const due = antreanJatuhTempo(
    bangunAntreanTinjauan(
      bundle.progress.states,
      bundle.progress.knowledgeTypes,
      bundle.progress.errorPointIds,
    ),
    now,
    20,
  ).map((task) => task.knowledgePointId);

  // The full schedule, not just what is due, so the review trail can show
  // "kembali 14 Des" for a point that is not due yet.
  const upcoming = Object.entries(bundle.progress.states)
    .map(([knowledgePointId, state]) => ({
      knowledgePointId,
      nextReviewAt: state.nextReviewAt,
    }))
    .sort((a, b) => Date.parse(a.nextReviewAt) - Date.parse(b.nextReviewAt));

  return (
    <MasteryTopicView
      topic={bundle.topic}
      points={points}
      duePointIds={due}
      upcoming={upcoming}
    />
  );
}
