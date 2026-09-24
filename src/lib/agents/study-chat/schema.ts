import { Type, type Schema } from "@google/genai";
import {
  MAX_STUDY_MESSAGE_CHARS,
  type StudyChatMessage,
  type StudyPathProposal,
} from "@/lib/learning/chat-types";
import type { OnboardingProfile } from "@/lib/onboarding/types";
import type { Level } from "@/types/domain";

export const MAX_STUDY_FOLLOW_UP_CHARS = 240;
export const MAX_STUDY_PATH_MODULES = 5;
export const MAX_STUDY_PATH_ID_CHARS = 120;
export const MAX_STUDY_PATH_RATIONALE_CHARS = 600;

export type StudyModelPathProposal = {
  readonly courseId: string;
  readonly moduleIds: readonly string[];
  readonly rationale: string;
};

export type StudyModelReply = {
  readonly message: string;
  readonly followUpQuestion: string;
  readonly pathProposal: StudyModelPathProposal | null;
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
  readonly pendingProposal?: StudyPathProposal;
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

const TOP_LEVEL_FIELDS = ["message", "followUpQuestion", "pathProposal"] as const;
const PROPOSAL_FIELDS = ["courseId", "moduleIds", "rationale"] as const;

const PROPOSAL_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    courseId: { type: Type.STRING },
    moduleIds: { type: Type.ARRAY, items: { type: Type.STRING } },
    rationale: { type: Type.STRING },
  },
  required: ["courseId", "moduleIds", "rationale"],
} satisfies Schema;

export const SKEMA_STUDY_REPLY = {
  type: Type.OBJECT,
  properties: {
    message: { type: Type.STRING },
    followUpQuestion: { type: Type.STRING },
    pathProposal: {
      anyOf: [PROPOSAL_SCHEMA, { type: Type.NULL }],
    },
  },
  required: ["message", "followUpQuestion", "pathProposal"],
} satisfies Schema;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactFields(value: Record<string, unknown>, fields: readonly string[]): boolean {
  const ownKeys = Reflect.ownKeys(value);
  return ownKeys.length === fields.length && fields.every((field) => Object.hasOwn(value, field));
}

function isBoundedText(
  value: unknown,
  maxLength: number,
  allowEmpty = false,
): value is string {
  if (typeof value !== "string" || value.length > maxLength) return false;
  if (allowEmpty && value.length === 0) return true;
  return value.trim().length > 0;
}

function parseModuleIds(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_STUDY_PATH_MODULES) {
    return null;
  }

  for (const key of Reflect.ownKeys(value)) {
    if (key === "length") continue;
    if (typeof key !== "string" || !/^(0|[1-9]\d*)$/.test(key)) return null;
    const index = Number(key);
    if (!Number.isSafeInteger(index) || index >= value.length) return null;
  }

  const moduleIds: string[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.hasOwn(value, index)) return null;
    const moduleId: unknown = value[index];
    if (
      !isBoundedText(moduleId, MAX_STUDY_PATH_ID_CHARS) ||
      seen.has(moduleId)
    ) {
      return null;
    }
    seen.add(moduleId);
    moduleIds.push(moduleId);
  }
  return moduleIds;
}

function parsePathProposal(value: unknown): StudyModelPathProposal | null {
  if (!isRecord(value) || !hasExactFields(value, PROPOSAL_FIELDS)) return null;
  if (!isBoundedText(value.courseId, MAX_STUDY_PATH_ID_CHARS)) return null;
  if (!isBoundedText(value.rationale, MAX_STUDY_PATH_RATIONALE_CHARS)) return null;
  const moduleIds = parseModuleIds(value.moduleIds);
  if (!moduleIds) return null;
  return { courseId: value.courseId, moduleIds, rationale: value.rationale };
}

export function validateStudyModelReply(raw: unknown): StudyReplyValidationResult {
  if (!isRecord(raw) || !hasExactFields(raw, TOP_LEVEL_FIELDS)) return { ok: false };
  if (!isBoundedText(raw.message, MAX_STUDY_MESSAGE_CHARS)) return { ok: false };
  if (!isBoundedText(raw.followUpQuestion, MAX_STUDY_FOLLOW_UP_CHARS, true)) {
    return { ok: false };
  }

  const pathProposal = raw.pathProposal;
  if (pathProposal !== null) {
    const parsedProposal = parsePathProposal(pathProposal);
    if (!parsedProposal) return { ok: false };
    return {
      ok: true,
      reply: {
        message: raw.message,
        followUpQuestion: raw.followUpQuestion,
        pathProposal: parsedProposal,
      },
    };
  }

  return {
    ok: true,
    reply: {
      message: raw.message,
      followUpQuestion: raw.followUpQuestion,
      pathProposal: null,
    },
  };
}
