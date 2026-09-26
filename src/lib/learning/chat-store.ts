import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { normalizeOwner } from "@/lib/auth/types";
import {
  MAX_STUDY_CHAT_MESSAGES,
  MAX_STUDY_MESSAGE_CHARS,
  MAX_STUDY_TRANSCRIPT_CHARS,
  STUDY_CHAT_COOKIE,
  STUDY_CHAT_MAX_AGE_SECONDS,
  STUDY_CHAT_VERSION,
  type StudyChatEnvelope,
  type StudyChatMessage,
  type StudyChatSnapshot,
} from "./chat-types";

const STUDY_CHAT_SECRET =
  process.env.SESSION_SECRET ?? "dev-session-secret-careevo";
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function emptySnapshot(): StudyChatSnapshot {
  return { version: STUDY_CHAT_VERSION, messages: [] };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isTimestamp(value: unknown): value is string {
  return (
    isNonEmptyString(value) && ISO_TIMESTAMP.test(value) && !Number.isNaN(Date.parse(value))
  );
}

function isValidMessage(value: unknown): value is StudyChatMessage {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    isNonEmptyString(candidate.id) &&
    (candidate.role === "user" || candidate.role === "assistant") &&
    isNonEmptyString(candidate.content) &&
    isTimestamp(candidate.createdAt) &&
    (candidate.courseId === undefined || isNonEmptyString(candidate.courseId)) &&
    (candidate.moduleId === undefined || isNonEmptyString(candidate.moduleId)) &&
    (candidate.truncated === undefined || typeof candidate.truncated === "boolean")
  );
}

function isBoundedMessage(value: unknown): value is StudyChatMessage {
  return isValidMessage(value) && value.content.length <= MAX_STUDY_MESSAGE_CHARS;
}

function isEnvelope(value: unknown): value is StudyChatEnvelope {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  if (
    candidate.version !== STUDY_CHAT_VERSION ||
    !isNonEmptyString(candidate.owner) ||
    candidate.owner !== normalizeOwner(candidate.owner) ||
    !Array.isArray(candidate.messages) ||
    candidate.messages.length > MAX_STUDY_CHAT_MESSAGES ||
    !candidate.messages.every(isBoundedMessage)
  ) {
    return false;
  }
  const transcriptChars = candidate.messages.reduce(
    (total, item) => total + item.content.length,
    0,
  );
  return transcriptChars <= MAX_STUDY_TRANSCRIPT_CHARS;
}

function sign(body: string): string {
  return createHmac("sha256", STUDY_CHAT_SECRET).update(body).digest("base64url");
}

function safeEqual(actual: string, expected: string): boolean {
  const actualBytes = Buffer.from(actual, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  if (actualBytes.length !== expectedBytes.length) return false;
  return timingSafeEqual(actualBytes, expectedBytes);
}

function encode(envelope: StudyChatEnvelope): string {
  const payload: StudyChatEnvelope = {
    version: envelope.version,
    owner: envelope.owner,
    messages: envelope.messages,
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${sign(body)}`;
}

function decode(raw: string | undefined): StudyChatEnvelope | null {
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 2) return null;
  const [body, signature] = parts;
  if (!body || !signature || !safeEqual(signature, sign(body))) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!isEnvelope(parsed)) return null;
    return {
      version: parsed.version,
      owner: parsed.owner,
      messages: parsed.messages.map(boundMessage),
    };
  } catch {
    return null;
  }
}

function toSnapshot(envelope: StudyChatEnvelope): StudyChatSnapshot {
  return {
    version: envelope.version,
    messages: envelope.messages,
  };
}

async function readEnvelope(owner: string): Promise<StudyChatEnvelope | null> {
  const normalizedOwner = normalizeOwner(owner);
  if (!normalizedOwner) return null;
  const jar = await cookies();
  const envelope = decode(jar.get(STUDY_CHAT_COOKIE)?.value);
  return envelope?.owner === normalizedOwner ? envelope : null;
}

async function writeEnvelope(envelope: StudyChatEnvelope): Promise<StudyChatSnapshot> {
  const jar = await cookies();
  jar.set(STUDY_CHAT_COOKIE, encode(envelope), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: STUDY_CHAT_MAX_AGE_SECONDS,
  });
  return toSnapshot(envelope);
}

function boundMessage(message: StudyChatMessage): StudyChatMessage {
  const content = message.content.slice(0, MAX_STUDY_MESSAGE_CHARS);
  const truncated =
    message.truncated === true ||
    (message.role === "assistant" && content.length < message.content.length);
  return {
    id: message.id,
    role: message.role,
    content,
    createdAt: message.createdAt,
    ...(message.courseId === undefined ? {} : { courseId: message.courseId }),
    ...(message.moduleId === undefined ? {} : { moduleId: message.moduleId }),
    ...(truncated ? { truncated: true } : {}),
  };
}

function boundMessages(messages: StudyChatMessage[]): StudyChatMessage[] {
  const bounded = messages.slice(-MAX_STUDY_CHAT_MESSAGES);
  while (
    bounded.reduce((total, item) => total + item.content.length, 0) >
      MAX_STUDY_TRANSCRIPT_CHARS
  ) {
    bounded.shift();
  }
  return bounded;
}

export async function readStudyChatSnapshot(owner: string): Promise<StudyChatSnapshot> {
  const envelope = await readEnvelope(owner);
  return envelope ? toSnapshot(envelope) : emptySnapshot();
}

export async function appendStudyMessage(
  owner: string,
  message: StudyChatMessage,
): Promise<StudyChatSnapshot> {
  if (!isValidMessage(message)) return readStudyChatSnapshot(owner);
  const envelope = await readEnvelope(owner);
  const nextEnvelope: StudyChatEnvelope = {
    version: STUDY_CHAT_VERSION,
    owner: normalizeOwner(owner),
    messages: boundMessages([
      ...(envelope?.messages ?? []),
      boundMessage(message),
    ]),
  };
  return nextEnvelope.owner ? writeEnvelope(nextEnvelope) : emptySnapshot();
}
