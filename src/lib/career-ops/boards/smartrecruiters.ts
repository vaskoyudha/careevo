/**
 * smartrecruiters.ts — the SmartRecruiters adapter.
 *
 * The list endpoint has no description; the per-posting detail does, nested
 * under `jobAd.sections`. Sections are joined in the engine's own order
 * (`engine/providers/smartrecruiters.mjs` `extractDescription`): company context
 * first, call-to-action last — so the fee rules read the same text the scanner
 * would have.
 */

import { htmlKeTeks } from "./html";
import { applyUrlOffPlatform, hostDari } from "./url";
import { perusahaanTerkenal, type HasilPapan, type PapanAdapter } from "./types";

const HOST = "jobs.smartrecruiters.com";
const BAGIAN_URL = /^https?:\/\/jobs\.smartrecruiters\.com\/([^/]+)\/(\d+)/i;

const URUTAN_BAGIAN = [
  "companyDescription",
  "jobDescription",
  "qualifications",
  "additionalInformation",
] as const;

interface SmartRecruitersDetail {
  applyUrl?: string | null;
  jobAd?: { sections?: Record<string, { text?: string } | undefined> } | null;
}

export const smartrecruiters: PapanAdapter = {
  nama: "SmartRecruiters",
  cocok: (url) => hostDari(url) === HOST,

  async ambilDetail(url, io, konteks): Promise<HasilPapan | null> {
    const m = BAGIAN_URL.exec(url);
    if (!m) return null;
    const [, slug, id] = m;

    const detail = (await io.fetchJson(
      `https://api.smartrecruiters.com/v1/companies/${slug}/postings/${id}`,
    )) as SmartRecruitersDetail | null;
    if (!detail || typeof detail !== "object") return null;

    const sections = detail.jobAd?.sections ?? {};
    const description = URUTAN_BAGIAN.map((k) => sections[k]?.text)
      .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
      .map(htmlKeTeks)
      .filter(Boolean)
      .join("\n");
    if (!description) return null;

    return {
      bahan: {
        description,
        apply_url: applyUrlOffPlatform(detail.applyUrl, url),
        company: konteks.perusahaan,
        employer_known: perusahaanTerkenal(konteks.perusahaan),
      },
    };
  },
};
