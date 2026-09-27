/**
 * index.ts — the board registry.
 *
 * The one place that answers "which board owns this URL?". Order is deliberate
 * but should never matter: `index.test.ts` asserts each sample URL is claimed by
 * exactly one adapter, so a future overlapping pattern fails a test rather than
 * silently handing a row to the wrong board.
 */

import { breezy } from "./breezy";
import { dealls } from "./dealls";
import { jobstreet } from "./jobstreet";
import { kalibrr } from "./kalibrr";
import { smartrecruiters } from "./smartrecruiters";
import type { PapanAdapter } from "./types";
import { workable } from "./workable";

export const ADAPTER: readonly PapanAdapter[] = [
  jobstreet,
  kalibrr,
  workable,
  smartrecruiters,
  dealls,
  breezy,
];

/** The adapter that owns this URL, or null when no board claims it. */
export function adapterUntuk(url: string): PapanAdapter | null {
  return ADAPTER.find((a) => a.cocok(url)) ?? null;
}

/** The human-readable board name, or undefined when no adapter claims the URL. */
export function namaPapan(url: string): string | undefined {
  return adapterUntuk(url)?.nama;
}
