import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `data/scan-runs.tsv` is the answer to "the scan ran and found nothing — why?".
 * The scan receipt's `filtered` is a summed total and cannot attribute a zero;
 * this ledger has one counter per filter.
 */

const AKAR = mkdtempSync(path.join(tmpdir(), "careevo-runs-"));
vi.stubEnv("CAREER_OPS_ROOT", AKAR);

const { bacaRiwayatScan, HEADER_SCAN_RUNS } = await import("./scan-runs");

const TSV = path.join(AKAR, "data", "scan-runs.tsv");

beforeEach(() => {
  mkdirSync(path.join(AKAR, "data"), { recursive: true });
});

afterAll(() => {
  vi.unstubAllEnvs();
});

/** Build a full-width row from the header, so the test can never drift from it. */
function baris(nilai: Record<number, string | number>): string {
  const cols = HEADER_SCAN_RUNS.trimEnd().split("\t");
  const cells = cols.map((_, i) => String(nilai[i] ?? 0));
  cells[0] = String(nilai[0] ?? "2026-09-26T00:00:00Z");
  cells[1] = String(nilai[1] ?? "completed");
  return cells.join("\t");
}

describe("bacaRiwayatScan", () => {
  it("is empty when no run has been recorded", () => {
    expect(bacaRiwayatScan()).toEqual([]);
  });

  it("maps every engine counter to a typed field", () => {
    // Column indices are 0-based against the verbatim header. This row is a real
    // one from a scan of the seeded config: 13,687 found, 11,698 dropped by
    // title (col 5), 49 dupes (12), 422 added (13), 11 provider errors (14),
    // 1,517 dropped by posted date (17).
    writeFileSync(
      TSV,
      HEADER_SCAN_RUNS +
        baris({ 2: 97, 3: 1, 4: 13687, 5: 11698, 12: 49, 13: 422, 14: 11, 17: 1517 }) +
        "\n",
    );
    expect(bacaRiwayatScan()[0]).toEqual({
      timestamp: "2026-09-26T00:00:00Z",
      status: "completed",
      companies: 97,
      boards: 1,
      found: 13687,
      filteredTitle: 11698,
      filteredTier: 0,
      filteredLocation: 0,
      filteredPostingAge: 0,
      filteredSalary: 0,
      filteredContent: 0,
      filteredCooldown: 0,
      filteredBlacklist: 0,
      filteredVisa: 0,
      filteredPostedDate: 1517,
      filteredCountryEligibility: 0,
      dupes: 49,
      newAdded: 422,
      errors: 11,
    });
  });

  // A short row means the engine gained a column. Indexing past the end would
  // yield NaN, which renders as "NaN lowongan" — worse than no row at all.
  it("skips a short row rather than producing NaN counters", () => {
    writeFileSync(TSV, HEADER_SCAN_RUNS + "2026-09-26T00:00:00Z\tcompleted\t1\n");
    expect(bacaRiwayatScan()).toEqual([]);
  });

  // A failed run is the most diagnostic row there is: its error count is the
  // whole explanation.
  it("keeps a failed run, because its error count is the diagnosis", () => {
    writeFileSync(TSV, HEADER_SCAN_RUNS + baris({ 1: "failed", 14: 7 }) + "\n");
    expect(bacaRiwayatScan()[0]).toMatchObject({ status: "failed", errors: 7 });
  });

  it("reads every run in file order, so the last one is the latest", () => {
    writeFileSync(
      TSV,
      HEADER_SCAN_RUNS +
        baris({ 0: "2026-09-24T00:00:00Z", 13: 5 }) + "\n" +
        baris({ 0: "2026-09-25T00:00:00Z", 13: 9 }) + "\n" +
        baris({ 0: "2026-09-26T00:00:00Z", 13: 0 }) + "\n",
    );
    const runs = bacaRiwayatScan();
    expect(runs).toHaveLength(3);
    expect(runs.map((r) => r.newAdded)).toEqual([5, 9, 0]);
    expect(runs.at(-1)!.newAdded).toBe(0);
  });

  it("tolerates CRLF, like every other reader of these data files", () => {
    writeFileSync(TSV, HEADER_SCAN_RUNS + baris({ 13: 3 }) + "\r\n");
    expect(bacaRiwayatScan()).toHaveLength(1);
  });

  it("coerces a non-numeric counter to 0 instead of NaN", () => {
    writeFileSync(TSV, HEADER_SCAN_RUNS + baris({ 13: "n/a" }) + "\n");
    expect(bacaRiwayatScan()[0]!.newAdded).toBe(0);
  });
});
