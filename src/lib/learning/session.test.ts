import { createHmac } from "node:crypto";
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

  // Kalau pemisah bocor ke dalam kolom, penyandian tanda tangan dan pembacaan
  // kolom jadi tidak sepakat: penyerang bisa menyelipkan kolom ekstra sehingga
  // `policyVersion` yang dibandingkan bukan yang ditandatangani.
  it("refuses to mint a proof whose owner smuggles the separator", () => {
    expect(() =>
      mod.buktiBaru({ courseId: "crs-1", owner: `a@b.test\u00019`, policyVersion: 1 }),
    ).toThrow();
  });

  it("refuses to mint a proof whose courseId smuggles the separator", () => {
    expect(() => mod.buktiBaru({ courseId: "crs-1\u00011", owner: "a@b.test", policyVersion: 1 })).toThrow();
  });

  it("does not validate a payload carrying extra separator-delimited fields", () => {
    // Payload dengan kolom ekstra yang ditandatangani utuh: penanda tangan hanya
    // mengautentikasi string gabungan, jadi tanpa pemeriksaan jumlah kolom
    // destructuring akan membaca `versi` = 9 dari kolom ketiga, padahal versi
    // yang sebenarnya dimaksud adalah 1 di kolom keempat.
    const terpalsu = ["crs-1", "a@b.test\u00019", "1"].join("\u0001");
    const signature = createHmac("sha256", process.env.SESSION_SECRET ?? "dev-session-secret-careevo")
      .update(terpalsu)
      .digest("base64url");
    const token = `${Buffer.from(terpalsu, "utf8").toString("base64url")}.${signature}`;
    expect(mod.verifikasiBuktiSesi(token, { courseId: "crs-1", owner: "a@b.test", policyVersion: 9 })).toBeNull();
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

  it("refuses a proof minted with the separator inside the owner", async () => {
    // Eksploitasi: owner peserta lain + kolom ekstra membuat `policyVersion`
    // yang dibandingkan (9) berbeda dari yang ditandatangani (1), sehingga sesi
    // korban yang berjalan di bawah kebijakan lama ikut terpakai.
    await mod.mulaiRun({ courseId: "crs-target", owner: "victim@x.test", policyVersion: 1 });
    expect(() => mod.buktiBaru({ courseId: "crs-target", owner: "victim@x.test\u00019", policyVersion: 1 })).toThrow();
  });
});
