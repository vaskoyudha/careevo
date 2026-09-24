import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { StudyModelReply, StudyPromptInput } from "@/lib/agents/study-chat/schema";

interface GenerateRequest {
  readonly model: string;
  readonly contents: string;
  readonly config?: {
    readonly responseMimeType?: string;
    readonly responseSchema?: unknown;
  };
}

interface SdkState {
  readonly constructorCalls: Array<{ readonly apiKey?: string }>;
  readonly requests: GenerateRequest[];
  text: string | undefined;
  error: Error | undefined;
}

const sdkState = vi.hoisted<SdkState>(() => ({
  constructorCalls: [],
  requests: [],
  text: undefined,
  error: undefined,
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    readonly models = {
      generateContent: async (request: GenerateRequest): Promise<{ text: string | undefined }> => {
        sdkState.requests.push(request);
        if (sdkState.error) throw sdkState.error;
        return { text: sdkState.text };
      },
    };

    constructor(options: { readonly apiKey?: string }) {
      sdkState.constructorCalls.push(options);
    }
  },
  Type: {
    ARRAY: "ARRAY",
    NULL: "NULL",
    OBJECT: "OBJECT",
    STRING: "STRING",
  },
}));

const { generateStudyReply } = await import("@/lib/agents/study-chat/gemini");

const validReply = {
  message: "Closure adalah fungsi yang mengingat lexical scope.",
  followUpQuestion: "Bisakah kamu memberi contoh closure?",
  pathProposal: {
    courseId: "crs-next",
    moduleIds: ["crs-next-m1", "crs-next-m2"],
    rationale: "Mulai dari konsep dasar lalu latihan terapan.",
  },
} satisfies StudyModelReply;

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
  sdkState.constructorCalls.length = 0;
  sdkState.requests.length = 0;
  sdkState.text = undefined;
  sdkState.error = undefined;
  vi.stubEnv("GEMINI_API_KEY", "test-key");
  vi.stubEnv("GEMINI_MODEL", "gemini-test");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("generateStudyReply", () => {
  it("returns missing_api_key without constructing a model client", async () => {
    // Given: no configured Gemini key.
    vi.stubEnv("GEMINI_API_KEY", "");

    // When: a study reply is requested.
    const result = await generateStudyReply(input);

    // Then: the feature is off and no provider client or request is constructed.
    expect(result).toMatchObject({ ok: false, reason: "missing_api_key" });
    expect(sdkState.constructorCalls).toHaveLength(0);
    expect(sdkState.requests).toHaveLength(0);
  });

  it("parses a valid JSON response and sends the bounded study configuration", async () => {
    // Given: a provider response containing the valid model shape.
    sdkState.text = JSON.stringify(validReply);

    // When: the adapter requests a reply.
    const result = await generateStudyReply(input);

    // Then: the validated reply is returned and the SDK request is correctly constrained.
    expect(result).toEqual({ ok: true, reply: validReply });
    expect(sdkState.constructorCalls).toEqual([{ apiKey: "test-key" }]);
    const request = sdkState.requests.at(0);
    expect(request?.model).toBe("gemini-test");
    expect(request?.contents).toContain("Next.js dan TypeScript");
    expect(request?.config?.responseMimeType).toBe("application/json");
    expect(request?.config?.responseSchema).toMatchObject({
      type: "OBJECT",
      properties: {
        message: { type: "STRING" },
        followUpQuestion: { type: "STRING" },
        pathProposal: {
          anyOf: [{ type: "OBJECT" }, { type: "NULL" }],
        },
      },
    });
  });

  it("maps provider rate limits without exposing raw credentials", async () => {
    // Given: a provider error containing a key-shaped secret.
    vi.stubEnv("GEMINI_API_KEY", "secret-key");
    sdkState.error = new Error("quota exceeded for secret-key");

    // When: the adapter maps the provider failure.
    const result = await generateStudyReply(input);

    // Then: the typed rate-limit result contains neither the raw error nor the key.
    expect(result).toMatchObject({ ok: false, reason: "rate_limited" });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("secret-key");
    expect(serialized).not.toContain("quota exceeded");
  });

  it("maps uncertain provider failures to a generic provider error", async () => {
    // Given: an SDK failure that cannot be classified more specifically.
    vi.stubEnv("GEMINI_API_KEY", "secret-key");
    sdkState.error = new Error("provider failed for secret-key");

    // When: the adapter handles the failure.
    const result = await generateStudyReply(input);

    // Then: no raw provider diagnostic is returned.
    expect(result).toMatchObject({ ok: false, reason: "provider_error" });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("secret-key");
    expect(serialized).not.toContain("provider failed");
  });

  it("maps malformed JSON to invalid_model_output", async () => {
    // Given: text that is not JSON.
    sdkState.text = "not json";

    // When: the adapter parses the provider response.
    const result = await generateStudyReply(input);

    // Then: the caller receives a typed invalid-output result.
    expect(result).toMatchObject({ ok: false, reason: "invalid_model_output" });
  });

  it("rejects a missing response body and an invalid structured reply", async () => {
    // Given: a missing body followed by a JSON object with an unknown field.
    sdkState.text = undefined;
    const missing = await generateStudyReply(input);
    sdkState.text = JSON.stringify({ ...validReply, unexpected: true });
    const unknownField = await generateStudyReply(input);

    // Then: neither body is trusted as a study reply.
    expect(missing).toMatchObject({ ok: false, reason: "invalid_model_output" });
    expect(unknownField).toMatchObject({ ok: false, reason: "invalid_model_output" });
  });

  it("rejects a proposed path when the input has no course context", async () => {
    // Given: a course-less input and a model response that still proposes a path.
    sdkState.text = JSON.stringify(validReply);

    // When: the adapter handles the response.
    const result = await generateStudyReply({
      profile: input.profile,
      messages: input.messages,
    });

    // Then: no proposal can escape the course-less boundary.
    expect(result).toMatchObject({ ok: false, reason: "invalid_model_output" });
    expect(JSON.stringify(result)).not.toContain(validReply.pathProposal.courseId);
  });
});
