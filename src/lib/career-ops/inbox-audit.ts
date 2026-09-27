/**
 * inbox-audit.ts — derive a Sentinel verdict for every inbox row.
 *
 * Three rules govern this file, and each exists because of a way the obvious
 * implementation lies:
 *
 *  1. A row we could not enrich is NEVER reported `clean`. "We could not check"
 *     and "nothing is wrong" are different answers, and collapsing them would
 *     put a reassuring badge over a posting nobody inspected. Unenriched rows
 *     are `quarantined` with `enriched: false`, so the UI can say "belum
 *     diperiksa" rather than "aman".
 *  2. A row no board claims is left alone rather than judged against material
 *     that does not exist. A posting on a board we do not read is not a failure
 *     of this audit; it is simply out of scope.
 *  3. This module does not know which board a row came from. It receives
 *     `BahanAudit` and derives a verdict — the board registry is the only place
 *     board knowledge lives. `papan` is attached by the caller for display.
 *
 * Verdicts are computed here and returned beside the row. Nothing is written
 * back to `pipeline.md` — a verdict derived from a cache that can be deleted
 * must not become state that cannot be.
 */

import { auditLoker, type SentinelOutput } from "@/lib/agents/sentinel";
import type { IsiCache } from "./job-cache";
import type { InboxJobShape } from "./pipeline-table";
import { normalisasiKunciUrl } from "./url-key";

export type BarisDiaudit = InboxJobShape & {
  audit: SentinelOutput;
  enriched: boolean;
  /** The board the row came from, for the "belum diperiksa" copy. Display only. */
  papan?: string;
};

/**
 * The verdict for a row whose material we could not read.
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

export function auditBaris(rows: InboxJobShape[], cache: IsiCache): BarisDiaudit[] {
  return rows.map((row) => {
    const kunci = normalisasiKunciUrl(row.url);
    // "" means NO KEY — never a value that can match another "". A row whose URL
    // will not normalize is unenriched, not a cache hit on the empty string.
    const entri = kunci ? cache[kunci] : undefined;

    if (!entri) {
      return { ...row, audit: takTeraudit(), enriched: false };
    }

    // The pipeline row's company is the fallback: a board's detail payload
    // sometimes omits what its list endpoint recorded.
    const bahan = entri.bahan;
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
