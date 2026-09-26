export const STUDY_CHAT_VERSION = 1;
export const MAX_STUDY_CHAT_MESSAGES = 6;
export const MAX_STUDY_MESSAGE_CHARS = 600;
export const MAX_STUDY_TRANSCRIPT_CHARS = 1800;
export const STUDY_CHAT_COOKIE = "ls_study_chat";
export const STUDY_CHAT_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export type StudyChatRole = "user" | "assistant";

export interface StudyChatMessage {
  id: string;
  role: StudyChatRole;
  content: string;
  createdAt: string;
  courseId?: string;
  moduleId?: string;
  truncated?: boolean;
}

export interface StudyChatSnapshot {
  version: 1;
  messages: StudyChatMessage[];
}

export interface StudyChatEnvelope extends StudyChatSnapshot {
  owner: string;
}

export type StudyChatActionState =
  | { status: "idle" }
  | { status: "unauthenticated"; message: string }
  | { status: "invalid_input"; message: string }
  | {
      status: "unavailable";
      reason: "missing_api_key" | "rate_limited" | "provider_error";
      message: string;
      snapshot: StudyChatSnapshot;
    }
  | {
      status: "invalid_model_output";
      message: string;
      snapshot: StudyChatSnapshot;
    }
  | {
      status: "success";
      message: string;
      snapshot: StudyChatSnapshot;
    };
