import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const DIR = mkdtempSync(path.join(tmpdir(), "careevo-sesi-"));
process.env.CAREERS_SESSION_DIR = DIR;

const mod = await import("./session");

afterAll(() => rmSync(DIR, { recursive: true, force: true }));

describe("bukti sesi", () => {
  it("verifies a proof minted for the same course, owner, and policy version", () => {
    const token = mod.buktiBaru({ courseId: "crs-1", owner: "a@b.test", policyVersion: 2 });
    const hasil = mod.verifikasiBuktiSesi(token, { courseId: "crs-1", owner: "a@b.test", policyVersion: 2 });
    expect(hasil?.courseId).toBe("crs-1");
  });

  it("rejects a proof whose policy version is stale", () => {
    const token = mod.buktiBaru({ courseId: "crs-1", owner: "a@b.test", policyVersion: 1 });
    expect(mod.verifikasiBuktiSesi(token, { courseId: "crs-1", owner: "a@b.test", policyVersion: 2 })).toBeNull();
  });

  it("rejects a tampered proof", () => {
    const token = mod.buktiBaru({ courseId: "crs-1", owner: "a@b.test", policyVersion: 1 });
    expect(mod.verifikasiBuktiSesi(`${token}x`, { courseId: "crs-1", owner: "a@b.test", policyVersion: 1 })).toBeNull();
  });
});

describe("siklus hidup run", () => {
  it("starts a run in status aktif and ends it", async () => {
    const run = await mod.mulaiRun({ courseId: "crs-1", owner: "a@b.test", policyVersion: 1 });
    expect(run.status).toBe("aktif");
    const diakhiri = await mod.akhiriRun(run.id, "peserta_akhiri");
    expect(diakhiri?.status).toBe("diakhiri");
    expect(await mod.ambilRun("sesi-tidak-ada")).toBeNull();
  });

  it("records integrity events with a gap classification", async () => {
    const run = await mod.mulaiRun({ courseId: "crs-1", owner: "a@b.test", policyVersion: 1 });
    const setelah = await mod.catatKejadian({
      runId: run.id,
      jenis: "kamera_berhenti",
      visibilitas: null,
      detail: "stream berhenti",
    });
    expect(setelah?.kejadian).toHaveLength(1);
    expect(setelah?.kejadian[0].jenis_klasifikasi).toBe("celah");
  });

  it("refuses to record events on a closed run", async () => {
    const run = await mod.mulaiRun({ courseId: "crs-1", owner: "a@b.test", policyVersion: 1 });
    await mod.akhiriRun(run.id, "peserta_akhiri");
    expect(await mod.catatKejadian({ runId: run.id, jenis: "pindah_tab", visibilitas: "hidden" })).toBeNull();
  });
});

describe("buktikanSesi", () => {
  it("returns the run only when owner, course, and policy version all match", async () => {
    const run = await mod.mulaiRun({ courseId: "crs-9", owner: "c@d.test", policyVersion: 3 });
    const token = mod.buktiBaru({ courseId: "crs-9", owner: "c@d.test", policyVersion: 3 });
    expect((await mod.buktikanSesi({ courseId: "crs-9", owner: "c@d.test", policyVersion: 3, token }))?.id).toBe(run.id);
    expect(await mod.buktikanSesi({ courseId: "crs-9", owner: "lain@d.test", policyVersion: 3, token })).toBeNull();
    expect(await mod.buktikanSesi({ courseId: "crs-9", owner: "c@d.test", policyVersion: 4, token })).toBeNull();
  });

  it("refuses a closed run", async () => {
    const run = await mod.mulaiRun({ courseId: "crs-10", owner: "e@f.test", policyVersion: 1 });
    const token = mod.buktiBaru({ courseId: "crs-10", owner: "e@f.test", policyVersion: 1 });
    await mod.akhiriRun(run.id, "peserta_akhiri");
    expect(await mod.buktikanSesi({ courseId: "crs-10", owner: "e@f.test", policyVersion: 1, token })).toBeNull();
  });
});
