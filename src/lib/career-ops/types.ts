/**
 * types.ts — the read model the loker feature consumes, produced by running the
 * vendored engine and parsing its `--json` output.
 *
 * These shapes are the engine's, not Careevo's invention: `HasilScan` mirrors
 * the `--json` receipt of scan-ats-full.mjs; `BarisTracker` mirrors the
 * `tracker.mjs query --json` row. Keep them here, in one file, so the UI never
 * has to know which engine script produced a shape.
 */

export interface TawaranScan {
  company: string;
  title: string;
  url: string;
  location: string | null;
  postedAt: string | null;
  dateStatus: "dated" | "unknown";
  blacklisted: boolean;
  note: string | null;
  source: string;
}

/**
 * One provider failure recorded by the scan.
 *
 * A dead board is not a scan failure: the run still completes and still adds
 * everything the live providers returned. These are what the UI reports so
 * "0 lowongan" can be attributed.
 */
export interface GagalScan {
  company: string;
  error: string;
}

/**
 * The Portal Scanner's receipt — `careerops.scan.receipt@1`, emitted by
 * `engine/scan.mjs`.
 *
 * Field names are the engine's, not ours. Two things to know before reading it:
 * this scanner counts `added`/`found` where the old reverse-ATS shape counted
 * `postingsKept`, and it gives up per-filter detail entirely — `filtered` is a
 * summed total. The per-filter ledger is `data/scan-runs.tsv`; see
 * `scan-runs.ts` for that surface.
 */
export interface HasilScan {
  version: string;
  date: string;
  /** Targets attempted: portal entries + tracked companies. */
  scanned: number;
  /** Targets the config named but no provider could claim. */
  skipped: number;
  /** Postings seen before any filter. */
  found: number;
  /**
   * Total postings dropped by all filters combined — a SUM, not a breakdown.
   *
   * The engine computes it as the sum of eleven per-filter counters
   * (`totalFilteredTitle + totalFilteredTier + … + totalFilteredCooldown`) and
   * collapses them into one number in the receipt. It is lossy on purpose: the
   * per-filter detail lives in `data/scan-runs.tsv`, which is what
   * `scan-runs.ts` reads. Do not expect to attribute a zero from this field.
   */
  filtered: number;
  duplicates: number;
  /** Postings actually appended to data/pipeline.md. */
  added: number;
  added_urls: string[];
  errors: GagalScan[];
  /** Boards that answered but returned nothing — suspicious, not proven dead. */
  unverified_zero: string[];
  dry_run: boolean;
}

export interface BarisTracker {
  id: number;
  date: string;
  company: string;
  role: string;
  score: string;
  status: string;
  pdf: string;
  report: string;
  notes: string;
  /** Present only when the tracker table carries a URL column. */
  url?: string;
  /** Present only when the tracker table carries a Via column. */
  via?: string;
  /** Present only when the tracker table carries a Location column. */
  location?: string;
}

export type StatusKanonis =
  | "Evaluated"
  | "Applied"
  | "Responded"
  | "Interview"
  | "Offer"
  | "Hired"
  | "Rejected"
  | "Discarded"
  | "SKIP";
