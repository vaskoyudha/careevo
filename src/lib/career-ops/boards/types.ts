/**
 * types.ts — the one contract every board adapter implements.
 *
 * `auditBaris` must never learn which board a row came from: it receives
 * `BahanAudit` and derives a verdict. Adapters are the only place board-specific
 * knowledge lives, so adding a board is adding one file, not editing a branch
 * per host.
 */

/** What `auditLoker` needs, named in the repo's Indonesian convention. */
export interface BahanAudit {
  description: string;
  apply_url: string;
  company: string;
  employer_known: boolean;
}

export type FetchJson = (
  url: string,
  init?: { headers?: Record<string, string> },
) => Promise<unknown>;

/**
 * The I/O an adapter may use. Injected rather than reached for globally — the
 * same reason `jobstreet-enrich.ts` injected `fetchJson`: it is what makes an
 * adapter testable under vitest's `node` environment with no network.
 */
export interface Io {
  fetchJson: FetchJson;
  /**
   * HTML plus the final URL after redirects. Dealls and Breezy parse the page;
   * Workable needs only `urlAkhir`, because its inbox URLs are `/j/<shortcode>`
   * and the account slug is recoverable only from the 301 target.
   */
  fetchHtml(url: string): Promise<{ html: string; urlAkhir: string }>;
}

/**
 * What the adapter may know about the inbox row it is enriching.
 *
 * `perusahaan` is the company the scan already recorded in `pipeline.md`. It is
 * the fallback when the board's own payload omits a company name — the same
 * role `fallbackCompany` plays in `bahanAudit`.
 */
export interface KonteksPapan {
  perusahaan: string;
}

/** What an adapter returns for one posting. */
export interface HasilPapan {
  bahan: BahanAudit;
  /** Occupational categories, when the board supplies them. Never inferred. */
  tags?: string[];
}

export interface PapanAdapter {
  /** "Kalibrr" — the human-readable name the UI may show. */
  nama: string;
  /** Whether this adapter owns the URL. Adapters must not overlap. */
  cocok(url: string): boolean;
  /**
   * Enrich one posting. Returns `null` when the board cannot be read — the
   * caller then leaves the row unenriched rather than guessing.
   */
  ambilDetail(
    url: string,
    io: Io,
    konteks: KonteksPapan,
  ): Promise<HasilPapan | null>;
}

/**
 * Whether a company name is one a candidate could look up.
 *
 * "Private Advertiser" is Jobstreet's anonymised-listing marker, and it is the
 * one name that is explicitly NOT verifiable. Shared by every adapter so the
 * rule has one definition rather than one per board.
 */
export function perusahaanTerkenal(nama: string | null | undefined): boolean {
  const n = (nama ?? "").trim();
  if (!n) return false;
  if (/^private advertiser$/i.test(n)) return false;
  return true;
}
