/**
 * match-tracker.ts — resolve a Careevo job posting to the tracker row that
 * describes it.
 *
 * The canonical file is `.data/career-ops/data/applications.md`. A row there is
 * a DIFFERENT artifact from a Careevo `JobFixture`; this module is the one place
 * that maps between them.
 *
 * The matching precedence mirrors the engine's own dedup precedence:
 *   merge-tracker.mjs matches on the posting URL FIRST (normalized), then on
 *   report/entry numbers, then on fuzzy company+role. The loker detail page only
 *   ever has a URL, a company and a role in hand, so the tiers that apply are:
 *
 *   1. URL — the deterministic dedup key. Compared with the engine's own
 *      `normalizeUrl` (mirrored in url-key.ts). A confirmed URL match is
 *      authoritative; a confirmed mismatch proves the rows are NOT duplicates,
 *      so the fallback tiers must not override it.
 *   2. Company + role — only when at least one side carries no usable URL. The
 *      engine's own `roleFuzzyMatch` rules are deliberately NOT reimplemented
 *      for status display: the only row this UI is allowed to EDIT is the one
 *      the engine itself would have deduped to. A fuzzy role mirror here would
 *      be the second implementation the web/AGENTS.md warns about, and the
 *      failure is silent — the UI editing a sibling requisition's status.
 *      Exact normalized title equality is the whole fallback, so a UI edit can
 *      only land where the engine's own fuzzy matcher would also land (fuzzy
 *      match is a superset of exact match).
 *
 * The matching is read-only and used both to DISPLAY a row's status and to
 * choose the row a status transition writes to. The write itself always goes
 * through `set-status.mjs` (see tracker.ts `ubahStatus`), which re-resolves the
 * row by number and re-validates the state — never a hand-edit.
 *
 * Adapted from career-ops (MIT), © 2026 Santiago Fernández de Valderrama.
 * Source: merge-tracker.mjs (Pass 0 dedup precedence) + tracker-parse.mjs
 * (`normalizeTextKey`, mirrored below as `kunciTeks`).
 * https://github.com/career-ops-hq/career-ops
 */

import type { BarisTracker } from "./types";
import { normalisasiKunciUrl } from "./url-key";

/** Whether the tracker emitted a URL column worth consulting. */
function punyaUrlBaris(row: BarisTracker): boolean {
  return typeof row.url === "string" && normalisasiKunciUrl(row.url) !== "";
}

/**
 * Find the tracker row that describes the same posting as the given job.
 *
 * @returns The matched row, or null when the posting is not yet tracked.
 */
export function cariBarisTracker(
  rows: BarisTracker[],
  job: { company: string; title: string; apply_url?: string | null },
): BarisTracker | null {
  const kunciJob = normalisasiKunciUrl(job.apply_url ?? "");
  const berUrl = kunciJob !== "";

  if (berUrl) {
    // URL tier is authoritative both ways: a row sharing the key IS the same
    // posting; a row whose URL key differs is PROOF of a different posting.
    const samaUrl = rows.filter((row) => normalisasiKunciUrl(row.url) === kunciJob);
    if (samaUrl.length === 1) return samaUrl[0];
    if (samaUrl.length > 1) return samaUrl[0]; // duplicate URL rows: display is still well-defined
    if (rows.some(punyaUrlBaris)) {
      // We have a URL but none of the URL-bearing rows share it — a confirmed
      // non-match. Do not let the fuzzy tier override what the engine treats
      // as proof of difference.
      return null;
    }
    // No row carries a URL: fall through to the company+role tier.
  }

  // Company+role tier. Exact normalized title only — see the module docstring
  // for why a fuzzy-role mirror is deliberately absent.
  const roleJob = kunciTeks(job.title);
  const companyJob = kunciTeks(job.company);
  const samaCompany = rows.filter((row) => kunciTeks(row.company) === companyJob);
  if (samaCompany.length === 0) return null;
  const samaRole = samaCompany.filter((row) => kunciTeks(row.role) === roleJob);
  if (samaRole.length === 1) return samaRole[0];

  // Same company, ambiguous role. Display the first row (the UI shows one card
  // per posting); an EDIT is refused server-side unless the row number is
  // unambiguous, so this leniency can never write to the wrong sibling req.
  return samaCompany[0];
}

/**
 * Fold text the way the engine's `normalizeTextKey` does (tracker-parse.mjs):
 * NFKC, lowercase, strip punctuation, keep letters/marks/digits of any script.
 * A subset of that rule is enough for comparing company/role equality on the
 * read path; the engine re-checks with its own function before any write.
 */
export function kunciTeks(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/̇/gu, "")
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, "")
    .trim();
}
