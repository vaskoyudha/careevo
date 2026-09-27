/**
 * One place that decides whether a real model is available.
 *
 * Everything that wants to generate text asks here. The point is that the
 * product is *never* dead without a key: a stub answers deterministically, so
 * every surface is demoable and every flow is testable. The env var, not a
 * feature flag, is the switch — adding a key turns the real model on with no
 * code change and no re-architecture.
 *
 * The stub is not a placeholder that says "TODO". It produces content derived
 * from the learner's own data, so a generated artifact is genuinely specific
 * rather than lorem ipsum.
 */

export interface LlmPort {
  /** A stable name for diagnostics and the UI ("gemini" / "stub"). */
  readonly name: string;
  /** Whether this port can actually reach a model. */
  readonly available: boolean;
  generate(prompt: string, options?: LlmOptions): Promise<LlmResult>;
}

export interface LlmOptions {
  /** When set, the port must return JSON matching this shape. */
  json?: boolean;
  signal?: AbortSignal;
  /**
   * Sampling temperature. Left unset the provider default applies.
   *
   * The A–H evaluation passes 0.4 explicitly: it is upstream's value, chosen to
   * be low enough that a structured evaluation is stable run to run but high
   * enough not to degenerate into a template.
   */
  temperature?: number;
  /** Output token ceiling. Providers disagree on the field name; the port hides that. */
  maxTokens?: number;
}

export type LlmResult =
  | { ok: true; text: string }
  | { ok: false; reason: "missing_api_key" | "rate_limited" | "provider_error" | "invalid_output"; message: string };

export function hasLlmKey(): boolean {
  return (process.env.GEMINI_API_KEY ?? "").trim().length > 0;
}

/**
 * Settings for an OpenAI-compatible endpoint.
 *
 * Added so the model-backed paths are testable without a Gemini account, and so
 * Careevo is not welded to one vendor: anything that speaks
 * `POST {baseUrl}/chat/completions` — a local 9Router, vLLM, Ollama, LM Studio —
 * works by setting three env vars and nothing else. Read here rather than in each
 * feature so the selection rule exists in exactly one place.
 */
export interface KonfigurasiCompat {
  baseUrl: string;
  model: string;
  apiKey: string;
}

/**
 * The compat settings, or `null` when the endpoint is not fully configured.
 *
 * `baseUrl` and `model` are both required: a half-set pair would fail at the
 * first request with an opaque 404, long after the developer thought the feature
 * was live. Treating that as "not configured" makes it fall back to the stub,
 * which is visible and honest.
 */
export function bacaKonfigurasiCompat(): KonfigurasiCompat | null {
  const baseUrl = (process.env.CAREERVO_LLM_BASE_URL ?? "").trim().replace(/\/+$/, "");
  const model = (process.env.CAREERVO_LLM_MODEL ?? "").trim();
  if (!baseUrl || !model) return null;
  return { baseUrl, model, apiKey: (process.env.CAREERVO_LLM_API_KEY ?? "").trim() };
}

/** Whether *any* real model is reachable, by either route. */
export function hasLlm(): boolean {
  return hasLlmKey() || bacaKonfigurasiCompat() !== null;
}

/**
 * Why generation is unavailable, in the user's language.
 *
 * Kept next to the port so a new provider failure mode cannot be added in one
 * place and forgotten in the other.
 *
 * These are deliberately NEUTRAL ("Layanan AI"), not "Tutor Gemini": the port is
 * shared, and these strings surface wherever a generation failed. They were
 * written for the tutor and leaked "Tutor Gemini sedang tidak tersedia" onto the
 * loker evaluation panel, which is both confusing and untrue — on that route no
 * Gemini is involved at all. A shared port must not name the feature or the
 * vendor that happens to answer.
 */
export const LLM_FAILURE_MESSAGES = {
  missing_api_key: "Belum ada model AI yang dikonfigurasi.",
  rate_limited: "Batas penggunaan layanan AI tercapai. Coba lagi nanti.",
  provider_error: "Layanan AI sedang tidak tersedia.",
  invalid_output: "Balasan model tidak valid. Silakan coba lagi.",
} as const;

