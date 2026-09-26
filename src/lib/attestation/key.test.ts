import { describe, expect, it } from "vitest";
import { tandaTangan, tokenPublicBaru, verifikasiSignature } from "./key";

describe("key attestation — signing/verify versi-kunci", () => {
  it("signature versi 1 lolos verifikasiSignature", () => {
    const payloadCanonical = '{"issued_at":"x","level":"dasar","score":87,"task_id":"t","task_title":"T","track":"web-dev","username":"budi"}';
    const signature = tandaTangan(payloadCanonical, 1);
    expect(verifikasiSignature(payloadCanonical, signature, 1)).toBe(true);
  });

  it("payload berbeda membuat verifikasi gagal", () => {
    const signature = tandaTangan('{"a":1}', 1);
    expect(verifikasiSignature('{"a":2}', signature, 1)).toBe(false);
  });

  it("signature rusak/malformed tidak melempar", () => {
    expect(verifikasiSignature('{"a":1}', "bukan-hex", 1)).toBe(false);
    expect(verifikasiSignature('{"a":1}', "", 1)).toBe(false);
  });

  it("versi kunci tidak dikenal melempar", () => {
    expect(() => tandaTangan("payload", 99 as never)).toThrow(/tidak dikenal/);
  });
});

describe("tokenPublicBaru", () => {
  it("menghasilkan nilai base64url non-kosong dan unik antar panggilan", () => {
    const a = tokenPublicBaru();
    const b = tokenPublicBaru();
    expect(a.length).toBeGreaterThan(0);
    expect(b.length).toBeGreaterThan(0);
    expect(a).not.toBe(b);
  });
});
