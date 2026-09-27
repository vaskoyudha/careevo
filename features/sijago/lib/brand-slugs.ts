/**
 * Catalog entry id → [Simple Icons](https://simpleicons.org) slug.
 *
 * The hand-curated half of the brand-icon pipeline. `brand-icons.generated.ts`
 * is produced from this file plus the `simple-icons` package by
 * `scripts/build-brand-icons.mts`, which **fails** on a slug that does not
 * exist — so a typo here is a build error, not a silently missing icon.
 *
 * Why bundled rather than fetched: an icon per installed service, fetched at
 * render time, tells that vendor (or a favicon proxy) who is looking and what
 * else they have installed. Simple Icons is CC0, so the paths ship with the app
 * and the browser makes no request at all. The upstream hub and nanobot both
 * hot-link a favicon chain; this is the same icons without the callout.
 *
 * Coverage is deliberately partial. The newer MCP brands (Exa, Tavily,
 * Firecrawl, Apify, Jina, Context7, Linkup, Browserbase, Hyperbrowser, FastMCP,
 * DeepWiki) are not in Simple Icons at all, and a wrong-but-present logo is
 * worse than an initials monogram. Anything absent here falls back to the
 * monogram, which is a fine second-class citizen.
 *
 * ADDING ONE: find the slug at simpleicons.org, add a line, re-run
 * `npm run build:brand-icons`. Trademarks belong to their owners; these marks
 * identify a product and imply no endorsement (see the notice in the stores).
 */

/** MCP catalog ids (`deeptutor/services/mcp/catalog/vendor/curated.json`). */
export const MCP_BRAND_SLUGS: Readonly<Record<string, string>> = {
  airtable: "airtable",
  "baidu-maps": "baidu",
  "brave-search": "brave",
  "chakra-ui": "chakraui",
  clerk: "clerk",
  "cloudflare-docs": "cloudflare",
  convex: "convex",
  github: "github",
  // The server is a thin wrapper over git hosting; the git mark is the honest one.
  gitmcp: "git",
  "google-maps": "googlemaps",
  huggingface: "huggingface",
  neon: "neon",
  postman: "postman",
  pubmed: "pubmed",
  stripe: "stripe",
  supabase: "supabase",
  svelte: "svelte",
  wolfram: "wolfram",
  zapier: "zapier",
};

/** Every slug the generated file has to contain, deduplicated. */
export function referencedSlugs(): string[] {
  return [...new Set(Object.values(MCP_BRAND_SLUGS))].sort();
}
