"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { loadPathContext, promptInputFor, type PathContext } from "@/lib/learning/path-context";
import { generateStudyReply } from "@/lib/agents/study-chat/model";
import {
  appendTutorMessage,
  createTutorSession,
  deleteTutorSession,
  getTutorSession,
  renameTutorSession,
  setTutorKonteks,
} from "@/lib/tutor/session-store";
import { isValidSessionId, normalizeTitle, titleFromMessage } from "@/lib/tutor/ids";
import { mintaPetunjuk } from "@/lib/agents/study-chat/hint";
import {
  MAX_TUTOR_MESSAGE_CHARS,
  newMessageId,
  type TutorKonteks,
  type TutorMessage,
} from "@/lib/tutor/types";

/**
 * Server actions for the DeepTutor-style tutor workspace.
 *
 * Reuses the existing study-chat agent (`generateStudyReply`) rather than
 * inventing a second one: the prompt, schema and failure handling are already
 * tested, and a tutor that behaves differently depending on which screen you
 * opened it from would be a bug, not a feature.
 *
 * Session persistence is file-backed (`src/lib/tutor/session-store.ts`) because
 * a sidebar of conversations cannot fit in a cookie.
 */

export type TutorSendState =
  | { status: "idle" }
  | { status: "unauthenticated"; message: string }
  | { status: "invalid_input"; message: string }
  | { status: "not_found"; message: string }
  | { status: "success"; message: string; sessionId: string }
  | {
      status: "unavailable";
      reason: "missing_api_key" | "rate_limited" | "provider_error" | "invalid_model_output";
      message: string;
      sessionId: string;
    };

const PROVIDER_MESSAGES = {
  // Reached only when a model *is* configured but the call failed — with no
  // provider at all the port returns the deterministic demo reply instead, so
  // this is never "you forgot a key" anymore.
  missing_api_key: "Tutor belum dikonfigurasi.",
  rate_limited: "Batas penggunaan tutor tercapai. Coba lagi nanti.",
  provider_error: "Tutor sedang tidak tersedia. Coba lagi sebentar lagi.",
  invalid_model_output: "Balasan tutor tidak valid. Silakan coba lagi.",
} as const;

/**
 * The learning context a session records, as ids *and* titles.
 *
 * The titles are not decoration: the activity drawer shows them, and a raw key
 * like `r1-m1` tells a learner nothing. They travel with the ids so the drawer
 * never has to join back to the catalogue on the client.
 */
function konteksTutor(context: PathContext): TutorKonteks {
  return {
    ...(context.course ? { courseId: context.course.id, courseTitle: context.course.title } : {}),
    ...(context.currentModule
      ? { moduleId: context.currentModule.id, moduleTitle: context.currentModule.judul }
      : {}),
  };
}

function tutorMessage(
  content: string,
  role: TutorMessage["role"],
  konteks: TutorKonteks,
): TutorMessage {
  return {
    id: newMessageId(),
    role,
    content,
    createdAt: new Date().toISOString(),
    ...konteks,
  };
}

export async function renameTutorSessionAction(
  _previous: { status: "idle" | "saved"; message: string },
  formData: FormData,
): Promise<{ status: "idle" | "saved"; message: string }> {
  const session = await getSession();
  if (!session) return { status: "idle", message: "Masuk dulu untuk mengubah nama." };

  const sessionId = String(formData.get("sessionId") ?? "");
  const title = String(formData.get("title") ?? "");
  if (!isValidSessionId(sessionId)) {
    return { status: "idle", message: "Sesi tidak valid." };
  }
  // A blank title is a rejected *input*, not a missing session. The store
  // returns `null` for both, so the wording is chosen before the call rather
  // than read off an ambiguous result — otherwise clearing the field reported
  // "Sesi tidak ditemukan", which sends the learner looking for a session that
  // is sitting right there.
  if (title.replace(/\s+/g, " ").trim().length === 0) {
    return { status: "idle", message: "Judul tidak boleh kosong." };
  }
  const renamed = await renameTutorSession(session.email, sessionId, normalizeTitle(title));
  if (!renamed) return { status: "idle", message: "Sesi tidak ditemukan." };
  // BOTH routes, because the rail's session list is rendered by whichever of
  // the two pages is on screen. Revalidating only `/belajar/tutor/<id>` left
  // the sidebar showing the old title after a rename made from `/belajar/tutor`
  // — the write succeeded and the list silently disagreed with the disk.
  revalidatePath(`/belajar/tutor/${sessionId}`);
  revalidatePath("/belajar/tutor");
  return { status: "saved", message: "Nama percakapan disimpan." };
}

export async function deleteTutorSessionAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/masuk");

  const sessionId = String(formData.get("sessionId") ?? "");
  if (!isValidSessionId(sessionId)) return;
  await deleteTutorSession(session.email, sessionId);
  revalidatePath("/belajar/tutor");
  // A deleted session must not leave the reader on a 404 of itself.
  redirect("/belajar/tutor");
}