/**
 * The deterministic stand-in used when no key is configured.
 *
 * It answers from the prompt's own subject line rather than inventing content,
 * so a learner sees a real, coherent reply that names what they asked about —
 * and the failure mode is obvious ("this is canned") rather than a wrong
 * answer dressed up as a confident one.
 */
export class StubLlm implements LlmPort {
  readonly name = "stub";
  readonly available = false;

  async generate(prompt: string): Promise<LlmResult> {
    const subject = extractSubject(prompt);
    return {
      ok: true,
      text:
        `Mode contoh aktif${subject ? ` untuk "${subject}"` : ""}. ` +
        `Pertanyaanmu sudah tercatat, tapi belum ada jawaban yang digenerate — ` +
        `tambahkan GEMINI_API_KEY untuk Tutor sungguhan. ` +
        `Sementara itu, coba langkah ini: tulis ulang sendiri dengan kata-katamu, ` +
        `lalu bandingkan dengan materi kursus dan catat bagian yang masih mengambang.`,
    };
  }

}

/** Pull a quoted or titled subject out of a prompt, if there is one. */
function extractSubject(prompt: string): string | null {
  const quoted = prompt.match(/["“]([^"”]{3,80})["”]/);
  if (quoted?.[1]) return quoted[1];
  const heading = prompt.match(/^#{1,3}\s+(.{3,80})$/m);
  return heading?.[1]?.trim() ?? null;
}

/** The real provider, using the same `@google/genai` client the tutor uses. */
export class GeminiLlm implements LlmPort {
  readonly name = "gemini";
  readonly available = true;

  constructor(private readonly apiKey: string) {}

  async generate(prompt: string, options: LlmOptions = {}): Promise<LlmResult> {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey: this.apiKey });
    try {
      // One `config` object, spread conditionally: two separate conditional
      // spreads would silently overwrite each other, so passing both `json`
      // and `signal` would drop the JSON mode.
      const response = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
        contents: prompt,
        config: {
          ...(options.json ? { responseMimeType: "application/json" as const } : {}),
          ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
          ...(options.maxTokens !== undefined ? { maxOutputTokens: options.maxTokens } : {}),
          ...(options.signal ? { abortSignal: options.signal } : {}),
        },
      });
      const text = response.text;
      if (typeof text !== "string" || text.trim().length === 0) {
        return { ok: false, reason: "invalid_output", message: LLM_FAILURE_MESSAGES.invalid_output };
      }
      return { ok: true, text };
    } catch (error: unknown) {
      return { ok: false, ...classifyGeminiError(error) };
    }
  }
}

function classifyGeminiError(error: unknown): {
  reason: "rate_limited" | "provider_error";
  message: string;
} {
  const record = typeof error === "object" && error !== null ? (error as Record<string, unknown>) : {};
  const status = record.status ?? record.statusCode;
  const text = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  if (
    status === 429 ||
    text.includes("quota") ||
    text.includes("rate limit") ||
    text.includes("resource_exhausted")
  ) {
    return { reason: "rate_limited", message: LLM_FAILURE_MESSAGES.rate_limited };
  }
  return { reason: "provider_error", message: LLM_FAILURE_MESSAGES.provider_error };
}

/**
 * A provider that speaks the OpenAI chat-completions protocol.
 *
 * The reason this exists: every model-backed feature in the repo (tutor,
 * mastery, books, quiz generation, the judge) has to be verifiable before it
 * ships, and a paid Gemini key is not a reasonable test dependency. Pointing
 * `CAREERVO_LLM_BASE_URL` at a local 9Router runs the *real* code path — real
 * prompts, real JSON mode, real failure classification — against a free model.
 *
 * One protocol difference is handled explicitly: some OpenAI-compatible
 * gateways answer a non-streaming request with an SSE-framed body that ends in
 * a literal `data: [DONE]` sentinel, which is not valid JSON. See
 * `uraikanJson` — dropping that suffix is not cosmetic, it is the difference
 * between a working feature and "invalid output" on every single call.
 */
