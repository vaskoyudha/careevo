/**
 * Mastery scoring + spaced-repetition scheduling.
 *
 * Adapted from DeepTutor (HKUDS), v1.6.8. Apache License 2.0.
 * Source: deeptutor/learning/mastery.py
 * Source: deeptutor/learning/scheduler.py
 * Source: https://github.com/HKUDS/DeepTutor
 * Source commit: a5eafa89072f6d7290a6854a6afc4ba060053beb
 * Original license: Apache License 2.0
 * Modified for Careevo: Python → TypeScript; epoch seconds → ISO strings; the
 * scheduler's wall-clock reads are now injected so the policy is testable and
 * a "due" review means the same thing on every machine.
 *
 * These two functions are the pedagogy. The schedule is the product, so they
 * are ported exactly rather than reinvented — a "nicer" interval table would
 * be a silent behaviour change dressed as an improvement.
 */

import type { KnowledgeType, RepetitionState, ReviewTask } from "./types";

/** Recency weights for the most recent attempts (oldest → newest). */
const RECENCY_WEIGHTS = [0.5, 0.7, 0.85, 0.95, 1.0] as const;

/**
 * Mastery cannot exceed this until enough attempts accumulate, so one or two
 * correct answers cannot declare a point "mastered".
 */
const CONFIDENCE_CAP: Readonly<Record<number, number>> = { 1: 0.5, 2: 0.8 };

/**
 * A knowledge point's mastery in 0..1 from its attempt outcomes.
 *
 * Newer attempts count for more, so recovery after early mistakes is
 * rewarded rather than permanently penalised.
 */
export function hitungPenguasaan(correctness: readonly boolean[]): number {
  if (correctness.length === 0) return 0;
  const recent = correctness.slice(-RECENCY_WEIGHTS.length);
  const weights = RECENCY_WEIGHTS.slice(-recent.length);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const earned = recent.reduce(
    (sum, correct, index) => sum + (correct ? (weights[index] ?? 0) : 0),
    0,
  );
  const score = total === 0 ? 0 : earned / total;
  return Math.min(score, CONFIDENCE_CAP[recent.length] ?? 1);
}

/** Review intervals in **days**, by knowledge type. */
export const INTERVAL_SEQUENCES: Readonly<Record<KnowledgeType, readonly number[]>> = {
  memory: [0, 1, 3, 7, 14, 30, 60],
  concept: [3, 7, 14, 30],
  procedure: [3, 7, 14],
  design: [14, 28],
};

/** Higher sorts later: a procedure is worth reviewing before a fact. */
const TYPE_PRIORITY: Readonly<Record<KnowledgeType, number>> = {
  memory: 2,
  concept: 3,
  procedure: 4,
  design: 5,
};

export const DAY_MS = 86_400_000;

export function initialRepetitionState(
  knowledgeType: KnowledgeType,
  now: number,
): RepetitionState {
  const intervals = INTERVAL_SEQUENCES[knowledgeType];
  return {
    intervalIndex: 0,
    consecutiveCorrect: 0,
    consecutiveWrong: 0,
    nextReviewAt: new Date(now + (intervals[0] ?? 0) * DAY_MS).toISOString(),
  };
}

/**
 * Advance a knowledge point's review schedule after an attempt.
 *
 * Two correct in a row jumps two intervals (the reward for a real streak); a
 * wrong answer steps back one, so a shaky point resurfaces sooner. Both ends
 * are clamped, and a point that has been answered wrongly twice is considered
 * "re-entered" rather than still on its old streak.
 */
export function jadwalkanBerikutnya(
  state: RepetitionState,
  knowledgeType: KnowledgeType,
  isCorrect: boolean,
  now: number,
): RepetitionState {
  const intervals = INTERVAL_SEQUENCES[knowledgeType];
  const maxIndex = intervals.length - 1;

  let { intervalIndex, consecutiveCorrect, consecutiveWrong } = state;

  if (isCorrect) {
    consecutiveWrong = 0;
    consecutiveCorrect += 1;
    intervalIndex = consecutiveCorrect >= 2 ? intervalIndex + 2 : intervalIndex + 1;
    if (consecutiveCorrect >= 2) consecutiveCorrect = 0;
  } else {
    consecutiveWrong += 1;
    consecutiveCorrect = 0;
    intervalIndex = Math.max(0, intervalIndex - 1);
    if (consecutiveWrong >= 2) consecutiveWrong = 0;
  }

  const clamped = Math.max(0, Math.min(intervalIndex, maxIndex));
  return {
    intervalIndex: clamped,
    consecutiveCorrect,
    consecutiveWrong,
    nextReviewAt: new Date(now + (intervals[clamped] ?? 0) * DAY_MS).toISOString(),
  };
}

/**
 * The review plan for a knowledge type, written from `INTERVAL_SEQUENCES`
 * itself rather than typed out beside it. A hand-written "mingguan" label is
 * a second source of truth that will eventually disagree with the table — and
 * a schedule the learner cannot trust is not a schedule.
 *
 * A leading `0` means the first review falls due immediately, so it is not
 * part of the spacing the learner is being shown.
 */
export function rentangTinjauan(knowledgeType: KnowledgeType): string {
  const days = INTERVAL_SEQUENCES[knowledgeType].filter((d) => d > 0);
  if (days.length === 0) return "tanpa jadwal tetap";
  if (days.length === 1) return `${days[0]} hari`;
  return `${days.join(" → ")} hari`;
}

/** Everything due at `now`, highest priority first. */
export function antreanJatuhTempo(
  tasks: readonly ReviewTask[],
  now: number,
  maxTasks = 5,
): ReviewTask[] {
  return tasks
    .filter((task) => Date.parse(task.dueAt) <= now)
    .sort((a, b) => a.priority - b.priority || Date.parse(a.dueAt) - Date.parse(b.dueAt))
    .slice(0, maxTasks);
}

/** The full review queue, ordered by when each item comes due. */
export function bangunAntreanTinjauan(
  states: Readonly<Record<string, RepetitionState>>,
  knowledgeTypes: Readonly<Record<string, KnowledgeType>>,
  errorPointIds: readonly string[],
): ReviewTask[] {
  const errors = new Set(errorPointIds);
  return Object.entries(states).map(([knowledgePointId, state]) => {
    const type = knowledgeTypes[knowledgePointId] ?? "memory";
    return {
      id: `review_${knowledgePointId}`,
      knowledgePointId,
      knowledgeType: type,
      dueAt: state.nextReviewAt,
      // A point the learner got wrong jumps the queue.
      priority: errors.has(knowledgePointId) ? 1 : TYPE_PRIORITY[type],
      state,
    };
  });
}
