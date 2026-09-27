/**
 * jobstreet.ts — the Jobstreet adapter.
 *
 * Jobstreet is the one board that was already enriched; this file moves its
 * fetch into the registry without rewriting the rules. `bahanAudit` and
 * `jobIdFromUrl` stay where they are and keep their tests — this is the wrapper,
 * not a second implementation.
 */

import {
  bahanAudit,
  jobIdFromUrl,
  type ListingJobstreet,
} from "../jobstreet-audit";
import type { HasilPapan, Io, PapanAdapter } from "./types";
import { hostDari } from "./url";

const ENDPOINT = "https://id.jobstreet.com/api/jobsearch/v5/search";
const SITE_KEY = "ID-Main";

const HOST_JOBSTREET = /(^|\.)jobstreet\.(com|co\.id)$/i;

/**
 * Jobstreet's occupational categories, used as tags.
 *
 * A controlled vocabulary (`Information & Communication Technology`,
 * `Business/Systems Analysts`) — the employer's own classification, not our
 * guess, so it carries more weight than anything derived from the title. Moved
 * here from `persiapan-inbox.ts`, where it was the only board-specific branch
 * left in a module that must not know about boards.
 */
export function tagKlasifikasi(listing: ListingJobstreet): string[] {
  const klasifikasi = (listing as { classifications?: unknown }).classifications;
  if (!Array.isArray(klasifikasi)) return [];

  const tags: string[] = [];
  for (const item of klasifikasi) {
    const c = (item as { classification?: { description?: string } })?.classification;
    const s = (item as { subclassification?: { description?: string } })?.subclassification;
    for (const deskripsi of [c?.description, s?.description]) {
      if (typeof deskripsi === "string" && deskripsi.trim()) tags.push(deskripsi.trim());
    }
  }
  return tags;
}

/** One listing by job id, or null when the API has no such listing. */
async function ambilListing(jobId: string, io: Io): Promise<ListingJobstreet | null> {
  const url = `${ENDPOINT}?siteKey=${SITE_KEY}&jobId=${encodeURIComponent(jobId)}&pageSize=1`;
  const payload = (await io.fetchJson(url, {
    headers: { Referer: "https://id.jobstreet.com/" },
  })) as { data?: unknown[] } | null;
  const first = payload?.data?.[0];
  if (!first || typeof first !== "object") return null;
  return first as ListingJobstreet;
}

export const jobstreet: PapanAdapter = {
  nama: "Jobstreet",
  cocok: (url) => HOST_JOBSTREET.test(hostDari(url)) && jobIdFromUrl(url) !== null,
  async ambilDetail(url, io, konteks): Promise<HasilPapan | null> {
    const jobId = jobIdFromUrl(url);
    if (!jobId) return null;
    const listing = await ambilListing(jobId, io);
    if (!listing) return null;
    return {
      bahan: bahanAudit(listing, konteks.perusahaan),
      tags: tagKlasifikasi(listing),
    };
  },
};
