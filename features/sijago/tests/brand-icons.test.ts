import test from "node:test";
import assert from "node:assert/strict";

import { brandIconFor, brandInitials } from "../lib/brand-icons";
import { BRAND_ICONS } from "../lib/brand-icons.generated";
import {
  MCP_BRAND_SLUGS,
  referencedSlugs,
} from "../lib/brand-slugs";

test("every curated slug is present in the generated data", () => {
  // The generator fails on a missing slug, so this catches the other drift: a
  // curation edit committed without re-running `npm run build:brand-icons`.
  for (const slug of referencedSlugs()) {
    assert.ok(
      BRAND_ICONS[slug],
      `${slug} is curated but not generated — re-run the build`,
    );
  }
});

test("the generated data carries nothing the catalogs do not reference", () => {
  // The full Simple Icons set is ~3,450 marks; shipping more than we use would
  // put the rest in the page bundle for nothing.
  const wanted = new Set(referencedSlugs());
  for (const slug of Object.keys(BRAND_ICONS)) {
    assert.ok(wanted.has(slug), `${slug} is generated but unused`);
  }
});

test("every mark is a usable 24x24 path", () => {
  for (const [slug, icon] of Object.entries(BRAND_ICONS)) {
    assert.match(icon.path, /^[Mm]/, `${slug} path does not start with a move`);
    assert.match(icon.hex, /^[0-9A-Fa-f]{6}$/, `${slug} hex is malformed`);
    assert.ok(icon.title.length > 0, `${slug} has no title`);
  }
});

test("a known entry resolves to its mark", () => {
  assert.ok(brandIconFor("github"));
});

test("an unknown entry resolves to null rather than a wrong logo", () => {
  // Partial coverage is the design: the newer MCP brands are not in Simple Icons,
  // and a plausible-but-wrong mark is worse than a monogram.
  assert.equal(brandIconFor("tavily"), null);
  assert.equal(brandIconFor("definitely-not-a-service"), null);
  // `blender` was only ever curated as a CLI app id, so with the CLI-apps
  // surface gone it must not resolve — a stale table would resurrect the mark.
  assert.equal(brandIconFor("blender"), null);
});

test("a renamed install still finds its mark", () => {
  // The MCP store lets the installer choose a local name, and the common edits
  // are case and separator changes.
  assert.ok(brandIconFor("GitHub"));
  assert.ok(brandIconFor("google_maps"));
});

test("resolution never throws on junk", () => {
  for (const value of ["", "   ", "../etc/passwd", "-", "___"]) {
    assert.doesNotThrow(() => brandIconFor(value));
  }
});

test("the curated table stays in sync with what is generated", () => {
  for (const id of Object.keys(MCP_BRAND_SLUGS)) {
    assert.ok(brandIconFor(id), `mcp:${id} resolves to nothing`);
  }
});

test("initials are word-aware and never empty", () => {
  assert.equal(brandInitials("Google Maps"), "GM");
  assert.equal(brandInitials("firecrawl"), "FI");
  assert.equal(brandInitials("chakra-ui"), "CU");
  assert.equal(brandInitials("Exa"), "EX");
  assert.equal(brandInitials(""), "?");
  assert.equal(brandInitials("   "), "?");
});

test("a CJK name still renders something", () => {
  assert.equal(brandInitials("语雀"), "语雀");
});
