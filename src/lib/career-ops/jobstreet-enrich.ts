/**
 * jobstreet-enrich.ts — fetch one Jobstreet listing per inbox row, and cache it.
 *
 * This is the I/O half of the pair with `jobstreet-audit.ts`. `fetchJson` is an
 * injected dependency rather than a global reach, which is the only reason this
 * file is testable at all under vitest's `node` environment.
 *
 * Why the search endpoint and not a detail endpoint: `/api/jobsearch/v5/job/<id>`
 * answers 404, and the posting page is client-rendered — its SSR payload carries
 * `loaderData: null`, so the description is not in the HTML either. `?jobId=<id>`
 * on the search endpoint returns exactly one listing. Measured 2026-09-26, not
 * assumed.
 *
 * The cache lives OUTSIDE the engine's data root, in a Careevo-owned directory.
 * The vendored engine must never be handed a file it does not own.
 */

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ListingJobstreet } from "./jobstreet-audit";

export type FetchJson = (url: string) => Promise<unknown>;

const ENDPOINT = "https://id.jobstreet.com/api/jobsearch/v5/search";
const SITE_KEY = "ID-Main";

/** Where the raw listings are cached. `.data/` is gitignored; this path is ours. */
export function cachePath(): string {
  const override = process.env.CAREERVO_JOBSTREET_CACHE?.trim();
  if (override) return path.resolve(process.cwd(), override);
  return path.join(process.cwd(), ".data", "jobstreet-cache", "listings.json");
}

/** Read the cache. A missing or corrupt file is an empty cache, never a throw. */
export async function bacaCache(): Promise<Record<string, ListingJobstreet>> {
  try {
    const raw = await readFile(cachePath(), "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    return parsed as Record<string, ListingJobstreet>;
  } catch {
    return {};
  }
}

/** Write via temp-then-rename, the same rule the other file stores use. */
export async function tulisCache(cache: Record<string, ListingJobstreet>): Promise<void> {
  const target = cachePath();
  await mkdir(path.dirname(target), { recursive: true });
  const tmp = `${target}.tmp`;
  await writeFile(tmp, JSON.stringify(cache, null, 2), "utf8");
  await rename(tmp, target);
}

/** One listing by job id, or null when the API has no such listing. */
export async function ambilListing(
  jobId: string,
  fetchJson: FetchJson,
): Promise<ListingJobstreet | null> {
  const url = `${ENDPOINT}?siteKey=${SITE_KEY}&jobId=${encodeURIComponent(jobId)}&pageSize=1`;
  const payload = (await fetchJson(url)) as { data?: unknown[] } | null;
  const first = payload?.data?.[0];
  if (!first || typeof first !== "object") return null;
  return first as ListingJobstreet;
}

/**
 * Resolve listings for the given ids, fetching only what the cache lacks.
 * A single failed lookup is skipped: one dead posting must not blank the inbox.
 */
export async function perkaya(
  jobIds: string[],
  fetchJson: FetchJson,
): Promise<Record<string, ListingJobstreet>> {
  const cache = await bacaCache();
  const missing = [...new Set(jobIds)].filter((id) => !cache[id]);
  for (const id of missing) {
    try {
      const listing = await ambilListing(id, fetchJson);
      if (listing) cache[id] = listing;
    } catch {
      // Leave it uncached; the audit falls back to what the row already has and
      // the row is reported unenriched rather than clean.
    }
  }
  await tulisCache(cache);
  return cache;
}

/** Default `fetchJson`: the real network, used only from the server side. */
export const fetchJsonDefault: FetchJson = async (url) => {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Referer: "https://id.jobstreet.com/",
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
    },
  });
  if (!response.ok) throw new Error(`jobstreet: HTTP ${response.status}`);
  return response.json();
};
