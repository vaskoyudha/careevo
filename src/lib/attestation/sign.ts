import { createHmac } from "node:crypto";

export interface AttestationPayload {
  username: string;
  task_id: string;
  task_title: string;
  track: string;
  level: string;
  score: number;
  issued_at: string;
}

export function canonicalize(payload: AttestationPayload): string {
  const keys = Object.keys(payload).sort() as Array<keyof AttestationPayload>;
  const sorted = Object.fromEntries(keys.map((key) => [key, payload[key]]));
  return JSON.stringify(sorted);
}

export function signPayload(
  payload: AttestationPayload,
  secret: string,
): string {
  return createHmac("sha256", secret)
    .update(canonicalize(payload))
    .digest("hex");
}
