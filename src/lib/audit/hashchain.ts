import { createHash } from "node:crypto";

export function computeEntryHash(prevHash: string | null, payload: unknown): string {
  return createHash("sha256")
    .update(`${prevHash ?? "genesis"}:${JSON.stringify(payload)}`)
    .digest("hex");
}
