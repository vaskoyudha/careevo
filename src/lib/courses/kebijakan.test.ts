import { describe, expect, it } from "vitest";
import {
  LABEL_ATURAN_BANTUAN,
  LABEL_ATURAN_PENGAWASAN,
  PESAN_POLICY,
  kebijakanDefault,
} from "./kebijakan";

describe("kebijakanDefault", () => {
  it("defaults to session-required proctoring", () => {
    const k = kebijakanDefault();
    expect(k.aturan_bantuan).toBe("bertutor");
    expect(k.aturan_pengawasan).toBe("wajib");
    expect(k.versi).toBe(1);
    expect(k.aturan_pengawasan_sejak).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("labels", () => {
  it("has an Indonesian label for every help rule", () => {
    expect(LABEL_ATURAN_BANTUAN.bebas).toContain("diizinkan");
    expect(LABEL_ATURAN_BANTUAN.tanpa_ai).toContain("AI");
  });

  it("has an Indonesian label and gate message for every proctoring rule", () => {
    expect(LABEL_ATURAN_PENGAWASAN.wajib).toContain("kamera");
    expect(PESAN_POLICY.wajib.length).toBeGreaterThan(20);
    expect(PESAN_POLICY.opsional.length).toBeGreaterThan(20);
  });
});
