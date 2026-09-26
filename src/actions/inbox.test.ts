import { afterEach, describe, expect, it, vi } from "vitest";
import type { RiwayatScan } from "@/lib/career-ops";

/**
 * The diagnostics are the point of this action. Without them a user who presses
 * the button and sees "0 lowongan" cannot tell a dead provider from a filter
 * that rejected everything — and the engine's own `filtered` field cannot help
 * because it is a summed total of eleven counters.
 *
 * These run the real action with the session and the career-ops layer stubbed,
 * so the wording, the ordering, and the auth gate are all covered.
 */

type Hasil = Awaited<ReturnType<typeof import("./inbox").jalankanScanAction>>;

const SESI_ADA = { email: "u@careevo.test", nama: "U", username: "u", role: "user" as const };
const SESI_KOSONG = null;

interface Stub {
  rows: number;
  /** A real ledger row, typed as the engine's — so a drift in `RiwayatScan`
   *  breaks this test rather than silently letting a fake shape through. */
  run: RiwayatScan | null;
  ok: boolean;
  stderr?: string;
  /** Postings the stubbed scan appended. Ignored when `ok` is false. */
  added?: number;
}

/** Load the action with `getSession` and `@/lib/career-ops` stubbed. */
async function actionDengan(sesi: unknown, stub: Stub): Promise<Hasil> {
  let rows = stub.rows;
  vi.doMock("@/lib/auth/session", () => ({ getSession: async () => sesi }));
  vi.doMock("@/lib/career-ops", () => ({
    bootstrapCareerOps: () => ({ dataRoot: "/tmp", dibuat: [] }),
    bacaInbox: () => Array.from({ length: rows }, (_, i) => ({ url: `u${i}` })),
    bacaRiwayatScan: () => (stub.run ? [stub.run] : []),
    jalankanScan: async () => {
      if (!stub.ok) return { ok: false, stderr: stub.stderr ?? "" };
      rows += stub.added ?? 0;
      return { ok: true, hasil: { added: stub.added ?? 0, errors: [] }, stderr: "" };
    },
  }));
  const { jalankanScanAction } = await import("./inbox");
  return jalankanScanAction();
}

const RUN = (over: Partial<RiwayatScan> = {}): RiwayatScan => ({
  timestamp: "2026-09-26T00:00:00Z",
  status: "completed",
  companies: 97,
  boards: 1,
  found: 0,
  filteredTitle: 0,
  filteredTier: 0,
  filteredLocation: 0,
  filteredPostingAge: 0,
  filteredSalary: 0,
  filteredContent: 0,
  filteredCooldown: 0,
  filteredBlacklist: 0,
  filteredVisa: 0,
  filteredPostedDate: 0,
  filteredCountryEligibility: 0,
  dupes: 0,
  newAdded: 0,
  errors: 0,
  ...over,
});

afterEach(() => {
  vi.doUnmock("@/lib/auth/session");
  vi.doUnmock("@/lib/career-ops");
  vi.resetModules();
});

describe("jalankanScanAction — auth gate", () => {
  it("refuses an anonymous caller, because a server action is a public endpoint", async () => {
    const hasil = await actionDengan(SESI_KOSONG, { rows: 0, run: null, ok: true, added: 0 });
    expect(hasil.ok).toBe(false);
    expect(hasil.pesan).toMatch(/Sesi/);
  });
});

describe("jalankanScanAction — success", () => {
  it("reports the count when postings were added, with no diagnostics", async () => {
    const hasil = await actionDengan(SESI_ADA, {
      rows: 10,
      run: RUN(),
      ok: true,
      added: 7,
    });
    expect(hasil.ok).toBe(true);
    expect(hasil.ditambah).toBe(7);
    expect(hasil.pesan).toMatch(/7 lowongan baru/);
    expect(hasil.diagnosa).toEqual([]);
  });
});

describe("jalankanScanAction — explaining a zero", () => {
  it("blames the title filter when that is what dropped them", async () => {
    const hasil = await actionDengan(SESI_ADA, {
      rows: 0,
      run: RUN({ found: 13687, filteredTitle: 11698 }),
      ok: true,
      added: 0,
    });
    expect(hasil.ok).toBe(true);
    expect(hasil.pesan).toMatch(/Tidak ada lowongan baru/);
    expect(hasil.diagnosa.join(" ")).toMatch(/judulnya tidak cocok/);
  });

  it("blames posting age, the cause that reads as 'nothing was out there'", async () => {
    const hasil = await actionDengan(SESI_ADA, {
      rows: 0,
      run: RUN({ found: 300, filteredPostedDate: 300 }),
      ok: true,
      added: 0,
    });
    expect(hasil.diagnosa.join(" ")).toMatch(/terlalu lama/);
  });

  it("leads with unreachable boards, because a dead provider is not a filter", async () => {
    const hasil = await actionDengan(SESI_ADA, {
      rows: 0,
      run: RUN({ errors: 11, filteredTitle: 900 }),
      ok: true,
      added: 0,
    });
    const lines = hasil.diagnosa;
    expect(lines[0]).toMatch(/11 papan gagal/);
    expect(lines.some((l) => l.includes("judulnya"))).toBe(true);
  });

  it("falls back to a scope statement when no filter fired", async () => {
    const hasil = await actionDengan(SESI_ADA, {
      rows: 0,
      run: RUN({ companies: 97, boards: 1 }),
      ok: true,
      added: 0,
    });
    expect(hasil.diagnosa.join(" ")).toMatch(/97 perusahaan/);
  });

  it("says so plainly when the engine wrote no ledger at all", async () => {
    const hasil = await actionDengan(SESI_ADA, { rows: 0, run: null, ok: true, added: 0 });
    expect(hasil.diagnosa.join(" ")).toMatch(/tidak diketahui/);
  });

  it("formats counters in Indonesian thousands separators", async () => {
    const hasil = await actionDengan(SESI_ADA, {
      rows: 0,
      run: RUN({ found: 13687, filteredTitle: 11698 }),
      ok: true,
      added: 0,
    });
    expect(hasil.diagnosa.join(" ")).toMatch(/11\.698/);
  });
});

describe("jalankanScanAction — failure", () => {
  it("surfaces the engine's stderr when the scan itself fails", async () => {
    const hasil = await actionDengan(SESI_ADA, {
      rows: 0,
      run: null,
      ok: false,
      stderr: "Error: portals.yml contains invalid YAML",
    });
    expect(hasil.ok).toBe(false);
    expect(hasil.pesan).toMatch(/invalid YAML/);
    expect(hasil.diagnosa).toEqual([]);
  });
});
