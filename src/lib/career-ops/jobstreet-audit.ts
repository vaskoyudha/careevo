/**
 * jobstreet-audit.ts — turn one Jobstreet search-API listing into the material
 * `auditLoker` judges.
 *
 * Pure on purpose: no fetch, no fs. `jobstreet-enrich.ts` owns the I/O, so all
 * of this is assertable under vitest's `node` environment.
 *
 * The load-bearing decision here is `applyUrlFromTeaser`. The trust layer judges
 * the URL we hand it, and every posting lives on the same trusted aggregator
 * host — which `ATS_DIIZINKAN` already lists, precisely so a legitimate
 * Greenhouse or Jobstreet posting does not flag on a domain mismatch. Passing
 * that host for every row would therefore make every row `clean`, and hide the
 * one signal that matters: a teaser sending the applicant to a short link off
 * the platform. So the off-platform URL wins when the teaser names one.
 *
 * The rule itself lives in `boards/url.ts` — the same one every board adapter
 * uses, so there is exactly one definition of "which url is worth judging".
 */

import { applyUrlOffPlatform } from "./boards/url";
import type { BahanAudit } from "./boards/types";

export type { BahanAudit };

/** One listing as returned by the Jobstreet v5 search endpoint. */
export interface ListingJobstreet {
  id: string;
  title: string;
  teaser: string;
  bulletPoints: string[];
  companyName: string;
  employer?: { id: string; name: string };
}

const JOBSTREET_JOB_PATH = /\/id\/job\/(\d+)(?:[/?#]|$)/;
const URL_DI_TEASER = /https?:\/\/[^\s"'<>)\]]+/i;

/** The numeric job id, or null when the url is not a Jobstreet posting. */
export function jobIdFromUrl(url: string): string | null {
  return JOBSTREET_JOB_PATH.exec(url)?.[1] ?? null;
}

/**
 * The url the applicant would actually be sent to. An off-platform link in the
 * teaser wins, because that is the url worth distrusting; anything on the
 * aggregator itself tells us nothing, so the posting url stands in.
 */
export function applyUrlFromTeaser(teaser: string, postingUrl: string): string {
  return applyUrlOffPlatform(URL_DI_TEASER.exec(teaser)?.[0], postingUrl);
}

/**
 * True when the listing names an employer a candidate could verify.
 *
 * `fallbackCompany` is the company the scan already recorded in `pipeline.md`.
 * It matters because Jobstreet's two endpoints disagree: the list endpoint (what
 * the scan reads) sometimes names a company that the single-job endpoint then
 * returns with `companyName` and `employer` both absent. That is an API
 * inconsistency, not an anonymous employer, so the scan's name is used rather
 * than quarantining a posting for the API's behaviour.
 *
 * An empty `employer.id` IS evidence of anonymity — Jobstreet sends
 * `{"id":"","name":"Private Advertiser"}` for anonymised listings — so a
 * truthy object is not on its own a verifiable employer.
 */
function employerTerverifikasi(listing: ListingJobstreet, fallbackCompany: string): boolean {
  const dariApi = (listing.companyName ?? "").trim();
  const nama = dariApi || fallbackCompany.trim();
  if (!nama) return false;
  if (/^private advertiser$/i.test(nama)) return false;
  if (dariApi && listing.employer && !listing.employer.id) return false;
  return true;
}

/** Everything `auditLoker` can be given for this listing. */
export function bahanAudit(listing: ListingJobstreet, fallbackCompany = ""): BahanAudit {
  const postingUrl = `https://id.jobstreet.com/id/job/${listing.id}`;
  const dariApi = (listing.companyName ?? "").trim();
  return {
    description: [...(listing.bulletPoints ?? []), listing.teaser ?? ""]
      .filter((part) => part && part.trim())
      .join("\n"),
    apply_url: applyUrlFromTeaser(listing.teaser ?? "", postingUrl),
    company: dariApi || fallbackCompany.trim(),
    employer_known: employerTerverifikasi(listing, fallbackCompany),
  };
}
