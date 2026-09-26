import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import type { ModulKursus } from "@/lib/courses/kurikulum";
import type { KnowledgePoint } from "./types";

// Point the store at a temp dir BEFORE importing it, so the test never touches
// the repo's real .data/ — same pattern as resume/store.test.ts. The import
// must be *dynamic*: a static `import ... from "./store"` is hoisted and
// evaluated above this assignment, so DATA_ROOT would bind to the real cwd.
const TEMP_ROOT = await mkdtemp(path.join(tmpdir(), "careevo-mastery-"));
process.env.CAREERS_DATA_DIR = TEMP_ROOT;

const {
  archiveMasteryTopic,
  createMasteryTopic,
  deleteMasteryTopic,
  getMasteryTopic,
  listMasteryTopics,
  recordAttempt,
  reviewQueueFor,
} = await import("./store");
const { turunkanPoinPenguasaan, judulTopikDefault, deskripsiTopikDefault } = await import(
  "./topic-tree"
);
const { hitungPenguasaan, DAY_MS } = await import("./scoring");

const OWNER = "learner@careevo.test";
const OTHER = "intruder@careevo.test";

function point(id: string, type: KnowledgePoint["type"] = "concept"): KnowledgePoint {
  return { id, name: `Poin ${id}`, type, moduleId: "m1" };
}

// Named `modul`, not `module`: the Next.js lint rule forbids assigning
// to a variable called `module` (it shadows the CommonJS global).
function modul(over: Partial<ModulKursus> = {}): ModulKursus {
  return {
    id: "m1",
    judul: "Pengenalan closures",
    ringkasan: "Ringkasan singkat.",
    durasi_min: 30,
    url: "/belajar/r1",
    ...over,
  } as ModulKursus;
}

afterAll(async () => {
  await rm(TEMP_ROOT, { recursive: true, force: true });
});

describe("turunkanPoinPenguasaan", () => {
  it("produces one point for a thin module and more for a substantial one", () => {
    const thin = turunkanPoinPenguasaan([modul({ ringkasan: "Singkat." })]);
    expect(thin).toHaveLength(1);
    const rich = turunkanPoinPenguasaan([modul({ ringkasan: "x".repeat(250) })]);
    expect(rich).toHaveLength(3);
  });

  it("classifies a how-to module as a procedure", () => {
    const [p] = turunkanPoinPenguasaan([modul({ judul: "Membangun layout", ringkasan: "" })]);
    expect(p?.type).toBe("procedure");
  });

  it("classifies a concept module as a concept", () => {
    const [p] = turunkanPoinPenguasaan([modul({ judul: "Apa itu closure", ringkasan: "" })]);
    expect(p?.type).toBe("concept");
  });

  it("is stable — same modules, same ids, so history stays attached", () => {
    const modules = [modul({ id: "m1" }), modul({ id: "m2" })];
    expect(turunkanPoinPenguasaan(modules)).toEqual(turunkanPoinPenguasaan(modules));
  });

  it("gives every point a distinct id across modules", () => {
    const points = turunkanPoinPenguasaan([
      modul({ id: "m1", ringkasan: "x".repeat(250) }),
      modul({ id: "m2", ringkasan: "x".repeat(250) }),
    ]);
    expect(new Set(points.map((p) => p.id)).size).toBe(points.length);
  });

  it("returns nothing for a course with no modules", () => {
    expect(turunkanPoinPenguasaan([])).toEqual([]);
  });

  it("builds a readable default title and description", () => {
    const course = { id: "r1", title: "HTML & CSS", provider: "MDN", slug: "r1" };
    expect(judulTopikDefault(course as never)).toContain("HTML & CSS");
    expect(deskripsiTopikDefault(course as never)).toContain("MDN");
  });
});

