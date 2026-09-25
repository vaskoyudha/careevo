import fs from "node:fs";
import path from "node:path";
import { dataRoot } from "./data-root";
import { parseInbox, splitLines, type InboxJobShape } from "./pipeline-table";

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
 * Inbox with a freshness date joined on.
 *
 * The row's own `posted:` label wins: it is the employer's post date, which is
 * more meaningful than the day our scanner happened to see it. The scan-history
 * join is the fallback for rows written without that label.
 */
export function bacaInboxDenganTanggal(): Array<InboxJob & { firstSeen?: string }> {
  const dates = bacaTanggalScan();
  return bacaInbox().map((j) => ({ ...j, firstSeen: j.postedAt ?? dates.get(j.url) }));
}
