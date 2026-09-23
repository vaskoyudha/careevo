"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Camera, AtSign, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

// Import shadcn/ui components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * OnboardingCard — onboarding card matching the reference layout: an
 * edge-to-edge hero image, a centered title/subtitle, a photo-upload row, an
 * `@` display-name field and a full-width Continue button.
 *
 * Theme: light mode, using Careevo's theme tokens (`bg-card`, `bg-muted`,
 * `border-input`, `text-muted-foreground`, `primary`) rather than the
 * reference's dark palette. Typography, borders and spacing deliberately
 * follow the same restrained scale as the login/register page so the two read
 * as one product, not a bolted-on generic component.
 *
 * The prop API matches the reference exactly, so this file is a drop-in.
 */

export interface OnboardingCardProps {
  heroImageSrc: string;
  title: string;
  subtitle: string;
  displayName: string;
  onDisplayNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onUploadClick: () => void;
  onContinueClick: () => void;
  isLoading?: boolean;
  className?: string;
}

export const OnboardingCard = React.forwardRef<HTMLDivElement, OnboardingCardProps>(
  (
    {
      heroImageSrc,
      title,
      subtitle,
      displayName,
      onDisplayNameChange,
      onUploadClick,
      onContinueClick,
      isLoading = false,
      className,
    },
    ref,
  ) => {
    // Variants for the parent container to orchestrate animations
    const containerVariants = {
      initial: { opacity: 0 },
      animate: {
        opacity: 1,
        transition: {
          staggerChildren: 0.15, // Stagger the animation of children
        },
      },
      exit: { opacity: 0 },
    };

    // Variants for individual child items to fade in
    const itemVariants = {
      initial: { opacity: 0, y: 20 },
      animate: {
        opacity: 1,
        y: 0,
        transition: {
          duration: 0.5,
          ease: "easeOut" as const,
        },
      },
      exit: { opacity: 0, y: 20 },
    };

    return (
      <AnimatePresence>
        <motion.div
          ref={ref}
          className={cn(
            "w-full max-w-md overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm",
            className,
          )}
          variants={containerVariants}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          {/* Hero Image Section */}
          <motion.img
            src={heroImageSrc}
            alt="Welcome Hero Image"
            className="h-48 w-full object-cover"
            variants={itemVariants}
          />

          <div className="flex flex-col space-y-6 p-6 sm:p-8">
            {/* Header Text */}
            <motion.div variants={itemVariants} className="space-y-1.5 text-center">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            </motion.div>

            {/* Photo Upload Section */}
            <motion.div
              variants={itemVariants}
              className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/40 p-3.5"
            >
              <div className="flex min-w-0 items-center gap-3.5">
                <div className="grid size-11 shrink-0 place-items-center rounded-full border border-border bg-card text-muted-foreground">
                  <UserRound className="size-5" strokeWidth={1.75} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">Your Photo</p>
                  <p className="truncate text-xs text-muted-foreground">PNG or JPEG, up to 5MB</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={onUploadClick} className="shrink-0">
                <Camera className="mr-2 size-4" />
                Upload
              </Button>
            </motion.div>

            {/* Display Name Input */}
            <motion.div variants={itemVariants} className="flex flex-col gap-2">
              <label htmlFor="displayName" className="text-sm font-medium text-foreground">
                Display Name
              </label>
              <div className="relative">
                <AtSign className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="displayName"
                  type="text"
                  placeholder="username"
                  value={displayName}
                  onChange={onDisplayNameChange}
                  className="pl-9"
                />
              </div>
            </motion.div>

            {/* Continue Button */}
            <motion.div variants={itemVariants}>
              <Button
                className="w-full"
                size="lg"
                onClick={onContinueClick}
                disabled={isLoading}
              >
                {isLoading ? "Saving..." : "Continue"}
              </Button>
            </motion.div>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  },
);

OnboardingCard.displayName = "OnboardingCard";
