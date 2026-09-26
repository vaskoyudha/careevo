import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { normalizeOwner } from "@/lib/auth/types";
import { newSessionId, isValidSessionId } from "@/lib/tutor/ids";
import {
  isKnowledgePoint,
  isMasteryTopic,
  isRepetitionState,
  type Attempt,
  type KnowledgePoint,
  type MasteryTopic,
  type MasteryTopicBundle,
  type MasteryTopicEnvelope,
  type RepetitionState,
  type ReviewTask,
  type TopicProgress,
} from "./types";
import { antreanJatuhTempo, bangunAntreanTinjauan, jadwalkanBerikutnya } from "./scoring";

/**
 * File-backed mastery-path persistence.
 *
 * Why the filesystem and not a signed cookie: a topic carries an unbounded
 * attempt history and a review queue, and `cookies().set` fails *silently*
 * past the ~4KB limit — the learner would watch a topic appear to save and then
 * vanish. Same reasoning (and the same `CAREERS_DATA_DIR` override) as the
 * resume store.
 *
 * ## On-disk layout (all under `DATA_ROOT`, gitignored)
 * ```
 * .data/mastery/<ownerHash>/<topicId>.json
 * ```
 *
 * The owner directory is a **sha256 of the normalized email**, so an
 * attacker-influenced id can never traverse the tree. Ids are validated
 * against a strict pattern *and* re-checked with `path.basename`, because a
 * topic id arriving from the URL is untrusted input even after the pattern
 * test. A file whose `owner` disagrees with its directory is ignored, never
 * surfaced.
 */

export const DATA_ROOT =
  process.env.CAREERS_DATA_DIR ?? path.join(process.cwd(), ".data");

const MASTERY_DIR = path.join(DATA_ROOT, "mastery");

/** Per-process write chain so concurrent attempts cannot interleave read→write. */
let writeChain: Promise<unknown> = Promise.resolve();

function enqueueWrite<T>(job: () => Promise<T>): Promise<T> {
  const next = writeChain.then(job, job);
  writeChain = next.catch(() => undefined);
  return next;
}

function ownerHash(owner: string): string {
  return createHash("sha256").update(normalizeOwner(owner)).digest("hex").slice(0, 32);
}

function ownerDir(owner: string): string {
  return path.join(MASTERY_DIR, ownerHash(owner));
}

function safeJoin(dir: string, name: string): string {
  const base = path.basename(name);
  if (!base || base === "." || base === "..") throw new Error("invalid mastery topic id");
  return path.join(dir, base);
}

function nowIso(): string {
  return new Date().toISOString();
}

function emptyProgress(): TopicProgress {
  return { attempts: [], states: {}, knowledgeTypes: {}, errorPointIds: [] };
}

function isAttempt(value: unknown): value is Attempt {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.knowledgePointId === "string" &&
    c.knowledgePointId.length > 0 &&
    typeof c.correct === "boolean" &&
    typeof c.at === "string" &&
    !Number.isNaN(Date.parse(c.at)) &&
    (c.source === "session" || c.source === "review")
  );
}

function isTopicProgress(value: unknown): value is TopicProgress {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    Array.isArray(c.attempts) &&
    c.attempts.every(isAttempt) &&
    typeof c.states === "object" &&
    c.states !== null &&
    Object.values(c.states as Record<string, unknown>).every(isRepetitionState) &&
    typeof c.knowledgeTypes === "object" &&
    c.knowledgeTypes !== null &&
    Array.isArray(c.errorPointIds) &&
    c.errorPointIds.every((id) => typeof id === "string")
  );
}

function isEnvelope(value: unknown): value is MasteryTopicEnvelope {
  if (typeof value !== "object" || value === null) return false;
  const c = value as MasteryTopicEnvelope;
  return c.version === 1 && isMasteryTopic(c.topic) && Array.isArray(c.points) &&
    c.points.every(isKnowledgePoint) && isTopicProgress(c.progress);
}

async function readBundle(owner: string, topicId: string): Promise<MasteryTopicBundle | null> {
  if (!isValidSessionId(topicId)) return null;
  let raw: string;
  try {
    raw = await readFile(safeJoin(ownerDir(owner), `${topicId}.json`), "utf8");
  } catch {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isEnvelope(parsed)) return null;
    if (parsed.topic.owner !== normalizeOwner(owner)) return null;
    return { topic: parsed.topic, points: parsed.points, progress: parsed.progress };
  } catch {
    return null;
  }
}

async function writeBundle(bundle: MasteryTopicBundle): Promise<MasteryTopicBundle> {
  const dir = ownerDir(bundle.topic.owner);
  await mkdir(dir, { recursive: true });
  const envelope: MasteryTopicEnvelope = {
    version: 1,
    topic: bundle.topic,
    points: bundle.points,
    progress: bundle.progress,
  };
  const target = safeJoin(dir, `${bundle.topic.id}.json`);
  const tmp = `${target}.${process.pid}.tmp`;
  await writeFile(tmp, `${JSON.stringify(envelope, null, 2)}\n`, "utf8");
  await rename(tmp, target);
  return bundle;
}

