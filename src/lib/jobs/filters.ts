/**
 * filters.ts — pure job-filter predicates for the loker board.
 *
 * Adapted from career-ops (MIT), © 2026 Santiago Fernández de Valderrama.
 * Source: scan.mjs — buildLocationFilter / buildContentFilter / buildSalaryFilter
 * https://github.com/career-ops-hq/career-ops
 *
 * The board previously filtered on ONE dimension (a location substring). These
 * builders restore the tiered, word-boundary semantics that make the filters
 * actually correct:
 *
 *   - Location: block_hard > always_allow > block > allow, with word boundaries.
 *     Plain `String.includes` is wrong because city/country names are prefixes of
 *     unrelated place names — blocking "india" also rejects "Indianapolis".
 *   - Content: reject/require keyword lists over the description.
 *   - Salary: range-overlap, so a posting is dropped only when it is entirely
 *     outside the requested band.
 *
 * Every filter follows upstream's "don't penalize missing data" convention: an
 * absent or unparseable field PASSES. Filtering must never silently hide a real
 * posting because the source omitted a field.
 */

// ── shared helpers ──────────────────────────────────────────────────

/**
 * Normalize a keyword list: tolerates a bare string, null/undefined, and
 * non-string entries. An empty keyword is dropped — `includes("")` matches
 * everything and would silently bypass every other tier.
 */
function normalisasiDaftarKata(value: unknown): string[] {
  if (value == null) return [];
  const arr = Array.isArray(value) ? value : [value];
  return arr
    .filter((k): k is string => typeof k === "string")
    .map((k) => k.toLowerCase().trim())
    .filter(Boolean);
}

/**
 * Compile a keyword into a word-boundary matcher.
 *
 * Lookarounds rather than `\b` so keywords starting or ending with punctuation
 * still anchor correctly — `\b` is defined against ASCII `\w` and behaves
 * surprisingly at a punctuation edge.
 */
function kompilasiKataLokasi(keyword: string): (lower: string) => boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const startsWord = /[a-z0-9]/.test(keyword[0]);
  const endsWord = /[a-z0-9]/.test(keyword[keyword.length - 1]);
  const prefix = startsWord ? "(?<![a-z0-9])" : "";
  const suffix = endsWord ? "(?![a-z0-9])" : "";
  const re = new RegExp(`${prefix}${escaped}${suffix}`);
  return (lower) => re.test(lower);
}

// ── location filter ─────────────────────────────────────────────────

export interface LocationFilterConfig {
  /** Reject — the only tier `always_allow` cannot override. Country-level terms. */
  block_hard?: unknown;
  /** Pass, taking precedence over `block`. */
  always_allow?: unknown;
  /** Reject. */
  block?: unknown;
  /** When non-empty, at least one must match. */
  allow?: unknown;
}

export type LocationFilter = (location: string | null | undefined) => boolean;

/**
 * Tiered location filter, mirroring scan.mjs's `buildLocationFilter`.
 *
 * Order: block_hard → always_allow → block → allow. `always_allow` wins over
 * `block` so a multi-location posting ("Remote · Jakarta · Singapore") survives
 * one blocked city; `block_hard` exists for country-level terms that are never a
 * false rejection and that `always_allow` must not rescue.
 */
export function buatFilterLokasi(config?: LocationFilterConfig | null): LocationFilter {
  if (!config) return () => true;

  const alwaysAllow = normalisasiDaftarKata(config.always_allow).map(kompilasiKataLokasi);
  const blockHard = normalisasiDaftarKata(config.block_hard).map(kompilasiKataLokasi);
  const block = normalisasiDaftarKata(config.block).map(kompilasiKataLokasi);
  const allow = normalisasiDaftarKata(config.allow).map(kompilasiKataLokasi);

  return (location) => {
    const lower = typeof location === "string" ? location.trim().toLowerCase() : "";
    // Nothing to judge → pass. Never penalize missing source data.
    if (lower === "") return true;

    if (blockHard.length > 0 && blockHard.some((m) => m(lower))) return false;
    if (alwaysAllow.length > 0 && alwaysAllow.some((m) => m(lower))) return true;
    if (block.length > 0 && block.some((m) => m(lower))) return false;
    if (allow.length === 0) return true;
    return allow.some((m) => m(lower));
  };
}

