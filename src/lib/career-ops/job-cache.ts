/**
 * job-cache.ts — the one enrichment cache, keyed by normalized URL.
 *
 * Why URL and not Jobstreet id: an id only exists for one board. A URL key is
 * what every board has, and `normalisasiKunciUrl` is already the key the tracker
 * dedupes on, so the cache cannot disagree with the rest of the app about which
 * posting a row is.
 *
 * Two rules carried over from the file this replaces, both load-bearing:
 *   · A missing or corrupt cache is an EMPTY cache, never a throw — a cache is a
 *     derived view, and losing it must degrade to "belum diperiksa", not a 500.
 *   · A row whose fetch fails is left out of the cache entirely. Writing a
 *     half-entry would let `auditBaris` judge a posting on a description we do
 *     not have.
 */

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { adapterUntuk } from "./boards";
import { tagKlasifikasi } from "./boards/jobstreet";
import type { BahanAudit, Io } from "./boards/types";
import { bahanAudit, jobIdFromUrl, type ListingJobstreet } from "./jobstreet-audit";
import type { InboxJobShape } from "./pipeline-table";
import { normalisasiKunciUrl } from "./url-key";

/** One enriched posting, as stored. */
export interface EntriCache {
  /** The board that produced it — `PapanAdapter.nama`. */
  board: string;
  bahan: BahanAudit;
  /** Occupational categories, when the board supplied them. */
  tags?: string[];
  /** `YYYY-MM-DD` the entry was fetched. Debugging metadata, never read by logic. */
  diambilPada: string;
}

export type IsiCache = Record<string, EntriCache>;

/**
 * Where the cache lives. `.data/` is gitignored; this path is Careevo's own, and
 * deliberately outside the engine's data root — the vendored engine must never
 * be handed a file it does not own.
 */
export function cachePath(): string {
  const override = process.env.CAREERVO_JOB_CACHE?.trim();
  if (override) return path.resolve(process.cwd(), override);
  return path.join(process.cwd(), ".data", "job-cache", "enrichment.json");
}

/** The superseded `{jobstreetId -> listing}` cache, read once for migration. */
function cacheLamaPath(): string {
  const override = process.env.CAREERVO_JOBSTREET_CACHE?.trim();
  if (override) return path.resolve(process.cwd(), override);
  return path.join(process.cwd(), ".data", "jobstreet-cache", "listings.json");
}

async function bacaJson<T>(target: string): Promise<T | null> {
  try {
    const parsed: unknown = JSON.parse(await readFile(target, "utf8"));
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    return parsed as T;
  } catch {
    return null;
  }
}

/** Read the cache. A missing or corrupt file is an empty cache, never a throw. */
export async function bacaCache(): Promise<IsiCache> {
  return (await bacaJson<IsiCache>(cachePath())) ?? {};
}

/** Write via temp-then-rename, the same rule the other file stores use. */
export async function tulisCache(cache: IsiCache): Promise<void> {
  const target = cachePath();
  await mkdir(path.dirname(target), { recursive: true });
  const tmp = `${target}.tmp`;
  await writeFile(tmp, JSON.stringify(cache, null, 2), "utf8");
  await rename(tmp, target);
}

const hariIni = () => new Date().toISOString().slice(0, 10);

/**
 * Carry the 180 already-enriched Jobstreet rows over without a single request.
 *
 * The old cache is keyed by Jobstreet id and the new one by URL, so the mapping
 * needs the inbox rows to bridge them. Without this, the first run after the
 * upgrade would re-fetch all 180 — or, worse, show them all as "Belum diperiksa"
 * if the fetch were ever skipped.
 */
async function migrasiCacheLama(rows: InboxJobShape[], cache: IsiCache): Promise<boolean> {
  const lama = await bacaJson<Record<string, ListingJobstreet>>(cacheLamaPath());
  if (!lama) return false;

  let berubah = false;
  for (const row of rows) {
    const kunci = normalisasiKunciUrl(row.url);
    if (!kunci || cache[kunci]) continue;
    const id = jobIdFromUrl(row.url);
    const listing = id ? lama[id] : undefined;
    if (!listing) continue;
    cache[kunci] = {
      board: "Jobstreet",
      bahan: bahanAudit(listing, row.company),
      tags: tagKlasifikasi(listing),
      diambilPada: hariIni(),
    };
    berubah = true;
  }
  return berubah;
}

/**
 * Run `kerja` over `item` with at most `batas` in flight.
 *
 * A shared cursor rather than chunking: with chunking, one slow request holds up
 * the whole chunk. Bounded concurrency is what keeps a cold backfill from
 * hammering a board while still finishing promptly.
 */
async function kolam<T>(
  item: readonly T[],
  batas: number,
  kerja: (t: T) => Promise<void>,
): Promise<void> {
  let i = 0;
  const pekerja = Array.from({ length: Math.max(1, Math.min(batas, item.length)) }, async () => {
    while (i < item.length) {
      const idx = i++;
      await kerja(item[idx]);
    }
  });
  await Promise.all(pekerja);
}

/**
 * Fill the cache for every row a board adapter claims.
 *
 * Called after a scan and by `scripts/enrich-inbox.ts` — never from the render
 * path. The render path reads `bacaCache()` and must not wait on a network.
 */
export async function perkayaSemua(
  rows: readonly InboxJobShape[],
  io: Io,
  opsi: { konkurensi?: number; paksa?: boolean } = {},
): Promise<IsiCache> {
  const cache = await bacaCache();
  let berubah = await migrasiCacheLama([...rows], cache);

  const perlu = rows.filter((row) => {
    const kunci = normalisasiKunciUrl(row.url);
    if (!kunci) return false;
    if (!opsi.paksa && cache[kunci]) return false;
    return adapterUntuk(row.url) !== null;
  });

  await kolam(perlu, opsi.konkurensi ?? 4, async (row) => {
    const kunci = normalisasiKunciUrl(row.url);
    const adapter = adapterUntuk(row.url);
    if (!kunci || !adapter) return;
    try {
      const hasil = await adapter.ambilDetail(row.url, io, { perusahaan: row.company });
      if (!hasil) return;
      cache[kunci] = {
        board: adapter.nama,
        bahan: hasil.bahan,
        tags: hasil.tags,
        diambilPada: hariIni(),
      };
      berubah = true;
    } catch {
      // Leave it uncached: the row is reported unenriched, never judged blind.
    }
  });

  if (berubah) await tulisCache(cache);
  return cache;
}
