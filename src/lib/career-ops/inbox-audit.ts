/**
 * inbox-audit.ts — derive a Sentinel verdict for every inbox row.
 *
 * Two rules govern this file, and both exist because of a way the obvious
 * implementation lies:
 *
 *  1. A row we could not enrich is NEVER reported `clean`. "We could not check"
 *     and "nothing is wrong" are different answers, and collapsing them would
 *     put a reassuring badge over a posting nobody inspected. Unenriched rows
 *     are `quarantined` with `enriched: false`, so the UI can say "belum
 *     diperiksa" rather than "aman".
 *  2. A row with no Jobstreet id is left alone rather than judged against a
 *     listing that does not exist. A Western ATS posting is not a failure of
 *     this enrichment; it is simply out of scope.
 *
 * Verdicts are computed here and returned beside the row. Nothing is written
 * back to `pipeline.md` — a verdict derived from a cache that can be deleted
 * must not become state that cannot be.
 */

import { auditLoker, type SentinelOutput } from "@/lib/agents/sentinel";
import { bahanAudit, jobIdFromUrl, type ListingJobstreet } from "./jobstreet-audit";
import type { InboxJobShape } from "./pipeline-table";

export type BarisDiaudit = InboxJobShape & { audit: SentinelOutput; enriched: boolean };

/**
 * The verdict for a row whose listing we could not read.
 *
 * `data_tidak_terverifikasi` is deliberately its own id rather than a reuse of
 * `perusahaan_tidak_terverifikasi`: "we could not fetch this" is not a claim
 * about the employer, and merging them would tell a learner their posting was
 * rejected when the truth is that we did not look.
 */
function takTeraudit(): SentinelOutput {
  return {
    status: "quarantined",
    flags: ["data_tidak_terverifikasi"],
    fee_flags: [],
    trust_flags: [],
    trust_score: 0,
    trust_level: "low",
  };
}

export function auditBaris(
  rows: InboxJobShape[],
  listings: Record<string, ListingJobstreet>,
): BarisDiaudit[] {
  return rows.map((row) => {
    const jobId = jobIdFromUrl(row.url);
    const listing = jobId ? listings[jobId] : undefined;

    if (!jobId || !listing) {
      return { ...row, audit: takTeraudit(), enriched: false };
    }

    // The pipeline row's company is the fallback: Jobstreet's single-job
    // endpoint sometimes omits what its list endpoint recorded.
    const bahan = bahanAudit(listing, row.company);
    return {
      ...row,
      audit: auditLoker({
        title: row.role,
        company: bahan.company || row.company,
        description: bahan.description,
        apply_url: bahan.apply_url,
        company_email: null,
        domain_age_days: null,
        employer_known: bahan.employer_known,
      }),
      enriched: true,
    };
  });
}
