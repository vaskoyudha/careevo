"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AuthBrandPanel } from "@/components/ui/auth-brand-panel";

/**
 * OnboardingShell — the onboarding screen laid out exactly like the login /
 * register pages: the shared black brand panel on the left, and a centered
 * content column on the right.
 *
 * The right column is where onboarding differs: instead of a single static
 * heading it renders a step head (eyebrow "Langkah n dari m", title, subtitle)
 * that animates on every step change, with the step body below. Animations are
 * intentionally light — a fade/slide of the head, a subtle stagger — so the
 * flow feels alive without being noisy.
 */
export function OnboardingShell({
  step,
  totalSteps,
  title,
  subtitle,
  children,
  footer,
}: {
  step: number;
  totalSteps: number;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="min-h-screen bg-white p-3 text-black antialiased [font-synthesis:none]">
      <div className="grid min-h-[calc(100vh-1.5rem)] gap-6 lg:grid-cols-[0.94fr_1.06fr]">
        <AuthBrandPanel className="order-2 min-h-[760px] lg:order-1 lg:min-h-0 lg:py-20 xl:py-24" />

        <div className="order-1 flex min-h-[760px] items-center justify-center px-6 py-12 sm:px-10 lg:order-2 lg:min-h-0 lg:px-14 xl:px-20">
          <div className="mx-auto w-full max-w-[500px]">
            {/* Progress */}
            <div className="flex items-center gap-3" aria-hidden="true">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-black/10">
                <motion.div
                  className="h-full rounded-full bg-black"
                  initial={false}
                  animate={{ width: `${(step / totalSteps) * 100}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>
              <span className="text-xs font-medium text-black/40 tabular-nums">
                {step}/{totalSteps}
              </span>
            </div>

            {/* Animated step head */}
            <AnimatePresence mode="wait">
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.32, ease: "easeOut" }}
                className="mt-7 text-center"
              >
                <p className="m-0 text-xs font-medium tracking-[0.14em] text-black/40 uppercase">
                  Langkah {step} dari {totalSteps}
                </p>
                <h1 className="mt-2 text-3xl font-medium tracking-[-0.04em] text-black sm:text-4xl lg:text-[42px] lg:leading-[1.05]">
                  {title}
                </h1>
                <p className="mx-auto mt-3 max-w-[440px] text-sm leading-6 text-black/50">
                  {subtitle}
                </p>
              </motion.div>
            </AnimatePresence>

            <div className="mt-7">{children}</div>

            {footer ? <div className="mt-7">{footer}</div> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
