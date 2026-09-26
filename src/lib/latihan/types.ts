/**
 * Tipe domain untuk latihan soal.
 *
 * Adapted from DeepTutor (HKUDS), v1.6.8. Apache License 2.0.
 * Source: deeptutor/agents/question/pipeline.py (QuizTemplate / QuizPair)
 * Source: web/lib/quiz-types.ts
 * Source: https://github.com/HKUDS/DeepTutor
 * Source commit: a5eafa89072f6d7290a6854a6afc4ba060053beb
 * Original license: Apache License 2.0
 * Modified for Careevo: Pydantic/dataclass → TypeScript, snake_case →
 *   camelCase, dan `QuizPair` dipisah menjadi `SoalLatihan` (soal) +
 *   `PercobaanSoal` (satu jawaban terhadap soal itu). Pisahan itu bukan
 *  kosmetik: upstream menyimpan jawaban sebagai kolom di dalam pair, sehingga
 *   satu soal yang dicoba dua kali butuh dua *row* — sedangkan Careevo
 *   menulis per soal ke satu berkas, jadi jawaban yang terbaru cukup menimpa
 *   yang lama dan riwayatnya disimpan terpisah.
 */

import {
  isKonsep,
  isPilihanGanda,
  isTeksBebas,
  isIsian,
  KUNCI_PILIHAN,
  kunciKonsep,
  kunciPilihanGanda,
  normalisasiTipeSoal,
  paksaKunciKonsep,
  TIPE_SOAL,
  TIPE_BEROPSI,
  TOKEN_ISIAN,
  type KunciPilihan,
  type TipeSoal,
} from "./tipe-soal";

/**
 * The fenced-JSON extractor now lives in `lib/llm/json.ts`, shared with the
 * tutor reply parser, which needs the exact same tolerance for ```json fences
 * and trailing prose. Re-exported here so the latihan tests and callers that
 * already import this module keep working unchanged.
 */
import { parseJsonMaybeFenced } from "@/lib/llm/json";
export { parseJsonMaybeFenced };

/**
 * Re-exported so a caller that already imports the domain types does not have
 * to remember which of the two modules a given symbol lives in. The taxonomy
 * itself stays in `tipe-soal.ts` — that is the contract, and it has one home.
 */
export type { TipeSoal, KunciPilihan };

/** Kesulitan. Tiga nilai, sama seperti `pipeline.py::_VALID_DIFFICULTIES`. */
export type TingkatSoal = "easy" | "medium" | "hard";

export const TINGKAT_SOAL: readonly TingkatSoal[] = ["easy", "medium", "hard"];

export const LABEL_TINGKAT: Readonly<Record<TingkatSoal, string>> = {
  easy: "Mudah",
  medium: "Sedang",
  hard: "Sulit",
};

/** Label tipe untuk UI. Tipe keys sengaja dibiarkan berbahasa Inggris. */
export const LABEL_TIPE: Readonly<Record<TipeSoal, string>> = {
  choice: "Pilihan Ganda",
  concept: "Benar / Salah",
  fill_in_blank: "Isian",
  short_answer: "Jawaban Singkat",
  written: "Uraian",
  coding: "Kode",
};

/** Deskripsi singkat tiap tipe — dipakai di panel konfigurasi. */
export const KETERANGAN_TIPE: Readonly<Record<TipeSoal, string>> = {
  choice: "Pilih satu dari empat opsi A–D. Dinilai otomatis.",
  concept: "Benar atau salah. Dinilai otomatis.",
  fill_in_blank: "Lengkapi satu kata atau frasa. Dinilai otomatis.",
  short_answer: "Jawab singkat dengan kalimatmu. Dinilai manual atau oleh juri AI.",
  written: "Uraikan dengan lengkap. Dinilai manual atau oleh juri AI.",
  coding: "Tulis potongan kode. Dinilai manual atau oleh juri AI.",
};

/** Batas panjang pertanyaan dan jawaban, supaya satu kartu tidak jadinovel. */
export const MAKS_PERTANYAAN_SOAL = 2000;
export const MAKS_TEKS_SOAL = 500;
export const MAKS_JAWABAN = 4000;

