import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { normalizeOwner } from "@/lib/auth/types";
import { newSessionId, isValidSessionId } from "./ids";
import {
  boundMessages,
  isTutorMessage,
  isTutorSession,
  MAX_TUTOR_TITLE_CHARS,
  type TutorKonteks,
  type TutorMessage,
  type TutorSession,
  type TutorSessionEnvelope,
} from "./types";

/**
 * File-backed tutor session persistence.
 *
 * Why the filesystem and not the signed cookie the other stores use: a sidebar
 * of conversations is unbounded — N sessions, each with a full transcript —
 * and the inline `StudyChat` cookie already caps at 6 messages / 1800 chars
 * precisely because `cookies().set` fails *silently* past the ~4KB limit. A
 * session list in a cookie would lose data with no error. The filesystem has
 * no such cliff.
 *
 * ## On-disk layout (all under `DATA_ROOT`, gitignored)
 * ```
 * .data/tutor/
 *   <ownerHash>/<sessionId>.json
 * ```
 *
 * The owner directory is a **sha256 of the normalized email**, so a username
 * (attacker-influenced) can never traverse the tree. Session ids are validated
 * against a strict pattern *and* re-checked with `path.basename`; a session id
 * arriving from the URL is untrusted input even after the pattern test.
 *
 * ## Deployment caveat (documented, not hidden)
 * Writes go to the process CWD. That works for local dev and a long-running
 * Node host; a serverless platform mounts a read-only filesystem apart from
 * `/tmp`, so point `CAREERS_DATA_DIR` at a writable volume there. Failing
 * loudly is intentional — a session that silently does not persist is worse
 * than an error.
 */

export const DATA_ROOT =
  process.env.CAREERS_DATA_DIR ?? path.join(process.cwd(), ".data");

const TUTOR_DIR = path.join(DATA_ROOT, "tutor");

/** Per-process write chain, so concurrent turns cannot interleave read→write. */
let writeChain: Promise<unknown> = Promise.resolve();

function enqueueWrite<T>(job: () => Promise<T>): Promise<T> {
  const next = writeChain.then(job, job);
  // Keep the chain alive even if one job rejects.
  writeChain = next.catch(() => undefined);
  return next;
}

function ownerHash(owner: string): string {
  return createHash("sha256")
    .update(normalizeOwner(owner))
    .digest("hex")
    .slice(0, 32);
}

function ownerDir(owner: string): string {
  return path.join(TUTOR_DIR, ownerHash(owner));
}

/** Resolve a path under `dir`, refusing anything that escapes it. */
function safeJoin(dir: string, name: string): string {
  const base = path.basename(name);
  if (!base || base === "." || base === "..") {
    throw new Error("invalid tutor session id");
  }
  return path.join(dir, base);
}

