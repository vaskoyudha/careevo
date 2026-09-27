import type { Level, Track } from "@/types/domain";

/**
 * Onboarding personalization domain.
 *
 * The onboarding flow captures three axes — background, interest, and goal —
 * and turns them into a persisted `OnboardingProfile`. That profile is the
 * input to `rekomendasi.ts`, which ranks real courses (course store + resource
 * fixtures) and real job postings (jobs fixture) for the learner.
 *
 * Kept separate from auth (`src/lib/auth`) on purpose: identity is cookie
 * session, personalization is a distinct, re-editable slice of the profile.
 */

/** How much prior experience the learner brings. Maps 1:1 to course `Level`. */
export const EXPERIENCE_LEVELS = ["pemula", "dasar", "menengah", "lanjut"] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

/** The learner's situation — shapes copy and job readiness framing. */
export const BACKGROUNDS = [
  "pelajar",
  "mahasiswa",
  "career-switcher",
  "fresh-graduate",
  "profesional",
] as const;
export type Background = (typeof BACKGROUNDS)[number];

/**
 * Interest tracks. A superset of the four real `Track`s plus two "aspirational"
 * tracks that have no courses yet but still steer job matching copy.
 */
export const INTERESTS = [
  "web-dev",
  "data",
  "ai",
  "game-dev",
  "cyber-sec",
  "mobile",
] as const;
export type Interest = (typeof INTERESTS)[number];

/** Desired working arrangement for job recommendations. */
export const WORK_PREFERENCES = ["remote", "hybrid", "onsite", "fleksibel"] as const;
export type WorkPreference = (typeof WORK_PREFERENCES)[number];

export interface OnboardingProfile {
  /**
   * Normalized email of the account this profile belongs to.
   *
   * The profile cookie is per-browser, not per-account, so it must be bound to
   * an identity: otherwise onboarding once would leak recommendations to every
   * later account created/signed into on the same browser.
   */
  owner: string;
  /** Experience as chosen (four buckets), distinct from course `Level`. */
  experience: ExperienceLevel;
  background: Background;
  /** 1–3 selected interests, most-preferred first. */
  interests: Interest[];
  goal: string;
  /** Weekly study target in hours. */
  weeklyHours: number;
  workPreference: WorkPreference;
  /** ISO timestamp of when the profile was completed. */
  completedAt: string;
  /** Schema version so future migrations can detect old payloads. */
  version: number;
}

export const ONBOARDING_VERSION = 2;

export const MAX_INTERESTS = 3;
export const MIN_INTERESTS = 1;
export const WEEKLY_HOURS_OPTIONS = [3, 5, 8, 12, 20] as const;
export const GOALS = [
  "dapat-kerja",
  "naik-level",
  "ganti-bidang",
  "portfolio",
  "sertifikasi",
] as const;
export type Goal = (typeof GOALS)[number];

/** Indonesian labels for the UI. Single source so copy never drifts. */
export const LABELS: {
  experience: Record<ExperienceLevel, string>;
  background: Record<Background, string>;
  interest: Record<Interest, string>;
  workPreference: Record<WorkPreference, string>;
  goal: Record<Goal, string>;
} = {
  experience: {
    pemula: "Baru mulai",
    dasar: "Sudah coba sedikit",
    menengah: "Sudah bikin proyek",
    lanjut: "Sudah bekerja / mahir",
  },
  background: {
    pelajar: "Pelajar sekolah",
    mahasiswa: "Mahasiswa",
    "career-switcher": "Ganti karier",
    "fresh-graduate": "Fresh graduate",
    profesional: "Profesional",
  },
  interest: {
    "web-dev": "Web Development",
    data: "Data Science",
    ai: "Artificial Intelligence",
    "game-dev": "Game Development",
    "cyber-sec": "Cybersecurity",
    mobile: "Mobile Development",
  },
  workPreference: {
    remote: "Remote",
    hybrid: "Hybrid",
    onsite: "Onsite",
    fleksibel: "Fleksibel",
  },
  goal: {
    "dapat-kerja": "Cepat dapat kerja",
    "naik-level": "Naik level karier",
    "ganti-bidang": "Ganti bidang",
    portfolio: "Bangun portofolio",
    sertifikasi: "Ambil sertifikasi/badge",
  },
};

export function isExperienceLevel(value: unknown): value is ExperienceLevel {
  return typeof value === "string" && (EXPERIENCE_LEVELS as readonly string[]).includes(value);
}

export function isBackground(value: unknown): value is Background {
  return typeof value === "string" && (BACKGROUNDS as readonly string[]).includes(value);
}

export function isInterest(value: unknown): value is Interest {
  return typeof value === "string" && (INTERESTS as readonly string[]).includes(value);
}

export function isWorkPreference(value: unknown): value is WorkPreference {
  return typeof value === "string" && (WORK_PREFERENCES as readonly string[]).includes(value);
}

export function isGoal(value: unknown): value is Goal {
  return typeof value === "string" && (GOALS as readonly string[]).includes(value);
}

/** Interest → real course/job `Track` mapping. `null` = no native track yet. */
export function trackForInterest(interest: Interest): Track | null {
  switch (interest) {
    case "web-dev":
      return "web-dev";
    case "data":
    case "ai":
      return "data";
    case "game-dev":
      return "game-dev";
    case "cyber-sec":
      return "cyber-sec";
    case "mobile":
      return null;
  }
}

/** Experience bucket → the course `Level` to surface first. */
export function levelForExperience(experience: ExperienceLevel): Level {
  switch (experience) {
    case "pemula":
    case "dasar":
      return "dasar";
    case "menengah":
      return "menengah";
    case "lanjut":
      return "lanjut";
  }
}

/** Indonesian display label for a course/job `Level`. Single source. */
export function levelLabel(level: string): string {
  switch (level) {
    case "dasar":
      return "Pemula";
    case "menengah":
      return "Menengah";
    case "lanjut":
      return "Lanjutan";
    default:
      return level;
  }
}
