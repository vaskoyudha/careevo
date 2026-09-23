"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * OnboardingCard — the visual shell for a single onboarding step.
 *
 * Adapted from the shadcn "onboarding" reference component, with three
 * deliberate changes:
 *   1. Light mode only — uses Careevo's shadcn theme tokens (`bg-card`,
 *      `text-foreground`, `text-muted-foreground`) so it inherits the oceanic
 *      light palette instead of hard-coded dark greys.
 *   2. No photo upload — this flow personalizes *interests and background*,
 *      not identity.
 *   3. The hero image is optional and replaced by an icon-led header, so the
 *      card works without a stock asset while still supporting one.
 *
 * Animation mirrors the reference: the parent orchestrates staggered children.
 */

export interface OnboardingCardProps {
  /** Optional hero image. Omitted in the default Careevo flow. */
  heroImageSrc?: string;
  icon?: React.ReactNode;
  title: string;
  subtitle: string;
  /** Current step (1-based) for the progress indicator. */
  step?: number;
  totalSteps?: number;
  children: React.ReactNode;
  /** Footer actions (Back/Continue). */
  footer?: React.ReactNode;
  className?: string;
}

const containerVariants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { staggerChildren: 0.12 },
  },
  exit: { opacity: 0 },
};

const itemVariants = {
  initial: { opacity: 0, y: 16 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: "easeOut" as const },
  },
  exit: { opacity: 0, y: 16 },
};

export const OnboardingCard = React.forwardRef<HTMLDivElement, OnboardingCardProps>(
  (
    {
      heroImageSrc,
      icon,
      title,
      subtitle,
      step,
      totalSteps,
      children,
      footer,
      className,
    },
    ref,
  ) => {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          ref={ref}
          className={cn(
            "w-full max-w-xl overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-lg",
            className,
          )}
          variants={containerVariants}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          {heroImageSrc ? (
            <motion.img
              src={heroImageSrc}
              alt=""
              className="h-40 w-full object-cover"
              variants={itemVariants}
            />
          ) : null}

          <div className="flex flex-col gap-6 p-6 sm:p-8">
            <motion.div variants={itemVariants} className="flex flex-col items-start gap-3">
              {typeof step === "number" && typeof totalSteps === "number" ? (
                <div className="flex w-full items-center gap-2" aria-hidden="true">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{ width: `${(step / totalSteps) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground tabular-nums">
                    {step}/{totalSteps}
                  </span>
                </div>
              ) : null}

              {icon ? (
                <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
                  {icon}
                </span>
              ) : null}

              <div className="space-y-1.5">
                <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
                <p className="text-muted-foreground">{subtitle}</p>
              </div>
            </motion.div>

            <motion.div variants={itemVariants} className="flex flex-col gap-4">
              {children}
            </motion.div>

            {footer ? (
              <motion.div variants={itemVariants} className="flex items-center gap-3">
                {footer}
              </motion.div>
            ) : null}
          </div>
        </motion.div>
      </AnimatePresence>
    );
  },
);

OnboardingCard.displayName = "OnboardingCard";
