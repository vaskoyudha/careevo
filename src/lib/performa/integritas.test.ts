import { describe, expect, it } from "vitest";
import type { KejadianIntegritas, SessionRun } from "@/lib/learning/session";
import { ringkasIntegritasByOwner } from "./integritas";

function kejadian(
  jenis: KejadianIntegritas["jenis"],
  jenis_klasifikasi: KejadianIntegritas["jenis_klasifikasi"],
): KejadianIntegritas {
  return { at: "2026-09-25T10:05:00.000Z", jenis, jenis_klasifikasi, visibilitas: "hidden" };
}

function run(partial: Partial<SessionRun> & Pick<SessionRun, "id" | "owner">): SessionRun {
  return {
    course_id: "crs-1",
    policy_version: 1,
    status: "aktif",
    mulai_at: "2026-09-25T10:00:00.000Z",
    berakhir_at: null,
    kejadian: [],
    ...partial,
  };
}

describe("ringkasIntegritasByOwner", () => {
  it("mengelompokkan kejadian dan celah per pemilik", () => {
    const peta = ringkasIntegritasByOwner([
      run({
        id: "s1",
        owner: "a@x.test",
        kejadian: [kejadian("pindah_tab", "kejadian")],
      }),
      run({
        id: "s2",
        owner: "a@x.test",
        status: "kedaluwarsa",
        kejadian: [kejadian("kamera_gagal", "celah")],
      }),
      run({ id: "s3", owner: "b@x.test" }),
    ]);

    const a = peta.get("a@x.test");
    expect(a?.sesi).toBe(2);
    expect(a?.kejadian).toBe(1);
    expect(a?.celah).toBe(1);
    expect(a?.kedaluwarsa).toBe(1);
    expect(peta.get("b@x.test")?.sesi).toBe(1);
  });

  it("tidak pernah mengembalikan nilai, skor, atau status kelulusan", () => {
    // This summary exists to be displayed. Pinning the field list keeps it from
    // quietly growing a field that would later be read as a verdict.
    const peta = ringkasIntegritasByOwner([run({ id: "s1", owner: "a@x.test" })]);
    expect(Object.keys(peta.get("a@x.test")!).sort()).toEqual([
      "celah",
      "daftar",
      "kedaluwarsa",
      "kejadian",
      "sesi",
    ]);
  });

  it("mengurutkan riwayat sesi dari yang terbaru", () => {
    const peta = ringkasIntegritasByOwner([
      run({ id: "lama", owner: "a@x.test", mulai_at: "2026-09-20T10:00:00.000Z" }),
      run({ id: "baru", owner: "a@x.test", mulai_at: "2026-09-25T10:00:00.000Z" }),
    ]);
    expect(peta.get("a@x.test")?.daftar.map((s) => s.run_id)).toEqual(["baru", "lama"]);
  });

  it("mengembalikan peta kosong untuk tanpa run", () => {
    expect(ringkasIntegritasByOwner([]).size).toBe(0);
  });
});
