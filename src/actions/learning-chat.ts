"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { appendStudyMessage } from "@/lib/learning/chat-store";
import {
  MAX_STUDY_MESSAGE_CHARS,
  type StudyChatActionState,
  type StudyChatMessage,
  type StudyChatSnapshot,
} from "@/lib/learning/chat-types";
import { loadPathContext, promptInputFor, type PathContext } from "@/lib/learning/path-context";
import { generateStudyReply } from "@/lib/agents/study-chat/model";
import type { StudyReplyFailureReason } from "@/lib/agents/study-chat/schema";

const PROVIDER_MESSAGES = {
  // Reached only when a model is configured but the call failed — with no
  // provider at all the port answers with the deterministic demo reply.
  missing_api_key: "Tutor belum dikonfigurasi.",
  rate_limited: "Batas penggunaan tutor tercapai. Coba lagi nanti.",
  provider_error: "Tutor sedang tidak tersedia. Coba lagi sebentar lagi.",
} as const satisfies Record<Exclude<StudyReplyFailureReason, "invalid_model_output">, string>;

function safeRevalidate(path: string): void {
  try {
    revalidatePath(path);
  } catch {
    return;
  }
}

function messageFor(
  content: string,
  role: StudyChatMessage["role"],
  context: PathContext,
): StudyChatMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    createdAt: new Date().toISOString(),
    ...(context.course ? { courseId: context.course.id } : {}),
    ...(context.currentModule ? { moduleId: context.currentModule.id } : {}),
  };
}

function unavailable(
  reason: Exclude<StudyReplyFailureReason, "invalid_model_output">,
  snapshot: StudyChatSnapshot,
): StudyChatActionState {
  return {
    status: "unavailable",
    reason,
    message: PROVIDER_MESSAGES[reason],
    snapshot,
  };
}

function invalidModelOutput(snapshot: StudyChatSnapshot): StudyChatActionState {
  return {
    status: "invalid_model_output",
    message: "Balasan tutor tidak valid. Silakan coba lagi.",
    snapshot,
  };
}

export async function kirimStudyChatAction(
  _previous: StudyChatActionState,
  formData: FormData,
): Promise<StudyChatActionState> {
  const session = await getSession();
  if (!session) {
    return { status: "unauthenticated", message: "Masuk dulu untuk membuka tutor." };
  }

  const rawMessage = formData.get("message");
  const message = typeof rawMessage === "string" ? rawMessage.trim() : "";
  if (message.length === 0 || message.length > MAX_STUDY_MESSAGE_CHARS) {
    return { status: "invalid_input", message: "Pesan harus berisi 1–600 karakter." };
  }

  const owner = session.email;
  const context = await loadPathContext(owner);
  if (!context) {
    return { status: "invalid_input", message: "Profil belajar belum lengkap." };
  }

  const learnerMessage = messageFor(message, "user", context);
  const afterLearner = await appendStudyMessage(owner, learnerMessage);
  const result = await generateStudyReply(promptInputFor(context, afterLearner.messages));

  if (!result.ok) {
    return result.reason === "invalid_model_output"
      ? invalidModelOutput(afterLearner)
      : unavailable(result.reason, afterLearner);
  }

  const assistant = messageFor(result.reply.message, "assistant", context);
  const afterAssistant = await appendStudyMessage(owner, assistant);
  safeRevalidate("/belajar/jalur");
  return { status: "success", message: "Tutor siap membantu.", snapshot: afterAssistant };
}
