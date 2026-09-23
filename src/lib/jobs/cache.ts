import { jobs, getVisibleJob, type JobFixture } from "@/lib/fixtures";

/**
 * Async data-access layer for loker listings.
 *
 * Why async at all, when the data is a synchronous fixture import: these are the
 * call sites that will become real I/O (a DB read, a cached fetch) without the
 * consuming components changing shape. Keeping the async boundary here means the
 * public page already `await`s, so swapping the body for a network call is a
 * one-file change.
 *
 * Every accessor respects the visibility rule — `rejected` postings are never
 * returned — so a caller cannot accidentally surface a scam listing by using the
 * "wrong" helper.
 */

/** Every audited posting, including quarantined ones. For internal/admin views. */
export async function ambilLokerDariCache(): Promise<JobFixture[]> {
  return jobs;
}

/** Postings safe to show publicly: everything except `rejected`. */
export async function ambilLokerTampil(): Promise<JobFixture[]> {
  return jobs.filter((job) => job.sentinel_status !== "rejected");
}

/** Postings that passed the audit with no signals at all. */
export async function ambilLokerBersih(): Promise<JobFixture[]> {
  return jobs.filter((job) => job.sentinel_status === "clean");
}

/**
 * Lookup by id, honouring the visibility rule: a `rejected` posting resolves to
 * `undefined` so its detail route 404s rather than rendering an apply flow.
 */
export async function ambilLokerById(id: string): Promise<JobFixture | undefined> {
  return getVisibleJob(id);
}
