/**
 * Resolving a catalog entry to a brand mark.
 *
 * Everything here is a pure lookup over the generated table, so the MCP store
 * page stays free of icon logic and this stays testable.
 */

import {
  BRAND_ICONS,
  MCP_ICON_SLUGS,
  type BrandIcon,
} from "@/lib/brand-icons.generated";

/**
 * The mark for an MCP server *id*, or `null` when there is none.
 *
 * `null` is the common case and not a failure: coverage is partial on purpose
 * (see `brand-slugs.ts`), and a monogram is the designed fallback rather than a
 * degraded one.
 */
export function brandIconFor(id: string): BrandIcon | null {
  for (const key of candidateKeys(id)) {
    const slug = MCP_ICON_SLUGS[key];
    if (slug) return BRAND_ICONS[slug] ?? null;
  }
  return null;
}

/**
 * The keys to try for *id*, exact form first.
 *
 * Exact-first matters: several catalog ids contain dashes. The looser forms
 * exist only for a *renamed* install — the MCP store lets the installer choose
 * a local name, and the common edits are case and separator changes.
 */
function candidateKeys(id: string): string[] {
  const raw = String(id ?? "").trim();
  if (!raw) return [];
  const lowered = raw.toLowerCase();
  const dashed = lowered.replace(/[\s_.]+/g, "-");
  return [...new Set([raw, lowered, dashed])];
}

/**
 * Up to two initials for the monogram fallback.
 *
 * Word-aware: "Google Maps" → "GM", "firecrawl" → "FI". Falls back to the first
 * two characters so a single CJK word still renders something.
 */
export function brandInitials(name: string): string {
  const cleaned = String(name ?? "").trim();
  if (!cleaned) return "?";
  const words = cleaned.split(/[\s\-_./]+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase();
}

export type { BrandIcon };
