import type { EntriKatalog } from "@/lib/courses/katalog";

/**
 * The reasons a model may attach to an already-decided course shortlist.
 *
 * The ids are NOT free-form: `validasiAlasanKursus` checks every one against
 * the shortlist the deterministic ranker produced. The model explains the
 * picks; it does not get to make them.
 */
export interface AlasanKursus {
  id: string;
  alasan: string;
}

export interface HasilAlasanKursus {
  ringkasan: string;
  kursus: AlasanKursus[];
}

export const SKEMA_ALASAN = `{
  "ringkasan": "<1 kalimat kenapa kursus-kursus ini cocok dengan lowongan>",
  "kursus": [
    { "id": "<id kursus dari daftar, persis>", "alasan": "<1 kalimat alasan spesifik>" }
  ]
}`;

/**
 * Validate against the shortlist, because the model must only be allowed to
 * *decorate* the deterministic picks. An id it invents is dropped, not trusted.
 *
 * Note the failure direction: this throws only on a non-object. A well-formed
 * object carrying no usable reason is SUCCESS with an empty list, not an error.
 * The shortlist stands without reasons exactly as it does with no model, so
 * surfacing a failure would imply the recommendation broke when it did not.
 * (The mastery-path schema is deliberately the opposite: there the points ARE
 * the artifact, so an empty one is a real failure.)
 */
export function validasiAlasanKursus(
  raw: unknown,
  shortlist: EntriKatalog[],
): HasilAlasanKursus {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Hasil alasan bukan objek");
  }
  const obj = raw as Record<string, unknown>;
  const idSah = new Set(shortlist.map((entry) => entry.id));

  const kursus: AlasanKursus[] = [];
  if (Array.isArray(obj.kursus)) {
    for (const row of obj.kursus) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const id = typeof r.id === "string" ? r.id.trim() : "";
      const alasan = typeof r.alasan === "string" ? r.alasan.trim() : "";
      if (!idSah.has(id) || !alasan) continue;
      kursus.push({ id, alasan });
    }
  }

  return {
    ringkasan: typeof obj.ringkasan === "string" ? obj.ringkasan.trim() : "",
    kursus,
  };
}