describe("mastery store", () => {
  it("creates a topic readable by its owner and invisible to others", async () => {
    const bundle = await createMasteryTopic({
      owner: OWNER,
      title: "Kuasai closures",
      points: [point("kp1")],
    });
    expect((await getMasteryTopic(OWNER, bundle.topic.id))?.topic.title).toBe("Kuasai closures");
    expect(await getMasteryTopic(OTHER, bundle.topic.id)).toBeNull();
  });

  it("records an attempt and updates the mastery and review state", async () => {
    const bundle = await createMasteryTopic({ owner: OWNER, title: "T", points: [point("kp1")] });
    const updated = await recordAttempt(OWNER, bundle.topic.id, {
      knowledgePointId: "kp1",
      correct: true,
      at: new Date().toISOString(),
      source: "session",
    });
    expect(updated?.progress.attempts).toHaveLength(1);
    expect(updated?.progress.states.kp1).toBeDefined();
    expect(updated?.progress.errorPointIds).toHaveLength(0);
  });

  it("keeps a wrong answer in the error list until it is answered right", async () => {
    const bundle = await createMasteryTopic({ owner: OWNER, title: "T", points: [point("kp1")] });
    await recordAttempt(OWNER, bundle.topic.id, {
      knowledgePointId: "kp1", correct: false, at: new Date().toISOString(), source: "session",
    });
    const afterWrong = await getMasteryTopic(OWNER, bundle.topic.id);
    expect(afterWrong?.progress.errorPointIds).toContain("kp1");

    await recordAttempt(OWNER, bundle.topic.id, {
      knowledgePointId: "kp1", correct: true, at: new Date().toISOString(), source: "review",
    });
    const afterRight = await getMasteryTopic(OWNER, bundle.topic.id);
    expect(afterRight?.progress.errorPointIds).not.toContain("kp1");
  });

  it("rejects an attempt against a point the topic does not teach", async () => {
    const bundle = await createMasteryTopic({ owner: OWNER, title: "T", points: [point("kp1")] });
    // A knowledgePointId is attacker-supplied: it comes from a form. An id the
    // topic does not teach must be refused outright, not recorded.
    const updated = await recordAttempt(OWNER, bundle.topic.id, {
      knowledgePointId: "nope", correct: true, at: new Date().toISOString(), source: "session",
    });
    expect(updated).toBeNull();
    const persisted = await getMasteryTopic(OWNER, bundle.topic.id);
    expect(persisted?.progress.attempts).toHaveLength(0);
  });

  it("builds a due queue that prioritises the errored point", async () => {
    const bundle = await createMasteryTopic({
      owner: OWNER, title: "T", points: [point("a"), point("b")],
    });
    // A wrong answer schedules b one interval out (concept = 3 days) but marks
    // it as an error, which is what buys it priority. `now` is far enough ahead
    // that both points are due, so only the priority ordering is under test.
    await recordAttempt(OWNER, bundle.topic.id, {
      knowledgePointId: "b", correct: false, at: new Date().toISOString(), source: "session",
    });
    await recordAttempt(OWNER, bundle.topic.id, {
      knowledgePointId: "a", correct: true, at: new Date().toISOString(), source: "session",
    });
    const fresh = await getMasteryTopic(OWNER, bundle.topic.id);
    const queue = reviewQueueFor(fresh!, Date.now() + 365 * DAY_MS, 10);
    expect(queue.find((t) => t.knowledgePointId === "b")?.priority).toBe(1);
  });

  it("returns an empty due queue before anything is due", async () => {
    const bundle = await createMasteryTopic({ owner: OWNER, title: "T", points: [point("a")] });
    await recordAttempt(OWNER, bundle.topic.id, {
      knowledgePointId: "a", correct: true, at: new Date().toISOString(), source: "session",
    });
    const fresh = await getMasteryTopic(OWNER, bundle.topic.id);
    // A concept point is not due again for 3 days.
    expect(reviewQueueFor(fresh!, Date.now())).toEqual([]);
  });

  it("archives and deletes only the owner's own topic", async () => {
    const bundle = await createMasteryTopic({ owner: OWNER, title: "T", points: [point("kp1")] });
    expect(await archiveMasteryTopic(OWNER, bundle.topic.id)).toBe(true);
    expect((await getMasteryTopic(OWNER, bundle.topic.id))?.topic.status).toBe("archived");
    expect(await deleteMasteryTopic(OTHER, bundle.topic.id)).toBe(false);
    expect(await deleteMasteryTopic(OWNER, bundle.topic.id)).toBe(true);
  });

  it("refuses a path-escaping or malformed id", async () => {
    await expect(getMasteryTopic(OWNER, "../../etc/passwd")).resolves.toBeNull();
    await expect(deleteMasteryTopic(OWNER, "..")).resolves.toBe(false);
    await expect(deleteMasteryTopic(OWNER, "SHORT")).resolves.toBe(false);
  });

  it("ignores a corrupt or owner-mismatched file", async () => {
    const bundle = await createMasteryTopic({ owner: OWNER, title: "T", points: [point("kp1")] });
    const dir = path.join(TEMP_ROOT, "mastery");
    const ownerDir = (await readdir(dir)).find((entry) => entry.length === 32);
    expect(ownerDir).toBeTruthy();
    const file = path.join(dir, ownerDir!, `${bundle.topic.id}.json`);

    await writeFile(file, "{ not json", "utf8");
    expect(await getMasteryTopic(OWNER, bundle.topic.id)).toBeNull();

    await writeFile(
      file,
      JSON.stringify({
        version: 1,
        topic: { ...bundle.topic, owner: "someone.else@example.com" },
        points: bundle.points,
        progress: bundle.progress,
      }),
      "utf8",
    );
    expect(await getMasteryTopic(OWNER, bundle.topic.id)).toBeNull();
  });

  it("sorts topics newest-updated first", async () => {
    const a = await createMasteryTopic({ owner: OWNER, title: "A", points: [point("a")] });
    await new Promise((r) => setTimeout(r, 5));
    const b = await createMasteryTopic({ owner: OWNER, title: "B", points: [point("b")] });
    await recordAttempt(OWNER, a.topic.id, {
      knowledgePointId: "a", correct: true, at: new Date().toISOString(), source: "session",
    });
    const listed = await listMasteryTopics(OWNER);
    expect(listed.findIndex((t) => t.id === a.topic.id)).toBeLessThan(
      listed.findIndex((t) => t.id === b.topic.id),
    );
  });
});

