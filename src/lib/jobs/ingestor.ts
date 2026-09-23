import { auditLoker, type SentinelInput, type SentinelOutput } from "@/lib/agents/sentinel";

/**
 * Ingest a raw loker posting into the audit pipeline.
 *
 * This is the single entry point for turning untrusted source data into a
 * Sentinel verdict. It exists so callers (a future live scan, a cache warm, a
 * verifikator re-audit) share one definition of "ingested" rather than each
 * calling `auditLoker` directly and drifting.
 */
export function ingestLoker(input: SentinelInput): SentinelOutput {
  return auditLoker(input);
}

/**
 * The subset of a raw posting this pipeline needs. Kept narrow on purpose: a
 * source may carry a dozen extra fields, and none of them should reach the audit.
 */
export interface LokerMentah {
  title: string;
  company: string;
  description: string;
  apply_url?: string | null;
  company_email?: string | null;
  domain_age_days?: number | null;
}

/**
 * Narrow a raw source record to the audit's input shape, defaulting every
 * optional field to null. Coercion lives here so `auditLoker` never has to
 * defend against `undefined`.
 */
export function normalisasiLokerMentah(raw: LokerMentah): SentinelInput {
  return {
    title: raw.title ?? "",
    company: raw.company ?? "",
    description: raw.description ?? "",
    apply_url: raw.apply_url ?? null,
    company_email: raw.company_email ?? null,
    domain_age_days: raw.domain_age_days ?? null,
  };
}
