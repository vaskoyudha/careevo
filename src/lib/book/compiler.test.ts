import { describe, expect, it } from "vitest";
import type { EntriKatalog } from "@/lib/courses/katalog";
import type { ModulKursus } from "@/lib/courses/kurikulum";
import type { Book } from "./types";
import { isBlock } from "./types";
import { StubBookCompiler, type CompileInput } from "./compiler";
import { parseBlocks } from "./compiler-gemini";

const COURSE = {
  id: "r1",
  slug: "r1",
  title: "Belajar HTML & CSS dari Nol",
  provider: "MDN",
  level: "dasar",
  tags: ["web-dev"],
  duration_min: 120,
  url: "/belajar/r1",
  type: "course",
  is_free: true,
  completed: false,
} as EntriKatalog;

function module(over: Partial<ModulKursus> = {}): ModulKursus {
  return {
    id: "r1-m1",
    judul: "Orientasi dan peta konsep",
    ringkasan:
      "Modul ini menjelaskan dasarnya. Kamu akan belajar istilah dasar. Akhirnya kamu bisa merangkum sendiri.",
    durasi_min: 30,
    url: "/belajar/r1#kurikulum",
    ...over,
  } as ModulKursus;
}

const BOOK: Book = {
  id: "bk1",
  owner: "learner@careevo.test",
  title: "Buku: Belajar HTML & CSS dari Nol",
  description: "",
  status: "draft",
  depth: "standard",
  courseId: "r1",
  courseSlug: "r1",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function input(over: Partial<CompileInput> = {}): CompileInput {
  return { book: BOOK, course: COURSE, modules: [module()], ...over };
}

describe("StubBookCompiler", () => {
  it("produces one chapter and one page per module", async () => {
    const result = await new StubBookCompiler().compile(
      input({ modules: [module({ id: "m1" }), module({ id: "m2" }), module({ id: "m3" })] }),
    );
    expect(result.spine.chapters).toHaveLength(3);
    expect(result.pages).toHaveLength(3);
    expect(result.compiledBy).toBe("stub");
  });

  it("links each chapter to its page", async () => {
    const result = await new StubBookCompiler().compile(input());
    const [chapter] = result.spine.chapters;
    expect(chapter?.pageIds).toEqual([result.pages[0]?.id]);
  });

  it("produces only valid blocks", async () => {
    const result = await new StubBookCompiler().compile(input());
    for (const page of result.pages) {
      expect(page.blocks.length).toBeGreaterThan(0);
      for (const block of page.blocks) {
        expect(isBlock(block)).toBe(true);
      }
    }
  });

  it("always includes a quiz whose answer index is valid", async () => {
    const result = await new StubBookCompiler().compile(input());
    const quiz = result.pages[0]?.blocks.find((b) => b.type === "quiz");
    expect(quiz?.type).toBe("quiz");
    if (quiz?.type === "quiz") {
      expect(quiz.correctIndex).toBeGreaterThanOrEqual(0);
      expect(quiz.correctIndex).toBeLessThan(quiz.options.length);
    }
  });

  it("is deterministic — the same modules give the same book", async () => {
    const a = await new StubBookCompiler().compile(input());
    const b = await new StubBookCompiler().compile(input());
    expect(a.pages[0]?.blocks).toEqual(b.pages[0]?.blocks);
    expect(a.spine.chapters[0]?.title).toBe(b.spine.chapters[0]?.title);
  });

  it("surfaces the learner's stated intent when given one", async () => {
    const result = await new StubBookCompiler().compile(input({ intent: "aku bingung soal flexbox" }));
    const callout = result.pages[0]?.blocks.find((b) => b.type === "callout" && b.title === "Tujuanmu");
    expect(callout?.type).toBe("callout");
    if (callout?.type === "callout") expect(callout.body).toContain("flexbox");
  });

  it("scales the target length with depth", async () => {
    const brief = await new StubBookCompiler().compile(input({ book: { ...BOOK, depth: "brief" } }));
    const deep = await new StubBookCompiler().compile(input({ book: { ...BOOK, depth: "deep" } }));
    const wordsOf = (blocks: { type: string; body?: string }[]) =>
      blocks.filter((b) => b.type === "text").map((b) => b.body ?? "").join(" ").split(/\s+/).length;
    expect(wordsOf(deep.pages[0]!.blocks)).toBeGreaterThan(wordsOf(brief.pages[0]!.blocks));
  });

  it("classifies practice and reference modules", async () => {
    const result = await new StubBookCompiler().compile(
      input({
        modules: [
          module({ id: "m1", judul: "Latihan soal", ringkasan: "Kerjakan latihan." }),
          module({ id: "m2", judul: "Ringkasan cepat", ringkasan: "Hafalan." }),
        ],
      }),
    );
    expect(result.spine.chapters[0]?.contentType).toBe("practice");
    expect(result.spine.chapters[1]?.contentType).toBe("reference");
  });

  it("does not call a chapter practice just because its summary mentions practising", async () => {
    // The regression this guards: scanning the summary marked nearly every
    // chapter "practice", so the label stopped meaning anything.
    const result = await new StubBookCompiler().compile(
      input({
        modules: [
          module({
            id: "m1",
            judul: "Mendalami HTML",
            ringkasan: "Di akhir modul kamu bisa mempraktikkannya sendiri di browser.",
          }),
        ],
      }),
    );
    expect(result.spine.chapters[0]?.contentType).toBe("theory");
  });

  it("handles a course with no modules without throwing", async () => {
    const result = await new StubBookCompiler().compile(input({ modules: [] }));
    expect(result.pages).toEqual([]);
    expect(result.spine.chapters).toEqual([]);
  });

  it("never emits HTML — no block carries a tag", async () => {
    const result = await new StubBookCompiler().compile(input());
    for (const page of result.pages) {
      for (const block of page.blocks) {
        const text = JSON.stringify(block);
        expect(text).not.toMatch(/<\/?(script|div|span|iframe|img|svg)\b/i);
      }
    }
  });
});

describe("parseBlocks", () => {
  it("accepts a bare array", () => {
    const blocks = parseBlocks(JSON.stringify([{ id: "x", type: "text", body: "halo" }]));
    expect(blocks).toHaveLength(1);
    const [block] = blocks;
    expect(block?.type).toBe("text");
    if (block?.type === "text") expect(block.body).toBe("halo");
  });

  it("accepts a { blocks: [...] } wrapper", () => {
    const blocks = parseBlocks(JSON.stringify({ blocks: [{ id: "x", type: "text", body: "halo" }] }));
    expect(blocks).toHaveLength(1);
  });

  it("strips a json code fence", () => {
    const blocks = parseBlocks('```json\n[{"id":"x","type":"text","body":"halo"}]\n```');
    expect(blocks).toHaveLength(1);
  });

  // The point of validating: one bad block must not cost the whole page.
  it("drops a malformed block but keeps the good ones", () => {
    const blocks = parseBlocks(
      JSON.stringify([
        { id: "a", type: "text", body: "bagus" },
        { id: "b", type: "text" },
        { id: "c", type: "quiz", question: "q", options: ["a"], correctIndex: 9, explanation: "e" },
        { id: "d", type: "heading", level: 2, body: "kepala" },
      ]),
    );
    expect(blocks).toHaveLength(2);
    expect(blocks.map((b) => b.type)).toEqual(["text", "heading"]);
  });

  it("rejects an unknown block type outright", () => {
    expect(parseBlocks(JSON.stringify([{ id: "x", type: "concept_graph", data: {} }]))).toEqual([]);
  });

  it("returns nothing for unparseable or unexpected input", () => {
    expect(parseBlocks("bukan json")).toEqual([]);
    expect(parseBlocks("{}")).toEqual([]);
    expect(parseBlocks("42")).toEqual([]);
  });

  // The guard that makes a bad model response cost one block instead of the
  // page. Without it, a quiz whose answer index points past its own options
  // renders as a question nobody can ever get right.
  it("rejects a quiz whose correctIndex falls outside its options", () => {
    const blocks = parseBlocks(
      JSON.stringify([
        {
          id: "x",
          type: "quiz",
          question: "q",
          options: ["satu", "dua"],
          correctIndex: 7,
          explanation: "e",
        },
      ]),
    );
    expect(blocks).toEqual([]);
  });

  it("rejects a quiz with fewer than two options", () => {
    const blocks = parseBlocks(
      JSON.stringify([
        { id: "x", type: "quiz", question: "q", options: ["satu"], correctIndex: 0, explanation: "e" },
      ]),
    );
    expect(blocks).toEqual([]);
  });

  it("rejects a non-integer correctIndex", () => {
    const blocks = parseBlocks(
      JSON.stringify([
        { id: "x", type: "quiz", question: "q", options: ["a", "b"], correctIndex: 0.5, explanation: "e" },
      ]),
    );
    expect(blocks).toEqual([]);
  });

  it("rejects a flashcard with an empty face", () => {
    const blocks = parseBlocks(
      JSON.stringify([{ id: "x", type: "flashcards", cards: [{ front: "", back: "b" }] }]),
    );
    expect(blocks).toEqual([]);
  });

  it("rejects a figure with no alt text", () => {
    const blocks = parseBlocks(
      JSON.stringify([{ id: "x", type: "figure", src: "/a.png", caption: "" }]),
    );
    expect(blocks).toEqual([]);
  });

  it("keeps a valid block that sits next to a rejected one", () => {
    const blocks = parseBlocks(
      JSON.stringify([
        { id: "bad", type: "figure", src: "/a.png", caption: "" },
        { id: "ok", type: "text", body: "tetap" },
      ]),
    );
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.type).toBe("text");
  });

  it("replaces model-supplied ids with its own", () => {
    const blocks = parseBlocks(
      JSON.stringify([
        { id: "sama", type: "text", body: "a" },
        { id: "sama", type: "text", body: "b" },
      ]),
    );
    expect(new Set(blocks.map((b) => b.id)).size).toBe(2);
  });

  it("narrows the type so a text block exposes its body", () => {
    const [block] = parseBlocks(JSON.stringify([{ id: "x", type: "text", body: "halo" }]));
    expect(block?.type).toBe("text");
    if (block?.type === "text") expect(block.body).toBe("halo");
  });
});
