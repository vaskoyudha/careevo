/**
 * io.ts — the real-network `Io` implementation.
 *
 * Kept apart from the adapters so an adapter test never needs the network: the
 * adapter is handed an `Io` and a test hands it a stub. This is the same
 * dependency-injection shape `jobstreet-enrich.ts` used for `fetchJson`, and the
 * reason that file was testable at all under vitest's `node` environment.
 *
 * The timeout is here, not in `perkayaSemua`: a per-request deadline belongs to
 * the thing making the request. Ten seconds is generous for a JSON API and
 * short enough that one dead board cannot stall a scan's enrichment step.
 */

import type { Io } from "./boards/types";

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

const TIMEOUT_MS = 10_000;
const JEDA_429_MS = 1_000;

async function ambil(
  url: string,
  headers: Record<string, string>,
): Promise<Response> {
  const init: RequestInit = {
    redirect: "follow",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { "User-Agent": UA, ...headers },
  };
  let res = await fetch(url, init);

  // One retry on 429. A board that keeps rate-limiting past this fails the row,
  // and the row stays "Belum diperiksa" rather than getting a guessed verdict.
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, JEDA_429_MS));
    res = await fetch(url, init);
  }

  if (!res.ok) throw new Error(`HTTP ${res.status} untuk ${url}`);
  return res;
}

export const ioDefault: Io = {
  async fetchJson(url, init) {
    return (await ambil(url, { Accept: "application/json", ...(init?.headers ?? {}) })).json();
  },
  async fetchHtml(url) {
    const res = await ambil(url, { Accept: "text/html,application/xhtml+xml" });
    return { html: await res.text(), urlAkhir: res.url };
  },
};
