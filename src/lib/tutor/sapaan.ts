/**
 * The empty-workspace greeting.
 *
 * Pure and separate from the component on purpose: vitest here runs in a `node`
 * environment with no DOM and only collects `.test.ts` files under `src/`, so
 * logic parked inside `tutor-column.tsx` cannot be asserted at all. It lived
 * there, and it rotted there — a chain of three ternaries (`< 12 ? pagi : < 17
 * ? siang : sore`) left the `malam` bucket unreachable dead data and greeted a
 * learner at 23:00 with "Selamat sore." A test cannot catch what it cannot
 * import.
 *
 * The buckets are now exhaustive over the 24-hour clock, and `bucketSalam` is
 * the single definition of the boundaries, so adding a fifth greeting means
 * adding a bucket here and letting the exhaustiveness test fail until the
 * boundary is chosen.
 */

/** Ported from DeepTutor's `welcomeGreeting`, in Indonesian. */
export const SAPAAN = {
  pagi: ["Selamat pagi.", "Pagi — mari belajar sesuatu.", "Apa yang ingin kamu pelajari?"],
  siang: ["Selamat siang.", "Siang — ada yang ingin dibahas?", "Apa yang ingin kamu pelajari?"],
  sore: ["Selamat sore.", "Sore — mau menjelajah apa?", "Apa yang ingin kamu pelajari?"],
  malam: ["Selamat malam.", "Malam — mau menjelajah apa?", "Apa yang ingin kamu pelajari?"],
} as const;

export type BucketSapaan = keyof typeof SAPAAN;

/** Every bucket, for the exhaustiveness test to walk. */
export const SEMUA_BUCKET: readonly BucketSapaan[] = ["pagi", "siang", "sore", "malam"];

/**
 * Which greeting bucket an hour falls in.
 *
 * `jam` is normalised, so an out-of-range value from a caller or a test cannot
 * silently fall through to the last branch.
 */
export function bucketSalam(jam: number): BucketSapaan {
  const hour = ((Math.trunc(jam) % 24) + 24) % 24;
  if (hour < 12) return "pagi";
  if (hour < 17) return "siang";
  if (hour < 19) return "sore";
  return "malam";
}

/**
 * Pick one line from the bucket for `jam`.
 *
 * `acak` is injected rather than calling `Math.random` inline so the choice is
 * assertable; the caller passes `Math.random`.
 */
export function pilihSapaan(jam: number, acak: () => number = Math.random): string {
  const baris = SAPAAN[bucketSalam(jam)];
  return baris[Math.floor(acak() * baris.length)];
}
