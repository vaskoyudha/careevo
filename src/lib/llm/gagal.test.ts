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

  // Caught in a real browser run: a 503 whose body was a provider's nested
  // quota error reached the page verbatim, so the learner was shown ~200
  // characters of escaped JSON. `pesan` is learner copy, so it must never
  // carry a provider body — the diagnostic belongs in `detail`.
  const BODY =
    'HTTP 503: {"error":{"message":"[antigravity/gemini-3-flash] [429]: quota reached"}}';

  // Typed rather than inferred: `it.each` widens a plain string[] to `string`,
  // which no longer satisfies the port's `reason` union.
  const REASONS = [
    "rate_limited",
    "invalid_output",
    "provider_error",
  ] as const;

  it.each(REASONS)("never leaks a provider body into pesan (%s)", (reason) => {
    const hasil = klasifikasiGagal({ ok: false, reason, message: BODY });
    expect(hasil.pesan).not.toMatch(/[{}"]|HTTP \d|antigravity|429|503/);
  });

  it("keeps the provider body in detail for diagnosis", () => {
    const hasil = klasifikasiGagal({ ok: false, reason: "provider_error", message: BODY });
    expect(hasil.detail).toBe(BODY);
  });

  it("gives a quota failure copy that tells the user what to do", () => {
    const hasil = klasifikasiGagal({ ok: false, reason: "rate_limited", message: BODY });
    expect(hasil.pesan).toMatch(/kuota/i);
  });

  it("omits detail when the provider said nothing extra", () => {
    const hasil = klasifikasiGagal({ ok: false, reason: "missing_api_key", message: "x" });
    expect(hasil.detail).toBeUndefined();
  });
});
