/**
 * Taksonomi tipe soal + resolusi kunci jawaban.
 *
 * Adapted from DeepTutor (HKUDS), v1.6.8. Apache License 2.0.
 * Source: web/lib/quiz-question-type.ts
 * Source: https://github.com/HKUDS/DeepTutor
 * Source commit: a5eafa89072f6d7290a6854a6afc4ba060053beb
 * Original license: Apache License 2.0
 * Modified for Careevo: fungsi di_DOWNSTREAM (nilaiOtomatis, dapatDinilaiOtomatis)
 *   tidak ikut di sini karena ia butuh tipe domain; nama perkuliahan diganti ke
 *   bahasa Indonesia; dan sekumpulan alias Indonesia ditambahkan pada tabel yang
 *   sama, sehingga soal yang ditulis admin dengan istilah lokal tetap dinormalkan
 *   ke tipe yang sama. Konvensi yang diport — tepat empat opsi A–D, kunci
 *   konsep lowercase "true"/"false" — dipertahankan persis: itulah kontrak yang
 *   dipakai di sisi server saat generasi dan di sisi klien saat penilaian, jadi
 *   melonggarkannya di satu tempat akan membuat keduanya diam-diam berbeda.
 */

/** Satu tipe soal, sudah ternormalisasi. */
export type TipeSoal =
  | "choice"
  | "concept"
  | "fill_in_blank"
  | "short_answer"
  | "written"
  | "coding";

/**
 * Tipe yang *hanya* boleh memakai empat opsi A–D.
 *
 * Berbeda dari `TIPE_SOAL`: bukan daftar tipe, melainkan tipe yang punya
 * `options`. Satu konstanta supaya aturan "hanya choice yang beropsi" tidak
 * ditulis ulang di tiga tempat.
 */
export const TIPE_BEROPSI: ReadonlySet<TipeSoal> = new Set<TipeSoal>(["choice"]);

/** Kunci pilihan ganda. Persis empat, bukan "sampai empat". */
export const KUNCI_PILIHAN = ["A", "B", "C", "D"] as const;

export type KunciPilihan = (typeof KUNCI_PILIHAN)[number];

/** Placeholder yang menandai rongga isian. */
export const TOKEN_ISIAN = "____";

export const TIPE_SOAL: readonly TipeSoal[] = [
  "choice",
  "concept",
  "fill_in_blank",
  "short_answer",
  "written",
  "coding",
];

const ALIAS_TIPE: Record<string, TipeSoal> = {
  // --- DeepTutor (verbatim) ---
  choice: "choice",
  multiple_choice: "choice",
  "multiple-choice": "choice",
  mcq: "choice",
  concept: "concept",
  true_false: "concept",
  "true-false": "concept",
  tf: "concept",
  judgement: "concept",
  fill_in_blank: "fill_in_blank",
  "fill-in-the-blank": "fill_in_blank",
  fill_in_the_blank: "fill_in_blank",
  cloze: "fill_in_blank",
  short_answer: "short_answer",
  "short-answer": "short_answer",
  written: "written",
  open_ended: "written",
  "open-ended": "written",
  open_response: "written",
  "open-response": "written",
  essay: "written",
  coding: "coding",
  code: "coding",
  programming: "coding",

  // --- Careevo: alias bahasa Indonesia ---
  //
  // Ditambahkan, bukan mengganti: sebuah soal yang administrative ditulis
  // "Pilihan Ganda" tidak boleh diam-diam jatuh ke `short_answer` hanya karena
  // whoever menulisnya berbahasa Indonesia. Kunci besarnya sama dengan upstream,
  // supaya kedua sisi tetapuju ke satu taksonomi.
  pilihan_ganda: "choice",
  "pilihan-ganda": "choice",
  pg: "choice",
  benar_salah: "concept",
  "benar-salah": "concept",
  isian: "fill_in_blank",
  isi: "fill_in_blank",
  short: "short_answer",
  jawaban_singkat: "short_answer",
  uraian: "written",
  esai: "written",
  kode: "coding",
  pemrograman: "coding",
};

/**
 * Terjemahkan apa pun menjadi tipe soal yang dikenal.
 *
 * Default `short_answer` dipilih upstream dengan sengaja: dari enam tipe, itu
 * satu-satunya yang **tidak** menuntut bentuk jawaban tertentu, jadi soal yang
 * tidak bisa diklasifikasi tetap bisa dijawab dan dinilai manual alih-alih
 * ditolak. Kontrak ini tidak diubah.
 */
