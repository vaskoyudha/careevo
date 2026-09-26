"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { katalogBelajar } from "@/lib/courses/katalog";
import { listPendaftaran } from "@/lib/courses/enrollment";
import { modulKursus } from "@/lib/courses/kurikulum";
import { bangunJalurPersonalisasi } from "@/lib/learning/personalized-path";
import { getProfile } from "@/lib/onboarding/store";
import { isValidSessionId } from "@/lib/tutor/ids";
import { newMessageId } from "@/lib/tutor/types";
import { appendTutorMessage, createTutorSession } from "@/lib/tutor/session-store";
import {
  archiveMasteryTopic,
  createMasteryTopic,
  deleteMasteryTopic,
  getMasteryTopic,
  recordAttempt,
} from "@/lib/mastery/store";
import {
  deskripsiTopikDefault,
  judulTopikDefault,
  turunkanPoinPenguasaan,
} from "@/lib/mastery/topic-tree";

/**
 * Server actions for the Mastery Path.
 *
 * A topic is derived from a course the learner is already enrolled in (or
 * recommended), so "start mastering" never needs a model. The optional
 * conversation is attached to a normal tutor session rather than owning a
 * second transcript, so mastery and the tutor share one history.
 */

export type MasteryActionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; message: string };

/**
 * Start a mastery topic for a course.
 *
 * Falls back to the learner's recommended course when no id is given, so the
 * button can be a single "Mulai jalur penguasaan" with nothing to choose.
 */
export async function mulaiTopikAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/masuk");

  const profile = await getProfile(session.email);
  if (!profile) redirect("/onboarding");

  const [catalog, enrollments] = await Promise.all([
    katalogBelajar(),
    listPendaftaran(session.email),
  ]);

  const requested = String(formData.get("courseId") ?? "").trim();
  const path = bangunJalurPersonalisasi({ profile, catalog, enrollments });
  const course = requested
    ? catalog.find((entry) => entry.id === requested)
    : path.course;

  if (!course) {
    revalidatePath("/belajar/mastery");
    return;
  }

  const modules = modulKursus(course);
  const points = turunkanPoinPenguasaan(modules);
  if (points.length === 0) {
    revalidatePath("/belajar/mastery");
    return;
  }

  const created = await createMasteryTopic({
    owner: session.email,
    title: judulTopikDefault(course),
    description: deskripsiTopikDefault(course),
    courseId: course.id,
    courseSlug: course.slug,
    points,
  });

  redirect(`/belajar/mastery/${created.topic.id}`);
}

/**
 * Record a graded attempt and move the review schedule.
 *
 * `knowledgePointId` and `correct` both come from the form, so both are
 * re-validated here: the store refuses a point the topic does not teach, and a
 * non-boolean would otherwise coerce to `true`.
 */
export async function catatPercobaanAction(
  _previous: MasteryActionState,
  formData: FormData,
): Promise<MasteryActionState> {
  const session = await getSession();
  if (!session) return { status: "error", message: "Masuk dulu untuk mencatat progres." };

  const topicId = String(formData.get("topicId") ?? "");
  if (!isValidSessionId(topicId)) {
    return { status: "error", message: "Topik tidak valid." };
  }

  const knowledgePointId = String(formData.get("knowledgePointId") ?? "").trim();
  if (knowledgePointId.length === 0) {
    return { status: "error", message: "Poin pengetahuan tidak valid." };
  }

  const correctRaw = String(formData.get("correct") ?? "");
  const correct = correctRaw === "true" || correctRaw === "benar";
  if (correctRaw !== "true" && correctRaw !== "false" && correctRaw !== "benar" && correctRaw !== "salah") {
    return { status: "error", message: "Hasil jawaban tidak valid." };
  }

  const updated = await recordAttempt(session.email, topicId, {
    knowledgePointId,
    correct,
    at: new Date().toISOString(),
    source: formData.get("source") === "review" ? "review" : "session",
  });

  if (!updated) {
    return { status: "error", message: "Poin itu tidak ada di topik ini." };
  }

  revalidatePath(`/belajar/mastery/${topicId}`);
  revalidatePath("/belajar/mastery");
  return {
    status: "success",
    message: correct
      ? "Bagus. Jadwal tinjauan diperpanjang."
      : "Oke, ini akan muncul lagi lebih cepat.",
  };
}

export async function arsipkanTopikAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/masuk");

  const topicId = String(formData.get("topicId") ?? "");
  if (!isValidSessionId(topicId)) return;
  await archiveMasteryTopic(session.email, topicId);
  revalidatePath("/belajar/mastery");
  revalidatePath(`/belajar/mastery/${topicId}`);
  redirect("/belajar/mastery");
}

export async function hapusTopikAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/masuk");

  const topicId = String(formData.get("topicId") ?? "");
  if (!isValidSessionId(topicId)) return;
  await deleteMasteryTopic(session.email, topicId);
  revalidatePath("/belajar/mastery");
  redirect("/belajar/mastery");
}

/**
 * Open a tutor conversation scoped to one knowledge point.
 *
 * The opening message is written on the learner's behalf — pressing the button
 * *is* the request — so the session arrives with context already in it rather
 * than as an empty box they have to describe. This mirrors DeepTutor's
 * hand-off (see `masteryOpeningMessage` upstream).
 */
export async function mulaiSesiTopikAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/masuk");

  const topicId = String(formData.get("topicId") ?? "");
  if (!isValidSessionId(topicId)) return;

  const bundle = await getMasteryTopic(session.email, topicId);
  if (!bundle) redirect("/belajar/mastery");

  const knowledgePointId = String(formData.get("knowledgePointId") ?? "").trim();
  const point = bundle.points.find((item) => item.id === knowledgePointId) ?? bundle.points[0];
  if (!point) redirect(`/belajar/mastery/${topicId}`);

  const opening = formData.get("opening") === "review"
    ? `Ulangi tes: apakah aku sudah menguasai "${point.name}"?`
    : `Bantu aku belajar "${point.name}". Mulai dari bagian yang paling sering bikin ragu.`;

  const tutorSession = await createMasterySession(session.email, bundle, point.name, opening);
  redirect(`/belajar/tutor/${tutorSession.id}`);
}

async function createMasterySession(
  owner: string,
  bundle: NonNullable<Awaited<ReturnType<typeof getMasteryTopic>>>,
  pointName: string,
  opening: string,
): Promise<{ id: string }> {
  const created = await createTutorSession(owner, {
    title: pointName,
    ...(bundle.topic.courseId ? { courseId: bundle.topic.courseId } : {}),
    ...(bundle.points[0] ? { moduleId: bundle.points[0].moduleId } : {}),
  });
  await appendTutorMessage(owner, created.id, {
    id: newMessageId(),
    role: "user",
    content: opening,
    createdAt: new Date().toISOString(),
    ...(bundle.topic.courseId ? { courseId: bundle.topic.courseId } : {}),
  });
  return created;
}
