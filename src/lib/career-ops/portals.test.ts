import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import yaml from "js-yaml";

/**
 * The default portals config is the difference between a scan that returns real
 * postings and one that returns zero. This file pins the properties that caused
 * the zero, so a future "simplification" of the seeded config fails here rather
 * than in production.
 */

const AKAR = mkdtempSync(path.join(tmpdir(), "careevo-portals-"));
vi.stubEnv("CAREER_OPS_ROOT", AKAR);

const { bootstrapCareerOps, cariSeedPortals } = await import("./bootstrap");

function portalsDoc(): Record<string, unknown> {
  return yaml.load(
    readFileSync(path.join(AKAR, "portals.yml"), "utf8"),
  ) as Record<string, unknown>;
}

beforeEach(() => {
  bootstrapCareerOps();
});

afterAll(() => {
  vi.unstubAllEnvs();
});

describe("seeded portals.yml", () => {
  // Two assertions, one source of truth. The seeded file must be a byte copy of
  // the Careevo config — so a hand-written 15-line stub can never come back —
  // AND the DEFAULT candidate order must actually resolve to that config.
  // The second half matters because bootstrap.test.ts only ever passes an
  // explicit candidate list, so inverting the two defaults would leave the
  // suite green while seeding the engine's Western template again. That is the
  // same invisible-zero failure class portals.test.ts exists to catch.
  it("is seeded from the Careevo config, not the engine template", () => {
    const nyata = path.join(
      process.cwd(),
      "src",
      "lib",
      "career-ops",
      "portals-careevo.yml",
    );
    expect(readFileSync(path.join(AKAR, "portals.yml"), "utf8")).toBe(
      readFileSync(nyata, "utf8"),
    );
    expect(cariSeedPortals()).toBe(nyata);
  });

  // The regression this guard exists for: an allow-list of six Indonesian cities
  // matched nothing in a dataset of 50k mostly-American companies, so every run
  // reported `postingsKept: 0` — and the UI could not tell that apart from a
  // dead scanner. The engine's own failure mode is that a config problem
  // produces a zero indistinguishable from a real one
  // (engine/detect-reposts.mjs:737,741), so a filter that is too NARROW for its
  // dataset is the expensive mistake, and a missing filter is not a mistake at
  // all — absence is a legitimate config, which is why this test asserts a
  // floor and not an exact list.
  //
  // Our own config now ships a real location_filter, so this is no longer a
  // guard against a filter existing. It is a guard against a filter existing
  // but being too small to clear a real corpus, and it is satisfied honestly:
  // 14 genuine Indonesian metros, not padding chosen to reach a threshold. The
  // count is the assertion, so a future "let's just list Jakarta" fails here.
  it("does not lock the location filter to a short list of cities", () => {
    const allow = (portalsDoc().location_filter as { allow?: string[] } | undefined)?.allow;
    if (Array.isArray(allow) && allow.length > 0) {
      expect(allow.length).toBeGreaterThanOrEqual(10);
    }
  });

  it("keeps a title filter, so a keyword sweep has something to match", () => {
    const positive = (portalsDoc().title_filter as { positive?: string[] } | undefined)?.positive;
    expect(Array.isArray(positive) && positive.length).toBeGreaterThan(0);
  });

  // The forward scanner walks boards and tracked companies. Zero of either means
  // scan.mjs has nothing to do — which is a different zero from "no matches".
  it("carries boards and tracked companies for the forward scanner to walk", () => {
    const doc = portalsDoc();
    expect((doc.job_boards as unknown[] | undefined)?.length ?? 0).toBeGreaterThan(0);
    expect((doc.tracked_companies as unknown[] | undefined)?.length ?? 0).toBeGreaterThan(0);
  });
});
