import type { Role } from "./types";
import { isStaffRole } from "./roles";
import { hasProfile } from "@/lib/onboarding/store";

/**
 * Server-only landing decision for post-auth navigation.
 *
 * Lives apart from `roles.ts` because it (transitively) imports `next/headers`
 * via the profile store. `roles.ts` is imported by client components, so mixing
 * the two would drag server-only APIs into the client bundle.
 *
 * Staff skip onboarding (it personalizes learner recommendations). Learners
 * without a stored profile for *this account* are funneled through
 * `/onboarding`; the onboarding page bounces already-onboarded users home,
 * making this idempotent.
 */
export async function landingFor(role: Role, userId: string, email?: string): Promise<string> {
  if (isStaffRole(role)) return "/review";
  return (await hasProfile(userId, email)) ? "/dashboard" : "/onboarding";
}
