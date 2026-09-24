import { describe, expect, it } from "vitest";
import {
  SKEMA_STUDY_REPLY,
  validateStudyModelReply,
} from "@/lib/agents/study-chat/schema";

function proposal(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    courseId: "crs-1",
    moduleIds: ["crs-1-m1", "crs-1-m2"],
    rationale: "Mulai dari konsep dasar lalu latihan terapan.",
    ...overrides,
  };
}

function validReply(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    message: "Closure adalah fungsi yang mengingat lexical scope.",
    followUpQuestion: "Bisakah kamu memberi contoh closure?",
    pathProposal: proposal(),
    ...overrides,
  };
}

describe("validateStudyModelReply", () => {
  it("accepts a bounded reply and one follow-up question", () => {
    // Given: a complete reply with one bounded question and a valid proposal.
    const input = validReply();

    // When: the raw model value crosses the validation boundary.
    const result = validateStudyModelReply(input);

    // Then: the exact typed reply is returned without dropping fields.
    expect(result).toEqual({ ok: true, reply: input });
  });

  it("rejects an empty or whitespace-only message", () => {
    // Given: a reply whose required message has no content.
    const empty = validReply({ message: "" });
    const whitespace = validReply({ message: "   " });

    // When: both values are validated.
    const emptyResult = validateStudyModelReply(empty);
    const whitespaceResult = validateStudyModelReply(whitespace);

    // Then: neither value reaches the typed study reply boundary.
    expect(emptyResult.ok).toBe(false);
    expect(whitespaceResult.ok).toBe(false);
  });

  it("rejects an oversized message or question", () => {
    // Given: one character beyond each public output bound.
    const oversizedMessage = validReply({ message: "x".repeat(601) });
    const oversizedQuestion = validReply({ followUpQuestion: "x".repeat(241) });

    // When: the values are validated.
    const messageResult = validateStudyModelReply(oversizedMessage);
    const questionResult = validateStudyModelReply(oversizedQuestion);

    // Then: both oversized fields are rejected.
    expect(messageResult.ok).toBe(false);
    expect(questionResult.ok).toBe(false);
  });

  it("accepts the exact maximum lengths and an explicit empty question", () => {
    // Given: output fields at their documented limits.
    const atLimit = validReply({
      message: "x".repeat(600),
      followUpQuestion: "x".repeat(240),
    });
    const noQuestion = validReply({ followUpQuestion: "" });

    // When: the values are validated.
    const atLimitResult = validateStudyModelReply(atLimit);
    const noQuestionResult = validateStudyModelReply(noQuestion);

    // Then: the boundaries are inclusive and an empty question is explicit.
    expect(atLimitResult.ok).toBe(true);
    expect(noQuestionResult.ok).toBe(true);
  });

  it("rejects unknown fields and malformed proposals", () => {
    // Given: a reply with a top-level extra and an incomplete proposal.
    const unknownReply = validReply({ unexpected: true });
    const malformedProposal = validReply({
      pathProposal: { courseId: "", moduleIds: [], rationale: "" },
    });

    // When: both values are validated.
    const unknownResult = validateStudyModelReply(unknownReply);
    const proposalResult = validateStudyModelReply(malformedProposal);

    // Then: neither unknown structure is trusted.
    expect(unknownResult.ok).toBe(false);
    expect(proposalResult.ok).toBe(false);
  });

  it("requires all top-level fields and rejects non-object values", () => {
    // Given: missing fields and non-object candidates.
    const missing = validReply();
    delete missing.message;
    const candidates = [null, undefined, [], "reply", 42, missing];

    // When: each raw value is validated.
    const results = candidates.map((candidate) => validateStudyModelReply(candidate));

    // Then: every non-object or incomplete candidate is rejected.
    expect(results.every((result) => !result.ok)).toBe(true);
  });

  it("rejects missing, non-string, or whitespace-only scalar fields", () => {
    // Given: malformed values for fields that must not be coerced.
    const candidates = [
      validReply({ message: null }),
      validReply({ message: 42 }),
      validReply({ followUpQuestion: null }),
      validReply({ followUpQuestion: "   " }),
    ];

    // When: each candidate is validated.
    const results = candidates.map((candidate) => validateStudyModelReply(candidate));

    // Then: malformed scalar values are rejected instead of converted.
    expect(results.every((result) => !result.ok)).toBe(true);
  });

  it("accepts a null proposal and preserves text without coercion", () => {
    // Given: a reply without a proposal and text containing surrounding spaces.
    const input = validReply({ pathProposal: null, message: " 保持 spacing  " });

    // When: the reply is validated.
    const result = validateStudyModelReply(input);

    // Then: the model text is returned unchanged rather than silently trimmed.
    expect(result).toEqual({ ok: true, reply: input });
  });

  it("rejects a proposal with a non-array, empty, or oversized module list", () => {
    // Given: module lists that cannot describe a bounded path.
    const candidates = [
      proposal({ moduleIds: "crs-1-m1" }),
      proposal({ moduleIds: [] }),
      proposal({ moduleIds: ["m1", "m2", "m3", "m4", "m5", "m6"] }),
    ];

    // When: each proposal is placed in an otherwise valid reply.
    const results = candidates.map((candidate) =>
      validateStudyModelReply(validReply({ pathProposal: candidate })),
    );

    // Then: all malformed lists are rejected.
    expect(results.every((result) => !result.ok)).toBe(true);
  });

  it("rejects sparse, inherited, empty, and duplicate module ids", () => {
    // Given: arrays that violate the dense, unique string contract.
    const sparse = new Array<string>(1);
    const inherited: unknown[] = Object.create(["inherited-id"]);
    inherited[0] = "own-id";
    const candidates = [
      proposal({ moduleIds: sparse }),
      proposal({ moduleIds: inherited }),
      proposal({ moduleIds: [""] }),
      proposal({ moduleIds: ["  "] }),
      proposal({ moduleIds: ["m1", "m1"] }),
    ];

    // When: each proposal is validated.
    const results = candidates.map((candidate) =>
      validateStudyModelReply(validReply({ pathProposal: candidate })),
    );

    // Then: no malformed id array is accepted.
    expect(results.every((result) => !result.ok)).toBe(true);
  });

  it("rejects proposal fields that are missing, extra, or unbounded", () => {
    // Given: proposals with exact-field and identifier-bound violations.
    const candidates = [
      { courseId: "crs-1", moduleIds: ["m1"] },
      { ...proposal(), unexpected: true },
      proposal({ courseId: "   " }),
      proposal({ courseId: "x".repeat(121) }),
      proposal({ rationale: "   " }),
      proposal({ rationale: "x".repeat(601) }),
    ];

    // When: each proposal is validated.
    const results = candidates.map((candidate) =>
      validateStudyModelReply(validReply({ pathProposal: candidate })),
    );

    // Then: all malformed proposal shapes are rejected.
    expect(results.every((result) => !result.ok)).toBe(true);
  });

  it("defines the nullable proposal with the installed SDK's anyOf form", () => {
    // Given: the response schema sent to Gemini.
    const pathSchema = SKEMA_STUDY_REPLY.properties?.pathProposal;

    // When: the nullable branch is inspected.
    const branches = pathSchema?.anyOf;

    // Then: the schema uses an object-or-Type.NULL union, not nullable:true.
    expect(branches).toHaveLength(2);
    expect(branches?.[1]).toEqual({ type: "NULL" });
    expect(pathSchema).not.toHaveProperty("nullable");
  });
});
