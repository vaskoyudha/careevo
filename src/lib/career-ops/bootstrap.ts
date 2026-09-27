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
 * The seed is chosen in preference order: Careevo's own Indonesian config
 * first, then the engine's shipped example.
 *
 * Why a Careevo-owned seed exists at all, in numbers taken from the files
 * rather than remembered:
 *
 *  - `engine/templates/portals.example.yml` lists 138 `tracked_companies` (120
 *    `enabled`) and 25 `job_boards`, of which exactly one is enabled: SolidJobs
 *    IT, a Polish board. Both Indonesian boards — Jobstreet ID (`siteKey:
 *    ID-Main`) and Glints ID (`countryCode: ID`) — are present with correct,
 *    non-placeholder endpoints but `enabled: false`, and
 *    `.data/career-ops/data/scan-runs.tsv` records `boards=1` on all seven
 *    recorded runs. That is the spec's T1.
 *
 *  - The cost, from the same receipts: `found` of 8,745–14,349 postings per
 *    run, essentially all European and American, and of the 486 rows that
 *    survived into `scan-history.tsv` exactly one is located in Indonesia — an
 *    Allianz "Product Manager, Jakarta" req, i.e. a European employer's Jakarta
 *    vacancy, not Indonesian market coverage. `filtered_location=0` on every
 *    run, because the template ships no `location_filter` at all. So the count
 *    of Indonesian postings is not "about one" by market share; it is one, and
 *    it is the only Jakarta row an European config happened to surface. This is
 *    the spec's T2, and it is also why fixing `location_filter` alone could not
 *    have moved the number: 138 Western companies with `location: Jakarta` is
 *    zero by arithmetic, not by a broken filter.
 *
 * `engine/**` stays byte-identical — it is vendored source, and editing it would
 * break the boundary recorded in AGENTS.md and the two attribution skills. We
 * change only WHICH file gets copied, never the copy itself.
 *
 * The candidate list is a parameter so the preference order is testable without
 * stubbing the filesystem or the environment. Note that passing a list bypasses
 * the defaults entirely, so the default order itself is asserted in
 * portals.test.ts — a test that only ever supplied its own candidates would
 * stay green if these two were swapped.
 */
export function cariSeedPortals(
  candidates: string[] = [
    path.join(process.cwd(), "src", "lib", "career-ops", "portals-careevo.yml"),
    path.join(engineRoot(), "templates", "portals.example.yml"),
  ],
): string | null {
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/** Copy the preferred seed (see `cariSeedPortals`) into the data root. */
function seedPortals(): boolean {
  const target = path.join(dataRoot(), "portals.yml");
  // Write-once, like everything else here: a user who has edited their portals
  // config must never have it replaced by the shipped seed.
  if (fs.existsSync(target)) return false;
  const seed = cariSeedPortals();
  if (!seed) return false;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(seed, target);
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

  if (seedPortals()) dibuat.push("portals.yml");

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
