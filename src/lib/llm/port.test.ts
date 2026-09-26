import { afterEach, describe, expect, it, vi } from "vitest";
import {
  bacaContent,
  bacaKonfigurasiCompat,
  getLlm,
  hasLlm,
  hasLlmKey,
  OpenAiCompatLlm,
  StubLlm,
} from "./port";

/**
 * `bacaContent` is the whole reason this provider exists as a separate parser:
 * a gateway that answers a non-streaming request with a body ending in a literal
 * `data: [DONE]` sentinel would otherwise fail `JSON.parse` on *every* call, and
 * the feature would look broken while the model was answering perfectly.
 */

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("bacaContent", () => {
  it("reads a plain non-streaming JSON body", () => {
    const body = JSON.stringify({
      choices: [{ message: { content: "Halo" } }],
    });
    expect(bacaContent(body)).toBe("Halo");
  });

  // The exact shape 9Router returns. Without the strip, JSON.parse throws and
  // the caller reports "invalid output" for a good answer.
  it("tolerates a trailing data: [DONE] sentinel after the JSON", () => {
    const body = `${JSON.stringify({ choices: [{ message: { content: "Halo" } }] })}data: [DONE]`;
    expect(bacaContent(body)).toBe("Halo");
  });

  it("tolerates whitespace and a newline before the sentinel", () => {
    const body = `${JSON.stringify({ choices: [{ message: { content: "Halo" } }] })}\n\ndata: [DONE]\n`;
    expect(bacaContent(body)).toBe("Halo");
  });

  it("joins the deltas of a full SSE stream", () => {
    const stream = [
      'data: {"choices":[{"delta":{"content":"Sa"}}]}',
      'data: {"choices":[{"delta":{"content":"ya!"}}]}',
      "data: [DONE]",
    ].join("\n");
    expect(bacaContent(stream)).toBe("Saya!");
  });

  it("reads a non-streaming message even inside a one-line SSE envelope", () => {
    const body = `data: ${JSON.stringify({ choices: [{ message: { content: "Halo" } }] })}\ndata: [DONE]`;
    expect(bacaContent(body)).toBe("Halo");
  });

  // 9Router glues the sentinel straight onto the frame with NO newline between
  // them, so the whole response is one physical line. The line filter drops any
  // line mentioning [DONE] — which took the good frame down with it, and a
  // perfectly good answer read as empty. Measured against o2a/space-bunny-free.
  it("keeps the frame when the sentinel is glued to it with no newline", () => {
    const body = `data: ${JSON.stringify({ choices: [{ message: { content: "Halo" } }] })}data: [DONE]`;
    expect(bacaContent(body)).toBe("Halo");
  });

  it("still drops a glued sentinel when several frames share one line", () => {
    const body = `data: {"choices":[{"delta":{"content":"Sa"}}]}data: {"choices":[{"delta":{"content":"ya!"}}]}data: [DONE]`;
    expect(bacaContent(body)).toBe("Saya!");
  });

  // Returning reasoning_content would put the model's private scratchpad in
  // front of a learner as if it were the answer.
  it("never returns reasoning_content", () => {
    const body = JSON.stringify({
      choices: [
        {
          message: { content: "Jawaban.", reasoning_content: "internal scratchpad" },
        },
      ],
    });
    expect(bacaContent(body)).toBe("Jawaban.");
    expect(bacaContent(body)).not.toContain("scratchpad");
  });

  it("preserves newlines inside the content", () => {
    const body = JSON.stringify({ choices: [{ message: { content: "baris 1\nbaris 2" } }] });
    expect(bacaContent(body)).toBe("baris 1\nbaris 2");
  });

  it("returns empty for a body with no usable content", () => {
    expect(bacaContent("")).toBe("");
    expect(bacaContent("   ")).toBe("");
    expect(bacaContent("not json at all")).toBe("");
    expect(bacaContent(JSON.stringify({ choices: [] }))).toBe("");
    expect(bacaContent(JSON.stringify({ choices: [{ message: {} }] }))).toBe("");
    expect(bacaContent("data: [DONE]")).toBe("");
  });
});

describe("bacaKonfigurasiCompat", () => {
  it("is null unless both the base URL and the model are set", () => {
    vi.stubEnv("CAREERVO_LLM_BASE_URL", "");
    vi.stubEnv("CAREERVO_LLM_MODEL", "");
    expect(bacaKonfigurasiCompat()).toBeNull();

    vi.stubEnv("CAREERVO_LLM_BASE_URL", "http://127.0.0.1:20128/v1");
    expect(bacaKonfigurasiCompat()).toBeNull();

    vi.stubEnv("CAREERVO_LLM_BASE_URL", "");
    vi.stubEnv("CAREERVO_LLM_MODEL", "o2a/space-bunny-free");
    expect(bacaKonfigurasiCompat()).toBeNull();
  });

  // A trailing slash would produce `//chat/completions`; harmless on some
  // servers, a 404 on others.
  it("strips a trailing slash from the base URL", () => {
    vi.stubEnv("CAREERVO_LLM_BASE_URL", "http://127.0.0.1:20128/v1///");
    vi.stubEnv("CAREERVO_LLM_MODEL", "o2a/space-bunny-free");
    expect(bacaKonfigurasiCompat()?.baseUrl).toBe("http://127.0.0.1:20128/v1");
  });

  it("reads the api key as optional", () => {
    vi.stubEnv("CAREERVO_LLM_BASE_URL", "http://127.0.0.1:20128/v1");
    vi.stubEnv("CAREERVO_LLM_MODEL", "o2a/space-bunny-free");
    vi.stubEnv("CAREERVO_LLM_API_KEY", "");
    expect(bacaKonfigurasiCompat()?.apiKey).toBe("");
  });
});

