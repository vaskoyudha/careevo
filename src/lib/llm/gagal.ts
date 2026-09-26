import type { LlmResult } from "./port";

/**
 * Why a generation failed, in terms the UI can act on.
 *
 * Moved out of `evaluasi.ts` so every model-backed feature shares one mapping.
 * Two agents needed the same switch, and a second hand-written copy is exactly
 * the kind that drifts: a new port failure mode would be handled in one feature
 * and silently fall through to `gagal` in another.
 *
 * `provider_error` stays `gagal` rather than becoming a new reason. The UI has
 * three messages, and inventing a fourth for one HTTP status would be a
 * translation exercise, not new information.
 */
export type JenisGagal =
  /** No model configured — the feature is off, not broken. */
  | "tanpa_kunci"
  /** Free-tier quota exhausted, or rate limited. */
  | "kuota"
  /** The model returned something that does not match the schema. */
  | "hasil_tidak_valid"
  /** Network, auth, or anything else. */
  | "gagal";

export function klasifikasiGagal(hasil: Extract<LlmResult, { ok: false }>): {
  alasan: JenisGagal;
  pesan: string;
} {
  switch (hasil.reason) {
    case "missing_api_key":
      return {
        alasan: "tanpa_kunci",
        pesan:
          "Belum ada model yang dikonfigurasi. Atur GEMINI_API_KEY atau CAREERVO_LLM_BASE_URL + CAREERVO_LLM_MODEL.",
      };
    case "rate_limited":
      return { alasan: "kuota", pesan: hasil.message };
    case "invalid_output":
      return { alasan: "hasil_tidak_valid", pesan: hasil.message };
    default:
      return { alasan: "gagal", pesan: hasil.message };
  }
}
