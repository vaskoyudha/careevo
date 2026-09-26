/**
 * tracker-table.ts — header-aware parsing of `data/applications.md`, the
 * tracker markdown that is the source of truth.
 *
 * This is the SAME read path career-ops' own web app uses
 * (web/src/lib/tracker-table.mjs + readApplications in web/src/lib/career-ops.ts):
 * the markdown is canonical, the SQLite index is a rebuildable derived view, and
 * the web app reads the markdown directly. The header-alias table is NOT
 * mirrored — it is loaded at runtime from the engine's `tracker-aliases.json`,
 * the one shared source tracker-parse.mjs also reads, so this reader and the
 * engine's trackers can never drift on what a column header means.
 *
 * Why not `tracker.mjs query --json`: that CLI SELECTs only the nine fixed
 * schema fields and never returns the URL column. The URL is the deterministic
 * dedup key (merge-tracker.mjs Pass 0) — the loker UI needs it to answer "is
 * THIS posting the one tracked in row N?" — so the read path parses the
 * markdown, exactly as career-ops' web does.
 *
 * Adapted from career-ops (MIT), © 2026 Santiago Fernández de Valderrama.
 * Source: tracker-parse.mjs (`parseTrackerRow`, header detection) and
 * `web/src/lib/tracker-table.mjs` + `readApplications`.
 * https://github.com/career-ops-hq/career-ops
 */

import fs from "node:fs";
import path from "node:path";
import { dataRoot, engineRoot } from "./data-root";
import type { BarisTracker } from "./types";

/** Canonical tracker-parse field name → BarisTracker field. */
const FIELD: Record<string, keyof BarisTracker> = {
  num: "id",
  date: "date",
  company: "company",
  via: "via",
  role: "role",
  location: "location",
  score: "score",
  status: "status",
  pdf: "pdf",
  report: "report",
  notes: "notes",
  url: "url",
};

/** The columns a row must label before it counts as the tracker header. */
const REQUIRED_HEADER_FIELDS = ["num", "company", "role", "score", "status"];

let aliasCache: { mtimeMs: number; size: number; aliases: Record<string, string> } | null = null;

/**
 * Load the engine's shared header-alias table (lowercased header text →
 * canonical field). Cached per mtime+size so a system update that rewrites the
 * JSON is picked up on the next read; failures are never cached (a missing file
 * degrades to the legacy fixed column order, same as the web parser).
 */
function loadHeaderAliases(): Record<string, string> {
  const file = path.join(engineRoot(), "tracker-aliases.json");
  try {
    const stat = fs.statSync(file);
    if (aliasCache && aliasCache.mtimeMs === stat.mtimeMs && aliasCache.size === stat.size) {
      return aliasCache.aliases;
    }
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
    const aliases =
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, string>)
        : {};
    aliasCache = { mtimeMs: stat.mtimeMs, size: stat.size, aliases };
    return aliases;
  } catch {
    aliasCache = null;
    return {};
  }
}

/** Split a tracker line into trimmed cells (outer pipes removed). */
function trackerCells(line: string): string[] {
  const parts = line.split("|").map((c) => c.trim());
  return parts.slice(1, line.trimEnd().endsWith("|") ? -1 : undefined);
}

/**
 * Pre-scan for the header row and build the column map. ANY row whose cells
 * resolve the essential columns counts as the header (so alias headers like
 * "Num" work too). Returns null when no recognizable header exists, in which
 * case the caller falls back to the legacy fixed column order.
 */
function detectColumnMap(lines: string[], aliases: Record<string, string>): Record<string, number> | null {
  for (const raw of lines) {
    const line = raw.trim();
    if (!line.startsWith("|")) continue;
    const cells = trackerCells(line);
    const m: Record<string, number> = {};
    cells.forEach((c, i) => {
      const key = aliases[c.toLowerCase()];
      if (key && FIELD[key]) m[key] = i; // last occurrence wins, same as the engine
    });
    if (REQUIRED_HEADER_FIELDS.every((k) => m[k] != null)) return m;
  }
  return null;
}

/**
 * Read the tracker rows from the canonical markdown. Returns [] when the file
 * does not exist yet (a fresh data root is an empty pipeline, not an error).
 */
export function bacaTrackerMd(): BarisTracker[] {
  const file = path.join(dataRoot(), "data", "applications.md");
  let md: string;
  try {
    md = fs.readFileSync(file, "utf8");
  } catch {
    return [];
  }

  const lines = md.split("\n");
  const map = detectColumnMap(lines, loadHeaderAliases());
  const mappedWidth = map ? Math.max(...Object.values(map)) + 1 : 0;
  const rows: BarisTracker[] = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line.startsWith("|")) continue;
    const cells = trackerCells(line);
    if (cells.length < 8) continue;

    if (map) {
      // Width guard, mirroring parseTrackerRow: a row missing an INTERIOR cell
      // shifts every later column one left, so the row must carry a cell for
      // every mapped column.
      if (cells.length < mappedWidth) continue;
      const at = (k: string): string => (map[k] != null ? (cells[map[k]] ?? "") : "");
      const id = Number(at("num"));
      if (!Number.isInteger(id) || id < 1) continue; // header / separator / malformed
      rows.push({
        id,
        date: at("date"),
        company: at("company"),
        role: at("role"),
        score: at("score"),
        status: at("status"),
        pdf: at("pdf"),
        report: at("report"),
        notes: at("notes"),
        url: at("url"),
        via: at("via"),
        location: at("location"),
      });
    } else {
      // Legacy fixed order; tolerate the 8-cell variant where Notes is absent.
      const id = Number(cells[0]);
      if (!Number.isInteger(id) || id < 1) continue;
      const [, date, company, role, score, status, pdf, report, ...rest] = cells;
      rows.push({
        id,
        date,
        company,
        role,
        score,
        status,
        pdf,
        report,
        notes: rest.join(" | "),
        url: "",
        via: "",
        location: "",
      });
    }
  }

  return rows;
}
