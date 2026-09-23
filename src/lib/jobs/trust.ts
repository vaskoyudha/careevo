/**
 * trust.ts — URL/domain trust validation for job postings.
 *
 * Adapted from career-ops (MIT), © 2026 Santiago Fernández de Valderrama.
 * Source: providers/_trust-validator.mjs + lib/ascii-fold.mjs
 * https://github.com/career-ops-hq/career-ops
 *
 * Why this exists alongside `auditLoker`:
 *   - `auditLoker` / `deteksiFee` read the DESCRIPTION for Indonesian recruitment
 *     scams (biaya administrasi, rekening pribadi, APK, tiket travel, …).
 *   - This module reads the APPLY URL and COMPANY name for structural trust:
 *     malformed links, link shorteners, and company↔domain mismatches.
 *
 * The two are complementary, not overlapping — career-ops' validator has no
 * Indonesian scam rules, and `deteksiFee` has no URL inspection. Merging them in
 * `auditLoker` gives a strictly stronger auditor that stays deterministic and
 * testable (no LLM, no network).
 *
 * Behavioural contract carried over from upstream: **never drops a posting, it
 * only flags**. A low score is a signal for the candidate to look closer, never
 * an accusation — the ethical framing in career-ops' modes/_shared.md applies
 * verbatim here.
 */

/** Score penalties. Values are upstream's, unchanged. */
export const PENALTI: Record<string, number> = {
  tanpa_url_lamaran: 40,
  url_tidak_valid: 50,
  link_pendek: 25,
  domain_tidak_cocok: 15,
};

/**
 * URL shorteners and form builders. A job that routes its application through one
 * of these hides its true destination, which is a standard scam pattern.
 */
export const DOMAIN_MENCURIGAKAN: readonly string[] = [
  "bit.ly",
  "tinyurl.com",
  "t.co",
  "forms.gle",
  "goo.gl",
  "shorturl.at",
  "rebrand.ly",
  "cutt.ly",
];

/**
 * Applicant-tracking systems and job boards. Postings hosted here legitimately
 * have a domain that does not contain the company name, so the company↔domain
 * check is skipped for them (otherwise every Greenhouse posting would flag).
 */
export const ATS_DIIZINKAN: readonly string[] = [
  "greenhouse.io",
  "ashbyhq.com",
  "lever.co",
  "workday.com",
  "smartrecruiters.com",
  "jobvite.com",
  "myworkdayjobs.com",
  "recruitee.com",
  "workable.com",
  "icims.com",
  "taleo.net",
  "applytojob.com",
  "breezy.hr",
  "jazz.co",
  "bamboohr.com",
  "teamtailor.com",
  // Indonesian boards — added for Careevo; upstream has no ID entries here.
  "glints.com",
  "jobstreet.co.id",
  "jobstreet.com",
  "kalibrr.com",
];

export type TrustLevel = "high" | "medium" | "low";

export interface TrustInput {
  /** The application URL. May be absent. */
  url?: string | null;
  /** The employer name, used for the company↔domain check. */
  company?: string | null;
}

export interface TrustResult {
  /** 0–100. 100 = nothing suspicious found. */
  score: number;
  /** Flag ids; empty when nothing fired. */
  flags: string[];
  level: TrustLevel;
}

export const LABEL_KEPERCAYAAN: Record<string, string> = {
  tanpa_url_lamaran: "Tidak ada URL lamaran",
  url_tidak_valid: "URL lamaran tidak valid",
  link_pendek: "Lamaran lewat link pendek",
  domain_tidak_cocok: "Domain tidak cocok dengan nama perusahaan",
};

export function klasifikasiLevel(score: number): TrustLevel {
  if (score >= 90) return "high";
  if (score >= 60) return "medium";
  return "low";
}

