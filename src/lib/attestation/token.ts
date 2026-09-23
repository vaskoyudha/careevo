import { signPayload, type AttestationPayload } from "./sign";

export const ATTESTATION_MAX_AGE_DAYS = 365;
export const ATTESTATION_MAX_AGE_MS =
  ATTESTATION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

export interface DecodedAttestation {
  payload: AttestationPayload;
  signature: string;
}

export function getAttestationSecret(): string {
  return process.env.ATTESTATION_SECRET ?? "dev-attestation-secret";
}

export function encodeToken(
  payload: AttestationPayload,
  signature: string,
): string {
  const json = JSON.stringify({ payload, signature });
  return Buffer.from(json, "utf8").toString("base64url");
}

function isAttestationPayload(value: unknown): value is AttestationPayload {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.username === "string" &&
    typeof candidate.task_id === "string" &&
    typeof candidate.task_title === "string" &&
    typeof candidate.track === "string" &&
    typeof candidate.level === "string" &&
    typeof candidate.score === "number" &&
    typeof candidate.issued_at === "string"
  );
}

export function decodeToken(token: string): DecodedAttestation | null {
  if (!token) return null;
  try {
    const json = Buffer.from(token, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;

    const candidate = parsed as Record<string, unknown>;
    if (!isAttestationPayload(candidate.payload)) return null;
    if (typeof candidate.signature !== "string" || candidate.signature.length === 0) {
      return null;
    }

    return { payload: candidate.payload, signature: candidate.signature };
  } catch {
    return null;
  }
}

export function isExpired(
  payload: AttestationPayload,
  now: number = Date.now(),
): boolean {
  const issued = Date.parse(payload.issued_at);
  if (Number.isNaN(issued)) return true;
  return now - issued > ATTESTATION_MAX_AGE_MS;
}

export function buildToken(
  payload: AttestationPayload,
  secret: string = getAttestationSecret(),
): string {
  return encodeToken(payload, signPayload(payload, secret));
}

export const DEMO_ATTESTATION_PAYLOAD: AttestationPayload = {
  username: "nadia.dev",
  task_id: "task-web-001",
  task_title: "Rebuild Challenge: Async Pagination",
  track: "Web Dev",
  level: "menengah",
  score: 87,
  issued_at: "2026-09-21T00:00:00.000Z",
};
