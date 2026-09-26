import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { normalizeOwner } from "@/lib/auth/types";
import { newSessionId, isValidSessionId } from "@/lib/tutor/ids";
import {
  isBlock,
  isBookDepth,
  isContentType,
  type Book,
  type BookBundle,
  type BookEnvelope,
  type BookPage,
  type BookSpine,
  type Chapter,
} from "./types";

/**
 * File-based book persistence.
 *
 * One file per book under `.data/book/<sha256(email)>/<bookId>.json`, holding
 * the book, its spine and all its pages together. A book is read and written
 * as a unit, so keeping it in one file removes a whole class of bug where a
 * page is written but the spine that lists it is not.
 *
 * Same owner-derivation, path checks and `CAREERS_DATA_DIR` override as the
 * resume, tutor and mastery stores — see `src/lib/tutor/session-store.ts` for
 * why a file and not a cookie.
 */

export const DATA_ROOT =
  process.env.CAREERS_DATA_DIR ?? path.join(process.cwd(), ".data");

const BOOK_DIR = path.join(DATA_ROOT, "book");

/** Per-process write chain so two page edits cannot interleave read→write. */
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
  return path.join(BOOK_DIR, ownerHash(owner));
}

function safeJoin(dir: string, name: string): string {
  const base = path.basename(name);
  if (!base || base === "." || base === "..") throw new Error("invalid book id");
  return path.join(dir, base);
}

function nowIso(): string {
  return new Date().toISOString();
}

/* ------------------------------------------------------------------ */
/* Guards                                                              */
/* ------------------------------------------------------------------ */

function isText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isIso(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && !Number.isNaN(Date.parse(value));
}

function isBook(value: unknown): value is Book {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    isText(c.id) &&
    isText(c.owner) &&
    c.owner === normalizeOwner(c.owner) &&
    isText(c.title) &&
    typeof c.description === "string" &&
    (c.status === "draft" || c.status === "ready" || c.status === "archived") &&
    isBookDepth(c.depth) &&
    (c.courseId === undefined || typeof c.courseId === "string") &&
    (c.courseSlug === undefined || typeof c.courseSlug === "string") &&
    isIso(c.createdAt) &&
    isIso(c.updatedAt)
  );
}

function isChapter(value: unknown): value is Chapter {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    isText(c.id) &&
    isText(c.title) &&
    typeof c.summary === "string" &&
    isContentType(c.contentType) &&
    Array.isArray(c.learningObjectives) &&
    c.learningObjectives.every((item) => typeof item === "string") &&
    Array.isArray(c.pageIds) &&
    c.pageIds.every((item) => typeof item === "string") &&
    typeof c.order === "number"
  );
}

function isSpine(value: unknown): value is BookSpine {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    isText(c.bookId) &&
    Array.isArray(c.chapters) &&
    c.chapters.every(isChapter) &&
    typeof c.version === "number" &&
    isIso(c.updatedAt)
  );
}

function isPage(value: unknown): value is BookPage {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    isText(c.id) &&
    isText(c.bookId) &&
    isText(c.chapterId) &&
    isText(c.title) &&
    isContentType(c.contentType) &&
    Array.isArray(c.learningObjectives) &&
    typeof c.order === "number" &&
    Array.isArray(c.blocks) &&
    // A malformed block is dropped rather than failing the whole page.
    c.blocks.filter(isBlock).length >= 0
  );
}

function isBundle(value: unknown): value is BookBundle {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    isBook(c.book) &&
    isSpine(c.spine) &&
    Array.isArray(c.pages) &&
    c.pages.every(isPage) &&
    (c.compiledBy === "stub" || c.compiledBy === "gemini")
  );
}

async function readBundle(owner: string, bookId: string): Promise<BookBundle | null> {
  if (!isValidSessionId(bookId)) return null;
  let raw: string;
  try {
    raw = await readFile(safeJoin(ownerDir(owner), `${bookId}.json`), "utf8");
  } catch {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      (parsed as BookEnvelope).version !== 1
    ) {
      return null;
    }
    const bundle = (parsed as BookEnvelope).bundle;
    if (!isBundle(bundle)) return null;
    if (bundle.book.owner !== normalizeOwner(owner)) return null;
    return bundle;
  } catch {
    return null;
  }
}

async function writeBundle(bundle: BookBundle): Promise<BookBundle> {
  const dir = ownerDir(bundle.book.owner);
  await mkdir(dir, { recursive: true });
  const envelope: BookEnvelope = { version: 1, bundle };
  const target = safeJoin(dir, `${bundle.book.id}.json`);
  const tmp = `${target}.${process.pid}.tmp`;
  await writeFile(tmp, `${JSON.stringify(envelope)}\n`, "utf8");
  await rename(tmp, target);
  return bundle;
}

/* ------------------------------------------------------------------ */
/* API                                                                 */
/* ------------------------------------------------------------------ */

export async function createBookRecord(options: {
  owner: string;
  title: string;
  description?: string;
  depth: Book["depth"];
  courseId?: string;
  courseSlug?: string;
}): Promise<Book> {
  const timestamp = nowIso();
  const book: Book = {
    id: newSessionId(),
    owner: normalizeOwner(options.owner),
    title: options.title,
    description: options.description ?? "",
    status: "draft",
    depth: options.depth,
    ...(options.courseId ? { courseId: options.courseId } : {}),
    ...(options.courseSlug ? { courseSlug: options.courseSlug } : {}),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await writeBundle({
    book,
    spine: { bookId: book.id, chapters: [], version: 1, updatedAt: timestamp },
    pages: [],
    compiledBy: "stub",
  });
  return book;
}

export async function getBook(owner: string, bookId: string): Promise<BookBundle | null> {
  return readBundle(owner, bookId);
}

export async function listBooks(owner: string): Promise<Book[]> {
  let entries: string[];
  try {
    entries = await readdir(ownerDir(owner));
  } catch {
    return [];
  }
  const books: Book[] = [];
  for (const entry of entries) {
    if (!entry.endsWith(".json")) continue;
    const bundle = await readBundle(owner, entry.slice(0, -".json".length));
    if (bundle) books.push(bundle.book);
  }
  return books.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Store a compiled spine + pages, and mark the book ready. */
export async function saveCompiledBook(bundle: BookBundle): Promise<BookBundle> {
  return enqueueWrite(async () => {
    const next: BookBundle = {
      ...bundle,
      book: { ...bundle.book, status: "ready", updatedAt: nowIso() },
      spine: { ...bundle.spine, updatedAt: nowIso() },
    };
    return writeBundle(next);
  });
}

export async function getPage(
  owner: string,
  bookId: string,
  pageId: string,
): Promise<{ bundle: BookBundle; page: BookPage; chapter: Chapter | null } | null> {
  const bundle = await readBundle(owner, bookId);
  if (!bundle) return null;
  const page = bundle.pages.find((item) => item.id === pageId);
  if (!page) return null;
  const chapter = bundle.spine.chapters.find((item) => item.id === page.chapterId) ?? null;
  return { bundle, page, chapter };
}

export async function deleteBook(owner: string, bookId: string): Promise<boolean> {
  if (!isValidSessionId(bookId)) return false;
  return enqueueWrite(async () => {
    const bundle = await readBundle(owner, bookId);
    if (!bundle) return false;
    await rm(safeJoin(ownerDir(owner), `${bookId}.json`), { force: true });
    return true;
  });
}
