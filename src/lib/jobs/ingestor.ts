import { auditLoker, type SentinelInput, type SentinelOutput } from "@/lib/agents/sentinel";

export function ingestLoker(input: SentinelInput): SentinelOutput {
  return auditLoker(input);
}
