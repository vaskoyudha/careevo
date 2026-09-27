import type { Level } from "@/types/domain";
import type { Course } from "@/types/course";
import { katalogBelajar, type EntriKatalog } from "@/lib/courses/katalog";
import { visibleJobs, type JobFixture } from "@/lib/fixtures";
import {
  levelForExperience,
  trackForInterest,
  type Interest,
  type OnboardingProfile,
} from "./types";

/**
 * Recommendation engine.
 *
 * Turns an `OnboardingProfile` into ranked, *real* courses and job postings.
 * Pure scoring is separated from data loading so it can be unit-tested without
 * touching cookies or the course store: `skorKursus` / `analisisLoker` take
 * plain data, `rekomendasiKursus` / `rekomendasiLoker` do the I/O.
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

/* ---------------------------------------------------------------------------
 * Job matching — "does this posting actually say what the learner wants?"
 *
 * The previous scorer concatenated `title + tags + description` into one
 * lowercase string and asked `hay.includes(keyword)`. That answers a different
 * question from the one the panel claims to answer, and it answers it wrongly in
 * both directions:
 *
 *  - **False positives.** Substring matching has no word boundaries, so `"ai"`
 *    fires inside "detail"/"maintain", `"ml"` fires inside "html", and `"web"`
 *    fires inside "webinar". A profile whose only interest was `ai` therefore
 *    scored postings that never mentioned AI at all, and those postings then
 *    out-ranked the ones that did — the panel was confidently wrong.
 *  - **False negatives.** A posting whose *description* is a precise fit but
 *    whose title says "Software Engineer" matched a single generic token or
 *    none, so it never reached the list no matter how well it described the
 *    work. Precision was thrown away because matching ignored *where* a keyword
 *    appeared.
 *
 * So the scorer now works on tokens, per field, and returns the evidence it
 * found. Three rules follow, and all three are load-bearing:
 *
 *  1. **Tokens, not substrings.** `tokenisasi` splits on every non-alphanumeric
 *     run, so `"Node.js"`, `"node js"` and `"node-js"` all reduce to the same
 *     two tokens and match the vocabulary entry `"Node.js"`, while `"ml"` can no
 *     longer hide inside `"html"`. Multi-word entries are matched as a
 *     *contiguous* token run, which is what keeps `"ai"` from matching
 *     `"ai engineer"`-free noise and lets `"React Native"` outrank a bare
 *     `"React"`.
 *  2. **Fields are not equal.** A keyword in the title is a statement of what
 *     the job *is*; the same keyword in the description is a requirement buried
 *     in a paragraph. `BOBOT_BUKTI` prices them 12 / 8 / 3, and a keyword is
 *     counted once, at the strongest field where it appears.
 *  3. **Breadth beats repetition.** A posting that names three of the skills in
 *     your interest is a better fit than one that repeats one of them, so a
 *     small bounded bonus rewards the number of *distinct* matches. Both the
 *     breadth bonus and the per-interest total are capped: without a cap, a
 *     keyword-stuffed description would out-rank level, work arrangement and the
 *     Sentinel verdict combined, and the ranking would drift back to
 *     "longest description wins".
 *
 * Because the evidence is returned, the card can show *why* it was picked
 * ("React · TypeScript · API") instead of asking the learner to trust a number.
 * ------------------------------------------------------------------------ */

/**
 * Interest → the vocabulary a posting must actually say to count as evidence.
 *
 * Written in display casing because these strings are shown on the card; matching
 * tokenizes them (see `tokenisasi`), so `"React Native"` and `"Node.js"` work
 * without any escaping. Entries are deliberately conservative: a term belongs
 * here only if seeing it in a posting genuinely predicts the work. That is why
 * `"api"` is absent (it describes almost every backend-adjacent job) and why
 * `"rest"` alone is absent while `"REST API"` is present.
 */
