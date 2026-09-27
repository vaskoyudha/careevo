import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { normalizeOwner } from "@/lib/auth/types";
import { bacaSecret } from "@/lib/config/secrets";
import { denganTransaksi, getDb } from "@/lib/db/client";
import {
  cariProfilOnboarding,
  hapusProfilOnboarding,
  simpanProfilOnboarding,
} from "./profile-repository";
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
 * Profiles are keyed by the authenticated account's stable database user id.
 * The signed cookie remains only as a one-time migration source for accounts
 * that completed onboarding before profiles were stored in PostgreSQL.
 */
export const PROFILE_COOKIE = "ls_profile";

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
 * Read by account id; migrate a matching legacy cookie once when no database
 * profile exists. Email is used only to verify legacy cookie ownership.
 */
export async function getProfile(userId: string, email?: string): Promise<OnboardingProfile | null> {
  const db = getDb();
  const row = await cariProfilOnboarding(db, userId);
  if (row) {
    const profile: OnboardingProfile = {
      owner: normalizeOwner(email ?? userId),
      experience: row.experience as OnboardingProfile["experience"],
      background: row.background as OnboardingProfile["background"],
      interests: row.interests as OnboardingProfile["interests"],
      goal: row.goal,
      weeklyHours: row.weeklyHours,
      workPreference: row.workPreference as OnboardingProfile["workPreference"],
      completedAt: row.completedAt.toISOString(),
      version: row.version,
    };
    return isOnboardingProfile(profile) ? profile : null;
  }

  if (!email) return null;
  const jar = await cookies();
  const legacy = decode(jar.get(PROFILE_COOKIE)?.value);
  if (!legacy || legacy.owner !== normalizeOwner(email)) return null;

  const completedAt = new Date(legacy.completedAt);
  const imported = await denganTransaksi(async (tx) => {
    const existing = await cariProfilOnboarding(tx, userId);
    if (existing) return false;
    await simpanProfilOnboarding(tx, userId, {
      experience: legacy.experience,
      background: legacy.background,
      interests: legacy.interests,
      goal: legacy.goal,
      weeklyHours: legacy.weeklyHours,
      workPreference: legacy.workPreference,
      completedAt,
      version: legacy.version,
    });
    return true;
  });
  jar.set(PROFILE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return imported ? legacy : getProfile(userId, email);
}

/** True when this account has a completed profile in PostgreSQL. */
export async function hasProfile(userId: string, email?: string): Promise<boolean> {
  return (await getProfile(userId, email)) !== null;
}

/** Persist a completed profile, stamping owner + version + completion time. */
export async function saveProfile(
  input: CompleteOnboardingInput,
  userId: string,
  email?: string,
): Promise<OnboardingProfile> {
  const profile: OnboardingProfile = {
    owner: normalizeOwner(email ?? userId),
    experience: input.experience,
    background: input.background,
    interests: input.interests.slice(0, MAX_INTERESTS),
    goal: input.goal,
    weeklyHours: input.weeklyHours,
    workPreference: input.workPreference,
    completedAt: new Date().toISOString(),
    version: ONBOARDING_VERSION,
  };

  await simpanProfilOnboarding(getDb(), userId, {
    experience: profile.experience,
    background: profile.background,
    interests: profile.interests,
    goal: profile.goal,
    weeklyHours: profile.weeklyHours,
    workPreference: profile.workPreference,
    completedAt: new Date(profile.completedAt),
    version: profile.version,
  });

  return profile;
}

/** Remove the profile — used by "reset onboarding" in settings. */
export async function clearProfile(userId: string): Promise<void> {
  await hapusProfilOnboarding(getDb(), userId);
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
