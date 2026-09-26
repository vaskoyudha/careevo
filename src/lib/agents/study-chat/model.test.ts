import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StudyPromptInput } from "@/lib/agents/study-chat/schema";

/**
 * `generateStudyReply` is the tutor's reply path. It was previously a
 * Google-SDK-only function, which meant the one surface a learner spends the
 * most time in was also the only one that ignored the LLM port: with a 9Router
 * endpoint configured the quiz generator and the book compiler worked while the
 * chat replied "not configured".
 *
 * These tests pin the port contract: the provider is chosen by `getLlm()`, a
 * model answer in fences or with trailing prose is still accepted, no-verdict
 * failures are typed, and an unreachable model never gets replaced by canned
 * text pretending to be an answer.
 */

const llm = vi.hoisted(() => ({
  calls: [] as Array<{ prompt: string; options?: { json?: boolean } }>,
  result: { ok: true, text: "" } as
    | { ok: true; text: string }
    | { ok: false; reason: string; message: string },
  available: true,
  throws: undefined as Error | undefined,
}));

vi.mock("@/lib/llm/port", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/llm/port")>();
  return {
    ...actual,
    getLlm: () => ({
      name: llm.available ? "openai-compat" : "stub",
      available: llm.available,
      async generate(prompt: string, options?: { json?: boolean }) {
        llm.calls.push({ prompt, options });
        if (llm.throws) throw llm.throws;
        return llm.result;
      },
    }),
  };
});

const { generateStudyReply } = await import("@/lib/agents/study-chat/model");

const ANSWER = "Closure adalah fungsi yang **ingat lexical scope** di tempat ia dibuat.";

const input = {
  profile: {
    experience: "menengah",
    interests: ["web-dev"],
    goal: "Bangun portfolio teknis.",
    weeklyHours: 8,
  },
  course: {
    id: "crs-next",
    slug: "nextjs-typescript",
    title: "Next.js dan TypeScript",
    tags: ["Next.js", "TypeScript"],
    level: "menengah",
  },
  module: {
    id: "crs-next-m1",
    title: "Komponen server dan client",
  },
  messages: [
    {
      id: "message-1",
      role: "user",
      content: "Jelaskan perbedaan server component dan client component.",
      createdAt: "2026-09-24T00:00:00.000Z",
    },
  ],
} satisfies StudyPromptInput;

beforeEach(() => {
  llm.calls.length = 0;
  llm.result = { ok: true, text: ANSWER };
  llm.available = true;
  llm.throws = undefined;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("generateStudyReply — provider comes from the port", () => {
  it("sends the study prompt and does not ask for JSON", async () => {
    const result = await generateStudyReply(input);

    expect(result).toEqual({ ok: true, reply: { message: ANSWER } });
    expect(llm.calls).toHaveLength(1);
    // The regression this pins: JSON mode was what forced prose into a schema.
    expect(llm.calls[0]?.options?.json).toBeUndefined();
    expect(llm.calls[0]?.prompt).toContain("Next.js dan TypeScript");
  });

  // The whole point of routing through the port: a compat endpoint that is not
  // Gemini still produces a reply, instead of "not configured".
  it("produces a reply from a non-Gemini provider", async () => {
    const result = await generateStudyReply(input);
    expect(result.ok).toBe(true);
    expect(llm.calls).toHaveLength(1);
  });

  it("passes Markdown prose through untouched, fences and all", async () => {
    // A model that wraps its whole answer in a fence is a formatting quirk, not
    // a broken answer: the renderer shows it, and we do not rewrite the text.
    const fenced = "```markdown\n**Closure**\n```";
    llm.result = { ok: true, text: fenced };
    const result = await generateStudyReply(input);
    expect(result).toEqual({ ok: true, reply: { message: fenced } });
  });

  it("maps a provider rate limit to rate_limited", async () => {
    llm.result = { ok: false, reason: "rate_limited", message: "raw provider text" };
    const result = await generateStudyReply(input);
    expect(result).toMatchObject({ ok: false, reason: "rate_limited" });
    // Our own wording, never the raw provider body.
    expect(JSON.stringify(result)).not.toContain("raw provider text");
  });

  it("maps a provider error to provider_error", async () => {
    llm.result = { ok: false, reason: "provider_error", message: "boom" };
    const result = await generateStudyReply(input);
    expect(result).toMatchObject({ ok: false, reason: "provider_error" });
  });

  // `invalid_output` is the port's name for the same failure the study layer
  // calls `invalid_model_output`; the translation must happen exactly once.
  it("translates the port's invalid_output to invalid_model_output", async () => {
    llm.result = { ok: false, reason: "invalid_output", message: "empty" };
    const result = await generateStudyReply(input);
    expect(result).toMatchObject({ ok: false, reason: "invalid_model_output" });
  });

  it("does not fall back to canned text when a configured model throws", async () => {
    llm.throws = new Error("socket hang up");
    const result = await generateStudyReply(input);
    expect(result).toMatchObject({ ok: false, reason: "provider_error" });
  });

  it("rejects an empty provider body as invalid_model_output", async () => {
    for (const text of ["", "   ", "\n\n"]) {
      llm.result = { ok: true, text };
      const result = await generateStudyReply(input);
      expect(result).toMatchObject({ ok: false, reason: "invalid_model_output" });
    }
  });

  it("answers a greeting without inventing a lecture", async () => {
    // Upstream's chat prompt never forced "explain one concept every turn";
    // that Careevo rule is what made `hi` receive a lecture. With the rule gone
    // the model is free to greet, and the layer must not punish it for doing so.
    llm.result = {
      ok: true,
      text: "Halo! Ada yang ingin kamu pelajari hari ini?",
    };
    const result = await generateStudyReply({
      ...input,
      messages: [
        {
          id: "message-greeting",
          role: "user",
          content: "hi there",
          createdAt: "2026-09-24T00:00:00.000Z",
        },
      ],
    });
    expect(result.ok).toBe(true);
  });
});

describe("generateStudyReply — no provider configured", () => {
  // With nothing configured the tutor must still answer coherently rather than
  // be dead, and must say plainly that it is a demo. This mirrors `StubLlm`'s
  // honesty, but in the study-reply shape that stub cannot produce.
  it("returns a deterministic demo reply without calling a model", async () => {
    llm.available = false;
    const result = await generateStudyReply(input);

    expect(result.ok).toBe(true);
    expect(llm.calls).toHaveLength(0);
    if (result.ok) {
      expect(result.reply.message.length).toBeGreaterThan(0);
      expect(result.reply.message).toContain("Mode contoh");
    }
  });
});