/**
 * Satu soal latihan.
 *
 * `jawaban` adalah satu field untuk semua tipe, dan bentuknya ditentukan oleh
 * `tipe` — persis seperti upstream. Satu field jawaban untuk semua tipe
 * membuat renderer cukup memanggil `kunciJawaban(soal)` dan selalu mendapat
 * string, alih-alih membawa satu cabang per tipe.
 *
 * - `choice`: `pilihan` = {A,B,C,D}, `jawaban` = huruf kunci.
 * - `concept`: `jawaban` = "true" | "false".
 * - `fill_in_blank`: `pertanyaan` memuat `____`, `jawaban` = teks rongga.
 * - teks bebas: `jawaban` = jawaban referensi.
 */
export interface SoalLatihan {
  id: string;
  tipe: TipeSoal;
  pertanyaan: string;
  /** Hanya untuk `choice`. Kunci harus persis A–D. */
  pilihan?: Record<KunciPilihan, string>;
  /** Kunci benar — bentuknya mengikuti `tipe` (lihat catatan di atas). */
  jawaban: string;
  /** Kenapa jawaban itu benar. Wajib: ini yang mengubah kuis jadi latihan. */
  pembahasan: string;
  tingkat: TingkatSoal;
  /** Id modul asal, supaya UI bisa mengaitkan soal ke materi. */
  moduleId?: string;
  /**
   * Pertanyaan berasal dari bank soal admin, bukan digenerasi.
   *
   * Bank kuis yang sudah ada di repo adalah aset nyata: soal-soalnya ditulis
   * manusia dan bobotnya sudah dipikir. Menandainya membuat UI bisa jujur
   * membedakan "soal admin" dari "soal mode contoh", dan membuat generator
   * stub memprioritaskan soal yang benar-benar dari sumber.
   */
  dariBank?: boolean;
}

/** Dari mana sebuah percobaan memperoleh nilai `benar`. */
export type SumberPenilaian = "otomatis" | "diri" | "juri" | "belum";

export interface PercobaanSoal {
  soalId: string;
  /** Jawaban mentah dari learner, apa pun tipenya. */
  jawaban: string;
  /**
   * `null` = belum dinilai atau tidak bisa dinilai otomatis.
   *
   * `null` dan `false` sengaja dibedakan: `false` adalah jawaban salah yang
   * sudah dinilai, `null` adalah soal uraian yang menunggu penilaian. Kalau
   * keduanya jadi `false`, skor akhir menghitung soal yang belum dijawab
   * sebagai jawaban salah.
   */
  benar: boolean | null;
  /** Umpan balik juri AI atau catatan penilaian mandiri. */
  penilaian?: string;
  sumber: SumberPenilaian;
  at: string;
}

/** Kumpulan latihan milik satu learner: soal + jawaban. */
export interface Latihan {
  id: string;
  owner: string;
  judul: string;
  /** Topik bebas yang diketik learner, atau judul kursus. */
  topik: string;
  tingkat: TingkatSoal;
  /** Tipe yang diminta learner. Soal hasil generasi boleh lebih sedikit. */
  tipe: TipeSoal[];
  courseId?: string;
  courseSlug?: string;
  /** Generator yang benar-benar menyusun soal — selalu jujur soal asal isinya. */
  disusunOleh: "stub" | "gemini";
  createdAt: string;
  updatedAt: string;
}

/** Satu berkas = satu latihan, dengan soal dan percobaannya. */
export interface LatihanBundle {
  latihan: Latihan;
  soal: SoalLatihan[];
  percobaan: PercobaanSoal[];
}

/** Amplop berkas. `version` sengaja ada supaya format yang berubah bisa ditolak, bukan di-parse ceroboh lalu gagal sebagian. */
export interface LatihanEnvelope {
  version: 1;
  bundle: LatihanBundle;
}

/* ------------------------------------------------------------------ */
/* Normalisasi + guard                                                 */
/* ------------------------------------------------------------------ */

function isText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function adalahIso(value: unknown): value is string {
  return (
    typeof value === "string" && value.length > 0 && !Number.isNaN(Date.parse(value))
  );
}

function isTingkat(value: unknown): value is TingkatSoal {
  return value === "easy" || value === "medium" || value === "hard";
}

/** CJK, kana, Hangul and Cyrillic. */
const HURUF_NON_LATIN = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Cyrillic}]/u;

