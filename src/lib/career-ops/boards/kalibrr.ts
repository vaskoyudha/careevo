/**
 * kalibrr.ts — the Kalibrr adapter.
 *
 * Kalibrr's search API has a `description` field, but it is a *global* search:
 * `company_code` and `job_id` are silently ignored (verified live — both return
 * unrelated employers), and only `company=<code>` scopes it. A company can also
 * exceed one page (a measured account has 188 postings), so a feed read needs
 * pagination for no benefit. The posting page is server-rendered with the full
 * text in `__NEXT_DATA__`, so one fetch per row is both simpler and complete.
 */

import { htmlKeTeks, ambilNextData } from "./html";
import { applyUrlOffPlatform, hostDari } from "./url";
import { perusahaanTerkenal, type HasilPapan, type PapanAdapter } from "./types";

/** `/c/<company-code>/jobs/<id>/<slug>` — the shape the scan records. */
const BAGIAN_URL = /^https?:\/\/(?:www\.)?kalibrr\.com\/c\/([^/]+)\/jobs\/(\d+)(?:\/([^/?#]+))?/i;

interface KalibrrJob {
  id?: number | string | null;
  slug?: string | null;
  name?: string | null;
  description?: string | null;
  qualifications?: string | null;
  // Live `__NEXT_DATA__` uses camelCase here (`applyRedirectUrl`); the older
  // design doc's `apply_redirect_url` does not exist on the payload.
  applyRedirectUrl?: string | null;
  function?: string | null;
  company?: { code?: string; name?: string } | null;
}

export const kalibrr: PapanAdapter = {
  nama: "Kalibrr",
  cocok: (url) => /(^|\.)kalibrr\.com$/i.test(hostDari(url)),

  async ambilDetail(url, io, konteks): Promise<HasilPapan | null> {
    if (!BAGIAN_URL.test(url)) return null;

    const { html } = await io.fetchHtml(url);
    const nd = ambilNextData(html) as
      | { props?: { pageProps?: { job?: KalibrrJob } } }
      | null;
    const job = nd?.props?.pageProps?.job;
    if (!job) return null;

    const description = [job.description, job.qualifications]
      .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
      .map(htmlKeTeks)
      .filter(Boolean)
      .join("\n");
    if (!description) return null;

    const nama = (job.company?.name ?? "").trim();
    const perusahaan = nama || konteks.perusahaan;

    return {
      bahan: {
        description,
        apply_url: applyUrlOffPlatform(job.applyRedirectUrl, url),
        company: perusahaan,
        employer_known: perusahaanTerkenal(perusahaan),
      },
      tags: [job.function].filter((t): t is string => typeof t === "string" && t.trim() !== ""),
    };
  },
};
