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
 */

/** One listing as returned by the Jobstreet v5 search endpoint. */
export interface ListingJobstreet {
  id: string;
  title: string;
  teaser: string;
  bulletPoints: string[];
  companyName: string;
  employer?: { id: string; name: string };
}

/** What `auditLoker` needs, named in the repo's Indonesian convention. */
export interface BahanAudit {
  description: string;
  apply_url: string;
  company: string;
  employer_known: boolean;
}

const JOBSTREET_JOB_PATH = /\/id\/job\/(\d+)(?:[/?#]|$)/;
const URL_DI_TEASER = /https?:\/\/[^\s"'<>)\]]+/i;
const HOST_TERPERCAYA = /(^|\.)(jobstreet\.(com|co\.id)|seek\.[a-z.]+)$/i;

/** The numeric job id, or null when the url is not a Jobstreet posting. */
export function jobIdFromUrl(url: string): string | null {
  return JOBSTREET_JOB_PATH.exec(url)?.[1] ?? null;
}

/** Host of a url, lowercased; null when it will not parse. */
function hostDari(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * The url the applicant would actually be sent to. An off-platform link in the
 * teaser wins, because that is the url worth distrusting; anything on the
 * aggregator itself tells us nothing, so the posting url stands in.
 */
export function applyUrlFromTeaser(teaser: string, postingUrl: string): string {
  const found = URL_DI_TEASER.exec(teaser)?.[0];
  if (!found) return postingUrl;
  const host = hostDari(found);
  if (!host || HOST_TERPERCAYA.test(host)) return postingUrl;
  return found;
}

/** True when the listing names an employer a candidate could verify. */
function employerTerverifikasi(listing: ListingJobstreet): boolean {
  const nama = (listing.companyName ?? "").trim();
  if (!nama) return false;
  if (/^private advertiser$/i.test(nama)) return false;
  return Boolean(listing.employer?.id);
}

/** Everything `auditLoker` can be given for this listing. */
export function bahanAudit(listing: ListingJobstreet): BahanAudit {
  const postingUrl = `https://id.jobstreet.com/id/job/${listing.id}`;
  return {
    description: [...(listing.bulletPoints ?? []), listing.teaser ?? ""]
      .filter((part) => part && part.trim())
      .join("\n"),
    apply_url: applyUrlFromTeaser(listing.teaser ?? "", postingUrl),
    company: (listing.companyName ?? "").trim(),
    employer_known: employerTerverifikasi(listing),
  };
}