/**
 * Whether text contains script that has no business being in this product.
 *
 * The product is Indonesian, and a model asked for Indonesian occasionally
 * leaks a fragment from another script — observed on a free model answering
 * "TypeScript menambah的类型检查" and "Peta концепт memetakan…". The question still
 * parses, still has a valid key, and still grades correctly, so no structural
 * guard catches it: it is simply unreadable, and a learner cannot learn from it.
 *
 * **Any** occurrence is a defect, not a ratio. Indonesian borrows Latin-script
 * technical terms freely, so a legitimate question can contain `é`, `ü` or `ñ`
 * without trouble, but there is no legitimate reason for a Han, Hangul, Kana or
 * Cyrillic letter. A ratio threshold was tried first and is wrong here: the
 * observed contamination is two or three stray characters inside a long,
 * otherwise correct sentence, which is well under any threshold low enough to
 * catch it.
 *
 * The one exception is an empty string, which trivially has no letters and so is
 * not "contaminated" — that case is the caller's to reject for being empty.
 */
export function terlaluKotor(text: string): boolean {
  return new RegExp(HURUF_NON_LATIN, "u").test(text);
}

/** Opsi A–D lengkap, tanpa huruf asing dan tanpa teks kosong. */
function normalisasiPilihan(value: unknown): Record<KunciPilihan, string> | null {
  if (typeof value !== "object" || value === null) return null;
  const masuk = value as Record<string, unknown>;
  const hasil = {} as Record<KunciPilihan, string>;
  for (const key of KUNCI_PILIHAN) {
    const teks = String(masuk[key] ?? "").trim();
    if (!teks) return null;
    hasil[key] = teks;
  }
  // Letter persis A–D, tidak A–E. Kelima opsi yang ditambahkan model adalah
  // cara paling sering pilihan ganda jadi tidak bisa dinilai adil: kunci
  // mungkin menunjuk opsi yang tidak pernah dirender.
  for (const key of Object.keys(masuk)) {
    if (!(KUNCI_PILIHAN as readonly string[]).includes(key.toUpperCase())) {
      return null;
    }
  }
  return hasil;
}

/** Opsi hanya sah untuk `choice`. Ada opsi di soal lain = soal rusak. */
function opsiSesuaiTipe(tipe: TipeSoal, value: unknown): Record<string, string> | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "object") return undefined;
  if (!TIPE_BEROPSI.has(tipe)) return undefined;
  return value as Record<string, string>;
}

/**
 * Normalkan satu payload mentah menjadi `SoalLatihan`, atau `null` kalau
 * bentuknya tidak bisa dipercaya.
 *
 * Adapted from DeepTutor (HKUDS), v1.6.8. Apache License 2.0.
 * Source: deeptutor/agents/question/pipeline.py (`_normalize_quiz_payload`)
 * Source: https://github.com/HKUDS/DeepTutor
 * Source commit: a5eafa89072f6d7290a6854a6afc4ba060053beb
 * Original license: Apache License 2.0
 * Modified for Careevo: dict of `issues` replaced by one nullable return, because
 *   Careevo's policy is already the book store's — a block/question that fails a
 *   guard is *dropped*, not repaired and rendered half-formed. The upstream
 *   checks that are kept verbatim are the load-bearing ones: choice must have
 *   exactly A–D, concept must be true/false, fill-in-blank must carry `____`,
 *   and no other type may carry options.
 */
