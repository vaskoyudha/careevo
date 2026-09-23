import { describe, expect, it } from "vitest";
import { ambilLokerBersih, ambilLokerById, ambilLokerDariCache, ambilLokerTampil } from "@/lib/jobs/cache";
import { cleanJobs, jobs, visibleJobs } from "@/lib/fixtures";

/**
 * The cache layer must DELEGATE the visibility rules to `fixtures.ts`, not
 * re-implement them. Two copies of "rejected is hidden" are two definitions free
 * to drift, and the copy that drifts silently is the one that leaks a scam
 * listing to the public board.
 *
 * These assert agreement with the source of truth, so a future edit to one side
 * that forgets the other fails here rather than in production.
 */
describe("cache layer delegates visibility rules", () => {
  it("ambilLokerDariCache returns every audited posting", async () => {
    expect(await ambilLokerDariCache()).toEqual(jobs);
  });

  it("ambilLokerTampil agrees with visibleJobs", async () => {
    const fromCache = await ambilLokerTampil();
    expect(fromCache.map((j) => j.id)).toEqual(visibleJobs().map((j) => j.id));
  });

  it("ambilLokerBersih agrees with cleanJobs", async () => {
    const fromCache = await ambilLokerBersih();
    expect(fromCache.map((j) => j.id)).toEqual(cleanJobs().map((j) => j.id));
  });

  it("ambilLokerTampil never yields a rejected posting", async () => {
    const fromCache = await ambilLokerTampil();
    expect(fromCache.every((j) => j.sentinel_status !== "rejected")).toBe(true);
  });

  it("ambilLokerById refuses a rejected posting and allows a visible one", async () => {
    const rejected = jobs.find((j) => j.sentinel_status === "rejected");
    const visible = visibleJobs()[0];
    expect(rejected).toBeDefined();
    expect(await ambilLokerById(rejected!.id)).toBeUndefined();
    expect((await ambilLokerById(visible.id))?.id).toBe(visible.id);
  });

  it("ambilLokerById returns undefined for an unknown id", async () => {
    expect(await ambilLokerById("tidak-ada")).toBeUndefined();
  });
});
