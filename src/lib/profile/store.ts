import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { normalizeOwner } from "@/lib/auth/types";
import { bacaSecret } from "@/lib/config/secrets";
import {
  isEditableProfile,
  PROFILE_VERSION,
  type EditableProfile,
  type EditableProfileInput,
} from "./types";

/**
 * Editable public-profile persistence.
 *
 * Same pattern as `src/lib/onboarding/store.ts` and `src/lib/auth/user-store.ts`:
 * the record is serialized to JSON, HMAC-SHA256 signed, and stored in an
 * httpOnly cookie. Keeps the prototype dependency-free while remaining
 * tamper-evident, and is owner-scoped so profiles never leak across accounts.
 *
 * Swapping for a real database means replacing only these functions
 * (`getEditableProfile` / `saveEditableProfile` / `clearEditableProfile`).
 */
export const PUBLIC_PROFILE_COOKIE = "ls_public_profile";
const PROFILE_MAX_AGE = 60 * 60 * 24 * 180; // ~6 months

function sign(body: string): string {
  return createHmac("sha256", bacaSecret("SESSION_SECRET"))
    .update(body)
    .digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function encode(profile: EditableProfile): string {
  const body = Buffer.from(JSON.stringify(profile), "utf8").toString("base64url");
  return `${body}.${sign(body)}`;
}

function decode(raw: string | undefined): EditableProfile | null {
  if (!raw) return null;
  const [body, signature] = raw.split(".");
  if (!body || !signature) return null;
  if (!safeEqual(signature, sign(body))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as unknown;
    return isEditableProfile(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export { normalizeOwner };

/**
 * Read the signed profile cookie, or null when absent/invalid.
 *
 * Pass `owner` to additionally require that the record belongs to that account.
 */
export async function getEditableProfile(owner?: string): Promise<EditableProfile | null> {
  const jar = await cookies();
  const profile = decode(jar.get(PUBLIC_PROFILE_COOKIE)?.value);
  if (!profile) return null;
  if (owner !== undefined && profile.owner !== normalizeOwner(owner)) return null;
  return profile;
}

/** Persist the editable profile, stamping owner + version + update time. */
export async function saveEditableProfile(
  input: EditableProfileInput,
  owner: string,
): Promise<EditableProfile> {
  const jar = await cookies();
  const profile: EditableProfile = {
    owner: normalizeOwner(owner),
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    username: input.username.trim().replace(/^@/, ""),
    website: input.website.trim(),
    bio: input.bio.trim(),
    avatarUrl: input.avatarUrl,
    coverUrl: input.coverUrl,
    updatedAt: new Date().toISOString(),
    version: PROFILE_VERSION,
  };

  jar.set(PUBLIC_PROFILE_COOKIE, encode(profile), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PROFILE_MAX_AGE,
  });

  return profile;
}

/** Remove the editable profile — used by the "reset" control. */
export async function clearEditableProfile(): Promise<void> {
  const jar = await cookies();
  jar.set(PUBLIC_PROFILE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
