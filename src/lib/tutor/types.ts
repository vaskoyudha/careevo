import { randomBytes } from "node:crypto";

/**
 * Tutor session types.
 *
 * Mirrors the `StudyChat` vocabulary that already exists in
 * `src/lib/learning/chat-types.ts`, but for a *session list* rather than the
 * single rolling cookie transcript. The cookie store caps at 6 messages /
 * 1800 chars, which is right for one inline card and useless for a workspace
 * with a sidebar of past conversations — hence the file-backed store.
 */

/** Longest a single message may be, in characters. */
export const MAX_TUTOR_MESSAGE_CHARS = 4_000;
/** Longest a session title may be, in characters. */
export const MAX_TUTOR_TITLE_CHARS = 80;
/** Most messages one session keeps before the oldest are dropped. */
export const MAX_TUTOR_MESSAGES = 200;

export type TutorRole = "user" | "assistant";

export interface TutorMessage {
  id: string;
  role: TutorRole;
  content: string;
  createdAt: string;
  /** Course/module the turn was anchored to, when known. */
  courseId?: string;
  courseTitle?: string;
  moduleId?: string;
  moduleTitle?: string;
  /** True when the stored content is shorter than what the model produced. */
  truncated?: boolean;
}

export interface TutorSession {
  id: string;
  owner: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: TutorMessage[];
  courseId?: string;
  courseTitle?: string;
  moduleId?: string;
  moduleTitle?: string;
}

/**
 * The learning context a session is anchored to.
 *
 * Ids AND titles, deliberately. The ids are the join key the store needs; the
 * titles are what a learner is shown. The activity drawer used to render the
 * bare ids (`r1`, `r1-m1`) because the ids were all the session carried, and a
 * database key is not a course name — so the titles are persisted next to them
 * rather than looked up at render time. That also makes the drawer a record of
 * the context the tutor was *actually* given, which is the honest thing to show
 * even if the course is renamed later.
 */
export interface TutorKonteks {
  courseId?: string;
  courseTitle?: string;
  moduleId?: string;
  moduleTitle?: string;
}

/** Shape persisted to disk. `version` lets the store migrate or reject later. */
export interface TutorSessionEnvelope {
  version: 1;
  session: TutorSession;
}

const ISO_TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isTimestamp(value: unknown): value is string {
  return (
    isNonEmptyString(value) && ISO_TIMESTAMP.test(value) && !Number.isNaN(Date.parse(value))
  );
}

export function isTutorMessage(value: unknown): value is TutorMessage {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    isNonEmptyString(c.id) &&
    (c.role === "user" || c.role === "assistant") &&
    isNonEmptyString(c.content) &&
    isTimestamp(c.createdAt) &&
    semuaKonteksValid(c) &&
    (c.truncated === undefined || typeof c.truncated === "boolean")
  );
}

export function isTutorSession(value: unknown): value is TutorSession {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    isNonEmptyString(c.id) &&
    isNonEmptyString(c.owner) &&
    c.owner === c.owner.trim().toLowerCase() &&
    isNonEmptyString(c.title) &&
    c.title.length <= MAX_TUTOR_TITLE_CHARS &&
    isTimestamp(c.createdAt) &&
    isTimestamp(c.updatedAt) &&
    Array.isArray(c.messages) &&
    c.messages.every(isTutorMessage) &&
    semuaKonteksValid(c)
  );
}

/**
 * The four optional context fields, validated in one place.
 *
 * They are all "absent, or a non-empty string" — the same rule four times per
 * record. Written as a loop so a fifth field cannot be added to the type and
 * forgotten here, which is how a field ends up persisted but never validated.
 */
const KUNTEKS_KEYS = ["courseId", "courseTitle", "moduleId", "moduleTitle"] as const;

function semuaKonteksValid(c: Record<string, unknown>): boolean {
  return KUNTEKS_KEYS.every((key) => c[key] === undefined || isNonEmptyString(c[key]));
}

/** Copy the context fields that are actually present, dropping absent ones. */
function konteksTersimpan(c: Record<string, unknown>): TutorKonteks {
  const out: TutorKonteks = {};
  for (const key of KUNTEKS_KEYS) {
    if (isNonEmptyString(c[key])) out[key] = c[key];
  }
  return out;
}

/** Keep only the newest messages, each bounded in length. */
export function boundMessages(messages: TutorMessage[]): TutorMessage[] {
  return messages
    .slice(-MAX_TUTOR_MESSAGES)
    .map((message) => {
      const content = message.content.slice(0, MAX_TUTOR_MESSAGE_CHARS);
      const truncated =
        message.truncated === true ||
        (message.role === "assistant" && content.length < message.content.length);
      return {
        id: message.id,
        role: message.role,
        content,
        createdAt: message.createdAt,
        ...konteksTersimpan(message as unknown as Record<string, unknown>),
        ...(truncated ? { truncated: true } : {}),
      };
    });
}

export function newMessageId(): string {
  return randomBytes(12).toString("hex");
}
