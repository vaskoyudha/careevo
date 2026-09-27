/**
 * url.ts — host and apply-URL helpers shared by the adapters.
 *
 * The load-bearing rule is `applyUrlOffPlatform`. The trust layer judges the URL
 * it is handed, and every board's own posting URL lives on a host that
 * `ATS_DIIZINKAN` already lists — so passing it makes every row `clean` and
 * hides the one signal that matters: a posting that sends the applicant to a
 * short link off the platform. The off-platform URL therefore wins when the
 * board names one.
 */

/** Lowercased hostname, or "" when the string will not parse. */
export function hostDari(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

/**
 * Hosts whose own URL carries no signal: the board/ATS host is listed in
 * `ATS_DIIZINKAN`, so a company↔domain check against it is skipped and a
 * shortener check against it is meaningless.
 */
const HOST_PAPAN =
  /(^|\.)(jobstreet\.(com|co\.id)|seek\.[a-z.]+|kalibrr\.com|workable\.com|smartrecruiters\.com|breezy\.hr|dealls\.com|sejutacita\.id)$/i;

/** The URL worth judging: an off-platform candidate, else the posting URL. */
export function applyUrlOffPlatform(
  kandidat: string | null | undefined,
  postingUrl: string,
): string {
  const k = (kandidat ?? "").trim();
  if (!k) return postingUrl;
  let u: URL;
  try {
    u = new URL(k);
  } catch {
    return postingUrl;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return postingUrl;
  if (HOST_PAPAN.test(u.hostname.toLowerCase())) return postingUrl;
  return k;
}
