import fs from "node:fs";
import path from "node:path";
import { dataRoot, engineRoot } from "./data-root";

/**
 * bootstrap.ts — first-run seeding of the canonical career-ops files in
 * Careevo's data root.
 *
 * Idempotent: it never overwrites an existing file, so a user's tracker, CV or
 * profile can never be clobbered by this path. The engine's own onboarding
 * (`doctor.mjs`) would otherwise report the system unconfigured; this mirrors
 * the minimal first-run the engine expects.
 */

const HEADER_TRACKER = [
  "# Applications Tracker",
  "",
  "| # | Date | Company | Via | Role | Score | Status | PDF | Report | Notes | URL |",
  "|---|------|---------|-----|------|-------|--------|-----|--------|-------|-----|",
  "",
].join("\n");

/**
 * portals.yml is seeded from the engine's own `templates/portals.example.yml`
 * (202 entries) rather than hand-written here.
 *
 * The hand-written 15-line version that used to live here locked
 * `location_filter.allow` to Indonesian cities. Against a mostly-US dataset
 * that returned `postingsKept: 0` on every run, and any future filter dimension
 * the engine supports would have had to be re-added by hand. The template is
 * data, not code — copying it is both smaller and correct.
 *
 * Write-once, like everything else here: a user who has edited their portals
 * config must never have it replaced by the shipped example.
 */
function seedPortalsFromTemplate(): boolean {
  const target = path.join(dataRoot(), "portals.yml");
  if (fs.existsSync(target)) return false;
  const template = path.join(engineRoot(), "templates", "portals.example.yml");
  if (!fs.existsSync(template)) return false;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, fs.readFileSync(template, "utf8"), "utf8");
  return true;
}

/** Copied verbatim from engine/scan.mjs PIPELINE_SKELETON (line 2625).
 *  The engine appends discovered postings under `## Pending`, so the section
 *  markers must exist or there is nowhere to put them. */
const PIPELINE_SKELETON = `# Pipeline — Pending URLs

Paste job URLs below as \`- [ ] {url}\` then run \`/career-ops pipeline\`.

## Pending

## Processed
`;

/** Copied verbatim from engine/scan.mjs (line 2702). The scanner writes this
 *  header itself on creation, but only when it is about to append — so a data
 *  root that has only ever been read has no file to read. */
const HEADER_SCAN_HISTORY =
  "url\tfirst_seen\tportal\ttitle\tcompany\tstatus\tlocation\tfingerprint\tposted_at\ttrust_score\ttrust_flags\tnormalized_company\n";

function tulisJikaBelumAda(rel: string, content: string): boolean {
  const target = path.join(dataRoot(), rel);
  if (fs.existsSync(target)) return false;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf8");
  return true;
}

export interface HasilBootstrap {
  dataRoot: string;
  dibuat: string[];
}

/** Seed the canonical files the engine needs. Never overwrites. */
export function bootstrapCareerOps(): HasilBootstrap {
  const dibuat: string[] = [];
  const root = dataRoot();

  const candidates: Array<[string, string]> = [
    ["data/applications.md", HEADER_TRACKER],
    ["data/pipeline.md", PIPELINE_SKELETON],
    ["data/scan-history.tsv", HEADER_SCAN_HISTORY],
  ];

  for (const [rel, content] of candidates) {
    if (tulisJikaBelumAda(rel, content)) dibuat.push(rel);
  }

  if (seedPortalsFromTemplate()) dibuat.push("portals.yml");

  // Empty dirs the engine expects (reports/, jds/, batch/tracker-additions/).
  // Written as three literal mkdir calls rather than a loop over a name array:
  // a computed path defeats static analysis, which makes the bundler trace the
  // whole project (including the vendored engine) into the server output.
  const seed = (rel: string) => {
    const full = path.join(root, rel);
    if (fs.existsSync(full)) return;
    fs.mkdirSync(full, { recursive: true });
    dibuat.push(`${rel}/`);
  };
  seed("reports");
  seed("jds");
  seed("batch/tracker-additions");

  return { dataRoot: root, dibuat };
}
