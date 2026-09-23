"use server";

import { redirect } from "next/navigation";
import type { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { homeForRole } from "@/lib/auth/roles";
import { saveProfile } from "@/lib/onboarding/store";
import { onboardingSchema } from "@/lib/validation/onboarding";
import type { OnboardingFormState } from "@/lib/onboarding/types-form";

function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !result[key]) {
      result[key] = issue.message;
    }
  }
  return result;
}

/**
 * Persist the onboarding profile and hand the learner to their home page.
 *
 * Requires an authenticated session — onboarding personalizes *an account*, so
 * an anonymous submission is rejected rather than silently dropped.
 */
export async function completeOnboardingAction(
  _prev: OnboardingFormState,
  formData: FormData,
): Promise<OnboardingFormState> {
  const session = await getSession();
  if (!session) {
    return { ok: false, message: "Sesi kamu sudah berakhir. Silakan masuk lagi." };
  }

  const raw = {
    experience: String(formData.get("experience") ?? ""),
    background: String(formData.get("background") ?? ""),
    interests: formData.getAll("interests").map(String),
    goal: String(formData.get("goal") ?? ""),
    weeklyHours: String(formData.get("weeklyHours") ?? ""),
    workPreference: String(formData.get("workPreference") ?? ""),
  };

  const parsed = onboardingSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      errors: fieldErrors(parsed.error),
      message: "Ada langkah yang belum lengkap. Periksa kembali jawabanmu.",
    };
  }

  await saveProfile(parsed.data);
  redirect(homeForRole(session.role));
}

/**
 * Clear the stored profile so the learner can redo onboarding.
 * Used by the "Ulangi onboarding" control in settings.
 */
export async function resetOnboardingAction(): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/masuk");
  const { clearProfile } = await import("@/lib/onboarding/store");
  await clearProfile();
  redirect("/onboarding");
}
