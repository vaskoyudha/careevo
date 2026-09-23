import { describe, expect, it } from "vitest";
import { auditJob, cleanJobs, getJob, getVisibleJob, jobs, visibleJobs, type JobSeed } from "@/lib/fixtures";
import jobsRaw from "@/fixtures/jobs.json";

/**
 * Fixture invariants.
 *
 * The Sentinel verdict is DERIVED from each posting's own content, so the fixture
 * can no longer claim `clean` while its description demands a fee — the failure
 * this refactor removed. These tests hold that property and the demo's shape.
 */

const seeds = jobsRaw as unknown as JobSeed[];

describe("fixture integrity", () => {
  it("every job's verdict matches a fresh audit of its own content", () => {
    for (const job of jobs) {
      const fresh = auditJob(job);
      expect(job.sentinel_status).toBe(fresh.sentinel_status);
      expect(job.flags).toEqual(fresh.flags);
      expect(job.fee_flags).toEqual(fresh.fee_flags);
      expect(job.trust_score).toBe(fresh.trust_score);
    }
  });

  it("no job is `clean` while carrying any signal", () => {
    for (const job of cleanJobs()) {
      expect(job.flags).toEqual([]);
      expect(job.fee_flags).toEqual([]);
    }
  });

  it("every rejected job carries at least one flag", () => {
    for (const job of jobs.filter((j) => j.sentinel_status === "rejected")) {
      expect(job.flags.length).toBeGreaterThan(0);
    }
  });

  it("fee_flags is a subset of flags for every job", () => {
    for (const job of jobs) {
      for (const flag of job.fee_flags) {
        expect(job.flags).toContain(flag);
      }
    }
  });

  it("has unique ids", () => {
    const ids = jobs.map((j) => j.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("audits all nine seeds", () => {
    expect(jobs.length).toBe(seeds.length);
    expect(jobs.length).toBeGreaterThan(0);
  });
});

describe("demo shape", () => {
  it("exercises all three Sentinel tiers, so the UI has something to show", () => {
    const tiers = new Set(jobs.map((j) => j.sentinel_status));
    expect(tiers).toContain("clean");
    expect(tiers).toContain("quarantined");
    expect(tiers).toContain("rejected");
  });

  it("hides rejected jobs from the public board", () => {
    expect(visibleJobs().every((j) => j.sentinel_status !== "rejected")).toBe(true);
    expect(visibleJobs().length).toBeLessThan(jobs.length);
  });

  it("keeps the 'no-fee' filter axis coherent with the AMAN badge", () => {
    // Regression: when `fee_flags` held EVERY signal, the board's "Tanpa sinyal
    // fee" toggle hid a job for a domain mismatch while the detail page showed it
    // an AMAN badge with "no signals" text. A clean job must never be filtered by
    // the no-fee axis, and a job with no fee demand must never be labelled unsafe.
    for (const job of jobs) {
      const punyaSinyalFee = job.fee_flags.length > 0;
      const aman = job.sentinel_status === "clean";
      // No job may be AMAN while demanding money, and none may demand money while
      // being presented as fee-free.
      if (aman) expect(punyaSinyalFee).toBe(false);
    }
  });
});

describe("visibility rule", () => {
  const rejected = jobs.find((j) => j.sentinel_status === "rejected");

  it("getJob reaches a rejected job by id (raw lookup)", () => {
    expect(rejected).toBeDefined();
    expect(getJob(rejected!.id)?.id).toBe(rejected!.id);
  });

  it("getVisibleJob refuses a rejected job, so its detail route 404s", () => {
    expect(getVisibleJob(rejected!.id)).toBeUndefined();
  });

  it("getVisibleJob still resolves a visible job", () => {
    const visible = visibleJobs()[0];
    expect(getVisibleJob(visible.id)?.id).toBe(visible.id);
  });
});