const BUKTI_MINAT: Record<Interest, readonly string[]> = {
  "web-dev": [
    "Frontend", "Backend", "Fullstack", "React", "Next.js", "Node.js", "JavaScript",
    "TypeScript", "HTML", "CSS", "Web", "REST API", "GraphQL", "Vite", "Web App",
  ],
  data: [
    "Data", "Data Analyst", "Analytics", "SQL", "Python", "Pandas", "NumPy", "ETL",
    "Tableau", "Power BI", "Big Data", "Data Engineering",
  ],
  ai: [
    "AI", "ML", "LLM", "NLP", "Machine Learning", "Deep Learning", "Generative AI",
    "Artificial Intelligence", "Computer Vision", "GPT", "OpenAI", "Chatbot",
  ],
  "game-dev": [
    "Game", "Game Developer", "Game Engine", "Godot", "Unity", "Unreal", "Game Studio",
  ],
  "cyber-sec": [
    "Security", "Cybersecurity", "Cyber", "Penetration Testing", "OWASP", "InfoSec",
    "Application Security", "Vulnerability", "Incident Response", "SOC", "SIEM",
  ],
  mobile: [
    "Mobile", "Mobile Developer", "Android", "iOS", "Flutter", "React Native", "Kotlin",
    "Swift", "Mobile App",
  ],
};

/**
 * What one matching keyword is worth, per field.
 *
 * Ordered strongest to weakest: a title is the posting's own summary of itself,
 * tags are the employer's own taxonomy, and the description is prose where the
 * same word may appear as an aside. These are *prices for evidence*, not a
 * probability — the caps in `analisisLoker` keep the total bounded.
 */
const BOBOT_BUKTI = {
  judul: 12,
  tag: 8,
  deskripsi: 3,
} as const;

/** Priority decay per interest position: the 1st choice counts fully, the 3rd half. */
const PELURUT_PRIORITAS = 0.25;

/**
 * Ceiling for one interest's evidence, applied *after* the breadth bonus.
 *
 * Without it the sum grows without bound in the length of the description, and
 * the three deliberate tie-breakers below (level, work arrangement, Sentinel
 * verdict) could not outrank a long paragraph. 40 is roughly "two strong
 * keywords plus a bonus", which is where a real posting's evidence saturates.
 */
const BATAS_BUKTI_MINAT = 40;

/** Each distinct keyword past the first is worth this much, up to {@link BATAS_LEBAR}. */
const NILAI_LEBAR = 2;
const BATAS_LEBAR = 4;

/** How many evidence words a card shows before it becomes a wall of chips. */
export const MAKSALAH_BUKTI_DITAMPILKAN = 3;

/**
 * Split text into lowercase alphanumeric tokens.
 *
 * Every non-alphanumeric *run* becomes a single separator, which is what makes
 * the tokenizer indifferent to `.`, `-`, `/`, `(`, `)` and `,`. `"Backend
 * Engineer (Node.js)"` therefore yields `["backend","engineer","node","js"]`, and
 * the vocabulary entry `"Node.js"` yields the same tail — so a keyword with a dot
 * in it needs no escaping anywhere in this file.
 */
