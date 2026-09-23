"use client";

import * as React from "react";
import { OnboardingCard } from "@/components/ui/onboarding";

/**
 * A demo component to showcase the OnboardingCard (light mode).
 * Rendered at /onboarding/demo — no server action, no persistence.
 */
export default function OnboardingCardDemo() {
  const [displayName, setDisplayName] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);

  // Handler for the display name input change
  const handleDisplayNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Basic validation: allow only alphanumeric characters and underscores
    const validUsername = e.target.value.replace(/[^a-zA-Z0-9_]/g, "");
    setDisplayName(validUsername);
  };

  // Placeholder function for upload button click
  const handleUploadClick = () => {
    alert("Upload button clicked!");
  };

  // Placeholder function for continue button click
  const handleContinueClick = () => {
    if (!displayName) {
      alert("Please enter a display name.");
      return;
    }
    setIsLoading(true);
    // Simulate an API call
    setTimeout(() => {
      setIsLoading(false);
      alert(`Welcome, ${displayName}!`);
    }, 2000);
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-white p-4">
      <OnboardingCard
        heroImageSrc="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1000&q=70"
        title="Selamat datang di Careevo"
        subtitle="Ini perjalanan pertamamu di sini."
        displayName={displayName}
        onDisplayNameChange={handleDisplayNameChange}
        onUploadClick={handleUploadClick}
        onContinueClick={handleContinueClick}
        isLoading={isLoading}
      />
    </div>
  );
}
