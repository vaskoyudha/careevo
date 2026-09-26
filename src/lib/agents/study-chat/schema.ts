import type { StudyChatMessage } from "@/lib/learning/chat-types";
import type { OnboardingProfile } from "@/lib/onboarding/types";
import type { Level } from "@/types/domain";

/**
 * The tutor reply contract.
 *
 * A reply is **one string of Markdown prose**. That is the whole contract.
 *
 * This replaced a structured object (`{ message, followUpQuestion,
 * pathProposal }`) that was attributed to DeepTutor but never existed there.
 * Upstream's chat turn is an agent loop
 * (`deeptutor/agents/loop/agent_loop.py`) whose finish condition is "a round
 * that calls NO tools" — the answer is prose streamed to the client, and
 * nothing parses it into fields. Forcing it into JSON had two costs that were
 * plainly visible in the product: the model was graded on a schema instead of
 * on its answer and could be rejected outright for an honest reply, and the
 * narration needed to satisfy three fields crowded out the teaching.
 *
 * So the rule now is upstream's rule: prose for a human, structure only for
 * machines. (`pathProposal` did not survive — the learning path it proposed is
 * offered as an explicit hand-off, which is how upstream models a hand-off too:
 * a closed target set in `course_handoff`, not a field on the answer.)
 *
 * What is still enforced, because prose is not a licence to accept anything:
 * the reply must be a non-empty string, and it must be under a hard ceiling.
 * The ceiling is deliberately far above any sane answer — a reply that breaks
 * it is a malfunction (a runaway generation, an echoed request), not a long
 * one, and the per-surface stores truncate and mark what genuinely is too long.
 */

/**
 * Hard ceiling on a tutor answer, in characters.
 *
 * Not the display bound: the cookie card keeps 600 chars and the tutor
 * workspace 4000, and both truncate with a visible notice. This is the point
 * past which the *model* is judged broken.
 */
export const MAX_STUDY_REPLY_CHARS = 20_000;

export type StudyModelReply = {
  /** Markdown prose. Rendered, never fed back into a schema. */
  readonly message: string;
};

export type StudyPromptInput = {
  readonly profile: {
    readonly experience: OnboardingProfile["experience"];
    readonly interests: readonly OnboardingProfile["interests"][number][];
    readonly goal: string;
    readonly weeklyHours: number;
  };
  readonly course?: {
    readonly id: string;
    readonly slug: string;
    readonly title: string;
    readonly tags: readonly string[];
    readonly level: Level;
  };
  readonly module?: {
    readonly id: string;
    readonly title: string;
  };
  readonly messages: readonly StudyChatMessage[];
};

export type StudyReplyValidationResult =
  | { readonly ok: true; readonly reply: StudyModelReply }
  | { readonly ok: false };

export type StudyReplyFailureReason =
  | "missing_api_key"
  | "rate_limited"
  | "provider_error"
  | "invalid_model_output";

export type StudyReplyResult =
  | { readonly ok: true; readonly reply: StudyModelReply }
  | {
      readonly ok: false;
      readonly reason: StudyReplyFailureReason;
      readonly message: string;
    };

/**
 * Accept a model answer, or reject it as unusable.
 *
 * Returns the trimmed text. The caller decides how to bound it for its own
 * surface; this only refuses inputs that are not a real answer at all.
 */
export function validateStudyModelReply(raw: unknown): StudyReplyValidationResult {
  if (typeof raw !== "string") return { ok: false };
  const message = raw.trim();
  if (message.length === 0) return { ok: false };
  if (message.length > MAX_STUDY_REPLY_CHARS) return { ok: false };
  return { ok: true, reply: { message } };
}
