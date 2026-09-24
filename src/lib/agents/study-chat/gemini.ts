import { GoogleGenAI } from "@google/genai";
import { bangunPromptStudy } from "@/lib/agents/study-chat/prompt";
import {
  SKEMA_STUDY_REPLY,
  validateStudyModelReply,
  type StudyPromptInput,
  type StudyReplyFailureReason,
  type StudyReplyResult,
} from "@/lib/agents/study-chat/schema";

export type { StudyReplyResult } from "@/lib/agents/study-chat/schema";

const DEFAULT_MODEL = "gemini-2.5-flash";
const FAILURE_MESSAGES = {
  missing_api_key: "Tutor Gemini belum dikonfigurasi.",
  rate_limited: "Batas penggunaan tutor tercapai. Coba lagi nanti.",
  provider_error: "Tutor Gemini sedang tidak tersedia.",
  invalid_model_output: "Balasan tutor tidak sesuai format.",
} as const satisfies Record<StudyReplyFailureReason, string>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasStatus(error: unknown, expected: number): boolean {
  if (!isRecord(error)) return false;
  return error.status === expected || error.statusCode === expected;
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (isRecord(error) && Object.hasOwn(error, "message") && typeof error.message === "string") {
    return error.message;
  }
  return "";
}

function classifyProviderError(error: unknown): "rate_limited" | "provider_error" {
  const text = errorText(error).toLowerCase();
  if (
    hasStatus(error, 429) ||
    text.includes("quota") ||
    text.includes("rate limit") ||
    text.includes("rate_limit") ||
    text.includes("rate-limited") ||
    text.includes("rate exceeded") ||
    text.includes("too many requests") ||
    text.includes("resource_exhausted") ||
    text.includes("429")
  ) {
    return "rate_limited";
  }
  return "provider_error";
}

function redactedMessage(message: string, apiKey: string): string {
  const withoutKey = apiKey ? message.split(apiKey).join("[REDACTED]") : message;
  return withoutKey.slice(0, 300);
}

function failure(reason: StudyReplyFailureReason, apiKey = ""): StudyReplyResult {
  return {
    ok: false,
    reason,
    message: redactedMessage(FAILURE_MESSAGES[reason], apiKey),
  };
}

async function requestStudyText(prompt: string, apiKey: string): Promise<string | undefined> {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL ?? DEFAULT_MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: SKEMA_STUDY_REPLY,
    },
  });
  return response.text;
}

export async function generateStudyReply(input: StudyPromptInput): Promise<StudyReplyResult> {
  const configuredKey = process.env.GEMINI_API_KEY ?? "";
  if (configuredKey.trim().length === 0) return failure("missing_api_key");

  const apiKey = configuredKey.trim();
  const prompt = bangunPromptStudy(input);
  let text: string | undefined;
  try {
    text = await requestStudyText(prompt, apiKey);
  } catch (error: unknown) { // no-excuse-ok: catch
    return failure(classifyProviderError(error), apiKey);
  }

  if (typeof text !== "string" || text.length === 0) {
    return failure("invalid_model_output", apiKey);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error: unknown) {
    if (error instanceof SyntaxError) return failure("invalid_model_output", apiKey);
    throw error;
  }

  const validation = validateStudyModelReply(parsed);
  // A course-less proposal is rejected, never silently stripped or invented.
  const hasCourseContext = input.course !== undefined && input.course !== null;
  if (!validation.ok || (!hasCourseContext && validation.reply.pathProposal !== null)) {
    return failure("invalid_model_output", apiKey);
  }
  return { ok: true, reply: validation.reply };
}