// ── content filter ──────────────────────────────────────────────────

export interface ContentFilterConfig {
  /** Reject when any matches. */
  negative?: unknown;
  /** When non-empty, at least one must match. */
  positive?: unknown;
}

export type ContentFilter = (description: string | null | undefined) => boolean;

/**
 * Keyword filter over the posting description. Plain substring matching is
 * correct here (no word-boundary anchoring), matching upstream's semantics: the
 * content filter is a coarse screen, unlike the location filter where prefix
 * collisions are the known failure mode.
 */
export function buatFilterKonten(config?: ContentFilterConfig | null): ContentFilter {
  if (!config) return () => true;

  const positive = normalisasiDaftarKata(config.positive);
  const negative = normalisasiDaftarKata(config.negative);

  return (description) => {
    if (typeof description !== "string" || description.trim() === "") return true;
    const lower = description.toLowerCase();

    if (negative.length > 0 && negative.some((k) => lower.includes(k))) return false;
    if (positive.length === 0) return true;
    return positive.some((k) => lower.includes(k));
  };
}

// ── salary filter ───────────────────────────────────────────────────

export interface RentangGaji {
  min: number | null;
  max: number | null;
  currency?: string | null;
}

export interface SalaryFilterConfig {
  min?: number;
  max?: number;
  currency?: string;
}

export type SalaryFilter = (salary: RentangGaji | null | undefined) => boolean;

/**
 * Range-overlap salary filter: a posting is rejected ONLY when it lies entirely
 * outside the requested band. Rejecting on non-overlap rather than containment is
 * deliberate — a wider posting band still contains acceptable offers.
 *
 * Currency is compared only when BOTH sides declare one, so a filter in IDR does
 * not silently drop every posting whose source omits the currency.
 */
export function buatFilterGaji(config?: SalaryFilterConfig | null): SalaryFilter {
  if (!config) return () => true;

  const min = Number(config.min ?? 0);
  const max = Number(config.max ?? 0);
  const currency = (config.currency || "").trim().toUpperCase();

  if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < 0) {
    return () => true;
  }
  if (max > 0 && min > max) return () => true;
  if (min === 0 && max === 0) return () => true;

  return (salary) => {
    if (!salary) return true;

    const jobMin = salary.min ?? salary.max ?? null;
    const jobMax = salary.max ?? salary.min ?? null;
    if (jobMin == null && jobMax == null) return true;

    const jobCurrency = (salary.currency || "").trim().toUpperCase();
    if (currency && jobCurrency && currency !== jobCurrency) return false;

    if (min > 0 && jobMax != null && jobMax < min) return false;
    if (max > 0 && jobMin != null && jobMin > max) return false;

    return true;
  };
}

/**
 * Parse a salary string in the fixture format ("Rp6-8 jt", "Rp10-14 jt") into a
 * numeric IDR range. Returns null when the string is absent or unrecognized —
 * callers treat null as "no data" and pass it through the filter.
 *
 * Units: "jt" (juta) = 1e6, "rb" (ribu) = 1e3. Ranges are inclusive bounds.
 */
export function parseRentangGaji(teks: string | null | undefined): RentangGaji | null {
  if (typeof teks !== "string" || teks.trim() === "") return null;

  const lower = teks.toLowerCase();
  const angka = lower.match(/\d+(?:[.,]\d+)?/g);
  if (!angka || angka.length === 0) return null;

  const skala = /jt|juta/.test(lower) ? 1_000_000 : /rb|ribu/.test(lower) ? 1_000 : 1;
  const nilai = angka.map((n) => Number(n.replace(",", ".")) * skala).filter((n) => Number.isFinite(n));
  if (nilai.length === 0) return null;

  return {
    min: Math.min(...nilai),
    max: Math.max(...nilai),
    currency: "IDR",
  };
}
