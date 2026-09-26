import type { EntriKatalog } from "@/lib/courses/katalog";
import type { ModulKursus } from "@/lib/courses/kurikulum";
import type { Kuis } from "@/types/course";
import { normalisasiSoal, type SoalLatihan, type TingkatSoal } from "./types";
import { KUNCI_PILIHAN, TOKEN_ISIAN, type TipeSoal } from "./tipe-soal";

/**
 * Quiz generation.
 *
 * Adapted from DeepTutor (HKUDS), v1.6.8. Apache License 2.0.
 * Source: deeptutor/agents/question/pipeline.py
 * Source: https://github.com/HKUDS/DeepTutor
 * Source commit: a5eafa89072f6d7290a6854a6afc4ba060053beb
 * Original license: Apache License 2.0
 * Modified for Careevo: the three-phase agentic pipeline (Explore → Plan →
 * per-question) is reduced to a single deterministic builder plus a Gemini
 * implementation in `generator-gemini.ts`. Upstream's phase 1 runs a tool-using
 * agent over a document store to *discover* sources; Careevo has no document
 * store and the course outline already is the outline, so Explore has nothing
 * to add. The per-question contract that matters — the four-choice rule, the
 * `____` token, concept true/false, and "drop a malformed question rather than
 * render it" — is kept in `normalisasiSoal` and reused by both paths.
 *
 * Why deterministic-by-default: this feature must be demoable with no API key,
 * and a quiz that silently produces three questions when you asked for ten is
 * worse than one that honestly says it drew from what it had. The stub reports
 * what it actually used via `fromBank` on each question.
 */

export interface GenerateInput {
  course: EntriKatalog;
  modules: readonly ModulKursus[];
  /** Quizzes mounted on these modules — the real question bank, when it exists. */
  kuis: readonly Kuis[];
  /** How many questions the learner asked for. */
  jumlah: number;
  tingkat: TingkatSoal;
  /** Types the learner enabled. Empty means "the generator's choice". */
  tipe: readonly TipeSoal[];
  /** Free text the learner typed as the focus. */
  fokus?: string;
}

export interface GenerateResult {
  soal: SoalLatihan[];
  disusunOleh: "stub" | "gemini";
  /** How many came from the admin-authored bank rather than the outline. */
  dariBank: number;
}

/** Tipe yang selalu bisa disusun dari metadata modul tanpa model. */
const TIPE_STUB: readonly TipeSoal[] = [
  "choice",
  "concept",
  "fill_in_blank",
  "short_answer",
  "written",
];

/**
 * Split a total across `n` buckets, with the remainder on the first buckets.
 *
 * 7 across 2 gives 4/3, not 3/3 and not 4/4. Both of those would either
 * overshoot the requested count or leave a type with none — and a learner who
 * ticked four types and asked for eight questions expects roughly two of each,
 * not eight of whichever happened to be first.
 */
export function bagiSisa(total: number, n: number): number {
  if (n <= 0 || total <= 0) return 0;
  return Math.max(1, Math.ceil(total / n));
}

export class StubLatihanGenerator {
  readonly name = "stub" as const;

  async generate(input: GenerateInput): Promise<GenerateResult> {
    return bangunSoalStub(input);
  }
}

/** Stable ids so a regenerated question set is comparable, not random. */
function soalId(moduleId: string, tipe: TipeSoal, index: number): string {
  return `${moduleId}::${tipe}::${index + 1}`;
}

function tambah(
  hasil: SoalLatihan[],
  raw: Record<string, unknown>,
  id: string,
  moduleId: string,
): boolean {
  const soal = normalisasiSoal({ ...raw, moduleId }, id);
  if (!soal) return false;
  hasil.push(soal);
  return true;
}

/**
 * Take a question from the admin-authored bank.
 *
 * The bank stores options as an **array** with a numeric index; this port's
 * contract stores them as `{A,B,C,D}` with a letter key. The conversion lives
 * here rather than in the renderer so the rest of the feature never has to know
 * the bank has a different shape. A bank question with fewer or more than four
 * options is dropped, not padded — padding invents distractors nobody wrote.
 */