export function normalisasiSoal(raw: unknown, id: string): SoalLatihan | null {
  if (typeof raw !== "object" || raw === null) return null;
  const c = raw as Record<string, unknown>;

  const tipe = normalisasiTipeSoal(c.tipe ?? c.question_type);
  const pertanyaan = String(c.pertanyaan ?? c.question ?? "")
    .trim()
    .slice(0, MAKS_PERTANYAAN_SOAL);
  const pembahasan = String(c.pembahasan ?? c.explanation ?? "")
    .trim()
    .slice(0, MAKS_TEKS_SOAL);
  const mentahTingkat = c.tingkat ?? c.difficulty;
  const tingkat: TingkatSoal = isTingkat(mentahTingkat) ? mentahTingkat : "medium";
  const moduleId = isText(c.moduleId) ? c.moduleId : undefined;
  const dariBank = c.dariBank === true;

  // Upstream requires question, correct_answer and explanation; a question with
  // no explanation is a question the learner cannot learn anything from, so it
  // fails here for the same reason.
  if (!pertanyaan || !pembahasan) return null;

  // Reject a question that reads as another language. This is the one defect no
  // structural guard catches: the shape is perfect and the key still grades, but
  // the text is unusable, so the repo's rule — drop it, do not render it — applies.
  if (terlaluKotor(pertanyaan) || terlaluKotor(pembahasan)) return null;

  let pilihan: Record<KunciPilihan, string> | undefined;
  let jawaban = String(c.jawaban ?? c.correct_answer ?? "")
    .trim()
    .slice(0, MAKS_TEKS_SOAL);

  if (isPilihanGanda(tipe)) {
    pilihan = normalisasiPilihan(opsiSesuaiTipe(tipe, c.pilihan ?? c.options)) ?? undefined;
    if (!pilihan) return null;
    const key = kunciPilihanGanda(jawaban, pilihan);
    if (!(KUNCI_PILIHAN as readonly string[]).includes(key)) return null;
    // The option text is what the learner actually reads, so it is checked too.
    if (Object.values(pilihan).some(terlaluKotor)) return null;
    jawaban = key;
  } else if (isKonsep(tipe)) {
    // Options are stripped for every non-choice type, exactly as upstream does.
    const key = kunciKonsep(paksaKunciKonsep(jawaban));
    if (!key) return null;
    jawaban = key;
  } else {
    if (!jawaban) return null;
    if (isIsian(tipe) && !pertanyaan.includes(TOKEN_ISIAN)) return null;
  }

  return {
    id,
    tipe,
    pertanyaan,
    ...(pilihan ? { pilihan } : {}),
    jawaban,
    pembahasan,
    tingkat,
    ...(moduleId ? { moduleId } : {}),
    ...(dariBank ? { dariBank } : {}),
  };
}

/** Parse a model response into questions, dropping any that fail a guard. */
export function parseSoalLathan(
  text: string,
  idFactory: () => string,
): SoalLatihan[] {
  const parsed = parseJsonMaybeFenced(text);
  if (!Array.isArray(parsed)) return [];
  const hasil: SoalLatihan[] = [];
  for (const entry of parsed) {
    const soal = normalisasiSoal(entry, idFactory());
    if (soal) hasil.push(soal);
  }
  return hasil;
}

/* ------------------------------------------------------------------ */
/* Guards untuk dibaca dari disk                                       */
/* ------------------------------------------------------------------ */
/* Guards untuk dibaca dari disk                                       */
/* ------------------------------------------------------------------ */

/** Guard soal yang sudah ternormalisasi (bukan payload mentah). */
export function isSoalLatihan(value: unknown): value is SoalLatihan {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  if (!isText(c.id) || !TIPE_SOAL.includes(c.tipe as TipeSoal)) return false;
  if (!isText(c.pertanyaan) || !isText(c.pembahasan)) return false;
  if (!isTingkat(c.tingkat)) return false;
  if (typeof c.jawaban !== "string" || c.jawaban.length === 0) return false;
  if (isTeksBebas(c.tipe)) return true;
  if (isKonsep(c.tipe)) return kunciKonsep(c.jawaban) !== "";
  if (isPilihanGanda(c.tipe)) return normalisasiPilihan(c.pilihan) !== null;
  return isIsian(c.tipe) && c.pertanyaan.includes(TOKEN_ISIAN);
}

function isLatihan(value: unknown): value is Latihan {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    isText(c.id) &&
    isText(c.owner) &&
    isText(c.judul) &&
    isText(c.topik) &&
    isTingkat(c.tingkat) &&
    Array.isArray(c.tipe) &&
    c.tipe.every((item) => TIPE_SOAL.includes(item as TipeSoal)) &&
    (c.disusunOleh === "stub" || c.disusunOleh === "gemini") &&
    adalahIso(c.createdAt) &&
    adalahIso(c.updatedAt)
  );
}

function isPercobaan(value: unknown): value is PercobaanSoal {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    isText(c.soalId) &&
    typeof c.jawaban === "string" &&
    (c.benar === null || typeof c.benar === "boolean") &&
    (c.penilaian === undefined || typeof c.penilaian === "string") &&
    (c.sumber === "otomatis" || c.sumber === "diri" || c.sumber === "juri" || c.sumber === "belum") &&
    adalahIso(c.at)
  );
}

export function isLatihanBundle(value: unknown): value is LatihanBundle {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    isLatihan(c.latihan) &&
    Array.isArray(c.soal) &&
    c.soal.every(isSoalLatihan) &&
    Array.isArray(c.percobaan) &&
    c.percobaan.every(isPercobaan)
  );
}
