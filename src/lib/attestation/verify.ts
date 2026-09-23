import { timingSafeEqual } from "node:crypto";
import { signPayload, type AttestationPayload } from "./sign";

export type VerifyReason = "signature_mismatch" | "malformed";

export interface VerifyResult {
  valid: boolean;
  reason?: VerifyReason;
}

export function verifyPayload(
  payload: AttestationPayload,
  signature: string,
  secret: string,
): VerifyResult {
  const expected = signPayload(payload, secret);
  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(signature, "hex");

  if (
    expectedBuffer.length === 0 ||
    expectedBuffer.length !== actualBuffer.length
  ) {
    return { valid: false, reason: "malformed" };
  }

  const valid = timingSafeEqual(expectedBuffer, actualBuffer);
  return valid ? { valid } : { valid, reason: "signature_mismatch" };
}
