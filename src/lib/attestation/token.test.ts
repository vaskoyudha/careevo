import { describe, expect, it } from "vitest";
import { signPayload, type AttestationPayload } from "./sign";
import { verifyPayload } from "./verify";
import {
  ATTESTATION_MAX_AGE_DAYS,
  buildToken,
  decodeToken,
  encodeToken,
  isExpired,
} from "./token";

const secret = "test-secret";
const payload: AttestationPayload = {
  username: "budi",
  task_id: "task-1",
  task_title: "Rebuild Landing Page",
  track: "web-dev",
  level: "dasar",
  score: 87,
  issued_at: "2026-09-21T00:00:00.000Z",
};

function verifyTokenPath(token: string): boolean {
  const decoded = decodeToken(token);
  if (!decoded) return false;
  return verifyPayload(decoded.payload, decoded.signature, secret).valid;
}

function tamperOneChar(token: string): string {
  const last = token.slice(-1);
  return token.slice(0, -1) + (last === "A" ? "B" : "A");
}

describe("attestation token encode/decode", () => {
  it("roundtrip encode lalu decode mengembalikan payload dan signature", () => {
    const signature = signPayload(payload, secret);
    const token = encodeToken(payload, signature);
    const decoded = decodeToken(token);

    expect(decoded).not.toBeNull();
    expect(decoded?.payload).toEqual(payload);
    expect(decoded?.signature).toBe(signature);
  });

  it("token yang dibangun buildToken lolos verifyPayload", () => {
    const token = buildToken(payload, secret);
    expect(verifyTokenPath(token)).toBe(true);
  });

  it("mengubah 1 karakter token membuat verifikasi gagal", () => {
    const token = buildToken(payload, secret);
    const tampered = tamperOneChar(token);
    expect(tampered).not.toBe(token);
    expect(verifyTokenPath(tampered)).toBe(false);
  });

  it("token acak atau malformed tidak valid dan tidak melempar error", () => {
    expect(verifyTokenPath("token-tidak-dikenal")).toBe(false);
    expect(verifyTokenPath("")).toBe(false);
    expect(decodeToken("!!!bukan-base64url!!!")).toBeNull();
  });

  it("signature yang diubah di dalam token membuat verifikasi gagal", () => {
    const signature = signPayload(payload, secret);
    const token = encodeToken(payload, "f".repeat(64));
    const decoded = decodeToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.signature).not.toBe(signature);
    expect(verifyTokenPath(token)).toBe(false);
  });
});

describe("aturan kedaluwarsa attestation", () => {
  it(`dianggap kedaluwarsa setelah ${ATTESTATION_MAX_AGE_DAYS} hari`, () => {
    const issued = Date.parse(payload.issued_at);
    const withinAge = issued + (ATTESTATION_MAX_AGE_DAYS - 1) * 24 * 60 * 60 * 1000;
    const beyondAge = issued + (ATTESTATION_MAX_AGE_DAYS + 1) * 24 * 60 * 60 * 1000;

    expect(isExpired(payload, withinAge)).toBe(false);
    expect(isExpired(payload, beyondAge)).toBe(true);
  });

  it("issued_at tidak valid dianggap kedaluwarsa", () => {
    expect(isExpired({ ...payload, issued_at: "bukan-tanggal" })).toBe(true);
  });
});
