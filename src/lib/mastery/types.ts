/**
 * Mastery Path domain types.
 *
 * Adapted from DeepTutor (HKUDS), v1.6.8. Apache License 2.0.
 * Source: deeptutor/learning/models.py
 * Source: https://github.com/HKUDS/DeepTutor
 * Source commit: a5eafa89072f6d7290a6854a6afc4ba060053beb
 * Original license: Apache License 2.0
 * Modified for Careevo: Pydantic models → plain TypeScript, snake_case →
 * camelCase, float epoch seconds → ISO date strings.
 */

/**
 * What kind of thing a knowledge point is. The type picks its review
 * schedule — a fact is checked often, a design decision rarely.
 */
export type KnowledgeType = "memory" | "concept" | "procedure" | "design";

export const KNOWLEDGE_TYPES: readonly KnowledgeType[] = [
  "memory",
  "concept",
  "procedure",
  "design",
];

/**
 * Mastery is a 0..1 estimate, never a "mastered" boolean. DeepTutor caps
 * confidence until enough attempts exist, so a single correct answer cannot
 * reach 1.0 — see `hitungPenguasaan`.
 */
export type MasteryLevel = number;

export interface KnowledgePoint {
  id: string;
  /** What the learner is being asked to know. */
  name: string;
  type: KnowledgeType;
  /** Course module this point belongs to, when it came from the catalog. */
  moduleId: string;
  /** Question bank entry used to test it, when one exists. */
  questionId?: string;
}

/** One graded attempt at a knowledge point. */
export interface Attempt {
  knowledgePointId: string;
  correct: boolean;
  at: string;
  /** Where the answer came from, so the review trail can be honest about it. */
  source: "session" | "review";
}

export interface RepetitionState {
  intervalIndex: number;
  consecutiveCorrect: number;
  consecutiveWrong: number;
  nextReviewAt: string;
}

export interface ReviewTask {
  id: string;
  knowledgePointId: string;
  knowledgeType: KnowledgeType;
  dueAt: string;
  priority: number;
  state: RepetitionState;
}

export type TopicStatus = "active" | "archived";

/** The learner-facing identity of a mastery topic. */
export interface MasteryTopic {
  id: string;
  owner: string;
  title: string;
  description: string;
  /** The course this topic was derived from, when it came from one. */
  courseId?: string;
  courseSlug?: string;
  status: TopicStatus;
  createdAt: string;
  updatedAt: string;
}

/** Everything the learner has done on one topic. */
export interface TopicProgress {
  attempts: Attempt[];
  states: Record<string, RepetitionState>;
  knowledgeTypes: Record<string, KnowledgeType>;
  /** Knowledge points still carrying an active error, which jump the queue. */
  errorPointIds: string[];
}

/** The knowledge points a topic teaches, plus its progress. */
export interface MasteryTopicBundle {
  topic: MasteryTopic;
  points: KnowledgePoint[];
  progress: TopicProgress;
}

export interface MasteryTopicEnvelope {
  version: 1;
  topic: MasteryTopic;
  points: KnowledgePoint[];
  progress: TopicProgress;
}

export function isKnowledgeType(value: unknown): value is KnowledgeType {
  return typeof value === "string" && (KNOWLEDGE_TYPES as readonly string[]).includes(value);
}

export function isIsoTimestamp(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && !Number.isNaN(Date.parse(value));
}

export function isKnowledgePoint(value: unknown): value is KnowledgePoint {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.id === "string" &&
    c.id.length > 0 &&
    typeof c.name === "string" &&
    c.name.length > 0 &&
    isKnowledgeType(c.type) &&
    typeof c.moduleId === "string" &&
    (c.questionId === undefined || typeof c.questionId === "string")
  );
}

export function isRepetitionState(value: unknown): value is RepetitionState {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.intervalIndex === "number" &&
    Number.isInteger(c.intervalIndex) &&
    c.intervalIndex >= 0 &&
    typeof c.consecutiveCorrect === "number" &&
    typeof c.consecutiveWrong === "number" &&
    isIsoTimestamp(c.nextReviewAt)
  );
}

export function isMasteryTopic(value: unknown): value is MasteryTopic {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.id === "string" &&
    c.id.length > 0 &&
    typeof c.owner === "string" &&
    c.owner.length > 0 &&
    c.owner === c.owner.trim().toLowerCase() &&
    typeof c.title === "string" &&
    c.title.length > 0 &&
    typeof c.description === "string" &&
    (c.courseId === undefined || typeof c.courseId === "string") &&
    (c.courseSlug === undefined || typeof c.courseSlug === "string") &&
    (c.status === "active" || c.status === "archived") &&
    isIsoTimestamp(c.createdAt) &&
    isIsoTimestamp(c.updatedAt)
  );
}