function tokenisasi(teks: string): string[] {
  return teks.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

/**
 * Index of the first contiguous occurrence of `kata` inside `tokens`, or `-1`.
 *
 * Contiguity is the point: `"react native"` is evidence of a mobile posting and
 * `"react"` merely evidence of a web one, so the two must not be satisfied by the
 * same tokens in a different order.
 */
function posisiKata(tokens: readonly string[], kata: readonly string[]): number {
  if (kata.length === 0 || kata.length > tokens.length) return -1;
  for (let i = 0; i + kata.length <= tokens.length; i++) {
    let cocok = true;
    for (let j = 0; j < kata.length; j++) {
      if (tokens[i + j] !== kata[j]) {
        cocok = false;
        break;
      }
    }
    if (cocok) return i;
  }
  return -1;
}

/** Whether one vocabulary entry's tokens sit inside another's run (subset test). */
function berisiDiDalam(tokens: readonly string[], diDalam: readonly string[]): boolean {
  if (diDalam.length === 0 || tokens.length >= diDalam.length) return false;
  for (let i = 0; i + tokens.length <= diDalam.length; i++) {
    let cocok = true;
    for (let j = 0; j < tokens.length; j++) {
      if (diDalam[i + j] !== tokens[j]) {
        cocok = false;
        break;
      }
    }
    if (cocok) return true;
  }
  return false;
}

type Bukti = { label: string; bobot: number; token: string[] };

/** Everything the scorer concluded about one posting. */
export interface AnalisisLoker {
  /** Ranking score. 0 means "no evidence at all" — the gate, not a weak match. */
  skor: number;
  /**
   * The evidence words themselves, strongest field first, already deduplicated
   * so a posting matching both `"React Native"` and `"React"` shows the former.
   */
  cocok: string[];
}

/**
 * Match a posting against the profile, returning both the score and its evidence.
 *
 * The score is additive: bounded evidence first (the part the posting actually
 * controls), then the three deliberate tie-breakers the learner feels but a
 * posting cannot assert — level fit, work arrangement, and whether Sentinel
 * cleared it.
 */
export function analisisLoker(job: JobFixture, profile: OnboardingProfile): AnalisisLoker {
  const judul = tokenisasi(job.title);
  const tag = job.tags.flatMap((t) => tokenisasi(t));
  const deskripsi = tokenisasi(job.description);

  const semuaBukti: Bukti[] = [];
  let buktiTotal = 0;

  profile.interests.forEach((minat, urut) => {
    let jumlah = 0;
    const CocokMinat: Bukti[] = [];

    for (const label of BUKTI_MINAT[minat]) {
      const token = tokenisasi(label);

      // A keyword counts once, at the strongest field where it appears: a title
      // hit and a description hit are not two independent facts.
      let bobot = 0;
      if (posisiKata(judul, token) >= 0) bobot = Math.max(bobot, BOBOT_BUKTI.judul);
      if (posisiKata(tag, token) >= 0) bobot = Math.max(bobot, BOBOT_BUKTI.tag);
      if (posisiKata(deskripsi, token) >= 0) bobot = Math.max(bobot, BOBOT_BUKTI.deskripsi);
      if (bobot === 0) continue;

      jumlah += bobot;
      CocokMinat.push({ label, bobot, token });
    }

    // Gate: no interest matched anywhere, so nothing else may lift this posting.
    if (CocokMinat.length === 0) return;

    const lebar = Math.min(BATAS_LEBAR, (CocokMinat.length - 1) * NILAI_LEBAR);
    const prioritas = 1 - urut * PELURUT_PRIORITAS;
    buktiTotal += Math.min(jumlah + lebar, BATAS_BUKTI_MINAT) * prioritas;
    semuaBukti.push(... CocokMinat);
  });

  if (semuaBukti.length === 0) return { skor: 0, cocok: [] };

  let skor = buktiTotal;

  // Level fit.
  const target = levelForExperience(profile.experience);
  if (job.level === target) skor += 20;
  else if (levelDistance(job.level, target) === 1) skor += 8;

  // Work arrangement. `work_type` is the employer's own field; parsing
  // `location` is the fallback for postings that only carry the composed
  // "Jakarta · Hybrid" string.
  if (profile.workPreference === "fleksibel") skor += 6;
  else if (susunanKerja(job) === profile.workPreference) skor += 12;

  // Freshly-verified postings edge ahead.
  if (job.sentinel_status === "clean") skor += 8;

  return { skor, cocok: buktiTampil(semuaBukti) };
}

/** `work_type` when present, else the arrangement named inside `location`. */
function susunanKerja(job: JobFixture): string {
  const deklarasi = job.work_type?.trim().toLowerCase() ?? "";
  if (deklarasi) return deklarasi;

  const lokasi = job.location.toLowerCase();
  if (lokasi.includes("remote")) return "remote";
  if (lokasi.includes("hybrid")) return "hybrid";
  if (lokasi.includes("onsite") || lokasi.includes("on-site")) return "onsite";
  return "";
}

/**
 * Pick the words a card should show: strongest evidence first, no redundancy.
 *
 * The redundancy rule matters because the vocabularies overlap on purpose — a
 * React Native posting is evidence for both `web-dev` (`"React"`) and `mobile`
 * (`"React Native"`). Showing both would tell the learner the same thing twice.
 *
 * "Contained in" is tested against **every** match, not only the ones already
 * accepted, and that is not a stylistic choice. Ordering first by field weight
 * puts `"React"` (title, 12) ahead of `"React Native"` (tag, 8), so an
 * accept-as-you-go test drops the *specific* word and keeps the vague one —
 * exactly backwards. Containment here is a strict partial order (a token run can
 * only contain a shorter run), so dropping every word that has a longer match
 * present cannot cascade into dropping both halves of a pair.
 *
 * Ties keep vocabulary order, which keeps the output stable across runs.
 */
function buktiTampil(bukti: readonly Bukti[]): string[] {
  const adaYangLebihSpesifik = (item: Bukti): boolean =>
    bukti.some((lain) => lain !== item && berisiDiDalam(item.token, lain.token));

  return [...bukti]
    .sort((a, b) => b.bobot - a.bobot)
    .filter((item) => !adaYangLebihSpesifik(item))
    .slice(0, MAKSALAH_BUKTI_DITAMPILKAN)
    .map((item) => item.label);
}

/** Score-only view of {@link analisisLoker}, for callers that need no evidence. */
export function skorLoker(job: JobFixture, profile: OnboardingProfile): number {
  return analisisLoker(job, profile).skor;
}

/** Rank the live catalog. Zero-scored entries are dropped. */
export function rekomendasiKursus(
  katalog: EntriKatalog[],
  profile: OnboardingProfile,
  limit = 4,
): EntriKatalog[] {
  const catalogIndex = new Map(katalog.map((entry, index) => [entry.id, index]));

  return katalog
    .map((entry) => ({ entry, score: skorKursus(entry, profile) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => {
      const aIndex = catalogIndex.get(a.entry.id) ?? Number.MAX_SAFE_INTEGER;
      const bIndex = catalogIndex.get(b.entry.id) ?? Number.MAX_SAFE_INTEGER;
      return b.score - a.score || aIndex - bIndex || a.entry.id.localeCompare(b.entry.id);
    })
    .slice(0, limit)
    .map((row) => row.entry);
}

/** A ranked posting: the posting itself, plus the evidence that ranked it. */
export interface RekomendasiLoker {
  job: JobFixture;
  skor: number;
  /** Evidence words for the card, strongest first. Empty only when `skor` is 0. */
  cocok: string[];
}

/**
 * Rank visible (non-rejected) job postings.
 *
 * The evidence travels with the posting on purpose: the card shows *why* a row
 * was picked, and a ranking whose reasoning cannot be displayed is a ranking the
 * learner has to take on faith. `cocok` doubles as a tie-breaker — two postings
 * can reach the same score, and the one that matched more distinct evidence
 * words is the better-founded recommendation — with the title last so the order
 * stays deterministic across runs.
 */
export function rekomendasiLoker(
  jobs: JobFixture[],
  profile: OnboardingProfile,
  limit = 4,
): RekomendasiLoker[] {
  return jobs
    .map((job) => {
      const { skor, cocok } = analisisLoker(job, profile);
      return { job, skor, cocok };
    })
    .filter((row) => row.skor > 0)
    .sort(
      (a, b) =>
        b.skor - a.skor ||
        b.cocok.length - a.cocok.length ||
        a.job.title.localeCompare(b.job.title),
    )
    .slice(0, limit);
}

/** Convenience loader used by pages: fetch and rank in one call. */
export async function rekomendasiUntukProfil(profile: OnboardingProfile): Promise<{
  kursus: EntriKatalog[];
  loker: RekomendasiLoker[];
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