/**
 * Send a message into a session and persist both the question and the reply.
 *
 * The learner message is written *before* the provider call, so a turn that
 * fails provider-side is still visible in the transcript — a question that
 * vanished on error reads as "nothing was sent".
 *
 * An empty `sessionId` means "first send from the empty workspace": the
 * session is created here and its id returned, and the caller navigates. This
 * is DeepTutor's own flow (sending the first message takes `/chat` →
 * `/chat/<id>`), and it beats redirecting on a click because it keeps the
 * question the learner already typed instead of round-tripping through a
 * blank page and losing it.
 */
export async function kirimTutorMessageAction(
  _previous: TutorSendState,
  formData: FormData,
): Promise<TutorSendState> {
  const session = await getSession();
  if (!session) {
    return { status: "unauthenticated", message: "Masuk dulu untuk membuka tutor." };
  }

  const requestedId = String(formData.get("sessionId") ?? "");
  const rawMessage = formData.get("message");
  const content = typeof rawMessage === "string" ? rawMessage.trim() : "";

  if (content.length === 0 || content.length > MAX_TUTOR_MESSAGE_CHARS) {
    return {
      status: "invalid_input",
      message: `Pesan harus berisi 1–${MAX_TUTOR_MESSAGE_CHARS} karakter.`,
    };
  }

  const owner = session.email;

  // Resolve the learner's path once per turn. The context is read *before* the
  // session is touched, so a first send can be anchored with it and every later
  // send can re-anchor to a path that has moved on.
  const context = await loadPathContext(owner);
  if (!context) {
    return { status: "invalid_input", message: "Profil belajar belum lengkap." };
  }
  const konteks = konteksTutor(context);

  let current = requestedId ? await getTutorSession(owner, requestedId) : null;
  if (requestedId && !current) {
    return { status: "not_found", message: "Sesi tidak ditemukan." };
  }
  // No session yet (or an id that never existed): start one, anchored to the
  // learner's current path so the tutor has course context on turn one.
  if (!current) {
    current = await createTutorSession(owner, { konteks });
  }

  const sessionId = current.id;
  // Re-anchor an existing session. Without this the activity drawer would keep
  // advertising the context from whenever the conversation was started, while
  // the model was actually being answered about today's module.
  if (
    current.courseId !== konteks.courseId ||
    current.moduleId !== konteks.moduleId ||
    current.courseTitle !== konteks.courseTitle ||
    current.moduleTitle !== konteks.moduleTitle
  ) {
    current = (await setTutorKonteks(owner, sessionId, konteks)) ?? current;
  }

  const isFirstTurn = current.messages.length === 0;
  const learnerMessage = tutorMessage(content, "user", konteks);
  const afterLearner = await appendTutorMessage(owner, sessionId, learnerMessage);
  if (!afterLearner) {
    return { status: "not_found", message: "Sesi tidak ditemukan." };
  }

  if (isFirstTurn) {
    // A sidebar of "Percakapan baru" is unfindable; DeepTutor titles a session
    // from its first user message too (ChatWorkspace.tsx `firstUserTitle`).
    await renameTutorSession(owner, sessionId, titleFromMessage(content));
  }

  const result = await generateStudyReply(promptInputFor(context, afterLearner.messages));
  if (!result.ok) {
    return {
      status: "unavailable",
      reason: result.reason,
      message: PROVIDER_MESSAGES[result.reason],
      sessionId,
    };
  }

  await appendTutorMessage(
    owner,
    sessionId,
    tutorMessage(result.reply.message, "assistant", konteks),
  );

  revalidatePath(`/belajar/tutor/${sessionId}`);
  revalidatePath("/belajar/tutor");
  return { status: "success", message: "Tutor siap membantu.", sessionId };
}

/**
 * The line to offer as the composer's placeholder, or `""`.
 *
 * This is DeepTutor's ask-hint (`deeptutor/services/chat_hints.py`), called
 * after a turn rather than as part of it. Two properties matter and are the
 * reason it lives in its own action instead of being folded into the send:
 *
 * - **It may fail freely.** An empty string means "offer nothing": no
 *   conversation yet, no model, a timeout, a prediction the sanitizer rejected.
 *   That is a real answer, so this never throws and never returns an error the
 *   composer would have to render. The static placeholder simply stands.
 * - **It is not on the send path.** The composer fetches it *after* the answer
 *   is already on screen, so a slow hint delays a hint and never the reply.
 *
 * The transcript is read here rather than passed in by the client, because the
 * prediction is derived from what the tutor actually said — a client-supplied
 * transcript would be an unauthenticated prompt-injection surface.
 */
export async function mintaPetunjukTutorAction(sessionId: string): Promise<string> {
  const session = await getSession();
  if (!session) return "";
  if (!isValidSessionId(sessionId)) return "";
  const tutorSession = await getTutorSession(session.email, sessionId);
  if (!tutorSession || tutorSession.messages.length === 0) return "";
  return mintaPetunjuk(tutorSession.messages);
}
