import { describe, expect, it } from "vitest";
import {
  MAX_STUDY_REPLY_CHARS,
  validateStudyModelReply,
} from "@/lib/agents/study-chat/schema";

/**
 * A reply is prose now, so the contract under test is deliberately thin: a
 * non-empty string that is not absurdly long. These tests exist to pin that
 * thinness — the point of the rewrite is that there is *no* schema to satisfy,
 * and a test that quietly reintroduced one would undo it.
 */
describe("validateStudyModelReply", () => {
  it("accepts Markdown prose and trims surrounding whitespace", () => {
    // Given: a plain answer with Markdown and padding around it.
    const input = "  Closure adalah fungsi yang **ingat lexical scope**.\n\nContoh:  `counter`  ";

    // When: the raw model value crosses the validation boundary.
    const result = validateStudyModelReply(input);

    // Then: the prose is accepted, trimmed, and carried verbatim inside.
    expect(result).toEqual({
      ok: true,
      reply: { message: input.trim() },
    });
  });

  it("accepts prose that would never have satisfied the old JSON schema", () => {
    // Given: an honest answer that the old contract rejected outright.
    const input = "Closure bukan fitur, tapi konsekuensi dari lexical scope.";

    // When / Then: it is accepted — grading prose on a schema was the bug.
    expect(validateStudyModelReply(input).ok).toBe(true);
  });

  it("rejects an empty or whitespace-only answer", () => {
    // Given: provider text that carries no answer at all.
    const candidates = ["", "   ", "\n\n", "\t"];

    // When: each candidate is validated.
    const results = candidates.map((candidate) => validateStudyModelReply(candidate));

    // Then: none of them reaches the transcript.
    expect(results.every((result) => !result.ok)).toBe(true);
  });

  it("rejects non-string values instead of coercing them", () => {
    // Given: values a provider must never be able to pass off as an answer.
    const candidates = [null, undefined, 42, {}, [], { message: "hi" }, true];

    // When: each candidate is validated.
    const results = candidates.map((candidate) => validateStudyModelReply(candidate));

    // Then: malformed values are rejected rather than converted.
    expect(results.every((result) => !result.ok)).toBe(true);
  });

  it("rejects a runaway answer and accepts one exactly at the ceiling", () => {
    // Given: one character past the hard ceiling, and one exactly on it.
    const over = "x".repeat(MAX_STUDY_REPLY_CHARS + 1);
    const atLimit = "x".repeat(MAX_STUDY_REPLY_CHARS);

    // When: both are validated.
    const overResult = validateStudyModelReply(over);
    const atLimitResult = validateStudyModelReply(atLimit);

    // Then: the boundary is inclusive, and past it the model counts as broken
    // rather than merely verbose.
    expect(overResult.ok).toBe(false);
    expect(atLimitResult.ok).toBe(true);
  });
});
