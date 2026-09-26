import { runEngine, runEngineJson } from "./exec-engine";
import type { BarisTracker, HasilScan } from "./types";

/**
 * tracker.ts — read/write access to the canonical applications tracker
 * (`data/applications.md`), orchestrated through the vendored engine.
 *
 * The tracker file stays the source of truth; the engine's SQLite index is a
 * rebuildable derived view. All writes go through `set-status.mjs` (the single
 * canonical write path) or `merge-tracker.mjs` (the TSV merge path) — never a
 * hand-edit from application code.
 *
 * Contract notes, learned from the engine's own CLIs:
 *   - `tracker.mjs query --json` and `set-status.mjs --json` emit JSON on
 *     stdout; everything else logs to stderr.
 *   - `reserve-report-num.mjs`, `merge-tracker.mjs`, `normalize-statuses.mjs`
 *     are PLAIN-TEXT CLIs — no `--json` flag. Their stdout is a human receipt,
 *     so this module reads exit codes and surfaces stderr, never parses stdout.
 */

/** Read the tracker as rows (via the engine's SQLite index, auto-resynced). */
export async function bacaTracker(): Promise<BarisTracker[]> {
  const hasil = await runEngineJson("tracker.mjs", ["query", "--json"]);
  if (!hasil.ok || !Array.isArray(hasil.data)) return [];
  return hasil.data as BarisTracker[];
}

/**
 * Canonical status transition. Mirrors the engine CLI:
 *   node set-status.mjs <report#|company> <state> [--note] [--force]
 *   node set-status.mjs --row N <state> [...]       (explicit tracker row)
 * The engine validates the state against templates/states.yml, guards against
 * report-link mismatches, and writes atomically under a shared lock.
 *
 * Pass `options.row` to select by the tracker's # column explicitly — the
 * number space the UI displays. A bare numeric selector is the ambiguous case
 * the mismatch guard exists for (tracker row IDs and report IDs diverge
 * permanently), so the web path mirrors career-ops' own /api/status: `--row N
 * <state> --source web`, which answers the ambiguity instead of suppressing it
 * with --force.
 */
export async function ubahStatus(
  selector: string,
  state: string,
  options: { note?: string; force?: boolean; row?: number } = {},
): Promise<{ ok: boolean; stderr: string; data?: Record<string, unknown> }> {
  const args = options.row !== undefined
    ? ["--row", String(options.row), state, "--source", "web"]
    : [selector, state];
  if (options.note) args.push("--note", options.note);
  if (options.force) args.push("--force");
  args.push("--json");
  const hasil = await runEngineJson("set-status.mjs", args);
  return { ok: hasil.ok, stderr: hasil.stderr, data: hasil.data as Record<string, unknown> | undefined };
}

/**
 * Run the Portal Scanner and return its JSON receipt.
 *
 * `scan.mjs` walks the boards and companies named in `portals.yml` through the
 * provider modules in `engine/providers/`, appends each new posting to
 * `data/pipeline.md`, stamps `data/scan-history.tsv`, and records a row in
 * `data/scan-runs.tsv`. Zero LLM cost.
 *
 * This replaced `scan-ats-full.mjs`, the reverse-ATS sweeper over 50k public ATS
 * companies. That scanner is right for a US keyword sweep and wrong for Careevo:
 * it is company-list driven, so it found 17 real postings and kept 0, and it has
 * no Indonesian provider. `scan.mjs` is the one with glints/jobstreet and with
 * the per-filter counters that explain a zero.
 *
 * The flag set is the engine's, not ours. Note there is NO `--limit`: the
 * scanner is bounded by `portals.yml`, and the only narrowing flags are
 * `--company` (a substring filter on an entry name) and the `--posted-*` /
 * `--since` date bounds. `--verify` and `--headed-fallback` are deliberately not
 * passed — they need Playwright, which is separate work.
 */

/**
 * Scan serialization.
 *
 * `scan.mjs` APPENDS to `data/pipeline.md` and APPENDS a row to
 * `data/scan-runs.tsv`. It is a separate process, so the in-process write chain
 * that protects `courses.json` cannot reach it, and nothing else serializes two
 * scans: two of them starting 168ms apart both read the same pre-scan state, both
 * decide their postings are new, and both append. Measured on a real data root:
 * 486 rows holding 443 distinct URLs, 29 of them duplicated. The engine's own
 * dedupe is a read-then-decide, so it only sees the earlier scan's rows once that
 * scan has committed them.
 *
 * Serializing the WHOLE run rather than just the write is what fixes it. A lock
 * around the append alone would still let both engines decide "new" from the same
 * snapshot, and would then append in an order neither one chose. Mirrors `antre`
 * in src/lib/courses/storage.ts.
 *
 * This is per process, like the courses cache: two `next start` instances on one
 * data root can still race. Serializing across processes needs a lock file the
 * engine respects, which is a change to the vendored engine, not to this layer.
 */