describe("provider selection", () => {
  it("falls back to the stub with nothing configured", () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("CAREERVO_LLM_BASE_URL", "");
    vi.stubEnv("CAREERVO_LLM_MODEL", "");
    expect(getLlm()).toBeInstanceOf(StubLlm);
    expect(hasLlm()).toBe(false);
    expect(hasLlmKey()).toBe(false);
  });

  // Both set is a configuration mistake; the endpoint is the more specific of
  // the two, so it wins rather than being silently ignored.
  it("prefers the compat endpoint over a Gemini key when both are set", () => {
    vi.stubEnv("GEMINI_API_KEY", "some-key");
    vi.stubEnv("CAREERVO_LLM_BASE_URL", "http://127.0.0.1:20128/v1");
    vi.stubEnv("CAREERVO_LLM_MODEL", "o2a/space-bunny-free");
    expect(getLlm()).toBeInstanceOf(OpenAiCompatLlm);
    expect(getLlm().name).toBe("openai-compat");
    expect(hasLlm()).toBe(true);
    // `hasLlmKey` keeps its narrower meaning, so the UI can still tell the
    // difference between "a model is configured" and "Gemini specifically is".
    expect(hasLlmKey()).toBe(true);
  });

  it("reports a model as available from the endpoint alone", () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("CAREERVO_LLM_BASE_URL", "http://127.0.0.1:20128/v1");
    vi.stubEnv("CAREERVO_LLM_MODEL", "o2a/space-bunny-free");
    expect(getLlm().available).toBe(true);
    expect(hasLlm()).toBe(true);
    expect(hasLlmKey()).toBe(false);
  });
});

/**
 * The request body is part of the port's contract with an OpenAI-compatible
 * gateway, and two fields in it are load-bearing rather than cosmetic.
 */
describe("OpenAiCompatLlm request", () => {
  const port = () =>
    new OpenAiCompatLlm({ baseUrl: "http://gw.test/v1", model: "m", apiKey: "" });

  function stubFetch(responses: Array<{ content?: string; ok?: boolean; status?: number }>) {
    // Same shape as the fake endpoint in generator-gemini.test.ts: a plain
    // function that records what it was sent. A `vi.fn` with unused params trips
    // no-unused-vars, and the assertions only need the bodies anyway.
    const bodies: Array<Record<string, unknown>> = [];
    let index = 0;
    vi.stubGlobal("fetch", async (_url: string, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      const r = responses[Math.min(index, responses.length - 1)];
      index += 1;
      return new Response(
        JSON.stringify({ choices: [{ message: { content: r.content ?? "" } }] }),
        { status: r.status ?? 200, headers: { "Content-Type": "application/json" } },
      );
    });
    return { bodies, calls: () => index };
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // An agentic model fronted by a gateway will answer "rate this posting" by
  // emitting a bash tool call, leaving content empty and failing every call.
  it("sends tools: [] and tool_choice none so an agentic model cannot divert", async () => {
    const spy = stubFetch([{ content: "halo" }]);
    await port().generate("prompt");
    expect(spy.bodies[0]!.tools).toEqual([]);
    expect(spy.bodies[0]!.tool_choice).toBe("none");
  });

  it("passes temperature and max_tokens through to the request", async () => {
    const spy = stubFetch([{ content: "halo" }]);
    await port().generate("prompt", { temperature: 0.4, maxTokens: 8192 });
    expect(spy.bodies[0]!.temperature).toBe(0.4);
    expect(spy.bodies[0]!.max_tokens).toBe(8192);
  });

  it("keeps its own max_tokens default when the caller sets none", async () => {
    const spy = stubFetch([{ content: "halo" }]);
    await port().generate("prompt");
    expect(spy.bodies[0]!.max_tokens).toBe(4096);
  });

  // An empty completion is a routing artifact, not an answer, so it is retried
  // once. The retry is bounded: a second empty response still fails.
  it("retries once when the completion is empty, then succeeds", async () => {
    const spy = stubFetch([{ content: "" }, { content: "jawaban" }]);
    const hasil = await port().generate("prompt");
    expect(hasil).toEqual({ ok: true, text: "jawaban" });
    expect(spy.calls()).toBe(2);
  });

  it("gives up after a second empty completion rather than looping", async () => {
    const spy = stubFetch([{ content: "" }]);
    const hasil = await port().generate("prompt");
    expect(hasil.ok).toBe(false);
    if (!hasil.ok) expect(hasil.reason).toBe("invalid_output");
    expect(spy.calls()).toBe(2);
  });

  // A model that DID answer must not be retried: a second call would be a real
  // charge for a parse problem that retrying cannot fix.
  it("does not retry when the model returned text", async () => {
    const spy = stubFetch([{ content: "bukan json" }]);
    const hasil = await port().generate("prompt");
    expect(hasil).toEqual({ ok: true, text: "bukan json" });
    expect(spy.calls()).toBe(1);
  });

  it("does not retry an HTTP failure", async () => {
    const spy = stubFetch([{ status: 500 }]);
    const hasil = await port().generate("prompt");
    expect(hasil.ok).toBe(false);
    if (!hasil.ok) expect(hasil.reason).toBe("provider_error");
    expect(spy.calls()).toBe(1);
  });

  it("maps 429 to rate_limited so the UI can say 'try later'", async () => {
    stubFetch([{ status: 429 }]);
    const hasil = await port().generate("prompt");
    expect(hasil.ok).toBe(false);
    if (!hasil.ok) expect(hasil.reason).toBe("rate_limited");
  });
});
