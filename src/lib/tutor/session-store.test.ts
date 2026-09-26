import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

// Point the store at a temp dir BEFORE importing it, so the test never
// touches the repo's real .data/. Same pattern as src/lib/resume/store.test.ts.
const TEMP_ROOT = await mkdtemp(path.join(tmpdir(), "careevo-tutor-"));
process.env.CAREERS_DATA_DIR = TEMP_ROOT;

const {
  appendTutorMessage,
  createTutorSession,
  deleteTutorSession,
  getTutorSession,
  listRingkasanTutorSessions,
  renameTutorSession,
  setTutorKonteks,
} = await import("./session-store");
const { newSessionId, isValidSessionId, titleFromMessage } = await import("./ids");
const { MAX_TUTOR_MESSAGES, MAX_TUTOR_MESSAGE_CHARS } = await import("./types");

const OWNER = "learner@careevo.test";
const OTHER = "intruder@careevo.test";

function message(role: "user" | "assistant", content: string, createdAt = "2026-09-25T00:00:00.000Z") {
  return { id: `${role}-${Math.random().toString(36).slice(2)}`, role, content, createdAt };
}

afterAll(async () => {
  await rm(TEMP_ROOT, { recursive: true, force: true });
});

describe("tutor session ids", () => {
  it("generates URL-safe ids that pass the validator", () => {
    for (let i = 0; i < 50; i += 1) {
      const id = newSessionId();
      expect(isValidSessionId(id)).toBe(true);
      expect(id).toHaveLength(12);
      expect(id).toMatch(/^[a-z2-9]+$/);
    }
  });

  it("rejects ids that could escape the store directory", () => {
    for (const bad of [
      "../../etc/passwd",
      "..",
      "a/b",
      "A".repeat(12), // uppercase is not in the alphabet
      "abcdefghijkl", // l is excluded to avoid confusion with 1
      "abcdefghijk0", // 0 is excluded
      "abcdefghijk1", // 1 is excluded
      "abcdefghijklm", // 13 chars
      "short",
      "",
      "abcdefghijk-",
      "abcdefghijk ",
    ]) {
      expect(isValidSessionId(bad)).toBe(false);
    }
  });

  it("accepts exactly the characters the generator can produce", () => {
    for (let i = 0; i < 200; i += 1) {
      expect(isValidSessionId(newSessionId())).toBe(true);
    }
    // Every symbol in the alphabet is accepted...
    for (const char of "abcdefghijkmnopqrstuvwxyz23456789") {
      expect(isValidSessionId(char.repeat(12))).toBe(true);
    }
    // ...and nothing outside it is. 0, 1 and l are the deliberate exclusions,
    // so every uppercase letter plus those three and two non-alphanumerics
    // must be refused.
    for (const char of "ABCDEFGHIJKLMNOPQRSTUVWXYZ01l-_") {
      expect(isValidSessionId(char.repeat(12))).toBe(false);
    }
  });
});

describe("titleFromMessage", () => {
  it("uses a short first message verbatim", () => {
    expect(titleFromMessage("Jelaskan closures")).toBe("Jelaskan closures");
  });

  it("collapses whitespace and truncates on a word boundary", () => {
    const title = titleFromMessage(`  hello \n\n  ${"word ".repeat(40)}`);
    expect(title.length).toBeLessThanOrEqual(81);
    expect(title.endsWith("…")).toBe(true);
    expect(title).not.toMatch(/wor…$/);
  });

  it("falls back for an empty message", () => {
    expect(titleFromMessage("   ")).toBe("Percakapan baru");
  });
});

