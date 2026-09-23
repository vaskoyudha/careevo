import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
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
 * Swapping this for a real database means replacing only these four functions
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

/** Read the signed profile cookie, or null when absent/invalid. */
export async function getProfile(): Promise<OnboardingProfile | null> {
  const jar = await cookies();
  return decode(jar.get(PROFILE_COOKIE)?.value);
}

/** True when the learner has finished onboarding. */
export async function hasProfile(): Promise<boolean> {
  return (await getProfile()) !== null;
}

/** Persist a completed profile, stamping version + completion time. */
export async function saveProfile(
  input: CompleteOnboardingInput,
): Promise<OnboardingProfile> {
  const jar = await cookies();
  const profile: OnboardingProfile = {
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
