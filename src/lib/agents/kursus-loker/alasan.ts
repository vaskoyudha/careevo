import type { EntriKatalog } from "@/lib/courses/katalog";
import type { JobFixture } from "@/lib/fixtures";
import { getLlm } from "@/lib/llm/port";
import { parseJsonMaybeFenced } from "@/lib/llm/json";
import { klasifikasiGagal, type JenisGagal } from "@/lib/llm/gagal";
import { bangunPromptAlasan } from "./prompt";
import {
  SKEMA_ALASAN,
  validasiAlasanKursus,
  type HasilAlasanKursus,
} from "./skema";

// The validator is re-exported so a caller needs one import, the same way
// `evaluasi.ts` re-exports its failure type: schema and orchestration belong to
// the same feature even when they live in separate files.
export { validasiAlasanKursus, SKEMA_ALASAN };
export type { AlasanKursus, HasilAlasanKursus };

export type HasilAlasanAtauGagal =
  | { ok: true; hasil: HasilAlasanKursus }
  | { ok: false; alasan: JenisGagal; pesan: string };

/**
 * Write one reason per shortlisted course. Never throws.
 *
 * An empty shortlist returns success with no reasons instead of calling the
 * model: spending a paid call to explain nothing is a waste, and the caller
 * renders an empty list either way.
 */
export async function jelaskanKursus(
  job: JobFixture,
  shortlist: EntriKatalog[],
): Promise<HasilAlasanAtauGagal> {
  if (shortlist.length === 0) {
    return { ok: true, hasil: { ringkasan: "", kursus: [] } };
  }

  const llm = getLlm();
  if (!llm.available) {
    return {
      ok: false,
      alasan: "tanpa_kunci",
      pesan: "Alasan tidak ditampilkan karena belum ada model AI yang dikonfigurasi.",
    };
  }

  const hasil = await llm.generate(bangunPromptAlasan(job, shortlist), {
    json: true,
    temperature: 0.4,
    maxTokens: 2048,
  });
  if (!hasil.ok) return { ok: false, ...klasifikasiGagal(hasil) };

  const parsed = parseJsonMaybeFenced(hasil.text);
  if (parsed === null) {
    return { ok: false, alasan: "hasil_tidak_valid", pesan: "Balasan model bukan JSON." };
  }

  try {
    return { ok: true, hasil: validasiAlasanKursus(parsed, shortlist) };
  } catch (err) {
    return {
      ok: false,
      alasan: "hasil_tidak_valid",
      pesan: err instanceof Error ? err.message : "Hasil model tidak sesuai skema.",
    };
  }
}
