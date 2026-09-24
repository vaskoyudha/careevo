/**
 * Editable public-profile domain.
 *
 * Everything a learner can change about how their profile *looks*: display
 * name parts, a short bio, an optional website, and optional avatar / cover
 * images (stored as small data-URLs).
 *
 * Deliberately separate from:
 *  - `src/lib/auth` — identity/session (email, role, password);
 *  - `src/lib/onboarding` — the personalization profile (interests/goals).
 *
 * Persisted through the same HMAC-signed cookie pattern as those two stores so
 * the demo "works" without a database, and the whole thing can be swapped for
 * a DB later by replacing only `store.ts`.
 */

export interface EditableProfile {
  /** Normalized email of the account this profile belongs to. */
  owner: string;
  /** Given name (first word of the display name). */
  firstName: string;
  /** Family name (the rest of the display name); may be empty. */
  lastName: string;
  /** Public handle, without the leading `@`. */
  username: string;
  /** Optional personal site / portfolio URL. */
  website: string;
  /** Short self-introduction, capped at `BIO_MAX_LENGTH`. */
  bio: string;
  /**
   * Optional avatar image as a data-URL. Kept small (~256px) so it fits inside
   * the cookie budget; an empty string means "fall back to initials".
   */
  avatarUrl: string;
  /**
   * Optional cover image as a data-URL. Empty string means "use the default
   * cover shipped in `public/profil/`".
   */
  coverUrl: string;
  /** ISO timestamp of the last save. */
  updatedAt: string;
  /** Schema version so future migrations can detect old payloads. */
  version: number;
}

export const PROFILE_VERSION = 1;
export const BIO_MAX_LENGTH = 180;

/** Payload accepted by `saveEditableProfile`; `owner` is added by the store. */
export type EditableProfileInput = Omit<
  EditableProfile,
  "owner" | "updatedAt" | "version"
>;

/**
 * Split a display name into first/last parts on the first whitespace run.
 * `"Raka Pratama"` → `{ firstName: "Raka", lastName: "Pratama" }`.
 */
export function splitName(nama: string): { firstName: string; lastName: string } {
  const trimmed = nama.trim().replace(/\s+/g, " ");
  if (!trimmed) return { firstName: "", lastName: "" };
  const [firstName, ...rest] = trimmed.split(" ");
  return { firstName, lastName: rest.join(" ") };
}

/** Join first/last back into a single display name (blank-safe). */
export function joinName(firstName: string, lastName: string): string {
  return [firstName, lastName].map((part) => part.trim()).filter(Boolean).join(" ");
}

export function isEditableProfile(value: unknown): value is EditableProfile {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.owner === "string" &&
    typeof candidate.firstName === "string" &&
    typeof candidate.lastName === "string" &&
    typeof candidate.username === "string" &&
    typeof candidate.website === "string" &&
    typeof candidate.bio === "string" &&
    typeof candidate.avatarUrl === "string" &&
    typeof candidate.coverUrl === "string" &&
    typeof candidate.updatedAt === "string" &&
    typeof candidate.version === "number"
  );
}