export function dariBankKuis(
  kuis: readonly Kuis[],
  options: { moduleId?: string; idPrefix?: string } = {},
): SoalLatihan[] {
  const hasil: SoalLatihan[] = [];
  for (const quiz of kuis) {
    for (const [index, soal] of quiz.soal.entries()) {
      if (soal.pilihan.length !== KUNCI_PILIHAN.length) continue;
      if (soal.jawaban_benar < 0 || soal.jawaban_benar >= soal.pilihan.length) continue;

      const pilihan = {} as Record<(typeof KUNCI_PILIHAN)[number], string>;
      KUNCI_PILIHAN.forEach((key, slot) => {
        pilihan[key] = soal.pilihan[slot];
      });

      const normalized = normalisasiSoal(
        {
          tipe: "choice",
          pertanyaan: soal.pertanyaan,
          pilihan,
          jawaban: KUNCI_PILIHAN[soal.jawaban_benar],
          // The bank has no explanation field. Saying so is better than inventing
          // one: a fabricated rationale teaches the learner something false.
          pembahasan: `Jawaban ini berasal dari soal bank "${quiz.judul}". Kunci: ${KUNCI_PILIHAN[soal.jawaban_benar]}.`,
          tingkat: "medium",
          ...(options.moduleId ? { moduleId: options.moduleId } : {}),
          dariBank: true,
        },
        `${options.idPrefix ?? quiz.id}-${index + 1}`,
      );
      if (normalized) hasil.push(normalized);
    }
  }
  return hasil;
}

/**
 * Build questions from the course outline.
 *
 * Each type is a different way of asking about the same material, chosen so the
 * set is not four rewordings of one fact:
 * - `choice`: which module covers X (tests structure).
 * - `concept`: true/false about what a module contains (tests discrimination —
 *   the false variant names a *different* module, so it is not a giveaway).
 * - `fill_in_blank`: the missing title in the module list.
 * - `short_answer` / `written`: explain a module in your own words.
 */
