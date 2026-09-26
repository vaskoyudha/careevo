"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { katalogBelajar } from "@/lib/courses/katalog";
import { listPendaftaran } from "@/lib/courses/enrollment";
import { modulKursus } from "@/lib/courses/kurikulum";
import { bangunJalurPersonalisasi } from "@/lib/learning/personalized-path";
import { getProfile } from "@/lib/onboarding/store";
import { isValidSessionId } from "@/lib/ids";
import {
  archiveMasteryTopic,
  createMasteryTopic,
  deleteMasteryTopic,
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
