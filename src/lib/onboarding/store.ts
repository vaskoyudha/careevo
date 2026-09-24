import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { normalizeOwner } from "@/lib/auth/types";
import {
  INTERESTS,
  MAX_INTERESTS,
  MIN_INTERESTS,
  ONBOARDING_VERSION,
  WEEKLY_HOURS_OPTIONS,
  isBackground,
  isExperienceLevel,
  isGoal,
  isInterest,
  isWorkPreference,
  type OnboardingProfile,
} from "./types";

/**
 * Onboarding profile persistence.
 *
 * Mirrors `src/lib/auth/user-store.ts`: the profile is serialized to JSON,
 * HMAC-SHA256 signed, and stored in an httpOnly cookie. This keeps the
 * prototype dependency-free (no DB) while still giving the flow a real,
 * tamper-evident store.
 *
 * Because the cookie is per-browser, every profile carries an `owner` (the
 * account email) so a new account on the same browser does not inherit — or
 * get skipped past — another account's onboarding.
 *
 * Swapping this for a real database means replacing only these functions
 * (`getProfile` / `saveProfile` / `clearProfile` / `hasProfile`) — nothing in
 * the UI or recommendation engine touches the cookie directly.
 */
export const PROFILE_COOKIE = "ls_profile";
const PROFILE_SECRET = process.env.SESSION_SECRET ?? "dev-session-secret-careevo";
const PROFILE_MAX_AGE = 60 * 60 * 24 * 180; // ~6 months

function sign(body: string): string {
  return createHmac("sha256", PROFILE_SECRET).update(body).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Validate an untrusted value into a well-formed OnboardingProfile. */
export function isOnboardingProfile(value: unknown): value is OnboardingProfile {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.owner === "string" &&
    c.owner.length > 0 &&
    isExperienceLevel(c.experience) &&
    isBackground(c.background) &&
    Array.isArray(c.interests) &&
    c.interests.length >= MIN_INTERESTS &&
    c.interests.length <= MAX_INTERESTS &&
    c.interests.every(isInterest) &&
    isGoal(c.goal) &&
    typeof c.weeklyHours === "number" &&
    (WEEKLY_HOURS_OPTIONS as readonly number[]).includes(c.weeklyHours) &&
    isWorkPreference(c.workPreference) &&
    typeof c.completedAt === "string" &&
    typeof c.version === "number"
  );
}

function decode(raw: string | undefined): OnboardingProfile | null {
  if (!raw) return null;
  const [body, signature] = raw.split(".");
  if (!body || !signature) return null;
  if (!safeEqual(signature, sign(body))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as unknown;
    return isOnboardingProfile(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function encode(profile: OnboardingProfile): string {
  const body = Buffer.from(JSON.stringify(profile), "utf8").toString("base64url");
  return `${body}.${sign(body)}`;
}

export interface CompleteOnboardingInput {
  experience: OnboardingProfile["experience"];
  background: OnboardingProfile["background"];
  interests: OnboardingProfile["interests"];
  goal: string;
  weeklyHours: number;
  workPreference: OnboardingProfile["workPreference"];
}

export { normalizeOwner };

/**
 * Read the signed profile cookie, or null when absent/invalid.
 *
 * Pass `owner` to additionally require that the profile belongs to that
 * account. Omitted, the raw stored profile is returned (used by the store's
 * own tests and the settings editor, which then checks ownership itself).
 */
export async function getProfile(owner?: string): Promise<OnboardingProfile | null> {
  const jar = await cookies();
  const profile = decode(jar.get(PROFILE_COOKIE)?.value);
  if (!profile) return null;
  if (owner !== undefined && profile.owner !== normalizeOwner(owner)) return null;
  return profile;
}

/** True when *this account* has finished onboarding on this browser. */
export async function hasProfile(owner: string): Promise<boolean> {
  return (await getProfile(owner)) !== null;
}

/** Persist a completed profile, stamping owner + version + completion time. */
export async function saveProfile(
  input: CompleteOnboardingInput,
  owner: string,
): Promise<OnboardingProfile> {
  const jar = await cookies();
  const profile: OnboardingProfile = {
    owner: normalizeOwner(owner),
    experience: input.experience,
    background: input.background,
    interests: input.interests.slice(0, MAX_INTERESTS),
    goal: input.goal,
    weeklyHours: input.weeklyHours,
    workPreference: input.workPreference,
    completedAt: new Date().toISOString(),
    version: ONBOARDING_VERSION,
  };

  jar.set(PROFILE_COOKIE, encode(profile), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PROFILE_MAX_AGE,
  });

  return profile;
}

/** Remove the profile — used by "reset onboarding" in settings. */
export async function clearProfile(): Promise<void> {
  const jar = await cookies();
  jar.set(PROFILE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export { INTERESTS };
