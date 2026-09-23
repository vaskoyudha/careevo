#!/usr/bin/env node
/**
 * validate-skills.mjs — validate .agents/skills/ against the Agent Skills spec.
 *
 * https://agentskills.io/specification
 *
 * Why this exists: a skill with invalid frontmatter does not error — it simply
 * fails to load, silently. The agent that needed it just never sees it, and
 * nothing anywhere says why. That is the worst failure mode for a file whose only
 * job is to be discovered, so it gets a validator rather than trust.
 *
 * Checks the spec's hard constraints, plus one repo-local rule: a skill that
 * points at another skill by name must point at one that exists.
 *
 * Usage: node scripts/validate-skills.mjs
 * Exits non-zero on any error, so it is usable as a gate.
 */

import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "js-yaml";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKILLS_DIR = path.join(ROOT, ".agents", "skills");

/** Spec: 1-64 chars, lowercase alphanumeric + hyphens, no leading/trailing/double hyphen. */
const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const NAME_MAX = 64;
const DESC_MAX = 1024;
const COMPAT_MAX = 500;

/** Top-level frontmatter keys the spec defines. Anything else is a typo risk. */
const KNOWN_FIELDS = new Set([
  "name",
  "description",
  "license",
  "compatibility",
  "metadata",
  "allowed-tools",
]);

const errors = [];
const warnings = [];

/** Split `---\n<yaml>\n---\n<body>` into its parts. */
function splitFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return null;
  return { yaml: match[1], body: match[2] };
}

function validateSkill(dirName) {
  const file = path.join(SKILLS_DIR, dirName, "SKILL.md");
  const rel = path.relative(ROOT, file);
  const fail = (msg) => errors.push(`${rel}: ${msg}`);
  const warn = (msg) => warnings.push(`${rel}: ${msg}`);

  if (!statSync(path.join(SKILLS_DIR, dirName)).isDirectory()) return;

  if (!existsSync(file)) {
    fail("missing SKILL.md");
    return;
  }

  const parts = splitFrontmatter(readFileSync(file, "utf8"));
  if (!parts) {
    fail("no YAML frontmatter (must open with --- and close with ---)");
    return;
  }

  let fm;
  try {
    fm = load(parts.yaml);
  } catch (err) {
    fail(`frontmatter is not valid YAML — ${err.message}`);
    return;
  }
  if (!fm || typeof fm !== "object" || Array.isArray(fm)) {
    fail("frontmatter must be a YAML mapping");
    return;
  }

  // --- name ---
  const name = fm.name;
  if (typeof name !== "string" || name === "") {
    fail("`name` is required and must be a non-empty string");
  } else {
    if (name.length > NAME_MAX) fail(`\`name\` exceeds ${NAME_MAX} chars (${name.length})`);
    if (!NAME_RE.test(name)) {
      fail(`\`name\` "${name}" must be lowercase alphanumeric words joined by single hyphens`);
    }
    if (name !== dirName) {
      fail(`\`name\` "${name}" must match its parent directory "${dirName}"`);
    }
  }

  // --- description ---
  const desc = fm.description;
  if (typeof desc !== "string" || desc.trim() === "") {
    fail("`description` is required and must be a non-empty string");
  } else if (desc.length > DESC_MAX) {
    fail(`\`description\` exceeds ${DESC_MAX} chars (${desc.length})`);
  } else if (desc.length < 40) {
    warn(`\`description\` is short (${desc.length} chars) — say what it does AND when to use it`);
  }

  // --- optional fields ---
  if (fm.compatibility != null) {
    if (typeof fm.compatibility !== "string") fail("`compatibility` must be a string");
    else if (fm.compatibility.length > COMPAT_MAX) {
      fail(`\`compatibility\` exceeds ${COMPAT_MAX} chars (${fm.compatibility.length})`);
    }
  }

  if (fm.metadata != null) {
    if (typeof fm.metadata !== "object" || Array.isArray(fm.metadata)) {
      fail("`metadata` must be a mapping");
    } else {
      for (const [k, v] of Object.entries(fm.metadata)) {
        if (typeof v !== "string") fail(`\`metadata.${k}\` must be a string (got ${typeof v})`);
      }
    }
  }

  for (const key of Object.keys(fm)) {
    if (!KNOWN_FIELDS.has(key)) {
      warn(`unknown frontmatter field \`${key}\` — the spec defines: ${[...KNOWN_FIELDS].join(", ")}`);
    }
  }

  // --- body ---
  if (parts.body.trim() === "") {
    fail("body is empty — the instructions are the point");
  }
}

/**
 * A skill that says "see the `foo` skill" must name a skill that exists.
 * A dangling cross-reference is invisible at runtime: the agent reads the
 * sentence, finds nothing, and proceeds without the context it was told to load.
 */
function validateCrossReferences(skillNames) {
  for (const dirName of skillNames) {
    const file = path.join(SKILLS_DIR, dirName, "SKILL.md");
    if (!existsSync(file)) continue;
    const text = readFileSync(file, "utf8");
    const rel = path.relative(ROOT, file);

    const re = /the\s+`([a-z0-9-]+)`\s+skill/gi;
    for (const match of text.matchAll(re)) {
      if (!skillNames.includes(match[1])) {
        errors.push(`${rel}: references the \`${match[1]}\` skill, which does not exist`);
      }
    }
  }
}

// ── run ──────────────────────────────────────────────────────────────────────

if (!existsSync(SKILLS_DIR)) {
  console.error(`✗ no skills directory at ${path.relative(ROOT, SKILLS_DIR)}`);
  process.exit(1);
}

const entries = readdirSync(SKILLS_DIR);
const skillNames = [];
for (const entry of entries) {
  if (!statSync(path.join(SKILLS_DIR, entry)).isDirectory()) continue;
  skillNames.push(entry);
  validateSkill(entry);
}

if (skillNames.length === 0) {
  console.error("✗ no skills found");
  process.exit(1);
}

validateCrossReferences(skillNames);

for (const w of warnings) console.warn(`⚠ ${w}`);

if (errors.length > 0) {
  for (const e of errors) console.error(`✗ ${e}`);
  console.error(`\n✗ ${errors.length} error(s) across ${skillNames.length} skill(s)`);
  process.exit(1);
}

console.log(`✓ ${skillNames.length} skill(s) valid: ${skillNames.join(", ")}`);
if (warnings.length > 0) console.log(`  (${warnings.length} warning(s))`);
