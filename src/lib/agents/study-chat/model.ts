import { getLlm, LLM_FAILURE_MESSAGES, type LlmResult } from "@/lib/llm/port";
import { bangunPromptStudy } from "@/lib/agents/study-chat/prompt";
import {
  validateStudyModelReply,
  type StudyPromptInput,
  type StudyReplyFailureReason,
  type StudyReplyResult,
} from "@/lib/agents/study-chat/schema";

export type { StudyReplyResult } from "@/lib/agents/study-chat/schema";

/**
 * The tutor's reply generator.
 *
 * Careevo's own module, not a DeepTutor port.
 *
 * DeepTutor has no structured chat reply at all: a turn runs an agent loop
 * (`deeptutor/agents/loop/agent_loop.py` — "a round that calls NO tools is the
 * finish") and the answer is the prose that came out of it. Nothing parses that
 * answer into fields. This module used to ask for a `{ message,
 * followUpQuestion, pathProposal }` object anyway, which was our invention
 * wearing upstream's name; a reply is now plain Markdown and is validated only
 * as "non-empty, not absurdly long". See `schema.ts` for why that reversal was
 * worth making.
 *
 * What *is* borrowed from upstream is its one architectural rule: every LLM
 * call resolves one provider from one configuration through one factory
 * (`deeptutor/services/llm/provider_factory.py::_build_runtime_provider` with
 * `OpenAICompatProvider`), so chat, quizzes and books all reach the same model
 * by the same route. `getLlm()` is Careevo's equivalent.
 *
 * Why this replaced a Google-SDK-only function: the previous version built a
 * `GoogleGenAI` client from `GEMINI_API_KEY` itself, so the tutor was the one
 * surface that ignored the port. With only an OpenAI-compatible endpoint
 * configured the chat returned "not configured" while the quiz generator and
 * book compiler — which do go through the port — worked. That is exactly the
 * inconsistency the port exists to prevent.
 *
 * Two safeguards are deliberately kept:
 * - a failure is a typed result, never a thrown error, so the caller can keep
 *   the learner's own turn persisted and still say why nothing came back;
 * - the returned message is our own canonical Indonesian text, never the raw
 *   provider body, so a provider that echoes the request (or the key) cannot
 *   leak it into the UI.
 */

const FAILURE_MESSAGES = {
  missing_api_key: "Tutor belum dikonfigurasi.",
  rate_limited: LLM_FAILURE_MESSAGES.rate_limited,
  provider_error: LLM_FAILURE_MESSAGES.provider_error,
  invalid_model_output: "Balasan tutor kosong. Coba lagi.",
} as const satisfies Record<StudyReplyFailureReason, string>;

/** Port reason → study reason. The names differ only for the last case. */
function keAlasan(
  reason: Extract<LlmResult, { ok: false }>["reason"],
): StudyReplyFailureReason {
  if (reason === "invalid_output") return "invalid_model_output";
  return reason;
}

function gagal(reason: StudyReplyFailureReason): StudyReplyResult {
  return { ok: false, reason, message: FAILURE_MESSAGES[reason] };
}

/**
 * The reply shown when no model is configured.
 *
 * The tutor is a chat, so unlike the quiz it cannot fall back to "here are the
 * questions anyway" — but it also must not be dead, because a learner who opens
 * the workspace and types a question has to get *something* coherent back. This
 * answers from the learner's own words and the course context, and says plainly
 * that it is a demo, so the canned nature is obvious rather than dressed up as
 * a confident answer. It mirrors `StubLlm`'s honesty while staying in the
 * tutor's own voice — a second person, addressing the learner directly.
 */
function balasanContoh(input: StudyPromptInput): StudyReplyResult {
  const pertanyaan =
    [...input.messages].reverse().find((message) => message.role === "user")?.content.trim() ??
    "";
  const konteks = input.module?.title ?? input.course?.title ?? null;

  const bagian = [
    `**Mode contoh aktif${konteks ? ` untuk "${konteks}"` : ""}.** Belum ada model yang`,
    "dikonfigurasi, jadi ini bukan jawaban hasil penalaran, melainkan kerangka belajar.",
    "",
    pertanyaan ? `Kamu bertanya: *${pertanyaan}*` : "Kamu belum menulis pertanyaan.",
    "",
    "Tulis ulang pertanyaan itu dengan kata-katamu sendiri, kaitkan dengan materi yang sedang",
    "kamu pelajari, lalu catat bagian yang masih mengambang. Begitu model dikonfigurasi,",
    "jawaban yang sesungguhnya akan muncul di tempat ini.",
  ];

  return { ok: true, reply: { message: bagian.join("\n") } };
}

export async function generateStudyReply(input: StudyPromptInput): Promise<StudyReplyResult> {
  const llm = getLlm();
  // No provider at all → the honest, deterministic demo reply. A model that is
  // configured but unreachable returns a typed failure below instead, so the
  // learner is told "try again later", not handed canned text.
  if (!llm.available) return balasanContoh(input);

  const prompt = bangunPromptStudy(input);

  // The port decides the provider — a Gemini key, an OpenAI-compatible
  // endpoint, or the deterministic stub — so this function never branches on an
  // env var and the tutor cannot silently disagree with the rest of the app.
  //
  // No `json: true`: the answer is prose, and asking an endpoint for JSON mode
  // here was what forced the reply through a schema it never needed.
  let result: LlmResult;
  try {
    result = await llm.generate(prompt);
  } catch {
    return gagal("provider_error");
  }

  if (!result.ok) return gagal(keAlasan(result.reason));

  const validation = validateStudyModelReply(result.text);
  if (!validation.ok) return gagal("invalid_model_output");
  return { ok: true, reply: validation.reply };
}
