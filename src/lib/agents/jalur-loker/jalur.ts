import type { JobFixture } from "@/lib/fixtures";
import { getLlm } from "@/lib/llm/port";
import { parseJsonMaybeFenced } from "@/lib/llm/json";
import { klasifikasiGagal, type JenisGagal } from "@/lib/llm/gagal";
import { bangunPromptJalur } from "./prompt";
import { validasiJalurLoker, type HasilJalurLoker } from "./skema";

/**
 * Extract a mastery path from a job posting.
 *
 * Same contract as `evaluasiLoker`: resolve the model through the port, never
 * throw, and report a failure as a typed value. A posting that cannot produce a
 * path must leave the learner with an honest message, not a plausible tree.
 *
 * This runs on demand, never on render: it costs a call and takes tens of
 * seconds, exactly like the A–H evaluation.
 */
export type HasilJalurAtauGagal =
  | { ok: true; hasil: HasilJalurLoker }
  | { ok: false; alasan: JenisGagal; pesan: string; detail?: string };

/** Group a job's points under one synthetic module, so ids stay namespaced. */
export function MODULE_LOKER(jobId: string): string {
  return `loker-${jobId}`;
}

/**
 * Stable, readable ids, so a point keeps its attempt history if the learner
 * regenerates the path. The course path uses `${moduleId}::kp${n}` for the same
 * reason (`topic-tree.ts`), and these ids are equally never derived from model
 * output — a model that reordered its points must not move a point's history.
 */
export function pointIdLoker(jobId: string, index: number): string {
  return `${MODULE_LOKER(jobId)}::kp${index + 1}`;
}

export async function susunJalurLoker(job: JobFixture): Promise<HasilJalurAtauGagal> {
  const llm = getLlm();

  // The stub answers with prose, so parsing it would be nonsense. Reported as
  // `tanpa_kunci`, which keeps the failure policy intact: no model, no path.
  if (!llm.available) {
    return {
      ok: false,
      alasan: "tanpa_kunci",
      pesan: "Belum ada model AI yang dikonfigurasi, jadi jalur penguasaan belum bisa disusun.",
    };
  }

  const hasil = await llm.generate(bangunPromptJalur(job), {
    json: true,
    temperature: 0.4,
    maxTokens: 4096,
  });
  if (!hasil.ok) return { ok: false, ...klasifikasiGagal(hasil) };

  // Tolerant parse: a model that wraps the object in a ```json fence, or
  // appends a sentence after it, has still answered correctly.
  const parsed = parseJsonMaybeFenced(hasil.text);
  if (parsed === null) {
    return { ok: false, alasan: "hasil_tidak_valid", pesan: "Balasan model bukan JSON." };
  }

  try {
    return { ok: true, hasil: validasiJalurLoker(parsed) };
  } catch (err) {
    return {
      ok: false,
      alasan: "hasil_tidak_valid",
      pesan: err instanceof Error ? err.message : "Hasil model tidak sesuai skema.",
    };
  }
}
