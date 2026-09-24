import type { Level } from "@/types/domain";
import type { Course } from "@/types/course";
import { katalogBelajar, type EntriKatalog } from "@/lib/courses/katalog";
import { visibleJobs, type JobFixture } from "@/lib/fixtures";
import {
  levelForExperience,
  trackForInterest,
  type OnboardingProfile,
} from "./types";

/**
 * Recommendation engine.
 *
 * Turns an `OnboardingProfile` into ranked, *real* courses and job postings.
 * Pure scoring is separated from data loading so it can be unit-tested without
 * touching cookies or the course store: `skorKursus` / `skorLoker` take plain
 * data, `rekomendasiKursus` / `rekomendasiLoker` do the I/O.
 *
 * Scoring is additive and bounded; ties break by a stable secondary key so
 * results are deterministic across runs (covered by tests).
 */

const ORDERING_LANGKAH: Level[] = ["dasar", "menengah", "lanjut"];

function levelDistance(a: Level, b: Level): number {
  return Math.abs(ORDERING_LANGKAH.indexOf(a) - ORDERING_LANGKAH.indexOf(b));
}

/**
 * Score a single catalog entry against the profile.
 * Higher is better. Returns 0 for entries that are irrelevant (wrong track).
 */
export function skorKursus(entry: EntriKatalog, profile: OnboardingProfile): number {
  const tracks = profile.interests
    .map(trackForInterest)
    .filter((t): t is NonNullable<ReturnType<typeof trackForInterest>> => t !== null);

  const entryTrack = trackOfEntry(entry);
  // No interest maps to this track → out of scope for this learner.
  if (entryTrack && !(tracks as string[]).includes(entryTrack)) return 0;

  let score = 0;

  // Interest priority: first interest outweighs the rest.
  if (entryTrack) {
    const idx = (tracks as string[]).indexOf(entryTrack);
    if (idx >= 0) score += 40 - idx * 8;
    else score += 10; // in-scope but from an unmapped/free-form track
  }

  // Level proximity to the learner's level.
  const target = levelForExperience(profile.experience);
  score += (2 - levelDistance(entry.level, target)) * 12;

  // Nudge free courses so the first recommended step has no paywall.
  if (entry.is_free) score += 6;

  // Shorter courses first for beginners who asked for few hours.
  if (profile.weeklyHours <= 5 && entry.duration_min <= 150) score += 4;

  return score;
}

function trackOfEntry(entry: EntriKatalog): string | null {
  // Course-store entries carry `track`; resource fixtures only carry `slug`.
  // We infer a track from the slug/tags for fixture entries.
  const raw = entry as EntriKatalog & { track?: string };
  if (typeof raw.track === "string") return raw.track;

  const hay = `${entry.slug} ${entry.tags.join(" ")}`.toLowerCase();
  if (/(security|owasp|crypto|hmac)/.test(hay)) return "cyber-sec";
  if (/(godot|game)/.test(hay)) return "game-dev";
  if (/(python|pandas|data|machine|ai|llm)/.test(hay)) return "data";
  // Default the fixture back-catalogue to web-dev (HTML/CSS/JS/React/testing).
  return "web-dev";
}

/**
 * Score a job posting against the profile.
 * Tracks are matched loosely through `tags` because job fixtures have no track.
 */
export function skorLoker(job: JobFixture, profile: OnboardingProfile): number {
  const hay = `${job.title} ${job.tags.join(" ")} ${job.description}`.toLowerCase();

  // Gate: a posting is only relevant if at least one interest keyword matches.
  // Without this, level/remote/clean bonuses would float unrelated jobs into
  // the list (e.g. a web-dev posting shown to a game-dev-only learner).
  let interestScore = 0;
  for (let i = 0; i < profile.interests.length; i++) {
    const kw = keywordForInterest(profile.interests[i]);
    if (kw.some((k) => hay.includes(k))) {
      interestScore += 35 - i * 7;
    }
  }
  if (interestScore === 0) return 0;

  let score = interestScore;

  // Level fit.
  const target = levelForExperience(profile.experience);
  if (job.level === target) score += 20;
  else if (levelDistance(job.level, target) === 1) score += 8;

  // Work arrangement preference (jobs embed it in `location`, e.g. "Remote").
  const loc = job.location.toLowerCase();
  if (profile.workPreference === "fleksibel") score += 6;
  else if (loc.includes(profile.workPreference)) score += 12;

  // Freshly-verified postings edge ahead.
  if (job.sentinel_status === "clean") score += 8;

  return score;
}

function keywordForInterest(interest: OnboardingProfile["interests"][number]): string[] {
  switch (interest) {
    case "web-dev":
      return ["react", "javascript", "html", "css", "frontend", "web", "node", "typescript", "next"];
    case "data":
      return ["data", "python", "analyst", "analytic", "sql"];
    case "ai":
      return ["ai", "machine learning", "ml", "llm", "artificial"];
    case "game-dev":
      return ["game", "godot", "unity", "gamedev"];
    case "cyber-sec":
      return ["security", "cyber", "owasp", "pentest"];
    case "mobile":
      return ["mobile", "android", "ios", "react native", "flutter", "kotlin", "swift"];
  }
}

/** Rank the live catalog. Zero-scored entries are dropped. */
export function rekomendasiKursus(
  katalog: EntriKatalog[],
  profile: OnboardingProfile,
  limit = 4,
): EntriKatalog[] {
  return katalog
    .map((entry) => ({ entry, score: skorKursus(entry, profile) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title))
    .slice(0, limit)
    .map((row) => row.entry);
}

/** Rank visible (non-rejected) job postings. */
export function rekomendasiLoker(
  jobs: JobFixture[],
  profile: OnboardingProfile,
  limit = 4,
): JobFixture[] {
  return jobs
    .map((job) => ({ job, score: skorLoker(job, profile) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.job.title.localeCompare(b.job.title))
    .slice(0, limit)
    .map((row) => row.job);
}

/** Convenience loader used by pages: fetch and rank in one call. */
export async function rekomendasiUntukProfil(profile: OnboardingProfile): Promise<{
  kursus: EntriKatalog[];
  loker: JobFixture[];
}> {
  const [katalog, loker] = await Promise.all([
    katalogBelajar(),
    Promise.resolve(visibleJobs()),
  ]);
  return {
    kursus: rekomendasiKursus(katalog, profile),
    loker: rekomendasiLoker(loker, profile),
  };
}

/** Exposed for tests — the level ladder used for distance. */
export const _ordering = ORDERING_LANGKAH;
export type { Course };