export function urlValid(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/** True when `hostname` is, or is a subdomain of, any entry in `daftar`. */
export function cocokDaftarDomain(hostname: string, daftar: readonly string[]): boolean {
  for (const domain of daftar) {
    if (hostname === domain || hostname.endsWith("." + domain)) return true;
  }
  return false;
}

/**
 * Latin letters that do NOT decompose under NFD, so stripping combining marks
 * alone still deletes them. Upstream's table, unchanged — the stroke/bar is part
 * of the glyph, not a combining mark.
 */
const LATIN_NON_DEKOMPOSISI: ReadonlyArray<readonly [RegExp, string]> = [
  [/ø/g, "o"], [/æ/g, "ae"], [/œ/g, "oe"], [/ß/g, "ss"],
  [/đ/g, "d"], [/ł/g, "l"], [/þ/g, "th"], [/ð/g, "d"],
  [/ħ/g, "h"], [/ı/g, "i"], [/ŋ/g, "ng"], [/ŧ/g, "t"],
  [/ĸ/g, "k"], [/ſ/g, "s"],
];

/**
 * Lowercase and fold a name to ASCII letters, digits and single spaces.
 *
 * `punctuation: "delete"` is the mode the hostname comparison needs (and the one
 * upstream uses here). It matters: turning punctuation into a separator would
 * CREATE words that were never there — "Smith&Jones" → [smith, jones] — and
 * `smith` substring-matches smithfield.com, so a mismatch that should be flagged
 * would silently pass. On a legitimacy check, the flag NOT firing is the costly
 * failure, so fewer false penalties is the safe direction.
 *
 * Returns "" when nothing Latin survives (CJK, Cyrillic, Greek).
 */
export function foldAsciiUntukHostname(value: string): string {
  let out = String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}+/gu, "");
  for (const [re, to] of LATIN_NON_DEKOMPOSISI) out = out.replace(re, to);
  out = out.replace(/[^a-z0-9 ]/g, "");
  return out.replace(/\s+/g, " ").trim();
}

/**
 * Heuristic: does the company name plausibly match the URL hostname?
 *
 * Returns true when a match is found (= no mismatch flag needed). Returns true
 * when either side is unusable — "can't evaluate" must never read as "mismatch".
 * A non-Latin company name folds to "" and therefore always passes: hostnames are
 * effectively ASCII, so such a name can never appear in one, and flagging it would
 * trade a silent skip for a systematic false positive.
 */
export function perusahaanCocokHostname(company: string, hostname: string): boolean {
  if (!company || !hostname) return true;

  const normalized = foldAsciiUntukHostname(company);
  if (!normalized) return true;

  const slug = normalized.replace(/\s+/g, "");
  if (hostname.includes(slug)) return true;

  const words = normalized.split(/\s+/).filter((w) => w.length >= 3);
  for (const word of words) {
    if (hostname.includes(word)) return true;
  }

  return false;
}

/**
 * Validate a posting's URL + company against the trust rules.
 *
 * Mirrors upstream's `buildTrustValidator` with the default config. A disabled
 * variant is not needed in Careevo — this always runs.
 */
export function nilaiKepercayaan(input: TrustInput): TrustResult {
  const flags: string[] = [];
  let score = 100;

  const url = typeof input.url === "string" ? input.url.trim() : "";

  // Rule 1 — no URL at all. Note this is a confidence signal, not a fraud signal:
  // the fixture postings legitimately carry no apply_url, so callers must not let
  // this flag alone change a Sentinel verdict (see auditLoker).
  if (!url) {
    flags.push("tanpa_url_lamaran");
    score -= PENALTI.tanpa_url_lamaran;
    const clamped = Math.max(0, score);
    return { score: clamped, flags, level: klasifikasiLevel(clamped) };
  }

  // Rule 2 — malformed URL. Cannot parse a hostname, so stop here.
  if (!urlValid(url)) {
    flags.push("url_tidak_valid");
    score -= PENALTI.url_tidak_valid;
    const clamped = Math.max(0, score);
    return { score: clamped, flags, level: klasifikasiLevel(clamped) };
  }

  let hostname = "";
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    const clamped = Math.max(0, score);
    return { score: clamped, flags, level: klasifikasiLevel(clamped) };
  }

  // Rule 3 — shortener / form builder.
  if (cocokDaftarDomain(hostname, DOMAIN_MENCURIGAKAN)) {
    flags.push("link_pendek");
    score -= PENALTI.link_pendek;
  }

  // Rule 4 — company ↔ domain mismatch, skipped for ATS-hosted URLs.
  const company = typeof input.company === "string" ? input.company.trim() : "";
  if (company && !cocokDaftarDomain(hostname, ATS_DIIZINKAN)) {
    if (!perusahaanCocokHostname(company, hostname)) {
      flags.push("domain_tidak_cocok");
      score -= PENALTI.domain_tidak_cocok;
    }
  }

  score = Math.max(0, Math.min(100, score));
  return { score, flags, level: klasifikasiLevel(score) };
}

/**
 * Trust flags strong enough to corroborate a content signal.
 *
 * `domain_tidak_cocok` is deliberately NOT here. It is the weakest rule (a
 * 15-point penalty) and the most false-positive-prone: a company legitimately
 * applying through an ATS we don't list looks identical to a mismatch. It can
 * quarantine, but it must not combine with a single fee flag to reject.
 *
 * `tanpa_url_lamaran` is excluded for a different reason — it means "we don't
 * know", not "this is suspicious", and letting it count would quarantine every
 * posting that simply omits a link.
 */
export const FLAG_KEPERCAYAAN_KUAT: readonly string[] = ["url_tidak_valid", "link_pendek"];
