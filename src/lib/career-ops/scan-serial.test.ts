import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Two concurrent scans corrupt `data/pipeline.md`.
 *
 * `scan.mjs` is a separate process that APPENDS, and nothing serialized two of
 * them: measured on a real data root, two scans 168ms apart both read the same
 * pre-scan state, both judged their postings new, and both appended — 486 rows
 * holding 443 distinct URLs. `bacaInboxUnik` hides the symptom, but the file
 * grows another duplicate set per race.
 *
 * These stub the exec boundary, so no engine is spawned and no network is used.
 * `vi.doMock` must be called BEFORE the dynamic import, or the already-resolved
 * module keeps the real dependency.
 */
afterEach(() => {
  vi.doUnmock("./exec-engine");
  vi.resetModules();
});

describe("jalankanScan — serialization", () => {
  it("never runs two engine processes at the same time", async () => {
    let aktif = 0;
    let puncak = 0;
    const urut: string[] = [];

    vi.doMock("./exec-engine", () => ({
      runEngineJson: async () => {
        aktif++;
        puncak = Math.max(puncak, aktif);
        urut.push(`mulai:${aktif}`);
        await new Promise((r) => setTimeout(r, 30));
        urut.push(`selesai:${aktif}`);
        aktif--;
        return { ok: true, data: { added: 1 }, stderr: "", exitCode: 0 };
      },
      runEngine: async () => ({ ok: true, stdout: "", stderr: "", exitCode: 0 }),
    }));

    const { jalankanScan } = await import("./tracker");
    await Promise.all([jalankanScan({}), jalankanScan({}), jalankanScan({})]);

    // Without the chain all three would be in flight together and peak at 3.
    expect(puncak).toBe(1);
    expect(urut).toEqual([
      "mulai:1",
      "selesai:1",
      "mulai:1",
      "selesai:1",
      "mulai:1",
      "selesai:1",
    ]);
  });

  it("still runs the next scan after the first one throws", async () => {
    let panggilan = 0;
    vi.doMock("./exec-engine", () => ({
      runEngineJson: async () => {
        panggilan++;
        if (panggilan === 1) throw new Error("engine meledak");
        return { ok: true, data: { added: 7 }, stderr: "", exitCode: 0 };
      },
      runEngine: async () => ({ ok: true, stdout: "", stderr: "", exitCode: 0 }),
    }));

    const { jalankanScan } = await import("./tracker");

    // A rejected run must not poison the chain for every scan after it.
    await expect(jalankanScan({})).rejects.toThrow("engine meledak");
    const kedua = await jalankanScan({});
    expect(kedua.ok).toBe(true);
    expect(kedua.hasil?.added).toBe(7);
    expect(panggilan).toBe(2);
  });

  it("passes the flags through unchanged, so the gate did not alter the contract", async () => {
    const calls: string[][] = [];
    vi.doMock("./exec-engine", () => ({
      runEngineJson: async (_script: string, args: string[]) => {
        calls.push(args);
        return { ok: true, data: { added: 0 }, stderr: "", exitCode: 0 };
      },
      runEngine: async () => ({ ok: true, stdout: "", stderr: "", exitCode: 0 }),
    }));

    const { jalankanScan } = await import("./tracker");
    await jalankanScan({ since: 7, dryRun: true, company: "Glints" });

    expect(calls[0]).toEqual([
      "--json",
      "--quiet",
      "--since",
      "7",
      "--dry-run",
      "--company",
      "Glints",
    ]);
  });
});
