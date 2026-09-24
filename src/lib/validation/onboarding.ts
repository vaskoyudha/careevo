import { z } from "zod";
import {
  BACKGROUNDS,
  EXPERIENCE_LEVELS,
  GOALS,
  INTERESTS,
  MAX_INTERESTS,
  MIN_INTERESTS,
  WEEKLY_HOURS_OPTIONS,
  WORK_PREFERENCES,
} from "@/lib/onboarding/types";

/**
 * Server-side validation for onboarding submissions.
 *
 * `interests` arrives as a repeated form field, so it is coerced from
 * `string | string[]`, deduped, and bounded — a malicious client cannot smuggle
 * in unknown values or more than MAX_INTERESTS picks. Mirrors the strictness of
 * `src/lib/validation/auth.ts`.
 */
export const onboardingSchema = z.object({
  experience: z.enum(EXPERIENCE_LEVELS, { message: "Pilih level pengalaman" }),
  background: z.enum(BACKGROUNDS, { message: "Pilih latar belakang" }),
  interests: z
    .union([z.string(), z.array(z.string())])
    .transform((value) => {
      const list = Array.isArray(value) ? value : [value];
      const unique = Array.from(new Set(list.filter(Boolean)));
      return unique;
    })
    .pipe(
      z
        .array(z.enum(INTERESTS, { message: "Minat tidak dikenali" }))
        .min(MIN_INTERESTS, `Pilih minimal ${MIN_INTERESTS} minat`)
        .max(MAX_INTERESTS, `Maksimal ${MAX_INTERESTS} minat`),
    ),
  goal: z.enum(GOALS, { message: "Pilih tujuan belajar" }),
  weeklyHours: z.coerce
    .number()
    .refine(
      (value) => (WEEKLY_HOURS_OPTIONS as readonly number[]).includes(value),
      "Pilih target jam per minggu",
    ),
  workPreference: z.enum(WORK_PREFERENCES, { message: "Pilih preferensi kerja" }),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
