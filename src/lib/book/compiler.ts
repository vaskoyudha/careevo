import type { EntriKatalog } from "@/lib/courses/katalog";
import type { ModulKursus } from "@/lib/courses/kurikulum";
import type { OnboardingProfile } from "@/lib/onboarding/types";
import {
  DEPTH_WORD_SCALE,
  type Block,
  type Book,
  type BookDepth,
  type BookPage,
  type BookSpine,
  type Chapter,
  type ContentType,
} from "./types";

/**
 * The compiler interface.
 *
 * A compiler turns a course (and optionally the learner's own words about what
 * they want) into a spine plus a set of pages. Two implementations exist —
 * `StubBookCompiler` here, and a Gemini-backed one — and the choice is made by
 * whether a key is configured, so the product is never in a state where you
 * cannot see a book.
 */
export interface BookCompiler {
  readonly name: "stub" | "gemini";
  compile(input: CompileInput): Promise<CompileResult>;
}

export interface CompileInput {
  book: Book;
  course: EntriKatalog;
  modules: readonly ModulKursus[];
  /** Free text the learner typed when starting the book. */
  intent?: string;
  profile?: OnboardingProfile | null;
}

export interface CompileResult {
  spine: BookSpine;
  pages: BookPage[];
  compiledBy: "stub" | "gemini";
}

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

let counter = 0;

