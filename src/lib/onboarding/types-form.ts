/**
 * Form state for the onboarding server action.
 * Mirrors `AuthFormState` (`src/lib/auth/types.ts`) so the two flows behave the
 * same under `useActionState`.
 */
export interface OnboardingFormState {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
}
