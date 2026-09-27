import { getLlm, type LlmResult } from "@/lib/llm/port";
import {
  KETERANGAN_TIPE,
  LABEL_TIPE,
  type SoalLatihan,
} from "./types";
import { KUNCI_PILIHAN, type TipeSoal } from "./tipe-soal";

/**
 * Grading a free-text answer.
 *
 * Adapted from DeepTutor (HKUDS), v1.6.8. Apache License 2.0.
 * Source: deeptutor/api/routers/quiz_judge.py (`_JUDGE_SYSTEM_PROMPTS`)
 * Source: https://github.com/HKUDS/DeepTutor
 * Source commit: a5eafa89072f6d7290a6854a6afc4ba060053beb
 * Original license: Apache License 2.0
 * Modified for Careevo: the English and Chinese system prompts became one
 *   Indonesian prompt, because every question and every answer in Careevo is in
 *   Indonesian and a judge instructed to answer in English is answering the
 *   wrong language. The verdict contract is kept exactly: one line that opens
 *   with ✅ / ⚠️ / ❌, then the three-part breakdown. And because the answer
 *   comes back as **markdown prose, not JSON**, a verdict is extracted from the
 *   first emoji rather than parsed — upstream streams the same prose.
 *
 * No key configured → the judge is honest instead of absent. It says which
 * mechanical checks it ran and refuses to score the rest, because a stub that
 * invents a grade is worse than no grade.
 */

export type PutusanJuri = "benar" | "sebagian" | "salah";

export interface HasilJuri {
  putusan: PutusanJuri;
  /** Indonesian prose from the model, or the stub's own explanation. */
  teks: string;
  sumber: "juri" | "contoh";
}

/** The Indonesian judge instructions. Mirrors upstream's structure verbatim. */
export const PROMPT_SISTEM_JURI = `Kamu adalah asisten mengajar yang teliti sekaligus mendukung, sedang menilai jawaban seorang learner terhadap soal kuis.
Gunakan soal, jawaban acuan, dan pembahasan untuk memberikan penilaian yang spesifik.

Persyaratan:
- Mulai dengan satu baris yang menyatakan putusan: ✅ Benar / ⚠️ Sebagian benar / ❌ Salah, beserta alasan utamanya.
- Setelah itu, jelaskan: apa yang sudah tepat, apa yang keliru atau kurang, dan bagaimana memperbaikinya.
- Jika ada beberapa jawaban yang sama-sama wajar, akui jawaban learner yang wajar.
- Bicara langsung tentang jawaban learner, jangan memberi nasihat umum.
- Gunakan bahasa Indonesia.`;

export interface InputJuri {
  soal: SoalLatihan;
  jawabanLearner: string;
}

/**
 * Build the per-question judging prompt.
 *
 * Adapted from DeepTutor (HKUDS), v1.6.8. Apache License 2.0.
 * Source: deeptutor/api/routers/quiz_judge.py (`_build_judge_user_prompt`)
 * Source: https://github.com/HKUDS/DeepTutor
 * Source commit: a5eafa89072f6d7290a6854a6afc4ba060053beb
 * Original license: Apache License 2.0
 * Modified for Careevo: labels are Indonesian and the four-choice options are
 *   rendered into the prompt even though only free text is ever judged, because
 *   upstream does the same and the judge is measurably better when it can see
 *   the alternatives it is not being asked about.
 */
export function bangunPromptJuri({ soal, jawabanLearner }: InputJuri): string {
  const baris: string[] = [
    `Tipe soal: ${LABEL_TIPE[soal.tipe]}`,
    `Soal: ${soal.pertanyaan}`,
  ];

  if (soal.pilihan) {
    baris.push("Pilihan yang tersedia:");
    for (const key of KUNCI_PILIHAN) {
      baris.push(`${key}. ${soal.pilihan[key]}`);
    }
  }

  baris.push(
    `Jawaban acuan: ${soal.jawaban}`,
    `Pembahasan: ${soal.pembahasan}`,
    `Jawaban learner: ${jawabanLearner}`,
  );

  return baris.join("\n");
}

