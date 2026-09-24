"use client";

import { useTransition } from "react";
import { RotateCcw } from "lucide-react";
import { resetOnboardingAction } from "@/actions/onboarding";
import { Button } from "@/components/ui/button";

/**
 * Client island: clears the stored onboarding profile and re-enters the flow.
 *
 * `landing` switches to the landing-page secondary button style so the control
 * fits in-app surfaces like /profil; the default keeps the legacy pill look
 * used elsewhere (e.g. /pengaturan).
 */
export function ResetOnboardingButton({
  className,
  variant = "pill",
}: {
  className?: string;
  variant?: "pill" | "landing";
}) {
  const [isPending, startTransition] = useTransition();

  const label = isPending ? "Mengulang..." : "Ulangi onboarding";

  if (variant === "landing") {
    return (
      <button
        type="button"
        disabled={isPending}
        className={
          "inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-base font-medium text-gray-800 transition duration-300 ease-in-out hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 " +
          (className ?? "")
        }
        onClick={() => startTransition(() => void resetOnboardingAction())}
      >
        <RotateCcw className="size-4" strokeWidth={1.75} aria-hidden="true" />
        {label}
      </button>
    );
  }

  return (
    <Button
      type="button"
      variant="glass"
      size="pill-sm"
      disabled={isPending}
      className={className}
      onClick={() => startTransition(() => void resetOnboardingAction())}
    >
      <RotateCcw className="size-3.5" />
      {label}
    </Button>
  );
}
