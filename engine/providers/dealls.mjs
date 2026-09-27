// @ts-check
/** @typedef {import('./_types.js').Provider} Provider */

// Dealls provider — hits the public explore-job REST endpoint powering dealls.com.
//
// Dealls (dealls.com, formerly SejutaCita) is an Indonesian talent marketplace
// focused on tech, corporate, and startup roles. Its public job exploration API
// is a no-auth REST endpoint at api.sejutacita.id/v1/explore-job/job.
//
// This provider is designed for explicit `provider: dealls` in portals.yml.
// Auto-detection is not supported because Dealls is a job board aggregator,
// not a company ATS.
//
// Portal entry fields (all optional except `provider`):
//   api             — endpoint URL (default: https://api.sejutacita.id/v1/explore-job/job)
//   searchKeywords  — search keywords string (default: "")
//   pageSize        — results per page (default: 30)
//   maxPages        — maximum pages to fetch (default: 3)
//   appendWorkType  — append workplace type (remote/hybrid) to title (default: false)

const DEFAULT_API = 'https://api.sejutacita.id/v1/explore-job/job';
const DEFAULT_PAGE_SIZE = 30;
const DEFAULT_MAX_PAGES = 3;

const ALLOWED_DEALLS_HOSTS = new Set([
  'api.sejutacita.id',
  'dealls.com',
  'www.dealls.com',
]);

/** @param {string} url */
function assertDeallsUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`dealls: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`dealls: URL must use HTTPS: ${url}`);
  if (!ALLOWED_DEALLS_HOSTS.has(parsed.hostname)) {
    throw new Error(`dealls: untrusted hostname "${parsed.hostname}" — must be one of: ${[...ALLOWED_DEALLS_HOSTS].join(', ')}`);
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
 * Parse a single Dealls explore-job document into the canonical Job shape.
 *
 * @param {any} item — raw explore-job document object
 * @param {string} fallbackCompany — fallback company name from portal entry
 * @param {{appendWorkType?: boolean}} [options]
 * @returns {{title: string, url: string, company: string, location: string, postedAt?: number, description?: string}|null}
 */
export function parseDeallsItem(item, fallbackCompany = '', options = {}) {
  if (!item || typeof item !== 'object') return null;

  let title = (item.role || item.title || '').trim();
  if (!title) return null;

  if (options.appendWorkType) {
    const wt = (item.workplaceType || '').trim();
    if (wt) title = `${title} [${wt}]`;
  }

  const slug = (item.slug || '').trim();
  const companySlug = (item.company?.slug || '').trim();
  const id = item.id != null ? String(item.id).trim() : '';

  let url;
  if (slug && companySlug) {
    url = `https://dealls.com/loker/${slug}~${companySlug}`;
  } else if (slug) {
    url = `https://dealls.com/loker/${slug}`;
  } else if (id) {
    url = `https://dealls.com/loker/${id}`;
  } else {
    return null;
  }

  try {
    const parsed = new URL(url);
    if (!ALLOWED_DEALLS_HOSTS.has(parsed.hostname)) return null;
  } catch {
    return null;
  }

  const company = (item.company?.name || fallbackCompany || '').trim();

  const city = (item.city?.name || '').trim();
  const country = (item.country?.name || 'Indonesia').trim();
  const location = [city, country].filter(Boolean).join(', ');

  const postedAt = toEpochMs(item.publishedAt || item.createdAt);

  const skills = Array.isArray(item.skills)
    ? item.skills.map((s) => s?.name).filter(Boolean).join(', ')
    : '';
  const descParts = [];
  if (skills) descParts.push(`Required skills: ${skills}`);
  if (item.workplaceType) descParts.push(`Workplace: ${item.workplaceType}`);
  if (item.company?.sector) descParts.push(`Industry: ${item.company.sector}`);
  const description = descParts.length > 0 ? descParts.join('. ') : undefined;

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
 * Build search URL with query parameters.
 * @param {string} apiUrl
 * @param {{keywords: string, pageSize: number, page: number}} params
 * @returns {string}
 */
function buildSearchUrl(apiUrl, params) {
  const url = new URL(apiUrl);
  if (params.keywords) url.searchParams.set('search', params.keywords);
  url.searchParams.set('status', 'active');
  url.searchParams.set('published', 'true');
  url.searchParams.set('limit', String(params.pageSize || DEFAULT_PAGE_SIZE));
  url.searchParams.set('page', String(params.page || 1));
  return url.href;
}

/** @type {Provider} */
export default {
  id: 'dealls',

  detect(_entry) {
    return null;
  },

  async fetch(entry, ctx) {
    const apiUrl = entry.api || DEFAULT_API;
    assertDeallsUrl(apiUrl);

    const keywords = entry.searchKeywords || '';
    const pageSize = Number(entry.pageSize) || DEFAULT_PAGE_SIZE;
    const maxPages = Number(entry.maxPages) || DEFAULT_MAX_PAGES;
    const fallbackCompany = entry.name || '';
    const appendWorkType = entry.appendWorkType === true;

    const allJobs = [];

    for (let page = 1; page <= maxPages; page++) {
      const searchUrl = buildSearchUrl(apiUrl, {
        keywords,
        pageSize,
        page,
      });

      let json;
      try {
        json = await ctx.fetchJson(searchUrl, { redirect: 'error' });
      } catch (err) {
        if (page === 1) throw err;
        console.error(`dealls: page ${page} fetch failed — ${err.message}`);
        break;
      }

      const docs = Array.isArray(json?.data?.docs) ? json.data.docs : [];
      if (docs.length === 0) break;

      for (const item of docs) {
        const job = parseDeallsItem(item, fallbackCompany, { appendWorkType });
        if (job) allJobs.push(job);
      }

      const totalPages = Number(json?.data?.totalPages) || 1;
      if (page >= totalPages || docs.length < pageSize) break;

      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    return allJobs;
  },
};
