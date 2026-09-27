// @ts-check
/** @typedef {import('./_types.js').Provider} Provider */

// Kalibrr provider — hits the public Kalibrr job board search REST API.
//
// Kalibrr (kalibrr.com, kalibrr.id) covers Southeast Asia with a strong presence
// in Indonesia and the Philippines. The public job search endpoint at
// /api/job_board/search is a no-auth REST API powering the web job board.
//
// This provider is designed for explicit `provider: kalibrr` in portals.yml.
// Auto-detection from careers_url is not supported because Kalibrr is a job board
// aggregator, not a company ATS.
//
// Portal entry fields (all optional except `provider`):
//   api             — search endpoint URL (default: https://www.kalibrr.com/api/job_board/search)
//   searchKeywords  — search keywords string (default: "")
//   country         — country filter (default: "Indonesia")
//   countryCode     — two-letter country code alias (e.g. "ID" -> "Indonesia", "PH" -> "Philippines")
//   pageSize        — results per page (default: 30)
//   maxPages        — maximum pages to fetch (default: 3)
//   appendWorkType  — append tenure / work arrangement to title (default: false)

import { htmlToText } from './_html-to-text.mjs';

const DEFAULT_API = 'https://www.kalibrr.com/api/job_board/search';
const DEFAULT_COUNTRY = 'Indonesia';
const DEFAULT_PAGE_SIZE = 30;
const DEFAULT_MAX_PAGES = 3;

const ALLOWED_KALIBRR_HOSTS = new Set([
  'www.kalibrr.com',
  'kalibrr.com',
  'www.kalibrr.id',
  'kalibrr.id',
]);

/** @param {string} url */
function assertKalibrrUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`kalibrr: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`kalibrr: URL must use HTTPS: ${url}`);
  if (!ALLOWED_KALIBRR_HOSTS.has(parsed.hostname)) {
    throw new Error(`kalibrr: untrusted hostname "${parsed.hostname}" — must be one of: ${[...ALLOWED_KALIBRR_HOSTS].join(', ')}`);
  }
  return url;
}

/**
 * NaN-safe Date.parse
 * @param {any} value
 * @returns {number|undefined}
 */
function toEpochMs(value) {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/**
 * Parse a single Kalibrr search API item into the canonical Job shape.
 *
 * @param {any} item — raw search API result object
 * @param {string} fallbackCompany — fallback company name from portal entry
 * @param {{appendWorkType?: boolean}} [options]
 * @returns {{title: string, url: string, company: string, location: string, postedAt?: number, description?: string}|null}
 */
export function parseKalibrrItem(item, fallbackCompany = '', options = {}) {
  if (!item || typeof item !== 'object') return null;

  let title = (item.name || '').trim();
  if (!title) return null;

  if (options.appendWorkType) {
    const tenure = (item.tenure || '').trim();
    if (tenure) title = `${title} [${tenure}]`;
  }

  const jobId = item.id != null ? String(item.id).trim() : '';
  if (!jobId) return null;

  const companyCode = (item.company?.code || item.company_info?.code || '').trim();
  const slug = (item.slug || '').trim();

  let url;
  if (companyCode && slug) {
    url = `https://www.kalibrr.com/c/${companyCode}/jobs/${jobId}/${slug}`;
  } else if (slug) {
    url = `https://www.kalibrr.com/jobs/${jobId}/${slug}`;
  } else {
    url = `https://www.kalibrr.com/jobs/${jobId}`;
  }

  try {
    const parsed = new URL(url);
    if (!ALLOWED_KALIBRR_HOSTS.has(parsed.hostname)) return null;
  } catch {
    return null;
  }

  const company = (item.company?.name || item.company_name || fallbackCompany || '').trim();

  const addrs = item.google_location?.address_components;
  const locParts = [
    addrs?.city,
    addrs?.region,
    addrs?.country,
  ].filter(Boolean).map((s) => String(s).trim()).filter(Boolean);
  const location = locParts.join(', ');

  const postedAt = toEpochMs(item.activation_date || item.created_at);
  const description = typeof item.description === 'string' ? htmlToText(item.description) : undefined;

  return {
    title,
    url,
    company,
    location,
    ...(postedAt != null ? { postedAt } : {}),
    ...(description ? { description } : {}),
  };
}

/**
 * Resolve country parameter from entry configuration.
 * @param {object} entry
 * @returns {string}
 */
function resolveCountry(entry) {
  if (entry.country) return String(entry.country).trim();
  const code = (entry.countryCode || '').toUpperCase().trim();
  if (code === 'ID') return 'Indonesia';
  if (code === 'PH') return 'Philippines';
  if (code === 'TH') return 'Thailand';
  if (code === 'VN') return 'Vietnam';
  return DEFAULT_COUNTRY;
}

/**
 * Build the search URL with query parameters.
 * @param {string} apiUrl
 * @param {{keywords: string, country: string, pageSize: number, offset: number}} params
 * @returns {string}
 */
function buildSearchUrl(apiUrl, params) {
  const url = new URL(apiUrl);
  if (params.keywords) url.searchParams.set('text', params.keywords);
  if (params.country) url.searchParams.set('country', params.country);
  url.searchParams.set('limit', String(params.pageSize || DEFAULT_PAGE_SIZE));
  url.searchParams.set('offset', String(params.offset || 0));
  return url.href;
}

/** @type {Provider} */
export default {
  id: 'kalibrr',

  detect(_entry) {
    return null;
  },

  async fetch(entry, ctx) {
    const apiUrl = entry.api || DEFAULT_API;
    assertKalibrrUrl(apiUrl);

    const country = resolveCountry(entry);
    const keywords = entry.searchKeywords || '';
    const pageSize = Number(entry.pageSize) || DEFAULT_PAGE_SIZE;
    const maxPages = Number(entry.maxPages) || DEFAULT_MAX_PAGES;
    const fallbackCompany = entry.name || '';
    const appendWorkType = entry.appendWorkType === true;

    const allJobs = [];

    for (let page = 1; page <= maxPages; page++) {
      const offset = (page - 1) * pageSize;
      const searchUrl = buildSearchUrl(apiUrl, {
        keywords,
        country,
        pageSize,
        offset,
      });

      let json;
      try {
        json = await ctx.fetchJson(searchUrl, { redirect: 'error' });
      } catch (err) {
        if (page === 1) throw err;
        console.error(`kalibrr: page ${page} fetch failed — ${err.message}`);
        break;
      }

      const jobs = Array.isArray(json?.jobs) ? json.jobs : [];
      if (jobs.length === 0) break;

      for (const item of jobs) {
        const job = parseKalibrrItem(item, fallbackCompany, { appendWorkType });
        if (job) allJobs.push(job);
      }

      if (jobs.length < pageSize) break;

      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    return allJobs;
  },
};
