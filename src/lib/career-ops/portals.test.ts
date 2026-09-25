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

const { bootstrapCareerOps } = await import("./bootstrap");

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
  it("is seeded from the engine template, not a hand-written stub", () => {
    const nyata = readFileSync(
      path.join(process.cwd(), "engine", "templates", "portals.example.yml"),
      "utf8",
    );
    expect(readFileSync(path.join(AKAR, "portals.yml"), "utf8")).toBe(nyata);
  });

  // The regression: an allow-list of six Indonesian cities matched nothing in a
  // dataset of 50k mostly-American companies, so every run reported
  // `postingsKept: 0` and the UI could not tell that from a dead scanner. The
  // template ships no `location_filter` at all, which is the correct default;
  // a short allow-list is what must never come back.
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
