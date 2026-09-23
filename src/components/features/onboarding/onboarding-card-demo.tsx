"use client";

import * as React from "react";
import { GraduationCap } from "lucide-react";
import { OnboardingCard } from "@/components/ui/onboarding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Standalone demo of the OnboardingCard shell in light mode.
 * Rendered at /onboarding/demo — no server action, no persistence.
 */
export default function OnboardingCardDemo() {
  const [displayName, setDisplayName] = React.useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDisplayName(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""));
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background p-4">
      <OnboardingCard
        icon={<GraduationCap className="size-5" />}
        title="Kenalan dulu, yuk"
        subtitle="Ceritakan minatmu supaya Careevo bisa menyusun rekomendasi."
        step={1}
        totalSteps={3}
        footer={
          <Button className="w-full" size="lg">
            Lanjut
          </Button>
        }
      >
        <label htmlFor="displayName" className="text-sm font-medium">
          Nama tampilan
        </label>
        <Input
          id="displayName"
          placeholder="username"
          value={displayName}
          onChange={handleChange}
        />
      </OnboardingCard>
    </div>
  );
}