export function bangunSoalStub(input: GenerateInput): GenerateResult {
  const modules = input.modules.filter((module) => module.judul.trim().length > 0);
  const tipe = input.tipe.length > 0 ? input.tipe : TIPE_STUB;
  const soal: SoalLatihan[] = [];

  // The bank comes first and is never padded: a real authored question is worth
  // more than a synthetic one, so it outranks the outline.
  const bank = dariBankKuis(input.kuis, { idPrefix: input.course.id });
  soal.push(...bank);
  const dariBank = bank.length;

  /**
   * A per-type budget, checked by every block below.
   *
   * Without it the first requested type filled the whole set: a learner who
   * ticked four types and asked for eight got eight choice questions. Bank
   * questions count against the `choice` budget, so authored material cannot
   * quietly become a second, uncounted source.
   */
  const perTipe = bagiSisa(Math.max(0, input.jumlah - soal.length), tipe.length);
  const kuota = new Map<TipeSoal, number>(tipe.map((item) => [item, perTipe]));
  // `coding` cannot be built from an outline, so asking for it alone still has
  // to produce something; it borrows the free-text quota.
  if (tipe.includes("coding") && !tipe.some((item) => item === "short_answer" || item === "written")) {
    kuota.set("short_answer", (kuota.get("short_answer") ?? 0) + (kuota.get("coding") ?? 0));
  }

  /** Can this type still take another question? */
  const boleh = (candidate: TipeSoal) => (kuota.get(candidate) ?? 0) > 0;

  function ambil(candidate: TipeSoal): boolean {
    if (!boleh(candidate)) return false;
    if (soal.length >= input.jumlah) return false;
    kuota.set(candidate, (kuota.get(candidate) ?? 0) - 1);
    return true;
  }

  // --- choice: "modul mana yang membahas …" ---
  for (const [moduleIndex, module] of modules.entries()) {
    if (!boleh("choice")) break;
    if (!ambil("choice")) break;
    const benar = KUNCI_PILIHAN[moduleIndex % KUNCI_PILIHAN.length];
    const opsi: Record<string, string> = {};
    // Distractors are other real modules, which makes the question answerable
    // from the outline instead of guessable by elimination.
    for (let slot = 0; slot < KUNCI_PILIHAN.length; slot += 1) {
      const key = KUNCI_PILIHAN[slot];
      if (key === benar) {
        opsi[key] = module.judul;
      } else {
        const lain = modules[(moduleIndex + 1 + slot) % modules.length];
        opsi[key] = lain?.judul ?? `Pilihan ${key}`;
      }
    }
    tambah(
      soal,
      {
        tipe: "choice",
        pertanyaan: `Modul mana dalam kursus "${input.course.title}" yang membahas ${module.ringkasan.split(".")[0].toLowerCase()}?`,
        pilihan: opsi,
        jawaban: benar,
        pembahasan: `Modul "${module.judul}" — ${module.ringkasan}`,
        tingkat: input.tingkat,
      },
      soalId(module.id, "choice", moduleIndex),
      module.id,
    );
  }

  // --- concept: true/false, with a real false variant ---
  //
  // The key alternates across the whole set, not per module: alternating on a
  // per-module counter produced "true" for every question, because the counter
  // only ever reached 0 — a learner could answer the entire true/false section
  // without reading a word.
  let sudahDibalik = false;
  for (const [moduleIndex, module] of modules.entries()) {
    if (!boleh("concept")) break;
    if (!ambil("concept")) break;
    const benar = sudahDibalik ? "false" : "true";
    sudahDibalik = !sudahDibalik;
    // For a "false" key the statement deliberately describes a *different*
    // module, so the learner has to know the outline to catch it.
    const subjek = benar === "true" ? module : modules[(moduleIndex + 1) % modules.length];
    tambah(
      soal,
      {
        tipe: "concept",
        pertanyaan: `Pernyataan ini benar tentang kursus "${input.course.title}": modul "${subjek.judul}" membahas ${subjek.ringkasan.split(".")[0].toLowerCase()}.`,
        jawaban: benar,
        pembahasan: `Jawaban: ${benar === "true" ? "benar" : "salah"}. Modul "${subjek.judul}" membahas ${subjek.ringkasan}`,
        tingkat: input.tingkat,
      },
      soalId(module.id, "concept", moduleIndex),
      module.id,
    );
  }

  // --- fill_in_blank: the missing module title ---
  for (const [moduleIndex, module] of modules.entries()) {
    if (!boleh("fill_in_blank")) break;
    if (!ambil("fill_in_blank")) break;
    tambah(
      soal,
      {
        tipe: "fill_in_blank",
        pertanyaan: `Modul nomor ${moduleIndex + 1} pada kursus "${input.course.title}" berjudul ${TOKEN_ISIAN}.`,
        jawaban: module.judul,
        // The answer *is* the missing title, so the explanation can name it
        // without giving anything away before the learner types it.
        pembahasan: `Modul nomor ${moduleIndex + 1} adalah "${module.judul}". Ringkasannya: ${module.ringkasan}`,
        tingkat: input.tingkat,
      },
      soalId(module.id, "fill_in_blank", moduleIndex),
      module.id,
    );
  }

  // --- short_answer / written / coding: open prompts from the same outline ---
  for (const tipeBebas of tipe) {
    if (tipeBebas !== "short_answer" && tipeBebas !== "written" && tipeBebas !== "coding") {
      continue;
    }
    for (const modul of modules) {
      if (!boleh(tipeBebas)) break;
      if (!ambil(tipeBebas)) break;
      const pertanyaan =
        tipeBebas === "coding"
          ? `Tulis contoh kode atau pseudokode yang menerapkan "${modul.judul}" pada kasus nyata.`
          : tipeBebas === "written"
            ? `Uraikan dengan lengkap apa yang perlu dipahami learner dari modul "${modul.judul}", beserta alasannya.`
            : `Jawab singkat: apa yang dibahas modul "${modul.judul}"?`;
      tambah(
        soal,
        {
          // `coding` is asked for, so it is what gets produced. When it was the
          // only free-text type requested, its quota was lent to
          // `short_answer`, so the budget is spent on whichever was asked for.
          tipe: tipeBebas,
          pertanyaan,
          jawaban: modul.ringkasan,
          // The reference is the outline summary, and the note tells the learner
          // what comparison means here: the core idea, not identical wording.
          // Naming the exact string would make a word-for-word copy the winning
          // strategy, which is not the skill being practised.
          pembahasan: `Ringkasan materi: ${modul.ringkasan} Yang dinilai adalah inti jawabannya, bukan kalimat yang sama persis.`,
          tingkat: input.tingkat,
        },
        soalId(modul.id, tipeBebas, 0),
        modul.id,
      );
    }
  }

  return { soal: soal.slice(0, input.jumlah), disusunOleh: "stub", dariBank };
}