describe("topik dari lowongan", () => {
  it("persists jobId and reads it back", async () => {
    const created = await createMasteryTopic({
      owner: OWNER,
      title: "Kuasai kebutuhan Frontend Engineer",
      description: "Jalur dari lowongan.",
      jobId: "1",
      points: [point("kp1")],
    });
    const bundle = await getMasteryTopic(OWNER, created.topic.id);
    expect(bundle?.topic.jobId).toBe("1");

    const topics = await listMasteryTopics(OWNER);
    expect(topics.find((t) => t.id === created.topic.id)?.jobId).toBe("1");
  });

  it("keeps course-derived topics without a jobId", async () => {
    const created = await createMasteryTopic({
      owner: OWNER,
      title: "Kuasai React",
      courseId: "c1",
      courseSlug: "react-dasar",
      points: [point("kp1")],
    });
    const bundle = await getMasteryTopic(OWNER, created.topic.id);
    expect(bundle?.topic.jobId).toBeUndefined();
  });
});

describe("the mastery loop end to end", () => {
  it("moves a point from untouched to scheduled-for-review", async () => {
    const bundle = await createMasteryTopic({ owner: OWNER, title: "Loop", points: [point("kp1")] });
    const start = Date.now();
    await recordAttempt(OWNER, bundle.topic.id, {
      knowledgePointId: "kp1", correct: true, at: new Date(start).toISOString(), source: "session",
    });
    const after = await getMasteryTopic(OWNER, bundle.topic.id);
    const state = after!.progress.states.kp1!;
    // memory intervals start at 0 days, so a first correct pushes one step out.
    expect(Date.parse(state.nextReviewAt)).toBeGreaterThanOrEqual(start);
    const mastery = hitungPenguasaan(after!.progress.attempts.map((a) => a.correct));
    expect(mastery).toBeGreaterThan(0);
    // And it shows up in the queue once due.
    const dueSoon = reviewQueueFor(after!, start + 40 * DAY_MS, 10);
    expect(dueSoon.map((t) => t.knowledgePointId)).toContain("kp1");
  });
});
