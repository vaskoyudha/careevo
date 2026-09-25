import fs from "node:fs";
import path from "node:path";
import { dataRoot } from "./data-root";
import { splitLines } from "./pipeline-table";

/**
 * scan-runs.ts — read `data/scan-runs.tsv`, the engine's per-run filter ledger.
 *
 * Adapted from career-ops (MIT), © 2026 Santiago Fernández de Valderrama.
 * Source: engine/scan.mjs (`SCAN_RUNS_HEADER`, line 2891).
 * https://github.com/career-ops-hq/career-ops
 *
 * This file is the answer to "the scan ran and found nothing — why?". The scan
 * receipt collapses eleven filter counters into one `filtered` total, so it
 * cannot attribute a zero. This ledger keeps one counter per filter, which is
 * what lets the UI say "1,517 were too old" instead of "0 lowongan".
 *
 * The column map is DERIVED from the copied header rather than written as a
 * second list. A hand-typed index list is a second source of truth for the
 * engine's schema, and it would silently misread every row the day the engine
 * reorders or adds a column.
 */

/** Verbatim from engine/scan.mjs SCAN_RUNS_HEADER (line 2891). */
export const HEADER_SCAN_RUNS =
  "timestamp\tstatus\tcompanies\tboards\tfound\tfiltered_title\tfiltered_tier\tfiltered_location\tfiltered_posting_age\tfiltered_salary\tfiltered_content\tfiltered_cooldown\tdupes\tnew_added\terrors\tfiltered_blacklist\tfiltered_visa\tfiltered_posted_date\tfiltered_country_eligibility\n";

export interface RiwayatScan {
  timestamp: string;
  status: string;
  companies: number;
  boards: number;
  found: number;
  filteredTitle: number;
  filteredTier: number;
  filteredLocation: number;
  filteredPostingAge: number;
  filteredSalary: number;
  filteredContent: number;
  filteredCooldown: number;
  filteredBlacklist: number;
  filteredVisa: number;
  filteredPostedDate: number;
  filteredCountryEligibility: number;
  dupes: number;
  newAdded: number;
  errors: number;
}

/** header column → RiwayatScan field. The two string columns are handled apart. */
const PETA: Record<string, keyof RiwayatScan> = {
  companies: "companies",
  boards: "boards",
  found: "found",
  filtered_title: "filteredTitle",
  filtered_tier: "filteredTier",
  filtered_location: "filteredLocation",
  filtered_posting_age: "filteredPostingAge",
  filtered_salary: "filteredSalary",
  filtered_content: "filteredContent",
  filtered_cooldown: "filteredCooldown",
  filtered_blacklist: "filteredBlacklist",
  filtered_visa: "filteredVisa",
  filtered_posted_date: "filteredPostedDate",
  filtered_country_eligibility: "filteredCountryEligibility",
  dupes: "dupes",
  new_added: "newAdded",
  errors: "errors",
};

/** header column → number, resolved once. */
const KOLOM = new Map(
  HEADER_SCAN_RUNS.trimEnd()
    .split("\t")
    .map((name, index) => [name, index] as const),
);

/** Every counter column, in header order, paired with its field name. */
const COUNTERS: Array<[number, keyof RiwayatScan]> = Object.entries(PETA).map(([kolom, field]) => {
  const index = KOLOM.get(kolom);
  if (index === undefined) {
    // The header we copied and the map we wrote disagree — a build-time bug,
    // not a runtime condition. Failing loudly beats reading garbage.
    throw new Error(`scan-runs: kolom "${kolom}" tidak ada di HEADER_SCAN_RUNS`);
  }
  return [index, field];
});

export function bacaRiwayatScan(): RiwayatScan[] {
  let tsv: string;
  try {
    tsv = fs.readFileSync(path.join(dataRoot(), "data", "scan-runs.tsv"), "utf8");
  } catch {
    return [];
  }

  const lebar = HEADER_SCAN_RUNS.trimEnd().split("\t").length;
  const idxTimestamp = KOLOM.get("timestamp") ?? 0;
  const idxStatus = KOLOM.get("status") ?? 1;

  const runs: RiwayatScan[] = [];
  for (const line of splitLines(tsv)) {
    if (!line) continue;
    if (line.startsWith("timestamp\t")) continue; // header
    const cells = line.split("\t");
    // A short row means the engine gained a column and this reader has not been
    // updated. Skipping it is the honest response: reading past the end would
    // yield undefined, and `Number(undefined) || 0` would render as a confident
    // zero for a column that was never measured.
    if (cells.length < lebar) continue;

    const row = {} as Record<keyof RiwayatScan, string | number>;
    row.timestamp = (cells[idxTimestamp] ?? "").trim();
    row.status = (cells[idxStatus] ?? "").trim();
    for (const [index, field] of COUNTERS) {
      // `Number("")` and `Number("n/a")` are both NaN; `|| 0` makes an
      // unmeasured counter read as zero rather than as NaN in the UI.
      row[field] = Number(cells[index]) || 0;
    }
    runs.push(row as unknown as RiwayatScan);
  }
  return runs;
}
