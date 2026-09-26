import fs from "node:fs";
import path from "node:path";
import { dataRoot } from "./data-root";
import { parseInbox, splitLines, type InboxJobShape } from "./pipeline-table";
import { auditBaris, type BarisDiaudit } from "./inbox-audit";
import { jobIdFromUrl } from "./jobstreet-audit";
import { fetchJsonDefault, perkaya, type FetchJson } from "./jobstreet-enrich";

/**
 * inbox.ts — read the discovered-postings inbox the engine writes.
 *
 * Adapted from career-ops (MIT), © 2026 Santiago Fernández de Valderrama.
 * Source: career-ops/web/src/lib/career-ops.ts (`readInbox`, `readScanDates`,
 *   `pipelineSummary`) + `web/src/lib/pipeline-table.mjs` (`parseInbox`).
 * https://github.com/career-ops-hq/career-ops
 *
 * `data/pipeline.md` is the engine's canonical inbox: the scanner appends one
 * line per discovered posting and never rewrites history. Reading it is the same
 * choice career-ops' own web app makes — the markdown is the source of truth, the
 * SQLite index is a rebuildable derived view.
 *
 * A missing file is an empty inbox, not an error. This is upstream's rule
 * ("A missing file is not a malformed file") and it is what lets a fresh data
 * root render an empty list instead of throwing.
 */

/**
 * One discovered posting. An alias rather than `interface InboxJob extends
 * InboxJobShape {}` so there is exactly one declared shape — the empty
 * interface form is both a lint error and a second place to edit.
 */
export type InboxJob = InboxJobShape;

function baca(rel: string): string | null {
  try {
    return fs.readFileSync(path.join(dataRoot(), rel), "utf8");
  } catch {
    return null;
  }
}

/** Discovered postings, pending and processed alike. The caller filters. */
export function bacaInbox(): InboxJob[] {
  const md = baca("data/pipeline.md");
  if (!md) return [];
  return parseInbox(md);
}

/**
 * One row per posting URL, keeping the first occurrence.
 *
 * `pipeline.md` is an append-only markdown file, and the engine's own dedupe is
 * TTL-based: a URL it considers "past its recheck window" gets re-added by a
 * later scan even though the row is still on the list. Measured on a real data
 * root: 431 rows, 422 distinct URLs — 9 postings present twice.
 *
 * That is not only a cosmetic repeat. The caller keys each row by URL, and React
 * reconciles by key, so duplicate keys make it strand stale rows in the DOM: with
 * 3 duplicate Allianz URLs the filtered list rendered 53 rows while the component
 * held 44, and rows from a *different* company survived the filter. A key that is
 * not unique is a rendering bug, not a duplicate to be tolerated.
 *
 * Keeping the first occurrence is unambiguous rather than a policy choice: every
 * one of the 9 measured groups was byte-identical apart from its position, so
 * there is no field to reconcile. A genuine future conflict — same URL, different
 * content — still resolves to the earlier row, which is the one the engine
 * recorded first and the one `bacaTanggalScan` already treats as canonical.
 */
export function bacaInboxUnik(): InboxJob[] {
  const seen = new Set<string>();
  const out: InboxJob[] = [];
  for (const job of bacaInbox()) {
    if (seen.has(job.url)) continue;
    seen.add(job.url);
    out.push(job);
  }
  return out;
}

/**
 * The inbox with a derived fraud verdict on every row.
 *
 * Deliberately a separate function from `bacaInboxDenganTanggal` rather than an
 * `await` inside it: reading the file is pure and synchronous, and its tests
 * should not need a network to pass. Enrichment is the slow, fallible,
 * networked part, so it lives here where a caller can choose to skip it and
 * where `fetchJson` can be injected.
 *
 * A row whose listing cannot be fetched comes back `enriched: false` and
 * `quarantined`, never `clean` — see `inbox-audit.ts` for why that distinction
 * is the whole point.
 */
export async function bacaInboxDiaudit(
  options: { fetchJson?: FetchJson; cacheFile?: string } = {},
): Promise<(BarisDiaudit & { firstSeen?: string })[]> {
  const rows = bacaInboxDenganTanggal();
  if (rows.length === 0) return [];

  const jobIds = [
    ...new Set(rows.map((row) => jobIdFromUrl(row.url)).filter((id): id is string => id !== null)),
  ];
  // Nothing Jobstreet-shaped, so do not touch the network at all.
  if (jobIds.length === 0) {
    return auditBaris(rows as unknown as InboxJobShape[], {});
  }

  if (options.cacheFile) process.env.CAREERVO_JOBSTREET_CACHE = options.cacheFile;
  const listings = await perkaya(jobIds, options.fetchJson ?? fetchJsonDefault);

  return auditBaris(rows as unknown as InboxJobShape[], listings).map((row, i) => ({
    ...row,
    firstSeen: rows[i]?.firstSeen,
  }));
}

/**
 * `url → first_seen (YYYY-MM-DD)` from `data/scan-history.tsv`.
 *
 * The scanner already stamps every posting with the day it was first seen, so
 * freshness is derived here without asking the engine for anything.
 *
 * A url that recurs keeps its FIRST-RECORDED row, which is what upstream's
 * `readScanDates` does. Upstream's comment says "earliest" while its code keeps
 * first-seen; the two agree only because the engine appends chronologically, so
 * this copies the code. The guard is `!dates.has(url)`, not a date comparison —
 * a later rewrite of the file out of order would change the answer.
 */
export function bacaTanggalScan(): Map<string, string> {
  const tsv = baca("data/scan-history.tsv");
  const dates = new Map<string, string>();
  if (!tsv) return dates;
  const lines = splitLines(tsv);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line || (i === 0 && line.startsWith("url\t"))) continue;
    const tab = line.indexOf("\t");
    if (tab < 1) continue;
    const url = line.slice(0, tab);
    const firstSeen = line.slice(tab + 1).split("\t")[0]?.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(firstSeen ?? "") && !dates.has(url)) dates.set(url, firstSeen!);
  }
  return dates;
}

/**
 * Inbox with a freshness date joined on, one row per posting URL.
 *
 * The row's own `posted:` label wins: it is the employer's post date, which is
 * more meaningful than the day our scanner happened to see it. The scan-history
 * join is the fallback for rows written without that label.
 *
 * Deduped by `bacaInboxUnik`, because this is the read the UI renders and keys
 * by URL — see that function for why a repeated URL is a rendering bug.
 */
export function bacaInboxDenganTanggal(): Array<InboxJob & { firstSeen?: string }> {
  const dates = bacaTanggalScan();
  return bacaInboxUnik().map((j) => ({ ...j, firstSeen: j.postedAt ?? dates.get(j.url) }));
}
