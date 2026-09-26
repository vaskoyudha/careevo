import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { normalizeOwner } from "@/lib/auth/types";
import { newSessionId, isValidSessionId } from "@/lib/tutor/ids";
import {
  isLatihanBundle,
  type Latihan,
  type LatihanBundle,
  type LatihanEnvelope,
  type PercobaanSoal,
  type SoalLatihan,
} from "./types";

/**
 * File-based quiz-attempt persistence.
 *
 * One file per latihan under `.data/latihan/<sha256(email)>/<latihanId>.json`,
 * holding the questions and their attempts together. That is the deliberate
 * divergence from the *existing* course quiz bank (`src/lib/courses/kuis.ts`),
 * which grades in the browser and stores nothing: a browser-graded quiz cannot
 * power a history, and this feature is explicitly the notebook-style one
 * ported from DeepTutor. Reusing the bank would also have meant shipping
 * correct answers twice — once for rendering, once to score server-side.
 *
 * Same owner-derivation, path checks and `CAREERS_DATA_DIR` override as the
 * resume, tutor, mastery and book stores — see `src/lib/mastery/store.ts` for
 * why a file and not a cookie.
 */

export const DATA_ROOT =
  process.env.CAREERS_DATA_DIR ?? path.join(process.cwd(), ".data");

const LATIHAN_DIR = path.join(DATA_ROOT, "latihan");

/** Per-process write chain so two answers cannot interleave read→write. */
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
  return path.join(LATIHAN_DIR, ownerHash(owner));
}

function safeJoin(dir: string, name: string): string {
  const base = path.basename(name);
  if (!base || base === "." || base === "..") throw new Error("invalid latihan id");
  return path.join(dir, base);
}

function nowIso(): string {
  return new Date().toISOString();
}

/* ------------------------------------------------------------------ */
/* Disk I/O                                                            */
/* ------------------------------------------------------------------ */

async function readBundle(owner: string, latihanId: string): Promise<LatihanBundle | null> {
  if (!isValidSessionId(latihanId)) return null;
  let raw: string;
  try {
    raw = await readFile(safeJoin(ownerDir(owner), `${latihanId}.json`), "utf8");
  } catch {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      (parsed as LatihanEnvelope).version !== 1
    ) {
      return null;
    }
    const bundle = (parsed as LatihanEnvelope).bundle;
    if (!isLatihanBundle(bundle)) return null;
    // A file whose owner disagrees with its directory is ignored, never
    // surfaced. Otherwise a copied file would let one learner read another's
    // history, because the directory is the only thing that scopes the lookup.
    if (bundle.latihan.owner !== normalizeOwner(owner)) return null;
    return bundle;
  } catch {
    return null;
  }
}

async function writeBundle(bundle: LatihanBundle): Promise<LatihanBundle> {
  const dir = ownerDir(bundle.latihan.owner);
  await mkdir(dir, { recursive: true });
  const envelope: LatihanEnvelope = { version: 1, bundle };
  const target = safeJoin(dir, `${bundle.latihan.id}.json`);
  const tmp = `${target}.${process.pid}.tmp`;
  await writeFile(tmp, `${JSON.stringify(envelope)}\n`, "utf8");
  await rename(tmp, target);
  return bundle;
}

/* ------------------------------------------------------------------ */
/* API                                                                 */
/* ------------------------------------------------------------------ */

export async function createLatihan(options: {
  owner: string;
  judul: string;
  topik: string;
  tingkat: Latihan["tingkat"];
  tipe: Latihan["tipe"];
  courseId?: string;
  courseSlug?: string;
}): Promise<Latihan> {
  const timestamp = nowIso();
  const latihan: Latihan = {
    id: newSessionId(),
    owner: normalizeOwner(options.owner),
    judul: options.judul,
    topik: options.topik,
    tingkat: options.tingkat,
    tipe: options.tipe,
    ...(options.courseId ? { courseId: options.courseId } : {}),
    ...(options.courseSlug ? { courseSlug: options.courseSlug } : {}),
    disusunOleh: "stub",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await writeBundle({ latihan, soal: [], percobaan: [] });
  return latihan;
}

/** Store a generated question set and mark the latihan as generated. */
export async function saveSoal(
  latihan: Latihan,
  soal: SoalLatihan[],
  disusunOleh: Latihan["disusunOleh"],
): Promise<LatihanBundle> {
  return enqueueWrite(async () => {
    const next: LatihanBundle = {
      latihan: { ...latihan, disusunOleh, updatedAt: nowIso() },
      soal,
      percobaan: [],
    };
    return writeBundle(next);
  });
}

export async function getLatihan(
  owner: string,
  latihanId: string,
): Promise<LatihanBundle | null> {
  return readBundle(owner, latihanId);
}

export async function listLatihan(owner: string): Promise<Latihan[]> {
  let entries: string[];
  try {
    entries = await readdir(ownerDir(owner));
  } catch {
    return [];
  }
  const hasil: Latihan[] = [];
  for (const entry of entries) {
    if (!entry.endsWith(".json")) continue;
    const bundle = await readBundle(owner, entry.slice(0, -".json".length));
    if (bundle) hasil.push(bundle.latihan);
  }
  return hasil.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * Upsert one attempt, keyed by question.
 *
 * Mirrors DeepTutor's UNIQUE `(session_id, turn_id, question_id)` notebook
 * constraint: re-answering a question replaces its row rather than appending,
 * so a bundle holds at most one current answer per question. The read happens
 * *inside* the write chain, otherwise two rapid answers would both read the old
 * list and the second would drop the first.
 */
export async function recordAttempt(
  owner: string,
  latihanId: string,
  attempt: PercobaanSoal,
): Promise<LatihanBundle | null> {
  if (!isValidSessionId(latihanId)) return null;
  return enqueueWrite(async () => {
    const bundle = await readBundle(owner, latihanId);
    if (!bundle) return null;
    // Reject an attempt for a question this latihan does not contain. Without
    // this, a crafted soalId would grow the file with rows no question can
    // ever read back — unbounded growth from one request.
    if (!bundle.soal.some((soal) => soal.id === attempt.soalId)) return null;

    const percobaan = bundle.percobaan.filter((item) => item.soalId !== attempt.soalId);
    percobaan.push(attempt);
    return writeBundle({
      ...bundle,
      percobaan,
      latihan: { ...bundle.latihan, updatedAt: nowIso() },
    });
  });
}

/** Drop every attempt, so the learner can retake the same questions clean. */
export async function resetAttempts(
  owner: string,
  latihanId: string,
): Promise<LatihanBundle | null> {
  return enqueueWrite(async () => {
    const bundle = await readBundle(owner, latihanId);
    if (!bundle) return null;
    return writeBundle({
      ...bundle,
      percobaan: [],
      latihan: { ...bundle.latihan, updatedAt: nowIso() },
    });
  });
}

export async function deleteLatihan(owner: string, latihanId: string): Promise<boolean> {
  if (!isValidSessionId(latihanId)) return false;
  return enqueueWrite(async () => {
    const bundle = await readBundle(owner, latihanId);
    if (!bundle) return false;
    await rm(safeJoin(ownerDir(owner), `${latihanId}.json`), { force: true });
    return true;
  });
}