let rantaiScan: Promise<unknown> = Promise.resolve();

function antreScan<T>(kerja: () => Promise<T>): Promise<T> {
  const berikut = rantaiScan.then(kerja);
  rantaiScan = berikut.catch(() => undefined);
  return berikut;
}

export async function jalankanScan(options: {
  /** Relative-age bound in days. Omitted = the engine's own default. */
  since?: number;
  dryRun?: boolean;
  /** Substring filter on a portal/company entry name. */
  company?: string;
}): Promise<{ ok: boolean; hasil?: HasilScan; stderr: string }> {
  return antreScan(() => scanSekarang(options));
}

async function scanSekarang(options: {
  since?: number;
  dryRun?: boolean;
  company?: string;
}): Promise<{ ok: boolean; hasil?: HasilScan; stderr: string }> {
  const args = ["--json", "--quiet"];
  if (options.since !== undefined) args.push("--since", String(options.since));
  if (options.dryRun) args.push("--dry-run");
  if (options.company) args.push("--company", options.company);
  const hasil = await runEngineJson("scan.mjs", args, { timeoutMs: 5 * 60_000 });

  // The exit code is NOT the success signal here, and treating it as one is a
  // trap worth naming. `scan.mjs` ends with
  //   emitJsonReceipt(receipt, errors.length > 0 ? 2 : 0)
  // so exit 2 means "the scan COMPLETED and some providers errored" — and it
  // still writes a valid receipt to stdout. Exit 1 is reserved for a fatal
  // main() throw, which writes no receipt.
  //
  // A real run on the seeded config: 13,687 postings found, 422 added, 11
  // provider errors, exit 2. Judging that by the exit code would have told the
  // user "scan failed" while 422 live postings sat in their inbox. So success is
  // "a receipt came back", and the error list is a diagnostic, not a failure.
  const dapat = hasil.data as HasilScan | undefined;
  if (dapat && typeof dapat.added === "number") {
    return { ok: true, hasil: dapat, stderr: hasil.stderr };
  }

  return { ok: false, hasil: undefined, stderr: hasil.stderr };
}

/** Merge `batch/tracker-additions/*.tsv` into the tracker (dedup + normalize). */
export async function mergeTracker(
  options: { dryRun?: boolean } = {},
): Promise<{ ok: boolean; stderr: string }> {
  const hasil = await runEngine("merge-tracker.mjs", options.dryRun ? ["--dry-run"] : []);
  return { ok: hasil.ok, stderr: hasil.stderr };
}

/** Normalize every status cell in the tracker to a canonical state. */
export async function normalisasiStatus(): Promise<{ ok: boolean; stderr: string }> {
  const hasil = await runEngine("normalize-statuses.mjs", []);
  return { ok: hasil.ok, stderr: hasil.stderr };
}

/**
 * Atomically reserve the next report number(s). Returns numeric IDs, e.g. [42].
 * stdout is a plain number (`042`) or range (`042-049`); never JSON.
 */
export async function pesanNomorLaporan(count = 1): Promise<number[]> {
  const hasil = await runEngine(
    "reserve-report-num.mjs",
    count > 1 ? ["--count", String(count)] : [],
  );
  if (!hasil.ok) return [];
  const raw = hasil.stdout.trim();
  const numbers: number[] = [];
  for (const part of raw.split(/[,\s]+/)) {
    if (!part) continue;
    const [start, end] = part.split("-").map((s) => Number(s));
    if (!Number.isSafeInteger(start) || start < 1) continue;
    const stop = Number.isSafeInteger(end) ? end : start;
    for (let n = start; n <= stop; n++) numbers.push(n);
  }
  return numbers;
}

/** Release reserved report numbers after writing (or on failure). */
export async function lepasNomorLaporan(numbers: number[]): Promise<void> {
  if (numbers.length === 0) return;
  const start = String(Math.min(...numbers)).padStart(3, "0");
  const end = String(Math.max(...numbers)).padStart(3, "0");
  await runEngine("reserve-report-num.mjs", ["--release", start === end ? start : `${start}-${end}`]);
}
