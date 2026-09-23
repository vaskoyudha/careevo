/**
 * skema.ts — the shape of an A–H evaluation result, and how it is validated.
 *
 * Ported from career-ops' A–H evaluation (MIT), © 2026 Santiago Fernández de
 * Valderrama. Upstream emits the report as Markdown blocks plus a
 * `---SCORE_SUMMARY---` trailer parsed by regex (`validateEvaluationShape`).
 *
 * This port asks the model for JSON instead, and validates it against a schema.
 * The reason is not taste: a regex over prose is a parser that fails silently on
 * a formatting change, and Careevo renders the result in a UI rather than saving
 * it to a report file. Gemini can constrain output to a schema, which removes the
 * entire class of "the model phrased it slightly differently" bugs.
 *
 * The SCORING MODEL is upstream's, unchanged: five dimensions integrated into one
 * global score of 1–5.
 */

/** The five dimensions, plus the holistic global score. All 1–5. */
export interface SkorDimensi {
  /** Kecocokan dengan CV — skills, pengalaman, proof point. */
  match_cv: number;
  /** Keselarasan North Star — seberapa cocok role dengan target kandidat. */
  north_star: number;
  /** Kompensasi vs pasar. 5 = kuartil atas, 1 = jauh di bawah. */
  kompensasi: number;
  /** Sinyal budaya: pertumbuhan, stabilitas, kebijakan remote. */
  budaya: number;
  /** Red flag — blocker dan peringatan (penyesuaian negatif). */
  red_flag: number;
}

/** One row of Block B's requirement↔CV mapping. */
export interface BarisKecocokan {
  /** The requirement, quoted or paraphrased from the posting. */
  syarat: string;
  /** How important it is for this posting: tinggi | sedang | rendah. */
  bobot: "tinggi" | "sedang" | "rendah";
  /** The candidate's evidence, or "" when there is none. */
  bukti: string;
  /** Gap + mitigation, or "" when the requirement is met. */
  gap: string;
}

export interface HasilEvaluasi {
  /** Global 1–5, holistic — NOT an arithmetic mean of the dimensions. */
  skor_global: number;
  dimensi: SkorDimensi;
  /** Archetype detected for the role (career-ops' Step 0). */
  arketipe: string;
  /** Block A — one-sentence role summary. */
  ringkasan: string;
  /** Block B — requirement↔CV rows. */
  kecocokan: BarisKecocokan[];
  /** Block C — level detected vs natural level, and the "sell senior" plan. */
  level: string;
  /** Block D — compensation assessment, citing the posting's own figure if any. */
  kompensasi: string;
  /** Block E — concrete CV/personalisation changes. */
  personalisasi: string[];
  /** Block F — interview stories mapped to requirements. */
  wawancara: string[];
  /** Block H — the single next action, or a reason to skip. */
  rekomendasi: string;
}

/** Score interpretation, verbatim from career-ops `modes/_shared.md`. */
export function tafsirSkor(skor: number): string {
  if (skor >= 4.5) return "Cocok kuat — lamar segera";
  if (skor >= 4.0) return "Cocok — layak dilamar";
  if (skor >= 3.5) return "Lumayan, belum ideal — lamar kalau ada alasan spesifik";
  return "Sebaiknya jangan lamar";
}

const DIMENSI_KEYS: Array<keyof SkorDimensi> = [
  "match_cv",
  "north_star",
  "kompensasi",
  "budaya",
  "red_flag",
];

function angkaSkor(value: unknown): number | null {
  // `null` and `""` must be rejected BEFORE Number() sees them: Number(null) is 0
  // and Number("") is 0, both of which are valid scores. Coercing a missing value
  // into a real 0 would render "no data" as "scored worst" — a silent, plausible-
  // looking lie. A numeric string like "4.5" is a formatting quirk and is allowed.
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;

  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 5) return null;
  return n;
}

function teks(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Validate a parsed model response.
 *
 * Throws with a specific reason rather than returning a partial object: a
 * half-valid evaluation rendered in the UI is worse than no evaluation, because
 * it looks authoritative while being wrong.
 */
export function validasiHasil(raw: unknown): HasilEvaluasi {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Hasil evaluasi bukan objek");
  }
  const obj = raw as Record<string, unknown>;

  const skorGlobal = angkaSkor(obj.skor_global);
  if (skorGlobal === null) throw new Error("skor_global harus angka 0–5");

  const dimensiRaw = obj.dimensi;
  if (!dimensiRaw || typeof dimensiRaw !== "object") {
    throw new Error("dimensi wajib ada");
  }
  const dimensiObj = dimensiRaw as Record<string, unknown>;
  const dimensi = {} as SkorDimensi;
  for (const key of DIMENSI_KEYS) {
    const v = angkaSkor(dimensiObj[key]);
    if (v === null) throw new Error(`dimensi.${key} harus angka 0–5`);
    dimensi[key] = v;
  }

  const arketipe = teks(obj.arketipe);
  const ringkasan = teks(obj.ringkasan);
  if (!arketipe) throw new Error("arketipe wajib ada");
  if (!ringkasan) throw new Error("ringkasan wajib ada");

  const kecocokan: BarisKecocokan[] = [];
  if (Array.isArray(obj.kecocokan)) {
    for (const row of obj.kecocokan) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const syarat = teks(r.syarat);
      if (!syarat) continue;
      const bobotRaw = teks(r.bobot).toLowerCase();
      const bobot: BarisKecocokan["bobot"] =
        bobotRaw === "tinggi" || bobotRaw === "rendah" ? bobotRaw : "sedang";
      kecocokan.push({ syarat, bobot, bukti: teks(r.bukti), gap: teks(r.gap) });
    }
  }

  const daftar = (v: unknown): string[] =>
    Array.isArray(v) ? v.map(teks).filter(Boolean) : [];

  return {
    skor_global: skorGlobal,
    dimensi,
    arketipe,
    ringkasan,
    kecocokan,
    level: teks(obj.level),
    kompensasi: teks(obj.kompensasi),
    personalisasi: daftar(obj.personalisasi),
    wawancara: daftar(obj.wawancara),
    rekomendasi: teks(obj.rekomendasi),
  };
}
