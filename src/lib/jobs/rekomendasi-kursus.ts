import type { EntriKatalog } from "@/lib/courses/katalog";
import type { JobFixture } from "@/lib/fixtures";
import type { Level } from "@/types/domain";
import { _ordering as LANGKAH_LEVEL } from "@/lib/onboarding/rekomendasi";

/**
 * Course ranking against a job posting, not a profile.
 *
 * `onboarding/rekomendasi.ts` scores courses against what the learner *wants*;
 * this scores them against what one posting *asks for*. The shape is
 * deliberately the same — additive score, relevance floor, stable tiebreak — so
 * a reader of both files sees one convention rather than two ranking systems.
 */

/** Minimum score for a course to count as relevant at all. */
const LANTAI_RELEVAN = 10;

/** Lowercase alphanumeric tokens, length >= 3, of a text. */
function tokenisasi(teks: string): Set<string> {
  return new Set(
    teks
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 3),
  );
}

export function skorKursusUntukLoker(entry: EntriKatalog, job: JobFixture): number {
  const teksJob = tokenisasi(`${job.title} ${job.description} ${job.tags.join(" ")}`);
  const teksKursus = tokenisasi(`${entry.title} ${entry.slug} ${entry.tags.join(" ")}`);
  const tagJob = new Set(job.tags.map((tag) => tag.toLowerCase()));
  const tagKursus = new Set(entry.tags.map((tag) => tag.toLowerCase()));

  let skor = 0;

  // The strongest signal: a skill the posting demands is literally a course tag.
  for (const tag of tagJob) {
    if (tagKursus.has(tag)) skor += 20;
  }

  // A course tag the posting's own text mentions.
  //
  // The tag is matched as a SET OF WORDS, not as a string. `teksJob` holds
  // single tokens, so the previous `teksJob.has(tag)` could only ever be true for
  // a one-word tag: "Machine Learning", "REST API", "Data Analytics", and "CI/CD"
  // were silently dead, which is to say every *specific* skill tag contributed
  // nothing while a generic role word like "engineer" scored the full 8 and
  // cleared the floor on its own. Measured on the scanned corpus, that made
  // "Machine Learning Engineer" rank a Git course above the machine-learning
  // course. Requiring every word of the tag to be present fixes the inversion
  // and keeps single-word tags working exactly as before.
  for (const tag of tagKursus) {
    const kata = tokenisasi(tag);
    if (kata.size > 0 && [...kata].every((k) => teksJob.has(k))) skor += 8;
  }

  // Any other shared vocabulary, capped so one wordy description cannot dominate.
  let overlap = 0;
  for (const token of teksJob) {
    if (teksKursus.has(token)) overlap += 1;
  }
  skor += Math.min(overlap, 5) * 2;

  // Level and price are tiebreakers, not relevance. A course that shares no
  // content with the posting is irrelevant no matter how free or well-levelled
  // it is, so it must not reach the recommendation floor through these alone.
  if (skor === 0) return 0;

  // Level proximity, same ladder as profile recommendations.
  //
  // A posting with NO level must contribute nothing here. `indexOf(undefined)`
  // is -1, not 0, so the unguarded version treated "level tidak diketahui" as
  // "satu tingkat di bawah dasar" and silently paid out a phantom bonus — a
  // scanned inbox row has no level at all, so every such row was scored against
  // a rung that does not exist. That made inbox scores incomparable with the
  // `/loker/[id]` path (where `level` is always set) and quietly propped up
  // matches near the floor. Guarded on both sides: an unknown rung on either
  // side means the tiebreaker is silent, not guessed.
  const iJob = LANGKAH_LEVEL.indexOf(job.level as Level);
  const iKursus = LANGKAH_LEVEL.indexOf(entry.level as Level);
  if (iJob >= 0 && iKursus >= 0) {
    skor += (2 - Math.abs(iJob - iKursus)) * 4;
  }

  if (entry.is_free) skor += 2;
  return skor;
}

/**
 * Rank the catalog for one posting. Irrelevant entries are dropped; ties break
 * by catalog order then id — the same determinism `rekomendasiKursus` uses.
 */
export function rekomendasiKursusUntukLoker(
  katalog: EntriKatalog[],
  job: JobFixture,
  limit = 3,
): EntriKatalog[] {
  const catalogIndex = new Map(katalog.map((item, index) => [item.id, index]));
  return katalog
    .map((item) => ({ item, score: skorKursusUntukLoker(item, job) }))
    .filter((row) => row.score >= LANTAI_RELEVAN)
    .sort((a, b) => {
      const aIndex = catalogIndex.get(a.item.id) ?? Number.MAX_SAFE_INTEGER;
      const bIndex = catalogIndex.get(b.item.id) ?? Number.MAX_SAFE_INTEGER;
      return b.score - a.score || aIndex - bIndex || a.item.id.localeCompare(b.item.id);
    })
    .slice(0, limit)
    .map((row) => row.item);
}
