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

/**
 * Learner-facing copy per reason.
 *
 * `pesan` is rendered straight onto a shared page, so it is written here once
 * and never assembled from the provider's own words. A browser run caught why
 * that matters: a 503 whose body was a nested quota error was shown verbatim,
 * dumping ~200 characters of escaped JSON at a job seeker. The provider text is
 * still available — as `detail` — for whoever is debugging, but it is not what
 * the learner reads.
 *
 * The wording promises nothing and blames nobody: the user did not cause a
 * gateway outage, and "layanan sedang tidak tersedia" is true whether the cause
 * is a quota, a bad key, or a socket.
 */
const PESAN: Record<JenisGagal, string> = {
  tanpa_kunci:
    "Belum ada model AI yang dikonfigurasi, jadi bagian ini belum aktif. Atur GEMINI_API_KEY atau CAREERVO_LLM_BASE_URL + CAREERVO_LLM_MODEL.",
  kuota:
    "Kuota model AI sedang habis. Coba lagi beberapa saat lagi — hasil tidak ditampilkan supaya tidak ada yang menebak-tebak.",
  hasil_tidak_valid:
    "Model AI menjawab dengan format yang tidak dikenali. Hasilnya tidak ditampilkan.",
  gagal: "Layanan AI sedang tidak tersedia. Hasilnya tidak ditampilkan.",
};

/**
 * Reasons that add no diagnostic value: a missing key is fully described by
 * `pesan` already, and the port's message for it is boilerplate.
 *
 * Written as an exclusion list on purpose. An allow-list would silently drop the
 * provider text the first time the port grows a new reason — the same drift
 * this module was extracted to prevent, just moved.
 */
const TANPA_DETAIL: ReadonlySet<string> = new Set(["missing_api_key"]);

export function klasifikasiGagal(hasil: Extract<LlmResult, { ok: false }>): {
  alasan: JenisGagal;
  pesan: string;
  /** The provider's own words, for logs and bug reports. Never learner copy. */
  detail?: string;
} {
  const alasan: JenisGagal =
    hasil.reason === "missing_api_key"
      ? "tanpa_kunci"
      : hasil.reason === "rate_limited"
        ? "kuota"
        : hasil.reason === "invalid_output"
          ? "hasil_tidak_valid"
          : "gagal";

  return {
    alasan,
    pesan: PESAN[alasan],
    ...(TANPA_DETAIL.has(hasil.reason) ? {} : { detail: hasil.message }),
  };
}
