import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  isResume,
  resumeKosong,
  type BerkasUpload,
  type Resume,
  type Slot,
} from "./types";

/**
 * File-based resume persistence.
 *
 * Why the filesystem (and not the HMAC cookie the other stores use): a resume
 * is unbounded — N jobs, N projects, and files up to 5MB. A JSON payload that
 * size cannot fit in a ~4KB cookie, and `cookies().set` fails *silently* past
 * the limit, so the profile would appear to save and then vanish. The
 * filesystem has no such cliff.
 *
 * ## On-disk layout (all under `DATA_ROOT`, gitignored)
 * ```
 * .data/resume/
 *   index/<ownerHash>.json      # ownerHash → { owner, username } lookup for /p/[username]
 *   profiles/<ownerHash>.json   # the structured resume
 *   files/<ownerHash>/<slug>.pdf  # uploaded CV / portfolio files
 * ```
 *
 * The owner directory is derived from a **sha256 of the normalized email**, so
 * a username (attacker-influenced) can never be used to traverse the tree. File
 * names are slugged by the caller and re-checked here with `path.basename`.
 *
 * ## Deployment caveat (documented, not hidden)
 * This writes to the process CWD. That works for local dev and a long-running
 * Node host, but a serverless platform (e.g. Vercel) mounts a **read-only**
 * filesystem apart from `/tmp`, so writes there fail. Set `CAREERS_DATA_DIR`
 * to a writable path (e.g. a mounted volume) in that case. Failing loudly is
 * intentional: a resume that silently does not persist is worse than an error.
 */

/** Root for all persisted data. Overridable so serverless can point at /tmp. */
export const DATA_ROOT =
  process.env.CAREERS_DATA_DIR ?? path.join(process.cwd(), ".data");

const RESUME_DIR = path.join(DATA_ROOT, "resume");
const PROFILE_DIR = path.join(RESUME_DIR, "profiles");
const INDEX_DIR = path.join(RESUME_DIR, "index");
const FILES_DIR = path.join(RESUME_DIR, "files");

function ownerHash(owner: string): string {
  return createHash("sha256")
    .update(owner.trim().toLowerCase())
    .digest("hex")
    .slice(0, 32);
}

/** Resolve a path under `dir`, refusing anything that escapes it. */
function safeJoin(dir: string, name: string): string {
  const base = path.basename(name);
  if (base !== name || base === "." || base === "..") {
    throw new Error(`Nama berkas tidak valid: ${name}`);
  }
  return path.join(dir, base);
}

async function bacaJson<T>(file: string): Promise<T | null> {
  try {
    const raw = await readFile(file, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function tulisJson(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  // Pretty-printed so the demo data is human-readable when inspecting `.data/`.
  await writeFile(file, JSON.stringify(value, null, 2), "utf8");
}

interface IndexEntry {
  owner: string;
  username: string;
  updatedAt: string;
}

export function normalizeOwner(owner: string): string {
  return owner.trim().toLowerCase();
}

/** Read the resume for an owner, or an empty one when none is stored yet. */
export async function ambilResume(owner: string): Promise<Resume> {
  const normalized = normalizeOwner(owner);
  const parsed = await bacaJson<unknown>(path.join(PROFILE_DIR, `${ownerHash(normalized)}.json`));
  if (isResume(parsed)) return parsed;
  return resumeKosong(normalized, "");
}

/** Read the resume for an owner, or `null` when none exists (no empty fallback). */
export async function ambilResumeAtauNull(owner: string): Promise<Resume | null> {
  const normalized = normalizeOwner(owner);
  const parsed = await bacaJson<unknown>(path.join(PROFILE_DIR, `${ownerHash(normalized)}.json`));
  return isResume(parsed) ? parsed : null;
}

/**
 * Persist a resume and refresh the username → owner index so the public page
 * can resolve it. The caller passes the full object; the store stamps
 * `updatedAt` and keeps the owner/username consistent.
 */
export async function simpanResume(resume: Resume): Promise<Resume> {
  const next: Resume = {
    ...resume,
    owner: normalizeOwner(resume.owner),
    username: resume.username.trim().replace(/^@/, ""),
    updatedAt: new Date().toISOString(),
  };

  await tulisJson(path.join(PROFILE_DIR, `${ownerHash(next.owner)}.json`), next);

  const entry: IndexEntry = {
    owner: next.owner,
    username: next.username,
    updatedAt: next.updatedAt,
  };
  if (next.username) {
    await tulisJson(path.join(INDEX_DIR, `${next.username.toLowerCase()}.json`), entry);
  }

  return next;
}

/**
 * Resolve a public profile by username. Returns the resume only when the
 * stored index points at a profile whose username still matches (so a renamed
 * handle does not leave a stale alias resolving to the old owner).
 */
export async function ambilResumeByUsername(username: string): Promise<Resume | null> {
  const key = username.trim().replace(/^@/, "").toLowerCase();
  if (!key) return null;
  const entry = await bacaJson<IndexEntry>(path.join(INDEX_DIR, `${key}.json`));
  if (!entry || typeof entry.owner !== "string") return null;

  const resume = await ambilResumeAtauNull(entry.owner);
  if (!resume) return null;
  return resume.username.toLowerCase() === key ? resume : null;
}

// ---------------------------------------------------------------------------
// Uploaded files
// ---------------------------------------------------------------------------

/**
 * Write an uploaded file for an owner and return its metadata. Overwrites any
 * previous file for the same slot so the owner directory never accumulates
 * orphans from repeated uploads.
 */
export async function simpanBerkas(
  owner: string,
  slot: Slot,
  namaAsli: string,
  bytes: Uint8Array,
): Promise<BerkasUpload> {
  const normalized = normalizeOwner(owner);
  const dir = path.join(FILES_DIR, ownerHash(normalized));
  await mkdir(dir, { recursive: true });

  // Remove any earlier file for this slot first (unknown old name).
  const existing = await readdir(dir).catch(() => [] as string[]);
  await Promise.all(
    existing
      .filter((f) => f.startsWith(`${slot}-`))
      .map((f) => rm(path.join(dir, f), { force: true })),
  );

  const nama = `${slot}-${Date.now()}.pdf`;
  await writeFile(safeJoin(dir, nama), bytes);

  return {
    nama,
    namaAsli: namaAsli.slice(0, 200),
    ukuran: bytes.byteLength,
    diunggahPada: new Date().toISOString(),
  };
}

/** Read an uploaded file's bytes for an owner + slot, or `null`. */
export async function ambilBerkas(
  owner: string,
  nama: string,
): Promise<Uint8Array | null> {
  const normalized = normalizeOwner(owner);
  const dir = path.join(FILES_DIR, ownerHash(normalized));
  const file = safeJoin(dir, nama);
  if (!existsSync(file)) return null;
  try {
    return await readFile(file);
  } catch {
    return null;
  }
}

/** Delete an uploaded file (used when the user removes their CV). */
export async function hapusBerkas(owner: string, nama: string): Promise<void> {
  const normalized = normalizeOwner(owner);
  const dir = path.join(FILES_DIR, ownerHash(normalized));
  await rm(safeJoin(dir, nama), { force: true });
}

/** Absolute directory holding an owner's uploaded files (for diagnostics). */
export function direktoriBerkas(owner: string): string {
  return path.join(FILES_DIR, ownerHash(normalizeOwner(owner)));
}
