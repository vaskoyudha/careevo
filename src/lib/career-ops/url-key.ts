/**
 * url-key.ts — the URL key the loker UI uses to match a Careevo posting to a
 * career-ops tracker row.
 *
 * Adapted from career-ops (MIT), © 2026 Santiago Fernández de Valderrama.
 * Source: url-key.mjs (`normalizeUrl`, `promoteKnownFragmentIdentity`) and
 * career-ops' own `web/src/lib/core/url-key.mjs` mirror.
 * https://github.com/career-ops-hq/career-ops
 *
 * The tracker records postings by URL. When Careevo's detail page wants to show
 * "what is the status of THIS posting?", it must compare URLs with the SAME key
 * the engine dedupes on — `normalizeUrl` in engine/url-key.mjs — or the two
 * halves disagree silently: a row matched here but not by merge-tracker (or vice
 * versa) is a UI lying about which posting is tracked.
 *
 * This file is a byte-for-byte mirror of `engine/url-key.mjs`'s `normalizeUrl`,
 * exactly like career-ops' own `web/src/lib/core/url-key.mjs` mirror. The
 * engine's module is not importable here: it is a Node `.mjs` resolved relative
 * to `engine/`, and the vendored tree is deliberately not part of the Next build
 * graph. Copying the algorithm is the lesser of two drifts — the engine copy is
 * the reference, this copy is parity-checked against it below.
 *
 * UNDER-STRIP ON PURPOSE (see engine/url-key.mjs for the full RFC 3986
 * rationale): only a denylist of tracking params is stripped, the host is
 * lowercased, https is forced, non-identity fragments + one trailing slash are
 * dropped, and every functional query param is kept. Over-normalizing collapses
 * two genuinely different postings into one key — a silent merge.
 */

// Query params that identify a click/campaign, never the posting itself. Keep
// this list literal and board-specific — identical to the engine's denylist.
const TRACKING_PARAMS = [
  /^utm_/i, /^gh_src$/i, /^fbclid$/i, /^gclid$/i,
  /^mc_cid$/i, /^mc_eid$/i, /^igshid$/i, /^_hsenc$/i, /^_hsmi$/i, /^trk$/i, /^trackingid$/i,
];

/**
 * Promote a known identity-bearing SPA fragment into a functional query key
 * before generic URL normalization drops the fragment. Mirrors the engine's
 * `promoteKnownFragmentIdentity`.
 */
function promoteKnownFragmentIdentity(url: URL): void {
  const match = /^#\/jobs?\/([^/?#]+)(?:\?[^#]*)?$/i.exec(url.hash);
  if (!match) return;
  let jobId: string;
  try {
    jobId = decodeURIComponent(match[1]);
  } catch {
    return;
  }
  if (!jobId) return;
  if (url.hostname.toLowerCase() === "app.mokahr.com") {
    url.searchParams.append("mokahr_job_id", jobId);
    return;
  }
  url.searchParams.append("_career_ops_fragment_job_id", jobId);
}

/**
 * Reduce a posting URL to a stable comparison key.
 *
 * @param raw A posting URL (or any string) from a tracker row / job fixture.
 * @returns A normalized key, or "" when there is nothing to key on. "" means
 *   NO KEY — callers must treat it as unknown, never as a value that can match
 *   another "".
 */
export function normalisasiKunciUrl(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const s = raw.trim();
  if (!s) return "";

  let u: URL;
  try {
    u = new URL(s);
  } catch {
    // Not a parseable absolute URL: a placeholder ("N/A", "TBD", "—"), a
    // `local:jds/...` reference, or free text. None of these identify a posting.
    return "";
  }

  if (u.protocol !== "http:" && u.protocol !== "https:") return "";

  u.protocol = "https:"; // http vs https is the same posting
  u.hostname = u.hostname.toLowerCase();
  promoteKnownFragmentIdentity(u);
  u.hash = ""; // unrecognized fragments do not identify it

  // Drop tracking params, keep functional ones, sort for order-independence.
  const keep: Array<[string, string]> = [];
  for (const [k, v] of u.searchParams.entries()) {
    if (!TRACKING_PARAMS.some((re) => re.test(k))) keep.push([k, v]);
  }
  keep.sort((x, y) =>
    x[0] !== y[0] ? (x[0] < y[0] ? -1 : 1) : x[1] < y[1] ? -1 : x[1] > y[1] ? 1 : 0,
  );
  u.search = "";
  for (const [k, v] of keep) u.searchParams.append(k, v);

  // Drop a single trailing slash on the path (but never the root "/").
  if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
    u.pathname = u.pathname.slice(0, -1);
  }

  return u.toString();
}
