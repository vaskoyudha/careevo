import { describe, expect, it } from "vitest";
import { signPayload, type AttestationPayload } from "./sign";
import { verifyPayload } from "./verify";

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

describe("HMAC attestation", () => {
  it("C1: sign lalu verify payload sama menghasilkan valid", () => {
    const signature = signPayload(payload, secret);
    expect(verifyPayload(payload, signature, secret).valid).toBe(true);
  });

  it("C2: mengubah 1 karakter payload membuat invalid", () => {
    const signature = signPayload(payload, secret);
    const tampered = { ...payload, score: 88 };
    expect(verifyPayload(tampered, signature, secret).valid).toBe(false);
  });

  it("C3: signature acak membuat invalid", () => {
    const random = "a".repeat(64);
    const result = verifyPayload(payload, random, secret);
    expect(result.valid).toBe(false);
  });

  it("secret berbeda membuat invalid", () => {
    const signature = signPayload(payload, secret);
    expect(verifyPayload(payload, signature, "secret-lain").valid).toBe(false);
  });

  it("signature malformed tidak melempar error", () => {
    expect(verifyPayload(payload, "bukan-hex", secret).valid).toBe(false);
    expect(verifyPayload(payload, "", secret).valid).toBe(false);
  });

  it("urutan key payload tidak mengubah signature", () => {
    const reordered: AttestationPayload = {
      issued_at: payload.issued_at,
      score: payload.score,
      level: payload.level,
      track: payload.track,
      task_title: payload.task_title,
      task_id: payload.task_id,
      username: payload.username,
    };
    expect(signPayload(reordered, secret)).toBe(signPayload(payload, secret));
  });
});