async function readSessionFile(owner: string, sessionId: string): Promise<TutorSession | null> {
  if (!isValidSessionId(sessionId)) return null;
  let raw: string;
  try {
    raw = await readFile(safeJoin(ownerDir(owner), `${sessionId}.json`), "utf8");
  } catch {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      (parsed as TutorSessionEnvelope).version !== 1
    ) {
      return null;
    }
    const session = (parsed as TutorSessionEnvelope).session;
    // A file whose `owner` disagrees with the directory it lives in is
    // corrupt or tampered with. Never surface it.
    if (!isTutorSession(session) || session.owner !== normalizeOwner(owner)) {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

async function writeSessionFile(session: TutorSession): Promise<TutorSession> {
  const dir = ownerDir(session.owner);
  await mkdir(dir, { recursive: true });
  const envelope: TutorSessionEnvelope = { version: 1, session };
  const target = safeJoin(dir, `${session.id}.json`);
  const tmp = `${target}.${process.pid}.tmp`;
  await writeFile(tmp, `${JSON.stringify(envelope, null, 2)}\n`, "utf8");
  await rename(tmp, target);
  return session;
}

function nowIso(): string {
  return new Date().toISOString();
}

/** Create an empty session for `owner`. */
export async function createTutorSession(
  owner: string,
  options: { title?: string; konteks?: TutorKonteks } = {},
): Promise<TutorSession> {
  const timestamp = nowIso();
  const session: TutorSession = {
    id: newSessionId(),
    owner: normalizeOwner(owner),
    title: (options.title ?? "Percakapan baru").slice(0, MAX_TUTOR_TITLE_CHARS),
    createdAt: timestamp,
    updatedAt: timestamp,
    messages: [],
    ...(options.konteks ?? {}),
  };
  return enqueueWrite(() => writeSessionFile(session));
}

/**
 * What the session list needs, and nothing else.
 *
 * The rail renders three fields per row. Reading it the full `TutorSession`
 * meant reading — and then **serialising into the RSC payload** — every message
 * of every past conversation, on both tutor pages, because `TutorShell` is a
 * client component. At the store's own ceiling that is ~800KB per session of
 * transcript to draw a list of titles. So the list reads this projection
 * instead, and the full record is fetched only for the session actually open.
 */
export interface RingkasanTutorSession {
  id: string;
  title: string;
  updatedAt: string;
  createdAt: string;
  courseTitle?: string;
  moduleTitle?: string;
}

/** Every session for `owner` as a summary, newest first. */
export async function listRingkasanTutorSessions(
  owner: string,
): Promise<RingkasanTutorSession[]> {
  let entries: string[];
  try {
    entries = await readdir(ownerDir(owner));
  } catch {
    return [];
  }
  const sessions: RingkasanTutorSession[] = [];
  for (const entry of entries) {
    if (!entry.endsWith(".json")) continue;
    const session = await readSessionFile(owner, entry.slice(0, -".json".length));
    if (!session) continue;
    sessions.push({
      id: session.id,
      title: session.title,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      ...(session.courseTitle ? { courseTitle: session.courseTitle } : {}),
      ...(session.moduleTitle ? { moduleTitle: session.moduleTitle } : {}),
    });
  }
  return sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getTutorSession(
  owner: string,
  sessionId: string,
): Promise<TutorSession | null> {
  return readSessionFile(owner, sessionId);
}

/**
 * Re-anchor a session to a freshly resolved course/module.
 *
 * The tutor resolves the learner's path on **every** turn, so a conversation
 * started last week can legitimately be answered about a different module than
 * the one it was created against. Without this the activity drawer would keep
 * advertising a stale context that no longer matches what the model was
 * actually told — the panel would be confidently wrong.
 *
 * `updatedAt` is deliberately NOT touched: the conversation itself did not
 * change, and bumping it would reorder the sidebar for a non-event. Returns
 * null when the session is gone, so the caller can notice rather than assume.
 */
export async function setTutorKonteks(
  owner: string,
  sessionId: string,
  konteks: TutorKonteks,
): Promise<TutorSession | null> {
  if (!isValidSessionId(sessionId)) return null;
  return enqueueWrite(async () => {
    const session = await readSessionFile(owner, sessionId);
    if (!session) return null;
    // Replace the context wholesale: a module that is no longer current must
    // not linger beside the new one.
    const next: TutorSession = { ...session, ...konteks };
    return writeSessionFile(next);
  });
}

/** Append a message, refresh `updatedAt`, and adopt the title on first turn. */
export async function appendTutorMessage(
  owner: string,
  sessionId: string,
  message: TutorMessage,
): Promise<TutorSession | null> {
  if (!isTutorMessage(message)) return null;
  return enqueueWrite(async () => {
    const session = await readSessionFile(owner, sessionId);
    if (!session) return null;
    const next: TutorSession = {
      ...session,
      messages: boundMessages([...session.messages, message]),
      updatedAt: nowIso(),
    };
    return writeSessionFile(next);
  });
}

export async function renameTutorSession(
  owner: string,
  sessionId: string,
  title: string,
): Promise<TutorSession | null> {
  const trimmed = title.replace(/\s+/g, " ").trim();
  if (trimmed.length === 0) return null;
  return enqueueWrite(async () => {
    const session = await readSessionFile(owner, sessionId);
    if (!session) return null;
    return writeSessionFile({
      ...session,
      title: trimmed.slice(0, MAX_TUTOR_TITLE_CHARS),
      updatedAt: nowIso(),
    });
  });
}

export async function deleteTutorSession(owner: string, sessionId: string): Promise<boolean> {
  if (!isValidSessionId(sessionId)) return false;
  return enqueueWrite(async () => {
    // Confirm the session exists *and* belongs to this owner before removing.
    const session = await readSessionFile(owner, sessionId);
    if (!session) return false;
    await rm(safeJoin(ownerDir(owner), `${sessionId}.json`), { force: true });
    return true;
  });
}
