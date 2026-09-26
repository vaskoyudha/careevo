import { getLlm } from "@/lib/llm/port";
import type { ModulKursus } from "@/lib/courses/kurikulum";
import {
  LABEL_TIPE,
  normalisasiSoal,
  parseJsonMaybeFenced,
  type SoalLatihan,
} from "./types";
import { KUNCI_PILIHAN, TOKEN_ISIAN, type TipeSoal } from "./tipe-soal";
import {
  bagiSisa,
  StubLatihanGenerator,
  type GenerateInput,
  type GenerateResult,
} from "./generator";

/**
 * The model-backed generator.
 *
 * Adapted from DeepTutor (HKUDS), v1.6.8. Apache License 2.0.
 * Source: deeptutor/agents/question/pipeline.py (plan + per-question phases)
 * Source: https://github.com/HKUDS/DeepTutor
 * Source commit: a5eafa89072f6d7290a6854a6afc4ba060053beb
 * Original license: Apache License 2.0
 * Modified for Careevo: one call per question (upstream's Plan phase is dropped —
 *   a separate planning call costs latency for a plan the prompt below can state
 *   directly), and the per-type rules are enforced by `normalisasiSoal` instead
 *   of by an `issues` list, matching this repo's drop-don't-render policy.
 *
 * Every returned question is validated before it is kept. A model that returns
 * five options for a choice question, or a fill-in-the-blank with no `____`,
 * loses **that question** — not the whole latihan, which is what throwing on the
 * first bad payload would cause.
 */
export class GeminiLatihanGenerator {
  readonly name = "gemini" as const;

  async generate(input: GenerateInput): Promise<GenerateResult> {
    const llm = getLlm();
    if (!llm.available) return new StubLatihanGenerator().generate(input);

    // The admin bank outranks generated questions: a human wrote it, and it is
    // already used elsewhere in the product. Generated questions fill the rest.
    const bank = await new StubLatihanGenerator().generate({ ...input, jumlah: 0 });
    const soal: SoalLatihan[] = [...bank.soal];
    const dariBank = soal.length;
    const tipe: readonly TipeSoal[] =
      input.tipe.length > 0 ? input.tipe : ["choice", "concept", "short_answer"];

    // A per-type quota, because one call commonly returns several questions and
    // the first type would otherwise swallow the whole budget. Without this, a
    // learner who asked for one of each type got four of the first one.
    const kuota = new Map<TipeSoal, number>(tipe.map((item) => [item, 0]));
    const perTipe = bagiSisa(input.jumlah, tipe.length);
    for (const item of tipe) kuota.set(item, perTipe);

    for (const tipeSoal of tipe) {
      for (const modul of input.modules) {
        if (soal.length >= input.jumlah) break;
        if ((kuota.get(tipeSoal) ?? 0) <= 0) break;

        const result = await llm.generate(
          bangunPrompt({ input, module: modul, tipeSoal }),
          { json: true },
        );
        if (!result.ok) continue;

        for (const raw of ambilArray(result.text)) {
          if (soal.length >= input.jumlah) break;
          const parsed = normalisasiSoal(
            { ...(raw as Record<string, unknown>), moduleId: modul.id },
            `g${soal.length + 1}`,
          );
          if (!parsed) continue;
          // Counted by the type the question *actually* came out as, not the one
          // that was requested. A model that ignores the requested type must not
          // be able to spend another type's quota.
          if ((kuota.get(parsed.tipe) ?? 0) <= 0) continue;
          kuota.set(parsed.tipe, (kuota.get(parsed.tipe) ?? 0) - 1);
          soal.push(parsed);
        }
      }
    }

    // Everything the model returned was unusable. Rather than hand back an empty
    // latihan that looks broken, fall back to the deterministic builder — the
    // learner still gets a complete set, and the footer says who wrote it.
    if (soal.length === 0) return new StubLatihanGenerator().generate(input);

    return {
      soal: soal.slice(0, input.jumlah),
      disusunOleh: "gemini",
      dariBank,
    };
  }
}

/**
 * Pull a question array out of a model response.
 *
 * A model asked for "a JSON array" routinely answers `{"questions": [...]}`
 * instead, so both shapes are accepted before giving up.
 */
function ambilArray(text: string): unknown[] {
  const parsed = parseJsonMaybeFenced(text);
  if (Array.isArray(parsed)) return parsed;
  if (typeof parsed === "object" && parsed !== null) {
    const questions = (parsed as Record<string, unknown>).questions;
    if (Array.isArray(questions)) return questions;
  }
  return [];
}

