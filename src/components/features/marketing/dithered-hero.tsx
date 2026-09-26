import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { DitheredHeroBackdrop } from "@/components/features/learning/dithered-hero-backdrop";

/**
 * Shared marketing hero shell that mirrors the `/belajar` hero pattern:
 * full-bleed light ground, the dithered WebGL backdrop, and only the subtle
 * bottom boundary fade allowed by DESIGN.md. Pages keep their own content
 * layout inside `contentClassName`.
 */
const DEFAULT_CONTENT =
  "relative mx-auto flex w-full max-w-6xl flex-col items-center justify-center px-4 text-center sm:px-6 lg:px-8";

export function DitheredHero({
  children,
  className,
  contentClassName,
}: {
  children: ReactNode;
  /** Extra classes for the outer <section> (padding, min-height, etc.). */
  className?: string;
  /** Full class list for the relative content wrapper. Replaces the default. */
  contentClassName?: string;
}) {
  return (
    <section
      className={cn("relative isolate overflow-hidden bg-[#f7fbfc]", className)}
    >
      <DitheredHeroBackdrop
        videoSrc="/videos/hero-sterly.mp4"
        levels={4}
        ditherScale={2}
        zoom={1}
        focusY={0.5}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#f7fbfc] via-[#f7fbfc]/55 to-transparent"
      />
      <div className={contentClassName ?? DEFAULT_CONTENT}>{children}</div>
    </section>
  );
}