/**
 * Pull the verdict out of the model's prose.
 *
 * Only the first line is read, because that is where the prompt requires the
 * verdict to be. Scanning the whole response would let a ✅ quoted later in the
 * feedback (for example "make sure your answer isn't ✅") override the actual
 * ruling.
 */
export function bacaPutusan(teks: string): PutusanJuri {
  const barisPertama = teks.trim().split("\n")[0] ?? "";
  if (barisPertama.includes("⚠️") || barisPertama.includes("⚠")) return "sebagian";
  if (barisPertama.includes("❌")) return "salah";
  if (barisPertama.includes("✅")) return "benar";
  // A model that ignores the format should not silently read as "correct".
  // "Partly right" is the only default that is defensible when the verdict is
  // unreadable, because it neither rewards nor punishes an unclear answer.
  return "sebagian";
}

/**
 * Coerce a verdict to the stored boolean.
 *
 * "Sebagian" deliberately maps to `null` (still ungraded) rather than to a coin
 * flip. Recording a definite `false` for a half-right answer would report a
 * result the judge never actually gave.
 */
export function hakimKeBoolean(putusan: PutusanJuri): boolean | null {
  if (putusan === "benar") return true;
  if (putusan === "salah") return false;
  return null;
}

function hasilContoh(soal: SoalLatihan, jawabanLearner: string): HasilJuri {
  const sama = jawabanLearner.trim().toLowerCase() === soal.jawaban.trim().toLowerCase();
  const baris: string[] = [];

  if (sama) {
    baris.push("✅ Benar — jawabanmu sama dengan jawaban acuan.");
  } else {
    baris.push(
      "⚠️ Sebagian — jawabanmu berbeda dari jawaban acuan, jadi belum bisa dipastikan benar atau salah.",
    );
    baris.push("");
    baris.push(
      "Tanpa Gemini, yang bisa dicek hanya perbandingan teks yang persis sama. Itu bukan penilaian pemahaman.",
    );
  }

  baris.push("");
  baris.push(`Jawaban acuan: ${soal.jawaban}`);
  baris.push(`Pembahasan: ${soal.pembahasan}`);
  baris.push("");
  baris.push(
    "Nilai jawabanmu sendiri dengan membacanya, atau atur GEMINI_API_KEY supaya juri AI bisa menilainya.",
  );

  return { putusan: sama ? "benar" : "sebagian", teks: baris.join("\n"), sumber: "contoh" };
}

/**
 * Judge one free-text answer.
 *
 * With a key: one model call whose prose *is* the feedback, matching upstream's
 * streaming judge. Without: the honest stub above. There is no third path — a
 * caller must never have to branch on the env var itself (see `llm/port.ts`).
 */
export async function nilaiDenganJuri(input: InputJuri): Promise<HasilJuri> {
  const { soal, jawabanLearner } = input;
  if (!jawabanLearner.trim()) {
    return {
      putusan: "sebagian",
      teks: "Belum ada jawaban yang bisa dinilai.",
      sumber: "contoh",
    };
  }

  const prompt = `${PROMPT_SISTEM_JURI}\n\n${bangunPromptJuri(input)}`;

  let result: LlmResult;
  try {
    result = await getLlm().generate(prompt, { json: false });
  } catch {
    return hasilContoh(soal, jawabanLearner);
  }

  if (!result.ok) return hasilContoh(soal, jawabanLearner);

  const teks = result.text.trim();
  if (!teks) return hasilContoh(soal, jawabanLearner);

  return { putusan: bacaPutusan(teks), teks, sumber: "juri" };
}

/** A one-line reminder of what each type means, for the config panel. */
export function ringkasTipe(tipe: TipeSoal): string {
  return KETERANGAN_TIPE[tipe] ?? tipe;
}