export function normalisasiTipeSoal(value: unknown): TipeSoal {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  return ALIAS_TIPE[normalized] ?? "short_answer";
}

export function isPilihanGanda(value: unknown): boolean {
  return normalisasiTipeSoal(value) === "choice";
}

export function isKonsep(value: unknown): boolean {
  return normalisasiTipeSoal(value) === "concept";
}

export function isIsian(value: unknown): boolean {
  return normalisasiTipeSoal(value) === "fill_in_blank";
}

/** Tipe yang jawabannya bebas dan tidak bisa dinilai otomatis. */
export function isTeksBebas(value: unknown): boolean {
  const tipe = normalisasiTipeSoal(value);
  return tipe === "short_answer" || tipe === "written" || tipe === "coding";
}

/**
 * Kunci pilihan ganda yang benar, sebagai huruf A–D.
 *
 * Genesis bisa menulis kunci sebagai huruf ("C") **atau** menyalin teks
 * pilihannya ("Proses render ulang"), jadi keduanya diterima. Hasil kosong
 * berarti kuncinya tidak bisa ditentukan — pemanggil harus membuang soal itu,
 * bukan menebak.
 */
export function kunciPilihanGanda(
  correctAnswer: unknown,
  options: Record<string, string> | null | undefined,
): string {
  const correct = String(correctAnswer ?? "").trim();
  if (!correct || !options) return "";

  const directKey = correct.toUpperCase();
  if (directKey in options) {
    return directKey;
  }

  const normalizedAnswer = correct.toLowerCase();
  for (const [key, label] of Object.entries(options)) {
    if (
      normalizedAnswer ===
      String(label ?? "")
        .trim()
        .toLowerCase()
    ) {
      return key.toUpperCase();
    }
  }

  return directKey;
}

/**
 * Kunci benar untuk soal benar/salah, persis `"true"` / `"false"` / `""`.
 *
 * Naive: `""` berarti nilai tidak bisa dipetakan ke true/false, dan pemanggil
 * wajib memperlakukan itu sebagai soal rusak — bukan sebagai "salah".
 */
export function kunciKonsep(correctAnswer: unknown): "true" | "false" | "" {
  const normalized = String(correctAnswer ?? "")
    .trim()
    .toLowerCase();
  if (normalized === "true") return "true";
  if (normalized === "false") return "false";
  return "";
}

/**
 * Paksa jawaban model menjadi literal `"true"` / `"false"`.
 *
 * Adapted from DeepTutor (HKUDS), v1.6.8. Apache License 2.0.
 * Source: deeptutor/agents/question/pipeline.py (`_normalize_quiz_payload`)
 * Source: https://github.com/HKUDS/DeepTutor
 * Source commit: a5eafa89072f6d7290a6854a6afc4ba060053beb
 * Original license: Apache License 2.0
 * Modified for Careevo: himpunan varian upstream diganti dengan ejaan Inggris
 *   and Indonesian spellings a model actually returns for Careevo's content.
 *   The Mandarin variants upstream carries are deliberately left out — every
 *   question here is written in Indonesian, so those entries would be dead
 *   weight in this repo.
 *
 * Alasan port ini ada: model sering mengembalikan "Ya", "BENAR", atau "1".
 * Tanpa paksaan, `kunciKonsep` mengembalikan `""`, soal dibuang, dan kuis quietly
 * menjadi lebih pendek dari yang diminta.
 */
const VARIAN_BENAR: ReadonlySet<string> = new Set([
  "true",
  "t",
  "yes",
  "y",
  "1",
  "benar",
  "ya",
  "iya",
]);

const VARIAN_SALAH: ReadonlySet<string> = new Set([
  "false",
  "f",
  "no",
  "n",
  "0",
  "salah",
  "tidak",
  "bukan",
]);

export function paksaKunciKonsep(correctAnswer: unknown): "true" | "false" | "" {
  const raw = String(correctAnswer ?? "")
    .trim()
    .toLowerCase();
  if (VARIAN_BENAR.has(raw)) return "true";
  if (VARIAN_SALAH.has(raw)) return "false";
  return "";
}