describe("tutor session store", () => {
  it("creates a session readable by its owner and invisible to everyone else", async () => {
    const created = await createTutorSession(OWNER);
    expect(isValidSessionId(created.id)).toBe(true);
    expect(created.messages).toEqual([]);

    expect((await getTutorSession(OWNER, created.id))?.id).toBe(created.id);
    expect(await getTutorSession(OTHER, created.id)).toBeNull();

    const mine = await listRingkasanTutorSessions(OWNER);
    expect(mine.some((s) => s.id === created.id)).toBe(true);
    const theirs = await listRingkasanTutorSessions(OTHER);
    expect(theirs.some((s) => s.id === created.id)).toBe(false);
  });

  it("appends messages in order and preserves them across a read", async () => {
    const session = await createTutorSession(OWNER);
    await appendTutorMessage(OWNER, session.id, message("user", "pertanyaan satu"));
    await appendTutorMessage(OWNER, session.id, message("assistant", "jawaban satu"));
    const loaded = await getTutorSession(OWNER, session.id);
    expect(loaded?.messages.map((m) => m.content)).toEqual([
      "pertanyaan satu",
      "jawaban satu",
    ]);
  });

  it("keeps only the newest messages and bounds message length", async () => {
    const session = await createTutorSession(OWNER);
    for (let i = 0; i < MAX_TUTOR_MESSAGES + 5; i += 1) {
      await appendTutorMessage(OWNER, session.id, message("user", `m${i}`));
    }
    const loaded = await getTutorSession(OWNER, session.id);
    expect(loaded?.messages).toHaveLength(MAX_TUTOR_MESSAGES);
    expect(loaded?.messages[0]?.content).toBe("m5");

    await appendTutorMessage(
      OWNER,
      session.id,
      message("assistant", "x".repeat(MAX_TUTOR_MESSAGE_CHARS + 500)),
    );
    const bounded = await getTutorSession(OWNER, session.id);
    const last = bounded?.messages[bounded.messages.length - 1];
    expect(last?.content).toHaveLength(MAX_TUTOR_MESSAGE_CHARS);
    expect(last?.truncated).toBe(true);
  });

  it("renames a session and refuses a blank title", async () => {
    const session = await createTutorSession(OWNER);
    expect((await renameTutorSession(OWNER, session.id, "  Ulangi  CSS  grid "))?.title).toBe(
      "Ulangi CSS grid",
    );
    expect(await renameTutorSession(OWNER, session.id, "   ")).toBeNull();
    expect((await getTutorSession(OWNER, session.id))?.title).toBe("Ulangi CSS grid");
  });

  it("deletes only the owner's own session", async () => {
    const session = await createTutorSession(OWNER);
    expect(await deleteTutorSession(OTHER, session.id)).toBe(false);
    expect(await getTutorSession(OWNER, session.id)).not.toBeNull();

    expect(await deleteTutorSession(OWNER, session.id)).toBe(true);
    expect(await getTutorSession(OWNER, session.id)).toBeNull();
    expect(await deleteTutorSession(OWNER, session.id)).toBe(false);
  });

  it("rejects a malformed or path-escaping session id instead of throwing", async () => {
    await expect(getTutorSession(OWNER, "../../../../etc/passwd")).resolves.toBeNull();
    await expect(deleteTutorSession(OWNER, "..")).resolves.toBe(false);
    await expect(appendTutorMessage(OWNER, "bad/id", message("user", "hi"))).resolves.toBeNull();
  });

  it("ignores a corrupt or owner-mismatched file on disk", async () => {
    const session = await createTutorSession(OWNER);
    const dir = path.join(TEMP_ROOT, "tutor");
    // Find the owner's hash directory by locating the session we just wrote.
    const owners = await readdir(dir);
    const ownerDir = owners.find((d) => d.length === 32);
    expect(ownerDir).toBeTruthy();

    const file = path.join(dir, ownerDir!, `${session.id}.json`);
    await writeFile(file, "{ not json", "utf8");
    expect(await getTutorSession(OWNER, session.id)).toBeNull();
    expect((await listRingkasanTutorSessions(OWNER)).some((s) => s.id === session.id)).toBe(false);

    // A well-formed file claiming a different owner is rejected too.
    await mkdir(dir, { recursive: true });
    await writeFile(
      file,
      JSON.stringify({
        version: 1,
        session: { ...session, owner: "someone.else@example.com" },
      }),
      "utf8",
    );
    expect(await getTutorSession(OWNER, session.id)).toBeNull();

    // Sanity: the file really is unreadable, not merely skipped by a bad path.
    const onDisk = await readFile(file, "utf8");
    expect(onDisk).toContain("someone.else@example.com");
  });

  it("sorts sessions newest-updated first", async () => {
    const a = await createTutorSession(OWNER, { title: "A" });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const b = await createTutorSession(OWNER, { title: "B" });
    await appendTutorMessage(OWNER, a.id, message("user", "触碰 A"));
    const listed = await listRingkasanTutorSessions(OWNER);
    expect(listed.findIndex((s) => s.id === a.id)).toBeLessThan(
      listed.findIndex((s) => s.id === b.id),
    );
  });
});

