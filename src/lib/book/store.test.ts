import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

// Dynamic import so DATA_ROOT binds to the temp dir, not the repo's cwd.
const TEMP_ROOT = await mkdtemp(path.join(tmpdir(), "careevo-book-store-"));
process.env.CAREERS_DATA_DIR = TEMP_ROOT;

const { createBookRecord, getBook, listBooks, saveCompiledBook, deleteBook, getPage } =
  await import("./store");

const OWNER = "reader@careevo.test";
const OTHER = "someone.else@careevo.test";

afterAll(async () => {
  await rm(TEMP_ROOT, { recursive: true, force: true });
});

describe("book store", () => {
  it("creates a book readable by its owner and invisible to anyone else", async () => {
    const book = await createBookRecord({
      owner: OWNER,
      title: "Buku uji",
      depth: "standard",
      courseId: "r1",
    });
    expect((await getBook(OWNER, book.id))?.book.title).toBe("Buku uji");
    expect(await getBook(OTHER, book.id)).toBeNull();
    expect((await listBooks(OWNER)).some((b) => b.id === book.id)).toBe(true);
    expect((await listBooks(OTHER)).some((b) => b.id === book.id)).toBe(false);
  });

  it("marks a compiled book ready and bumps updatedAt", async () => {
    const book = await createBookRecord({ owner: OWNER, title: "B", depth: "brief" });
    expect(book.status).toBe("draft");
    const bundle = await getBook(OWNER, book.id);
    const saved = await saveCompiledBook({
      book: bundle!.book,
      spine: { bookId: book.id, chapters: [], version: 1, updatedAt: new Date().toISOString() },
      pages: [],
      compiledBy: "stub",
    });
    expect(saved.book.status).toBe("ready");
    expect((await getBook(OWNER, book.id))?.book.status).toBe("ready");
  });

  it("refuses a path-escaping or malformed book id", async () => {
    await expect(getBook(OWNER, "../../etc/passwd")).resolves.toBeNull();
    await expect(getBook(OWNER, "..")).resolves.toBeNull();
    await expect(deleteBook(OWNER, "SHORT")).resolves.toBe(false);
  });

  it("deletes only the owner's own book", async () => {
    const book = await createBookRecord({ owner: OWNER, title: "B", depth: "standard" });
    expect(await deleteBook(OTHER, book.id)).toBe(false);
    expect(await deleteBook(OWNER, book.id)).toBe(true);
    expect(await getBook(OWNER, book.id)).toBeNull();
  });

  it("returns a page with its chapter, and null for a page that is not there", async () => {
    const book = await createBookRecord({ owner: OWNER, title: "B", depth: "standard" });
    const bundle = await getBook(OWNER, book.id);
    await saveCompiledBook({
      book: bundle!.book,
      spine: {
        bookId: book.id,
        chapters: [
          {
            id: "ch1",
            title: "Bab 1",
            summary: "",
            contentType: "theory",
            learningObjectives: [],
            pageIds: ["pg1"],
            order: 0,
          },
        ],
        version: 1,
        updatedAt: new Date().toISOString(),
      },
      pages: [
        {
          id: "pg1",
          bookId: book.id,
          chapterId: "ch1",
          title: "Halaman 1",
          contentType: "theory",
          learningObjectives: [],
          order: 0,
          blocks: [{ id: "bl1", type: "text", body: "halo" }],
        },
      ],
      compiledBy: "stub",
    });
    const found = await getPage(OWNER, book.id, "pg1");
    expect(found?.page.title).toBe("Halaman 1");
    expect(found?.chapter?.title).toBe("Bab 1");
    expect(await getPage(OWNER, book.id, "pg404")).toBeNull();
    expect(await getPage(OTHER, book.id, "pg1")).toBeNull();
  });

  // The mutation that must not survive: dropping the owner check would let any
  // account read any book by id, since ids are 12 chars of a known alphabet.
  it("ignores a file whose owner disagrees with the directory it sits in", async () => {
    const book = await createBookRecord({ owner: OWNER, title: "Rahasia", depth: "standard" });
    const dir = path.join(TEMP_ROOT, "book");
    const ownerDir = (await readdir(dir)).find((entry) => entry.length === 32);
    expect(ownerDir).toBeTruthy();
    const file = path.join(dir, ownerDir!, `${book.id}.json`);

    const bundle = await getBook(OWNER, book.id);
    await writeFile(
      file,
      JSON.stringify({
        version: 1,
        bundle: { ...bundle, book: { ...bundle!.book, owner: OTHER, title: "Dicuri" } },
      }),
      "utf8",
    );

    // The tampered file is not surfaced...
    expect(await getBook(OWNER, book.id)).toBeNull();
    // ...and the *other* account cannot use the path to reach it either.
    expect(await getBook(OTHER, book.id)).toBeNull();
  });

  it("ignores a corrupt or wrong-version file", async () => {
    const book = await createBookRecord({ owner: OWNER, title: "B", depth: "standard" });
    const dir = path.join(TEMP_ROOT, "book");
    const ownerDir = (await readdir(dir)).find((entry) => entry.length === 32);
    const file = path.join(dir, ownerDir!, `${book.id}.json`);

    await writeFile(file, "{ not json", "utf8");
    expect(await getBook(OWNER, book.id)).toBeNull();

    await writeFile(file, JSON.stringify({ version: 2, bundle: {} }), "utf8");
    expect(await getBook(OWNER, book.id)).toBeNull();
  });

  it("sorts books newest-updated first", async () => {
    const a = await createBookRecord({ owner: OWNER, title: "A", depth: "brief" });
    await new Promise((r) => setTimeout(r, 5));
    const b = await createBookRecord({ owner: OWNER, title: "B", depth: "brief" });
    const listed = await listBooks(OWNER);
    expect(listed.findIndex((x) => x.id === a.id)).toBeGreaterThanOrEqual(0);
    expect(listed.findIndex((x) => x.id === b.id)).toBeLessThan(
      listed.findIndex((x) => x.id === a.id),
    );
  });
});
