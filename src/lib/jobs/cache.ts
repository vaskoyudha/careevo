import { cleanJobs, jobs, visibleJobs, getVisibleJob, type JobFixture } from "@/lib/fixtures";

/**
 * Async data-access layer for loker listings.
 *
 * Why async at all, when the data is a synchronous fixture import: these are the
 * call sites that will become real I/O (a DB read, a cached fetch) without the
 * consuming components changing shape. Keeping the async boundary here means the
 * public page already `await`s, so swapping the body for a network call is a
 * one-file change.
 *
 * The visibility rules themselves live in `fixtures.ts` and are DELEGATED to, not
 * re-spelled: two copies of "rejected is hidden" would be two definitions free to
 * drift, and the one that drifts silently is the one that leaks a scam listing.
 */

/** Every audited posting, including quarantined ones. For internal/admin views. */
export async function ambilLokerDariCache(): Promise<JobFixture[]> {
  return jobs;
}

/** Postings safe to show publicly: everything except `rejected`. */
export async function ambilLokerTampil(): Promise<JobFixture[]> {
  return visibleJobs();
}

/** Postings the audit passed with no signals at all (`clean`). */
export async function ambilLokerBersih(): Promise<JobFixture[]> {
  return cleanJobs();
}

/**
 * Lookup by id, honouring the visibility rule: a `rejected` posting resolves to
 * `undefined` so its detail route 404s rather than rendering an apply flow.
 */
export async function ambilLokerById(id: string): Promise<JobFixture | undefined> {
  return getVisibleJob(id);
}