/** Ids are local to a book, so a simple counter is enough and stays readable. */
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}_${counter.toString(36)}`;
}

/** Reset between compiles so two books in one process do not share numbering. */
function resetIds(): void {
  counter = 0;
}

function targetWords(depth: BookDepth, module: ModulKursus): number {
  const base = 220 + Math.min(module.ringkasan.length, 400);
  return Math.round(base * (DEPTH_WORD_SCALE[depth] ?? 1));
}

/**
 * Which content type a module is, from the same signals the mastery path uses.
 *
 * Kept as its own function rather than imported from `mastery/topic-tree.ts`:
 * that module's heuristic returns a *knowledge* type for scheduling, this one
 * returns a *reading* type for page composition. Same words, different jobs —
 * coupling them would make one change alter both the review schedule and the
 * book layout.
 */
function contentTypeFor(module: ModulKursus): ContentType {
  // Matched against the *title* only. Scanning the summary too marked almost
  // every chapter "practice", because a course summary routinely ends with
  // "…lalu kamu bisa mempraktikkannya" — so the label told the reader nothing.
  const title = module.judul.toLowerCase();
  if (/(latihan|soal|kuis|exercise|praktik|eksperimen|proyek|tugas)/.test(title)) {
    return "practice";
  }
  if (/(cheat ?sheet|ringkasan|referensi|glossar|kamus|daftar|indeks)/.test(title)) {
    return "reference";
  }
  return "theory";
}

function truncate(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** Split a summary into sentence-ish fragments for a list block. */
function toPoints(text: string, max: number): string[] {
  return text
    .split(/(?<=[.!?:])\s+|\n+/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter((part) => part.length > 8)
    .slice(0, max);
}

/* ------------------------------------------------------------------ */
/* The stub compiler                                                   */
/* ------------------------------------------------------------------ */

/**
 * Builds a real, readable book from a course without a model.
 *
 * This is not a placeholder that says "TODO". Every page is assembled from the
 * course's own material — module summaries become prose, objectives and a
 * checklist, the module title becomes the heading, and the course's own level
 * and duration shape the callouts. The result is a genuine (if plainly
 * generated) study book that a learner can read and follow today; a key later
 * upgrades the *prose*, not the structure.
 */
export class StubBookCompiler implements BookCompiler {
  readonly name = "stub" as const;

  async compile(input: CompileInput): Promise<CompileResult> {
    resetIds();
    const { book, modules, intent } = input;
    const chapters: Chapter[] = [];
    const pages: BookPage[] = [];

    for (const [order, module] of modules.entries()) {
      const contentType = contentTypeFor(module);
      const chapterId = nextId("ch");
      const pageId = nextId("pg");

      chapters.push({
        id: chapterId,
        title: module.judul,
        summary: truncate(module.ringkasan || module.judul, 220),
        contentType,
        learningObjectives: [
          `Menjelaskan ${module.judul.toLowerCase()} dengan bahasa sendiri`,
          `Menghubungkan ${module.judul.toLowerCase()} ke ${input.course.title}`,
        ],
        pageIds: [pageId],
        order,
      });

      pages.push({
        id: pageId,
        bookId: book.id,
        chapterId,
        title: module.judul,
        contentType,
        learningObjectives: chapters[chapters.length - 1]?.learningObjectives ?? [],
        order,
        blocks: buildPageBlocks({ module, course: input.course, depth: book.depth, intent }),
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
      compiledBy: "stub",
    };
  }
}

function buildPageBlocks(args: {
  module: ModulKursus;
  course: EntriKatalog;
  depth: BookDepth;
  intent?: string;
}): Block[] {
  const { module, course, depth, intent } = args;
  const blocks: Block[] = [];
  const summary = module.ringkasan.trim() || module.judul;
  const target = targetWords(depth, module);

  blocks.push({ id: nextId("bl"), type: "heading", level: 2, body: module.judul });

  if (intent && intent.trim().length > 0) {
    blocks.push({
      id: nextId("bl"),
      type: "callout",
      tone: "note",
      title: "Tujuanmu",
      body: truncate(intent, 300),
    });
  }

  // The opening paragraph is scaled to the requested depth. Without this the
  // depth control only changed a number quoted in a sentence, which made the
  // whole setting cosmetic.
  const opening = [
    `${summary}`,
    `Modul ini adalah bagian "${course.title}" (${course.provider}, tingkat ${course.level}) ` +
      `dan butuh sekitar ${module.durasi_min} menit.`,
  ];
  if (depth !== "brief") {
    opening.push(
      `Bacaan ini disusun sekitar ${target} kata, jadi luangkan waktu untuk berhenti ` +
        `setiap paragraf dan coba rumuskan kembali dengan kalimat sendiri sebelum lanjut.`,
    );
  }
  blocks.push({ id: nextId("bl"), type: "text", body: opening.join(" ") });

  // A brief book gets the summary as a single line; anything longer gets the
  // summary broken into its own points, which is what actually lengthens it.
  const points = toPoints(summary, depth === "deep" ? 6 : depth === "standard" ? 4 : 2);
  if (points.length > 1) {
    blocks.push({
      id: nextId("bl"),
      type: "list",
      ordered: false,
      items: points.map((point) => truncate(point, depth === "brief" ? 100 : 180)),
    });
  }

  blocks.push({
    id: nextId("bl"),
    type: "callout",
    tone: "tip",
    title: "Cara memakai bagian ini",
    body:
      `Baca sekali tanpa catatan, lalu tutup dan coba jelaskan ulang dengan kata-katamu. ` +
      `Kalau tersendat di satu kalimat, itu bagian yang perlu diulang — bukan seluruh modul.`,
  });

  if (depth !== "brief") {
    // Two extra cards, each grounded in this module rather than generic.
    blocks.push({
      id: nextId("bl"),
      type: "flashcards",
      cards: [
        {
          front: `Apa itu ${module.judul}?`,
          back: truncate(summary, 220),
        },
        {
          front: `Berapa lama ${module.judul} perlu dipelajari?`,
          back: `Kurikulum memperkirakan ${module.durasi_min} menit untuk bagian ini.`,
        },
        {
          front: `Di mana ${module.judul} dipakai?`,
          back:
            `Di dalam "${course.title}". Kalau tidak bisa menyebut satu kasus nyata, ` +
            `bagian ini belum benar-benar dikuasai.`,
        },
        {
          front: `Apa yang membuat ${module.judul} mudah dilupakan?`,
          back: truncate(points[1] ?? summary, 180),
        },
      ],
    });
  } else {
    blocks.push({
      id: nextId("bl"),
      type: "flashcards",
      cards: [
        {
          front: `Apa itu ${module.judul}?`,
          back: truncate(summary, 220),
        },
      ],
    });
  }

  blocks.push({
    id: nextId("bl"),
    type: "deepDive",
    body:
      `Pada tingkat ${course.level}, bagian "${module.judul}" menuntut dua hal: ` +
      `kamu bisa menjelaskan mekanismenya, dan kamu bisa memakainya untuk kasus nyata. ` +
      `Yang pertama diuji dengan mengubah kata-katamu sendiri; yang kedua hanya terlihat ` +
      `saat kamu mengerjakan sesuatu dan tahu bagian mana yang relevan.`,
    takeaways: [
      `Jelaskan ${module.judul} tanpa membuka materi.`,
      `Sebutkan satu kasus nyata di mana ini dipakai.`,
      `Tandai bagian yang masih terasa abstrak.`,
    ],
  });

  blocks.push({
    id: nextId("bl"),
    type: "quiz",
    question: `Menurutmu, apa ide utama dari "${module.judul}"?`,
    options: [
      truncate(summary, 120),
      "Cukup dibaca tanpa latihan.",
      "Hanya relevan untuk ujian.",
      "Tidak berkaitan dengan kursus ini.",
    ],
    correctIndex: 0,
    explanation: truncate(summary, 240),
  });

  return blocks;
}