export class OpenAiCompatLlm implements LlmPort {
  readonly name = "openai-compat";
  readonly available = true;

  constructor(private readonly config: KonfigurasiCompat) {}

  async generate(prompt: string, options: LlmOptions = {}): Promise<LlmResult> {
    return this.attempt(prompt, options, false);
  }

  private async attempt(
    prompt: string,
    options: LlmOptions,
    retried: boolean,
  ): Promise<LlmResult> {
    const controller = new AbortController();
    // Forward an external signal into our own, so `options.signal` cancels the
    // fetch rather than being silently ignored.
    const onAbort = () => controller.abort();
    options.signal?.addEventListener("abort", onAbort);

    try {
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [{ role: "user", content: prompt }],
          // Enough headroom for a whole question set. Upstream's own note: an
          // empty completion at a low `max_tokens` is a budget artifact, not a
          // dead model, so this must not be starved.
          max_tokens: options.maxTokens ?? 4096,
          ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
          // Tool-calling MUST be off here, and this is not a politeness setting.
          // A gateway can front an agentic coding model, and that model will
          // happily answer "rate this posting" by emitting a `bash` tool call
          // instead of prose — leaving `content` empty, so `bacaContent` returns
          // "" and every call reports `invalid_output`. Measured against
          // 9Router: with tools on, the evaluation returned tool_calls or empty
          // content on most calls; with `tools: []` + `tool_choice: "none"` it
          // returns text. An empty `tools` array is the explicit opt-out; some
          // gateways ignore it, which is why `tool_choice` is sent too.
          tools: [],
          tool_choice: "none",
          ...(options.json ? { response_format: { type: "json_object" } } : {}),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const detail = (await response.text()).slice(0, 300);
        if (response.status === 429) {
          return { ok: false, reason: "rate_limited", message: LLM_FAILURE_MESSAGES.rate_limited };
        }
        return {
          ok: false,
          reason: "provider_error",
          message: `${LLM_FAILURE_MESSAGES.provider_error} (HTTP ${response.status}${detail ? `: ${detail}` : ""})`,
        };
      }

      const text = bacaContent(await response.text());
      if (text.length === 0) {
        // An empty completion is a ROUTING artifact, not an answer: the model
        // diverted into a tool call and left `content` blank. Measured against
        // 9Router fronting an agentic coding model, this happens on roughly one
        // call in three even with `tools: []` sent, and the retry answers
        // correctly. So retry exactly once, and only here — a model that
        // returned text and we could not parse is a different failure, and
        // retrying that would silently paper over a real prompt problem.
        if (!retried) {
          return this.attempt(prompt, options, true);
        }
        return { ok: false, reason: "invalid_output", message: LLM_FAILURE_MESSAGES.invalid_output };
      }
      return { ok: true, text };
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "AbortError") {
        return { ok: false, reason: "provider_error", message: LLM_FAILURE_MESSAGES.provider_error };
      }
      return { ok: false, ...classifyGeminiError(error) };
    } finally {
      options.signal?.removeEventListener("abort", onAbort);
    }
  }
}

/**
 * Pull `choices[0].message.content` out of a response body that may be plain
 * JSON, JSON followed by an SSE sentinel, or a whole SSE stream.
 *
 * The stripping order matters: the sentinel is removed *before* parsing,
 * because `JSON.parse` on the concatenation throws and the caller would report
 * a provider error for a perfectly good answer.
 */