/** The per-type rules, stated so a model does not have to guess. */
function aturanTipe(tipeSoal: TipeSoal): string {
  switch (tipeSoal) {
    case "choice":
      return [
        `- Tipe soal WAJIB "choice".`,
        `- "pilihan" HARUS punya tepat empat kunci: ${KUNCI_PILIHAN.join(", ")}. Tidak boleh lima, tidak boleh tiga.`,
        `- "jawaban" HARUS salah satu huruf ${KUNCI_PILIHAN.join("/")}, bukan teks pilihannya.`,
      ].join("\n");
    case "concept":
      return [
        `- Tipe soal WAJIB "concept".`,
        `- "jawaban" HARUS persis "true" atau "false" (huruf kecil). Jangan tulis "benar" atau "ya".`,
        `- "pilihan" tidak boleh ada sama sekali.`,
      ].join("\n");
    case "fill_in_blank":
      return [
        `- Tipe soal WAJIB "fill_in_blank".`,
        `- "pertanyaan" HARUS memuat token ${TOKEN_ISIAN} tepat satu kali di tempat rongga jawabannya.`,
        `- "jawaban" adalah isi rongga itu saja, tanpa ${TOKEN_ISIAN}.`,
        `- "pilihan" tidak boleh ada sama sekali.`,
      ].join("\n");
    case "coding":
      return `- Tipe soal WAJIB "coding". "jawaban" adalah kode acuan yang benar secara sintaks. "pilihan" tidak boleh ada.`;
    case "written":
      return `- Tipe soal WAJIB "written". "jawaban" adalah jawaban acuan yang lengkap. "pilihan" tidak boleh ada.`;
    default:
      return `- Tipe soal WAJIB "short_answer". "jawaban" adalah jawaban acuan singkat. "pilihan" tidak boleh ada.`;
  }
}

/**
 * The example the model is shown, as an array of one question.
 *
 * Built with `JSON.stringify` over a real object rather than a template string.
 * A hand-written example is exactly the kind of thing that drifts: an earlier
 * version interpolated a pre-quoted `"tingkat":"medium"` fragment and ended up
 * emitting `,""tingkat":"medium""`, i.e. a broken JSON sample to a model being
 * asked for JSON. Serialising a real object makes that class of bug impossible.
 */
function contoh(tipeSoal: TipeSoal): string {
  const dasar = { tipe: tipeSoal, tingkat: "medium" as const, pembahasan: "Penjelasan singkat." };
  switch (tipeSoal) {
    case "choice":
      return JSON.stringify([
        {
          ...dasar,
          pertanyaan: "Pernyataan mana yang benar?",
          pilihan: { A: "…", B: "…", C: "…", D: "…" },
          jawaban: "A",
          pembahasan: "Alasan A benar dan B–D tidak.",
        },
      ]);
    case "concept":
      return JSON.stringify([
        {
          ...dasar,
          pertanyaan: "Pernyataan benar atau salah: …",
          jawaban: "true",
          pembahasan: "Penjelasan singkat mengapa pernyataan itu benar.",
        },
      ]);
    case "fill_in_blank":
      return JSON.stringify([
        {
          ...dasar,
          pertanyaan: `Hooks dipanggil ${TOKEN_ISIAN} setiap render.`,
          jawaban: "useEffect",
        },
      ]);
    case "coding":
      return JSON.stringify([{ ...dasar, pertanyaan: "Tulis fungsi …", jawaban: "function …" }]);
    default:
      return JSON.stringify([
        { ...dasar, pertanyaan: "…", jawaban: "jawaban acuan" },
      ]);
  }
}

function bangunPrompt({
  input,
  module: modul,
  tipeSoal,
}: {
  input: GenerateInput;
  module: ModulKursus;
  tipeSoal: TipeSoal;
}): string {
  const baris = [
    `Buat satu soal kuis bertipe "${tipeSoal}" (${LABEL_TIPE[tipeSoal]}) tentang modul "${modul.judul}" dari kursus "${input.course.title}".`,
    ``,
    `Konteks modul: ${modul.ringkasan}`,
    `Tag kursus: ${input.course.tags.join(", ")}`,
  ];

  if (input.fokus?.trim()) {
    baris.push(`Fokus yang diminta learner: ${input.fokus.trim()}`);
  }

  baris.push(
    `Tingkat kesulitan: ${input.tingkat}.`,
    ``,
    `Aturan wajib:`,
    aturanTipe(tipeSoal),
    `- "pertanyaan" maksimal 2 kalimat, dalam bahasa Indonesia.`,
    `- "pembahasan" wajib diisi dan menjelaskan kenapa kunci itu benar, bukan mengulang soal.`,
    `- Kesulitan soal: "${input.tingkat}".`,
    ``,
    `Balas HANYA dengan JSON — satu objek dalam array, tanpa penjelasan lain:`,
    contoh(tipeSoal),
    ``,
    `Soal yang melanggar aturan di atas akan dibuang, jadi pastikan bentuknya tepat.`,
  );

  return baris.join("\n");
}