describe("tutor session context", () => {
  const KONTEKS_A = {
    courseId: "r1",
    courseTitle: "Belajar HTML & CSS dari Nol",
    moduleId: "r1-m1",
    moduleTitle: "Memperkenalkan HTML",
  };

  it("stores ids and titles together, and the summary carries the titles", async () => {
    const session = await createTutorSession(OWNER, { konteks: KONTEKS_A });
    const loaded = await getTutorSession(OWNER, session.id);
    expect(loaded).toMatchObject(KONTEKS_A);

    // The rail draws titles, and it only ever receives the summary — so a title
    // that never reaches the summary is a title the learner cannot see.
    const ringkasan = (await listRingkasanTutorSessions(OWNER)).find(
      (s) => s.id === session.id,
    );
    expect(ringkasan?.courseTitle).toBe("Belajar HTML & CSS dari Nol");
    expect(ringkasan?.moduleTitle).toBe("Memperkenalkan HTML");
  });

  it("re-anchors to a new module and drops the context it replaces", async () => {
    const session = await createTutorSession(OWNER, { konteks: KONTEKS_A });
    const updated = await setTutorKonteks(OWNER, session.id, {
      courseId: "r3",
      courseTitle: "React Fundamentals",
      moduleId: "r3-m2",
      moduleTitle: "State & Props",
    });
    expect(updated).toMatchObject({
      courseId: "r3",
      courseTitle: "React Fundamentals",
      moduleId: "r3-m2",
    });
    // A module that is no longer current must not linger beside the new one.
    expect(updated?.moduleTitle).toBe("State & Props");
    expect((await getTutorSession(OWNER, session.id))?.courseId).toBe("r3");
  });

  it("re-anchoring does not reorder the sidebar", async () => {
    const session = await createTutorSession(OWNER, { title: "Ctx" });
    await appendTutorMessage(OWNER, session.id, message("user", "halo"));
    const before = (await getTutorSession(OWNER, session.id))!.updatedAt;
    await new Promise((resolve) => setTimeout(resolve, 5));
    await setTutorKonteks(OWNER, session.id, KONTEKS_A);
    // updatedAt is the sort key for the whole list, so a context refresh must
    // not float the conversation to the top as if it had just been used.
    expect((await getTutorSession(OWNER, session.id))?.updatedAt).toBe(before);
  });

  it("refuses to re-anchor someone else's session or a malformed id", async () => {
    const session = await createTutorSession(OWNER, { konteks: KONTEKS_A });
    expect(await setTutorKonteks(OTHER, session.id, { courseId: "r9" })).toBeNull();
    expect(await setTutorKonteks(OWNER, "../etc", { courseId: "r9" })).toBeNull();
    expect((await getTutorSession(OWNER, session.id))?.courseId).toBe("r1");
  });

  it("rejects a stored context that is not made of non-empty strings", async () => {
    const session = await createTutorSession(OWNER);
    const dir = path.join(TEMP_ROOT, "tutor");
    const ownerDir = (await readdir(dir)).find((d) => d.length === 32);
    const file = path.join(dir, ownerDir!, `${session.id}.json`);
    await writeFile(
      file,
      JSON.stringify({
        version: 1,
        session: { ...session, courseTitle: "" },
      }),
      "utf8",
    );
    // An empty title is not a title. Accepting it would put a blank label in
    // the drawer, which is the exact failure the title was added to prevent.
    expect(await getTutorSession(OWNER, session.id)).toBeNull();
  });
});
