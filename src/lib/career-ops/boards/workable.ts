/**
 * workable.ts — the Workable adapter.
 *
 * Two requests per row, and the reason is in the URL the scan records. Workable
 * postings are written to `pipeline.md` as `apply.workable.com/j/<shortcode>` —
 * the account slug is not there. `GET /j/<shortcode>` 301s to
 * `/<slug>/j/<shortcode>`, and only the per-account endpoint
 * (`/api/v1/accounts/<slug>/jobs/<shortcode>`) carries the description:
 * `/api/v1/jobs/<shortcode>` answers 404, and the account widget's list omits
 * `description` unless `?details=true` is set, which returns the whole account.
 *
 * So the redirect is not an extra hop we could skip by cleverness — it is the
 * only way to learn the slug the detail endpoint needs.
 */

import { htmlKeTeks } from "./html";
import { applyUrlOffPlatform, hostDari } from "./url";
import { perusahaanTerkenal, type HasilPapan, type PapanAdapter } from "./types";

const HOST = "apply.workable.com";

/** `/j/<shortcode>` or `/<slug>/j/<shortcode>`. */
const SHORTCODE = /^https?:\/\/apply\.workable\.com\/(?:[A-Za-z0-9_-]+\/)?j\/([A-Za-z0-9]+)/i;
const SLUG = /^https?:\/\/apply\.workable\.com\/([A-Za-z0-9][A-Za-z0-9_-]*)\/j\//i;

interface WorkableJob {
  description?: string | null;
  requirements?: string | null;
  application_url?: string | null;
}

export const workable: PapanAdapter = {
  nama: "Workable",
  cocok: (url) => hostDari(url) === HOST,

  async ambilDetail(url, io, konteks): Promise<HasilPapan | null> {
    const shortcode = SHORTCODE.exec(url)?.[1];
    if (!shortcode) return null;

    let slug = SLUG.exec(url)?.[1];
    if (!slug) {
      const { urlAkhir } = await io.fetchHtml(url);
      slug = SLUG.exec(urlAkhir)?.[1];
    }
    if (!slug) return null;

    const detail = (await io.fetchJson(
      `https://apply.workable.com/api/v1/accounts/${slug}/jobs/${shortcode}`,
    )) as WorkableJob | null;
    if (!detail || typeof detail !== "object") return null;

    const description = [detail.description, detail.requirements]
      .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
      .map(htmlKeTeks)
      .filter(Boolean)
      .join("\n");
    if (!description) return null;

    return {
      bahan: {
        description,
        apply_url: applyUrlOffPlatform(detail.application_url, url),
        company: konteks.perusahaan,
        employer_known: perusahaanTerkenal(konteks.perusahaan),
      },
    };
  },
};
