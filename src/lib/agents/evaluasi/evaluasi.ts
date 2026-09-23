/**
 * evaluasi.ts — evaluate a loker posting against the candidate profile with Gemini.
 *
 * Adapted from career-ops (MIT), © 2026 Santiago Fernández de Valderrama.
 * Source: gemini-eval.mjs — context assembly, systemInstruction split, the
 * `temperature: 0.4` / `maxOutputTokens` generation config, and the
 * error-handling shape (quota vs key vs generic).
 * https://github.com/career-ops-hq/career-ops
 *
 * Divergences from upstream, each deliberate:
 *   - Uses `@google/genai` (the current SDK), not `@google/generative-ai`.
 *     Upstream's SDK last shipped April 2025 and Google has replaced it; porting
 *     onto a dead dependency only defers the problem.
 *   - Constrains output with a `responseSchema` instead of parsing a
 *     `---SCORE_SUMMARY---` regex trailer. A regex over prose fails silently when
 *     the model rephrases; a schema makes that class of bug impossible.
 *   - Returns a typed result or a typed failure. Upstream `process.exit(1)`s,
 *     which is correct for a CLI and wrong for a request handler.
 *
 * Failure policy (a product decision, not a technical one): when evaluation is
 * unavailable, the caller shows NO score. It never falls back to a heuristic
 * score — a made-up number presented as an evaluation is worse than an absent one.
 */

import { GoogleGenAI, Type } from "@google/genai";
import type { JobFixture, ProfileFixture } from "@/lib/fixtures";
import { bangunPrompt } from "./prompt";
import { validasiHasil, type HasilEvaluasi } from "./skema";

/** Model choice. Flash is the free-tier model upstream defaults to. */
const MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

export type HasilEvaluasiAtauGagal =
  | { ok: true; hasil: HasilEvaluasi }
  | { ok: false; alasan: JenisGagal; pesan: string };

export type JenisGagal =
  /** No API key configured — the feature is off, not broken. */
  | "tanpa_kunci"
  /** Free-tier quota exhausted, or rate limited. */
  | "kuota"
  /** The model returned something that does not match the schema. */
  | "hasil_tidak_valid"
  /** Network, auth, or anything else. */
  | "gagal";

/**
 * JSON schema handed to Gemini so the response is constrained at generation time.
 *
 * `responseMimeType: "application/json"` plus this schema is what removes the
 * prose-parsing problem. It is also why `validasiHasil` still exists: a schema
 * constrains shape, not meaning, so the values are checked independently.
 */
const SKEMA_RESPONS = {
  type: Type.OBJECT,
  properties: {
    skor_global: { type: Type.NUMBER },
    dimensi: {
      type: Type.OBJECT,
      properties: {
        match_cv: { type: Type.NUMBER },
        north_star: { type: Type.NUMBER },
        kompensasi: { type: Type.NUMBER },
        budaya: { type: Type.NUMBER },
        red_flag: { type: Type.NUMBER },
      },
      required: ["match_cv", "north_star", "kompensasi", "budaya", "red_flag"],
    },
    arketipe: { type: Type.STRING },
    ringkasan: { type: Type.STRING },
    kecocokan: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          syarat: { type: Type.STRING },
          bobot: { type: Type.STRING },
          bukti: { type: Type.STRING },
          gap: { type: Type.STRING },
        },
        required: ["syarat", "bobot", "bukti", "gap"],
      },
    },
    level: { type: Type.STRING },
    kompensasi: { type: Type.STRING },
    personalisasi: { type: Type.ARRAY, items: { type: Type.STRING } },
    wawancara: { type: Type.ARRAY, items: { type: Type.STRING } },
    rekomendasi: { type: Type.STRING },
  },
  required: [
    "skor_global",
    "dimensi",
    "arketipe",
    "ringkasan",
    "kecocokan",
    "level",
    "kompensasi",
    "personalisasi",
    "wawancara",
    "rekomendasi",
  ],
} as const;

/**
 * Classify a thrown error into a cause the UI can act on.
 *
 * Upstream distinguishes these to print a helpful CLI message; here the
 * distinction drives what the UI says, so the mapping is the load-bearing part.
 * Never include the API key in a message — upstream's `.split(apiKey).join(...)`
 * redaction is the same defence.
 */
function klasifikasiError(err: unknown): JenisGagal {
  const pesan = (err instanceof Error ? err.message : String(err)).toLowerCase();
  if (pesan.includes("quota") || pesan.includes("rate") || pesan.includes("429") || pesan.includes("resource_exhausted")) {
    return "kuota";
  }
  return "gagal";
}

/** Strip anything key-shaped from a message before it reaches a response. */
function bersihkanPesan(pesan: string, apiKey: string): string {
  const tanpaKunci = apiKey ? pesan.split(apiKey).join("[REDACTED]") : pesan;
  return tanpaKunci.slice(0, 300);
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
  const apiKey = process.env.GEMINI_API_KEY ?? "";
  if (!apiKey) {
    return {
      ok: false,
      alasan: "tanpa_kunci",
      pesan: "GEMINI_API_KEY belum diatur. Skor kecocokan tidak tersedia.",
    };
  }

  const prompt = bangunPrompt(job, profile);

  try {
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        // 0.4 — low enough for a stable structured evaluation, high enough not to
        // degenerate. Upstream's value.
        temperature: 0.4,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
        responseSchema: SKEMA_RESPONS,
      },
    });

    const teks = response.text;
    if (!teks) {
      return { ok: false, alasan: "hasil_tidak_valid", pesan: "Model tidak mengembalikan isi." };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(teks);
    } catch {
      return {
        ok: false,
        alasan: "hasil_tidak_valid",
        pesan: "Hasil model bukan JSON yang valid.",
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
  } catch (err) {
    const alasan = klasifikasiError(err);
    return {
      ok: false,
      alasan,
      pesan: bersihkanPesan(err instanceof Error ? err.message : String(err), apiKey),
    };
  }
}

/** Whether the feature is configured at all — lets the UI hide rather than error. */
export function evaluasiTersedia(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}
