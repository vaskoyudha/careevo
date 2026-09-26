import { getLlm } from "@/lib/llm/port";
import type { EntriKatalog } from "@/lib/courses/katalog";
import type { ModulKursus } from "@/lib/courses/kurikulum";
import { isBlock, type Block, type BookPage, type Chapter } from "./types";
import { StubBookCompiler, type BookCompiler, type CompileInput, type CompileResult } from "./compiler";

/**
 * The model-backed compiler.
 *
 * It asks for JSON shaped exactly like a page's block list, then **validates
 * every block before it is kept** (`isBlock`). A model that returns prose
 * where a quiz belongs, or an `correctIndex` outside its own options, loses
 * that block rather than the page — the reader then sees a slightly shorter
 * chapter instead of a crash. This is the same schema-constrained approach the
 * existing `study-chat` agent uses, for the same reason.
 */
export class GeminiBookCompiler implements BookCompiler {
  readonly name = "gemini" as const;

  async compile(input: CompileInput): Promise<CompileResult> {
    const { book, course, modules, intent } = input;
    const llm = getLlm();

    // No key: the caller should have picked the stub, but never return an
    // empty book if it did not.
    if (!llm.available) return new StubBookCompiler().compile(input);

    const chapters: Chapter[] = [];
    const pages: BookPage[] = [];

    for (const [order, module] of modules.entries()) {
      const chapterId = `ch_${order + 1}`;
      const pageId = `pg_${order + 1}`;
      const prompt = buildPrompt({ course, module, intent });

      const result = await llm.generate(prompt, { json: true });
      const blocks: Block[] = result.ok ? parseBlocks(result.text) : [];

      // A failed or unusable generation still yields a page, built from the
      // stub — a half-empty chapter is worse than a plainly-written one.
      const usable = blocks.length > 0 ? blocks : (await new StubBookCompiler().compile(input)).pages[order]?.blocks ?? [];

      chapters.push({
        id: chapterId,
        title: module.judul,
        summary: module.ringkasan.slice(0, 220),
        contentType: "theory",
        learningObjectives: [],
        pageIds: [pageId],
        order,
      });
      pages.push({
        id: pageId,
        bookId: book.id,
        chapterId,
        title: module.judul,
        contentType: "theory",
        learningObjectives: [],
        order,
        blocks: usable,
      });
    }

    return {
      spine: {
        bookId: book.id,
        chapters,
        version: 1,
        updatedAt: new Date().toISOString(),
      },
      pages,
      compiledBy: "gemini",
    };
  }
}

function buildPrompt(args: {
  course: EntriKatalog;
  module: ModulKursus;
  intent?: string;
}): string {
  const { course, module, intent } = args;
  return [
    `Kamu menulis satu halaman buku belajar berbahasa Indonesia.`,
    `Kursus: ${course.title} (${course.provider}, tingkat ${course.level}).`,
    `Modul: ${module.judul}. Ringkasan modul: ${module.ringkasan}`,
    intent ? `Tujuan pembelajar: ${intent}` : "",
    `Balas hanya JSON: array blok. Tipe yang boleh:`,
    `- {"type":"heading","level":2|3|4,"body":"..."}`,
    `- {"type":"text","body":"..."}`,
    `- {"type":"list","ordered":false,"items":["..."]}`,
    `- {"type":"callout","tone":"note"|"tip"|"warning","title":"...","body":"..."}`,
    `- {"type":"deepDive","body":"...","takeaways":["..."]}`,
    `- {"type":"flashcards","cards":[{"front":"...","back":"..."}]}`,
    `- {"type":"quiz","question":"...","options":["...","..."],"correctIndex":0,"explanation":"..."}`,
    `Setiap blok juga butuh "id" unik. Tulis dalam bahasa Indonesia yang jelas dan ringkas.`,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Parse a model response into blocks, discarding anything malformed.
 *
 * Tolerant of the two shapes models actually emit — a bare array, or an object
 * with a `blocks` key — and of a ```json fence around it. Everything else is
 * rejected rather than guessed at.
 */
export function parseBlocks(text: string): Block[] {
  const unfenced = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  let parsed: unknown;
  try {
    parsed = JSON.parse(unfenced);
  } catch {
    return [];
  }

  const candidates = Array.isArray(parsed)
    ? parsed
    : typeof parsed === "object" && parsed !== null && Array.isArray((parsed as { blocks?: unknown }).blocks)
      ? (parsed as { blocks: unknown[] }).blocks
      : [];

  const blocks: Block[] = [];
  candidates.forEach((candidate, index) => {
    if (!isBlock(candidate)) return;
    // The model's ids are not trusted even when present; ours are unique by
    // construction and cannot collide with another block on the page.
    blocks.push({ ...candidate, id: `bl_${index + 1}` } as Block);
  });
  return blocks;
}
