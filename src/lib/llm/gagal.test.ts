import { describe, expect, it } from "vitest";
import { klasifikasiGagal } from "./gagal";

describe("klasifikasiGagal", () => {
  it("maps a missing key to tanpa_kunci", () => {
    const hasil = klasifikasiGagal({ ok: false, reason: "missing_api_key", message: "x" });
    expect(hasil.alasan).toBe("tanpa_kunci");
  });

  it("maps rate_limited to kuota", () => {
    const hasil = klasifikasiGagal({ ok: false, reason: "rate_limited", message: "slow" });
    expect(hasil.alasan).toBe("kuota");
  });

  it("maps invalid_output to hasil_tidak_valid", () => {
    const hasil = klasifikasiGagal({ ok: false, reason: "invalid_output", message: "bad" });
    expect(hasil.alasan).toBe("hasil_tidak_valid");
  });

  it("keeps everything else as gagal", () => {
    const hasil = klasifikasiGagal({ ok: false, reason: "provider_error", message: "503" });
    expect(hasil.alasan).toBe("gagal");
  });

  // The message reaches a learner on a shared page, so it must not name one
  // feature or vendor.
  it("does not name a tutor or a vendor", () => {
    const hasil = klasifikasiGagal({ ok: false, reason: "missing_api_key", message: "x" });
    expect(hasil.pesan).not.toMatch(/Tutor|Gemini/);
  });
});
