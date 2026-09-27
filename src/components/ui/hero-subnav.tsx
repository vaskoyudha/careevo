"use client";

import Link from "next/link";
import type { RefObject, ReactNode } from "react";
import { ScrollSubNav } from "@/components/ui/scroll-subnav";

/**
 * Sub-header for a page whose top is a hero.
 *
 * The same `ScrollSubNav` mechanism as `/careevo-plus` and `/belajar/[slug]`,
 * composed for the Explore catalog pages: a badge, the page's own title, and
 * the one action the hero was asking for — so scrolling a long course grid
 * does not strand both.
 *
 * The silhouette deliberately matches `KursusSubNav` (badge, two-line title
 * block, right-hand CTA) so the three read as one bar family rather than three
 * unrelated strips.
 */
export function HeroSubNav({
  trigger,
  badge,
  title,
  subtitle,
  cta,
  children,
}: {
  /** The hero element, owned by the page. */
  trigger: RefObject<HTMLElement | null>;
  /** Short label above the title — a section or product type. */
  badge?: string;
  title: string;
  /** Second line. Falls back to nothing, which collapses the block to one line. */
  subtitle?: string;
  cta: { href: string; label: string };
  /** Overrides the default CTA button (e.g. a server action). */
  children?: ReactNode;
}) {
  return (
    <ScrollSubNav trigger={trigger}>
      <div className="flex min-w-0 items-center gap-2.5">
        {badge ? (
          <span className="shrink-0 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold tracking-wide text-[#0056D2] uppercase">
            {badge}
          </span>
        ) : null}
        {/* Two lines, not one: these titles are catalog data and a single
            truncated line can reduce to an unidentifiable stub. */}
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-sm font-semibold text-gray-900">{title}</span>
          {subtitle ? (
            <span className="block truncate text-xs text-gray-500">{subtitle}</span>
          ) : null}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {children ?? (
          <Link
            href={cta.href}
            className="inline-flex h-9 items-center justify-center rounded-lg bg-[#0056D2] px-4 text-sm font-semibold text-white transition-colors duration-200 hover:bg-[#00419e]"
          >
            {cta.label}
          </Link>
        )}
      </div>
    </ScrollSubNav>
  );
}
