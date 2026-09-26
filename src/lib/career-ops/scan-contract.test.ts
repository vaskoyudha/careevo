import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * `scan.mjs` ends with `emitJsonReceipt(receipt, errors.length > 0 ? 2 : 0)`.
 * Exit 2 therefore means "completed, some providers errored" and STILL carries a
 * valid receipt. Judging the run by its exit code reports a successful scan as a
 * failure — a real one added 422 postings and exited 2.
 *
 * The child process is stubbed at the exec boundary, so these stay pure unit
 * tests: no network, no engine spawn. `vi.doMock` must be called BEFORE the
 * dynamic import of the module under test, or the already-resolved module keeps
 * the real dependency.
 */
afterEach(() => {
  vi.doUnmock("./exec-engine");
  vi.resetModules();
});

/**
 * A stubbed `runEngineJson` that records what the engine was asked to run.
 * Same shape as the fake endpoint in generator-gemini.test.ts: the parameters are
 * read, so they are used rather than merely present for typing.
 */
function stubEngine(data: unknown, stderr: string, exitCode: number) {
  const calls: Array<{ script: string; args: string[] }> = [];
  const fn = vi.fn(async (script: string, args: string[]) => {
    calls.push({ script, args });
    return { ok: exitCode === 0, data, stderr, exitCode };
  });
  return Object.assign(fn, { calls });
}

type StubEngine = ReturnType<typeof stubEngine>;

/** Load `tracker.ts` with a stubbed engine boundary. */
async function trackerDengan(runEngineJson: StubEngine): Promise<typeof import("./tracker")> {
  vi.doMock("./exec-engine", () => ({ runEngineJson, runEngine: vi.fn() }));
  return import("./tracker");
}

const RECEIPT_422 = {
  version: "careerops.scan.receipt@1",
  date: "2026-09-26",
  scanned: 97,
  skipped: 23,
  found: 13687,
  filtered: 13640,
  duplicates: 50,
  added: 422,
  added_urls: ["https://jobs.ashbyhq.com/deepgram/abc"],
  errors: [{ company: "acme", error: "HTTP 404" }],
  unverified_zero: [],
  dry_run: false,
};

describe("scan.mjs exit-code contract", () => {
  it("exit 2 with a receipt is a success, not a failure", async () => {
    // The engine's real shape: non-zero code AND a valid receipt on stdout.
    const { jalankanScan } = await trackerDengan(stubEngine(RECEIPT_422, "11 errors", 2));

    const hasil = await jalankanScan({ since: 30 });
    expect(hasil.ok).toBe(true);
    expect(hasil.hasil?.added).toBe(422);
    expect(hasil.hasil?.found).toBe(13687);
    // Provider errors stay available — as a diagnostic, not a failure.
    expect(hasil.hasil?.errors).toHaveLength(1);
  });

  it("a fatal run has no receipt and is reported as a failure", async () => {
    const { jalankanScan } = await trackerDengan(
      stubEngine(undefined, "Error: portals.yml not found", 1),
    );

    const hasil = await jalankanScan({ since: 30 });
    expect(hasil.ok).toBe(false);
    expect(hasil.hasil).toBeUndefined();
    expect(hasil.stderr).toMatch(/portals\.yml/);
  });

  it("passes only flags scan.mjs actually accepts", async () => {
    const runEngineJson = stubEngine({ added: 0 }, "", 0);
    const { jalankanScan } = await trackerDengan(runEngineJson);

    await jalankanScan({ since: 30, dryRun: true, company: "acme" });
    const args = runEngineJson.calls[0]!.args;
    expect(args).toEqual(["--json", "--quiet", "--since", "30", "--dry-run", "--company", "acme"]);
    // --limit and --seeds belong to scan-ats-full.mjs, not scan.mjs. Passing
    // them makes validateFlags exit before any work happens.
    expect(args).not.toContain("--limit");
    expect(args).not.toContain("--seeds");
  });

  it("names the script it spawns", async () => {
    const runEngineJson = stubEngine({ added: 0 }, "", 0);
    const { jalankanScan } = await trackerDengan(runEngineJson);
    await jalankanScan({});
    expect(runEngineJson.calls[0]!.script).toBe("scan.mjs");
  });

  // The receipt's `filtered` is a summed total of eleven counters, so it can
  // never attribute a zero. Anything that tries to will render "undefined".
  it("treats filtered as a lossy total, not a per-filter breakdown", async () => {
    const { jalankanScan } = await trackerDengan(stubEngine(RECEIPT_422, "", 2));
    const hasil = await jalankanScan({});
    expect(hasil.hasil?.filtered).toBe(13640);
    expect(typeof hasil.hasil?.filtered).toBe("number");
  });
});