export function bacaContent(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return "";

  // Full SSE envelope: one or more `data:` frames, then the `[DONE]` sentinel.
  //
  // Frames are located by scanning balanced braces from each `data:` marker, NOT
  // by splitting on newlines. 9Router emits the sentinel — and sometimes several
  // frames — glued onto the same physical line as the JSON, with no separator, so
  // a newline split leaves `{"..."}data: [DONE]` as one "line" that a [DONE]
  // filter then discards whole, frame included. That reported a correct answer
  // from o2a/space-bunny-free as empty on every call.
  //
  // Consuming a whole balanced object also means a `data:` appearing inside the
  // model's own content is never mistaken for a frame boundary, and it means
  // `ambilDelta` only ever sees well-formed JSON.
  if (trimmed.startsWith("data:")) {
    const potongan: string[] = [];
    let pos = 0;
    while (pos < trimmed.length) {
      const penanda = trimmed.indexOf("data:", pos);
      if (penanda === -1) break;
      const frame = ambilJsonObject(trimmed, penanda + "data:".length);
      // No `{` after the marker: this is the `[DONE]` sentinel (or trailing
      // whitespace), so the stream is over.
      if (!frame) break;
      potongan.push(ambilDelta(frame));
      pos = penanda + "data:".length + frame.length;
    }
    return potongan.join("");
  }

  const json = uraikanJson(trimmed);
  if (json === null) return "";
  return ambilPesan(json);
}

/** Drop a trailing `data: [DONE]` and parse what is left. */
function uraikanJson(body: string): unknown {
  const tanpaSentinel = body.replace(/\s*data:\s*\[DONE\]\s*$/, "").trim();
  if (!tanpaSentinel) return null;
  try {
    return JSON.parse(tanpaSentinel);
  } catch {
    return null;
  }
}

/**
 * The balanced `{...}` JSON object starting at or after `from`, or null when
 * there is none (which is how the `[DONE]` sentinel ends the scan).
 *
 * Brace counting is string-aware: a `}` or `{` inside a JSON string does not
 * change the depth, and a backslash escapes the next character, so content
 * containing braces cannot end the object early.
 */
function ambilJsonObject(teks: string, from: number): string | null {
  const mulai = teks.indexOf("{", from);
  if (mulai === -1) return null;
  let kedalaman = 0;
  let dalamString = false;
  let escape = false;
  for (let i = mulai; i < teks.length; i++) {
    const c = teks[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (c === "\\") {
      escape = true;
      continue;
    }
    if (c === '"') {
      dalamString = !dalamString;
      continue;
    }
    if (dalamString) continue;
    if (c === "{") kedalaman++;
    else if (c === "}") {
      kedalaman--;
      if (kedalaman === 0) return teks.slice(mulai, i + 1);
    }
  }
  return null;
}

/** One streaming delta, or a whole non-streaming message. */
function ambilDelta(payload: string): string {
  const parsed = JSON.parse(payload) as unknown;
  if (typeof parsed !== "object" || parsed === null) return "";
  const choices = (parsed as Record<string, unknown>).choices;
  if (!Array.isArray(choices) || choices.length === 0) return "";
  const first = choices[0] as Record<string, unknown>;
  const delta = first.delta as Record<string, unknown> | undefined;
  if (delta && typeof delta.content === "string") return delta.content;
  return ambilPesan(parsed);
}

function ambilPesan(payload: unknown): string {
  if (typeof payload !== "object" || payload === null) return "";
  const choices = (payload as Record<string, unknown>).choices;
  if (!Array.isArray(choices) || choices.length === 0) return "";
  const first = choices[0] as Record<string, unknown>;
  const message = first.message as Record<string, unknown> | undefined;
  if (!message) return "";
  // `reasoning_content` is a separate field on some gateways. It is **not** the
  // answer, so it is deliberately not read here: returning it would put the
  // model's private scratchpad in front of a learner.
  return typeof message.content === "string" ? message.content : "";
}

/**
 * The port for this process.
 *
 * Resolved per call rather than cached at module load so a key added to
 * `.env.local` takes effect on the next request in dev without a restart, and
 * so tests can vary the environment freely.
 *
 * Precedence: an explicit compat endpoint wins over a Gemini key. Both being
 * set is a configuration mistake, and the endpoint is the more specific of the
 * two — someone who wrote down a base URL meant to be used.
 */
export function getLlm(): LlmPort {
  const compat = bacaKonfigurasiCompat();
  if (compat) return new OpenAiCompatLlm(compat);
  const key = (process.env.GEMINI_API_KEY ?? "").trim();
  return key.length > 0 ? new GeminiLlm(key) : new StubLlm();
}
