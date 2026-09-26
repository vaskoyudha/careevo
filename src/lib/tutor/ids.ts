import { randomBytes } from "node:crypto";
import { MAX_TUTOR_TITLE_CHARS } from "./types";

/**
 * Session id + title helpers for the tutor workspace.
 *
 * Ids are URL-safe random hex, never derived from user input, so a session id
 * can be pasted into the address bar without any chance of it escaping the
 * store's directory (see `session-store.ts`, which still re-checks with
 * `path.basename` — defence in depth, not a substitute).
 */

const ID_ALPHABET = "abcdefghijkmnopqrstuvwxyz23456789";

/**
 * A short, URL-safe id, drawn uniformly from `ID_ALPHABET`.
 *
 * The alphabet drops `0`, `1` and `l` — the glyphs most easily confused with
 * `o`, `I` and `1` when an id is read aloud or copied by hand. 33 symbols over
 * 12 characters is ~63 bits, far more than the store needs.
 */
export function newSessionId(): string {
  const bytes = randomBytes(12);
  let out = "";
  for (const byte of bytes) {
    out += ID_ALPHABET[byte % ID_ALPHABET.length];
  }
  return out;
}

/**
 * The authoritative id shape. It is deliberately written as an explicit
 * character class rather than `[a-z2-9]` so it matches `ID_ALPHABET` exactly:
 * a validator wider than its generator would accept ids the store can never
 * produce, and that class is the security boundary for ids arriving from a URL.
 */
export const SESSION_ID_PATTERN = /^[a-km-z2-9]{12}$/;

export function isValidSessionId(value: unknown): value is string {
  return typeof value === "string" && SESSION_ID_PATTERN.test(value);
}

/**
 * Derive a session title from the learner's first question.
 *
 * Mirrors DeepTutor, which titles a session from its first user message
 * (`firstUserTitle` in `ChatWorkspace.tsx`) — a sidebar of "Percakapan 1" is
 * useless for finding a conversation again. Collapses whitespace, trims, and
 * cuts on a word boundary so the title never ends mid-word.
 */
export function titleFromMessage(content: string): string {
  const flat = content.replace(/\s+/g, " ").trim();
  if (flat.length === 0) return "Percakapan baru";
  if (flat.length <= MAX_TUTOR_TITLE_CHARS) return flat;
  const clipped = flat.slice(0, MAX_TUTOR_TITLE_CHARS);
  const lastSpace = clipped.lastIndexOf(" ");
  return `${(lastSpace > MAX_TUTOR_TITLE_CHARS / 2 ? clipped.slice(0, lastSpace) : clipped).trimEnd()}…`;
}

export function normalizeTitle(title: string): string {
  return title.replace(/\s+/g, " ").trim().slice(0, MAX_TUTOR_TITLE_CHARS);
}