export async function createMasteryTopic(options: {
  owner: string;
  title: string;
  description?: string;
  courseId?: string;
  courseSlug?: string;
  points: KnowledgePoint[];
}): Promise<MasteryTopicBundle> {
  const timestamp = nowIso();
  const topic: MasteryTopic = {
    id: newSessionId(),
    owner: normalizeOwner(options.owner),
    title: options.title,
    description: options.description ?? "",
    ...(options.courseId ? { courseId: options.courseId } : {}),
    ...(options.courseSlug ? { courseSlug: options.courseSlug } : {}),
    status: "active",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  return writeBundle({ topic, points: options.points, progress: emptyProgress() });
}

export async function listMasteryTopics(owner: string): Promise<MasteryTopic[]> {
  let entries: string[];
  try {
    entries = await readdir(ownerDir(owner));
  } catch {
    return [];
  }
  const topics: MasteryTopic[] = [];
  for (const entry of entries) {
    if (!entry.endsWith(".json")) continue;
    const bundle = await readBundle(owner, entry.slice(0, -".json".length));
    if (bundle) topics.push(bundle.topic);
  }
  return topics.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getMasteryTopic(
  owner: string,
  topicId: string,
): Promise<MasteryTopicBundle | null> {
  return readBundle(owner, topicId);
}

export async function archiveMasteryTopic(owner: string, topicId: string): Promise<boolean> {
  return enqueueWrite(async () => {
    const bundle = await readBundle(owner, topicId);
    if (!bundle) return false;
    await writeBundle({
      ...bundle,
      topic: { ...bundle.topic, status: "archived", updatedAt: nowIso() },
    });
    return true;
  });
}

/**
 * Record a graded attempt and advance that point's review schedule.
 *
 * The schedule is updated here rather than in the UI, so a review that is
 * answered anywhere — a study session or the due queue — moves the same
 * counter. The wrong-answer bookkeeping mirrors DeepTutor's error list: the
 * point stays "in error" until it is answered correctly, and a point with an
 * active error jumps the review queue.
 */
export async function recordAttempt(
  owner: string,
  topicId: string,
  attempt: Attempt,
): Promise<MasteryTopicBundle | null> {
  if (!isAttempt(attempt)) return null;
  return enqueueWrite(async () => {
    const bundle = await readBundle(owner, topicId);
    if (!bundle) return null;
    if (!bundle.points.some((point) => point.id === attempt.knowledgePointId)) return null;

    const type =
      bundle.points.find((point) => point.id === attempt.knowledgePointId)?.type ?? "memory";
    const previous = bundle.progress.states[attempt.knowledgePointId];
    const next: RepetitionState = previous
      ? jadwalkanBerikutnya(previous, type, attempt.correct, Date.now())
      : jadwalkanBerikutnya(
          { intervalIndex: 0, consecutiveCorrect: 0, consecutiveWrong: 0, nextReviewAt: nowIso() },
          type,
          attempt.correct,
          Date.now(),
        );

    const errorPointIds = new Set(bundle.progress.errorPointIds);
    if (attempt.correct) errorPointIds.delete(attempt.knowledgePointId);
    else errorPointIds.add(attempt.knowledgePointId);

    return writeBundle({
      ...bundle,
      topic: { ...bundle.topic, updatedAt: nowIso() },
      progress: {
        attempts: [...bundle.progress.attempts, attempt],
        states: { ...bundle.progress.states, [attempt.knowledgePointId]: next },
        knowledgeTypes: { ...bundle.progress.knowledgeTypes, [attempt.knowledgePointId]: type },
        errorPointIds: [...errorPointIds],
      },
    });
  });
}

/**
 * The due queue for a topic, highest priority first.
 *
 * Filters to what is actually due at `now` rather than returning the whole
 * schedule — the review trail needs the full set, but "what should I revise
 * today" is the question this screen actually asks. `now` is injectable so the
 * policy is testable without waiting for real days to pass.
 */
export function reviewQueueFor(
  bundle: MasteryTopicBundle,
  now = Date.now(),
  maxTasks = 5,
): ReviewTask[] {
  return antreanJatuhTempo(
    bangunAntreanTinjauan(
      bundle.progress.states,
      bundle.progress.knowledgeTypes,
      bundle.progress.errorPointIds,
    ),
    now,
    maxTasks,
  );
}

export async function deleteMasteryTopic(owner: string, topicId: string): Promise<boolean> {
  if (!isValidSessionId(topicId)) return false;
  return enqueueWrite(async () => {
    const bundle = await readBundle(owner, topicId);
    if (!bundle) return false;
    await rm(safeJoin(ownerDir(owner), `${topicId}.json`), { force: true });
    return true;
  });
}
