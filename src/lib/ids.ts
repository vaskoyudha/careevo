import { randomBytes } from "node:crypto";

/**
 * The id shape shared by every owner-scoped file store under `.data/`.
 *
 * Mastery topics, books and practice quizzes all key their directory by one of
 * these ids, and all three validate an id arriving from a URL against the same
 * pattern before it reaches the filesystem. It used to live in
 * `src/lib/tutor/ids.ts` and was named for the tutor workspace; the tutor is
 * gone, but the ids it minted still address three stores, so the helper moved
 * here rather than being duplicated per store.
 *
 * Ids are URL-safe random hex, never derived from user input, so an id can be
 * pasted into the address bar without any chance of it escaping the store's
 * directory (each store still re-checks with `path.basename` — defence in
 * depth, not a substitute).
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
