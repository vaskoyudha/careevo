/**
 * dealls.ts — the Dealls adapter.
 *
 * Dealls (dealls.com, formerly SejutaCita) has no per-posting JSON endpoint: its
 * explore-job API's list documents carry no description. The posting page is
 * server-rendered, and its `__NEXT_DATA__` payload holds `responsibilities` and
 * `requirements`. One fetch per row.
 *
 * The slug in `pipeline.md` is `~<company-slug>`; the page 307-redirects a stale
 * company slug to the current one, so the fetch follows redirects and the final
 * URL is not load-bearing here.
 */

import { ambilNextData, htmlKeTeks } from "./html";
import { applyUrlOffPlatform, hostDari } from "./url";
import { perusahaanTerkenal, type HasilPapan, type PapanAdapter } from "./types";

const BAGIAN_URL = /^https?:\/\/dealls\.com\/loker\/([^~?#]+)(?:~([^?#]+))?/i;

interface DeallsData {
  responsibilities?: string | null;
  requirements?: string | null;
  externalPlatformApplyUrl?: string | null;
  company?: { name?: string } | null;
  jobRoleCategorySlug?: string | null;
  categorySlug?: string | null;
}

/**
 * The first dehydrated query that carries job text. Picking `queries[0]`
 * positionally would break the moment Dealls reorders its prefetches; the shape
 * is the contract, not the index.
 */
function cariDataJob(nd: unknown): DeallsData | null {
  const queries = (nd as { props?: { pageProps?: { dehydratedState?: { queries?: unknown[] } } } })
    ?.props?.pageProps?.dehydratedState?.queries;
  if (!Array.isArray(queries)) return null;
  for (const q of queries) {
    const data = (q as { state?: { data?: unknown } })?.state?.data as DeallsData | undefined;
    if (data && (typeof data.responsibilities === "string" || typeof data.requirements === "string")) {
      return data;
    }
  }
  return null;
}

export const dealls: PapanAdapter = {
  nama: "Dealls",
  cocok: (url) => /(^|\.)dealls\.com$/i.test(hostDari(url)),

  async ambilDetail(url, io, konteks): Promise<HasilPapan | null> {
    if (!BAGIAN_URL.test(url)) return null;

    const { html } = await io.fetchHtml(url);
    const data = cariDataJob(ambilNextData(html));
    if (!data) return null;

    const description = [data.responsibilities, data.requirements]
      .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
      .map(htmlKeTeks)
      .filter(Boolean)
      .join("\n");
    if (!description) return null;

    const nama = (data.company?.name ?? "").trim();
    const perusahaan = nama || konteks.perusahaan;

    return {
      bahan: {
        description,
        apply_url: applyUrlOffPlatform(data.externalPlatformApplyUrl, url),
        company: perusahaan,
        employer_known: perusahaanTerkenal(perusahaan),
      },
      tags: [data.jobRoleCategorySlug, data.categorySlug].filter(
        (t): t is string => typeof t === "string" && t.trim() !== "",
      ),
    };
  },
};
