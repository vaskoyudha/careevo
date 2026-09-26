/**
 * Book model — a spine (chapter tree), pages, and typed content blocks.
 *
 * Adapted from DeepTutor (HKUDS), v1.6.8. Apache License 2.0.
 * Source: deeptutor/book/models.py
 * Source: https://github.com/HKUDS/DeepTutor
 * Source commit: a5eafa89072f6d7290a6854a6afc4ba060053beb
 * Original license: Apache License 2.0
 * Modified for Careevo: Pydantic → TypeScript, snake_case → camelCase, float
 * epochs → ISO strings, and a deliberately smaller block taxonomy (see
 * `BLOK_TERSEDIA`). Blocks are plain data with a `type` discriminator — never
 * HTML — so a page is safe to render without a sanitiser, matching the repo's
 * `BlokHalaman` rule.
 */

export type BookStatus = "draft" | "ready" | "archived";

/** How much prose a book aims for. Scales the target length per chapter. */
export type BookDepth = "brief" | "standard" | "deep";

export const DEPTH_WORD_SCALE: Readonly<Record<BookDepth, number>> = {
  brief: 0.5,
  standard: 1,
  deep: 1.6,
};

/** What a chapter is for. Drives which blocks the compiler emits. */
export type ContentType = "theory" | "practice" | "reference";

export const CONTENT_TYPE_LABEL: Readonly<Record<ContentType, string>> = {
  theory: "Teori",
  practice: "Praktik",
  reference: "Referensi",
};

/* ------------------------------------------------------------------ */
/* Blocks                                                              */
/* ------------------------------------------------------------------ */

/**
 * The block types Careevo ships.
 *
 * DeepTutor has nineteen. Three are dropped on purpose because each needs an
 * engine this repo does not have, and a block that renders as a grey box is
 * worse than no block: `conceptGraph` (force-directed layout), `animation`
 * (server-rendered Manim video) and `interactive` (GeoGebra). The rest are
 * plain structured data and render with React alone.
 */
export type BlockType =
  | "text"
  | "heading"
  | "list"
  | "callout"
  | "code"
  | "figure"
  | "quiz"
  | "flashcards"
  | "timeline"
  | "deepDive"
  | "userNote";

export const BLOK_TERSEDIA: readonly BlockType[] = [
  "text",
  "heading",
  "list",
  "callout",
  "code",
  "figure",
  "quiz",
  "flashcards",
  "timeline",
  "deepDive",
  "userNote",
];

/** Every block carries this, and exactly one payload field matches its type. */
export interface BlockBase {
  id: string;
  type: BlockType;
}

export type Block =
  | (BlockBase & { type: "text"; body: string })
  | (BlockBase & { type: "heading"; level: 2 | 3 | 4; body: string })
  | (BlockBase & { type: "list"; ordered: boolean; items: string[] })
  | (BlockBase & { type: "callout"; tone: "note" | "tip" | "warning"; title: string; body: string })
  | (BlockBase & { type: "code"; language: string; caption: string; code: string })
  | (BlockBase & { type: "figure"; caption: string; alt: string; /** A data: image or an existing public path. */ src: string })
  | (BlockBase & { type: "quiz"; question: string; options: string[]; correctIndex: number; explanation: string })
  | (BlockBase & { type: "flashcards"; cards: { front: string; back: string }[] })
  | (BlockBase & { type: "timeline"; events: { label: string; body: string }[] })
  | (BlockBase & { type: "deepDive"; body: string; takeaways: string[] })
  | (BlockBase & { type: "userNote"; body: string; author: string; at: string });

/* ------------------------------------------------------------------ */
/* Structure                                                           */
/* ------------------------------------------------------------------ */

export interface Chapter {
  id: string;
  title: string;
  summary: string;
  contentType: ContentType;
  learningObjectives: string[];
  pageIds: string[];
  order: number;
}

export interface BookPage {
  id: string;
  bookId: string;
  chapterId: string;
  title: string;
  contentType: ContentType;
  learningObjectives: string[];
  order: number;
  blocks: Block[];
}

export interface Book {
  id: string;
  owner: string;
  title: string;
  description: string;
  status: BookStatus;
  depth: BookDepth;
  /** The course this book was compiled from, when it came from one. */
  courseId?: string;
  courseSlug?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BookSpine {
  bookId: string;
  chapters: Chapter[];
  version: number;
  updatedAt: string;
}

/** Everything on disk for one book. */
export interface BookBundle {
  book: Book;
  spine: BookSpine;
  pages: BookPage[];
  /** How the spine was produced, so the UI can be honest about it. */
  compiledBy: "stub" | "gemini";
}

export interface BookEnvelope {
  version: 1;
  bundle: BookBundle;
}

/* ------------------------------------------------------------------ */
/* Guards — everything on disk is untrusted                              */
/* ------------------------------------------------------------------ */

export function isBookDepth(value: unknown): value is BookDepth {
  return value === "brief" || value === "standard" || value === "deep";
}

export function isContentType(value: unknown): value is ContentType {
  return value === "theory" || value === "practice" || value === "reference";
}

export function isBlockType(value: unknown): value is BlockType {
  return typeof value === "string" && (BLOK_TERSEDIA as readonly string[]).includes(value);
}

function isText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isTextArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

/**
 * Validate one block. Strict on purpose: a malformed block is *dropped*, not
 * rendered half-formed, so one bad record from a model cannot break a page.
 */
export function isBlock(value: unknown): value is Block {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  if (!isText(c.id) || !isBlockType(c.type)) return false;

  switch (c.type) {
    case "text":
    case "deepDive":
      return isText(c.body);
    case "heading":
      return (
        (c.level === 2 || c.level === 3 || c.level === 4) && isText(c.body)
      );
    case "list":
      return (
        typeof c.ordered === "boolean" &&
        Array.isArray(c.items) &&
        c.items.length > 0 &&
        isTextArray(c.items)
      );
    case "callout":
      return (
        (c.tone === "note" || c.tone === "tip" || c.tone === "warning") &&
        isText(c.body)
      );
    case "code":
      return isText(c.code);
    case "figure":
      return isText(c.src) && isText(c.alt);
    case "quiz":
      return (
        isText(c.question) &&
        Array.isArray(c.options) &&
        c.options.length >= 2 &&
        isTextArray(c.options) &&
        typeof c.correctIndex === "number" &&
        Number.isInteger(c.correctIndex) &&
        c.correctIndex >= 0 &&
        c.correctIndex < c.options.length
      );
    case "flashcards":
      return (
        Array.isArray(c.cards) &&
        c.cards.length > 0 &&
        c.cards.every(
          (card) =>
            typeof card === "object" &&
            card !== null &&
            isText((card as Record<string, unknown>).front) &&
            isText((card as Record<string, unknown>).back),
        )
      );
    case "timeline":
      return (
        Array.isArray(c.events) &&
        c.events.length > 0 &&
        c.events.every(
          (event) =>
            typeof event === "object" &&
            event !== null &&
            isText((event as Record<string, unknown>).label),
        )
      );
    case "userNote":
      return isText(c.body);
    default:
      return false;
  }
}
