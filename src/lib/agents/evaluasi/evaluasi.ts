/**
 * evaluasi.ts — evaluate a loker posting against the candidate profile.
 *
 * Adapted from career-ops (MIT), © 2026 Santiago Fernández de Valderrama.
 * Source: gemini-eval.mjs — context assembly, systemInstruction split, the
 * `temperature: 0.4` / `maxOutputTokens` generation config, and the
 * error-handling shape (quota vs key vs generic).
 * https://github.com/career-ops-hq/career-ops
 *
 * Divergences from upstream, each deliberate:
 *   - Resolves the model through the LLM port (`getLlm`), not `@google/genai`
 *     directly. Upstream is Gemini-only; Careevo must reach any OpenAI-compatible
 *     gateway (a local 9Router, vLLM, Ollama) and must never branch on
 *     `process.env.GEMINI_API_KEY` outside the port — a Gemini key was once the
 *     only switch, and it left every other model-backed surface on a different
 *     route. AGENTS.md forbids that branch outright.
 *   - Returns a typed result or a typed failure. Upstream `process.exit(1)`s,
 *     which is correct for a CLI and wrong for a request handler.
 *   - No `responseSchema`. The schema constraint was real on Gemini, but the
 *     port cannot express it for every provider, and a schema that silently
 *     applies to one route and not another is worse than none. The shape is
 *     enforced in two places that work everywhere instead: the exact key names
 *     are spelled out in the prompt (`SKEMA_HASIL` in prompt.ts) and
 *     `validasiHasil` rejects anything that does not validate. See
 *     "Where the shape is enforced" below.
 *
 * Failure policy (a product decision, not a technical one): when evaluation is
 * unavailable, the caller shows NO score. It never falls back to a heuristic
 * score — a made-up number presented as an evaluation is worse than an absent one.
 * The port's stub is prose, not a score, so a stubbed port is reported as
 * `tanpa_kunci` rather than being parsed and rendered as a result.
 */

import type { JobFixture, ProfileFixture } from "@/lib/fixtures";
import { getLlm, hasLlm, type LlmResult } from "@/lib/llm/port";
import { parseJsonMaybeFenced } from "@/lib/llm/json";
import { bangunPrompt } from "./prompt";
import { validasiHasil, type HasilEvaluasi } from "./skema";

/** Upstream's value: stable enough for a structured evaluation, not degenerate. */
const SUHU = 0.4;

export type HasilEvaluasiAtauGagal =
  | { ok: true; hasil: HasilEvaluasi }
  | { ok: false; alasan: JenisGagal; pesan: string };

export type JenisGagal =
  /** No model configured — the feature is off, not broken. */
  | "tanpa_kunci"
  /** Free-tier quota exhausted, or rate limited. */
  | "kuota"
  /** The model returned something that does not match the schema. */
  | "hasil_tidak_valid"
  /** Network, auth, or anything else. */
  | "gagal";

/**
 * Map a port failure onto the cause the UI can act on.
 *
 * Upstream distinguishes quota from key from generic so it can print a helpful
 * CLI message; here the distinction drives what the user is told, so the mapping
 * is the load-bearing part. `provider_error` stays `gagal` rather than becoming a
 * new reason: the UI has three messages, and inventing a fourth for one HTTP
 * status would be a translation exercise, not new information.
 */
function klasifikasiGagal(hasil: Extract<LlmResult, { ok: false }>): {
  alasan: JenisGagal;
  pesan: string;
} {
  switch (hasil.reason) {
    case "missing_api_key":
      return {
        alasan: "tanpa_kunci",
        pesan: "Belum ada model yang dikonfigurasi. Atur GEMINI_API_KEY atau CAREERVO_LLM_BASE_URL + CAREERVO_LLM_MODEL.",
      };
    case "rate_limited":
      return { alasan: "kuota", pesan: hasil.message };
    case "invalid_output":
      return { alasan: "hasil_tidak_valid", pesan: hasil.message };
    default:
      return { alasan: "gagal", pesan: hasil.message };
  }
}

/**
 * Evaluate one posting. Never throws — every failure is a typed result.
 *
 * Returning a result rather than throwing is deliberate: a page that calls this
 * must render the posting either way. A thrown error would take down the page
 * for what is an optional enrichment.
 */
export async function evaluasiLoker(
  job: JobFixture,
  profile: ProfileFixture,
): Promise<HasilEvaluasiAtauGagal> {
  const llm = getLlm();

  // The stub answers with prose, so parsing it would be nonsense. Reporting it
  // as `tanpa_kunci` keeps the failure policy intact: no model, no score.
  if (!llm.available) {
    return {
      ok: false,
      alasan: "tanpa_kunci",
      pesan: "GEMINI_API_KEY belum diatur. Skor kecocokan tidak tersedia.",
    };
  }

  const prompt = bangunPrompt(job, profile);

  const hasil = await llm.generate(prompt, { json: true, temperature: SUHU, maxTokens: 8192 });
  if (!hasil.ok) return { ok: false, ...klasifikasiGagal(hasil) };

  // Tolerant parse: a model that wraps the object in a ```json fence, or appends
  // a sentence after it, has still answered correctly. Reporting that as a
  // provider fault would be wrong, and it is common on gateway models.
  const parsed = parseJsonMaybeFenced(hasil.text);
  if (parsed === null) {
    return {
      ok: false,
      alasan: "hasil_tidak_valid",
      pesan: "Balasan model bukan JSON yang bisa dibaca.",
    };
  }

  try {
    return { ok: true, hasil: validasiHasil(parsed) };
  } catch (err) {
    return {
      ok: false,
      alasan: "hasil_tidak_valid",
      pesan: err instanceof Error ? err.message : "Hasil model tidak sesuai skema.",
    };
  }
}

/** Whether the feature is configured at all — lets the UI hide rather than error. */
export function evaluasiTersedia(): boolean {
  return hasLlm();
}
