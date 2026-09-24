"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Camera, AtSign, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * OnboardingCard — onboarding card matching the reference layout: an
 * edge-to-edge hero image, a centered title/subtitle, a photo-upload row, an
 * `@` display-name field and a full-width Continue button.
 *
 * Palette mirrors the login/register page and landing header: white surface,
 * hairline `black/10` borders, black text with `black/40`–`/50` muted copy, and
 * a solid black primary button. Nothing here leans on the shadcn default
 * blue/teal chrome, so it reads as one product with the auth screens.
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
            "w-full max-w-md overflow-hidden rounded-[12px] border border-black/10 bg-white text-black shadow-sm",
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
              <h1 className="text-2xl font-semibold tracking-tight text-black">{title}</h1>
              <p className="text-sm text-black/50">{subtitle}</p>
            </motion.div>

            {/* Photo Upload Section */}
            <motion.div
              variants={itemVariants}
              className="flex items-center justify-between gap-4 rounded-[10px] border border-black/10 bg-black/[0.02] p-3.5"
            >
              <div className="flex min-w-0 items-center gap-3.5">
                <div className="grid size-11 shrink-0 place-items-center rounded-full border border-black/10 bg-white text-black/40">
                  <UserRound className="size-5" strokeWidth={1.75} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-black">Your Photo</p>
                  <p className="truncate text-xs text-black/45">PNG or JPEG, up to 5MB</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onUploadClick}
                className="flex h-9 shrink-0 items-center gap-2 rounded-[8px] border border-black/15 bg-white px-3 text-sm font-medium text-black transition-colors hover:bg-black/[0.03]"
              >
                <Camera className="size-4" />
                Upload
              </button>
            </motion.div>

            {/* Display Name Input */}
            <motion.div variants={itemVariants} className="flex flex-col gap-2">
              <label htmlFor="displayName" className="text-sm font-medium text-black">
                Display Name
              </label>
              <div className="relative flex h-11 items-center rounded-[8px] border border-black/20 bg-white px-3 focus-within:border-black/50">
                <AtSign className="pointer-events-none size-4 shrink-0 text-black/35" />
                <input
                  id="displayName"
                  type="text"
                  placeholder="username"
                  value={displayName}
                  onChange={onDisplayNameChange}
                  className="min-w-0 flex-1 bg-transparent px-2 text-base text-black outline-none placeholder:text-black/35"
                />
              </div>
            </motion.div>

            {/* Continue Button */}
            <motion.div variants={itemVariants}>
              <button
                type="button"
                onClick={onContinueClick}
                disabled={isLoading}
                className="flex h-12 w-full items-center justify-center rounded-[10px] border border-black/40 bg-black text-base font-medium text-white transition-colors hover:bg-black/85 disabled:opacity-60"
              >
                {isLoading ? "Saving..." : "Continue"}
              </button>
            </motion.div>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  },
);

OnboardingCard.displayName = "OnboardingCard";
