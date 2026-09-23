"use client";

import { useTransition } from "react";
import { RotateCcw } from "lucide-react";
import { resetOnboardingAction } from "@/actions/onboarding";
import { Button } from "@/components/ui/button";

/** Client island: clears the stored onboarding profile and re-enters the flow. */
export function ResetOnboardingButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="glass"
      size="pill-sm"
      disabled={isPending}
      onClick={() => startTransition(() => void resetOnboardingAction())}
    >
      <RotateCcw className="size-3.5" />
      {isPending ? "Mengulang..." : "Ulangi onboarding"}
    </Button>
  );
}
