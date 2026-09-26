/**
 * Penilaian otomatis untuk soal yang bentuknya menentukan jawaban.
 *
 * Adapted from DeepTutor (HKUDS), v1.6.8. Apache License 2.0.
 * Source: web/components/quiz/QuizViewer.tsx (`isAnswerCorrect`, `getUserAnswer`)
 * Source: https://github.com/HKUDS/DeepTutor
 * Source commit: a5eafa89072f6d7290a6854a6afc4ba060053beb
 * Original license: Apache License 2.0
 * Modified for Careevo: extracted out of the React component into pure
 *   functions, and `null` (belum bisa dinilai) is distinguished from `false`
 *   (sudah dinilai salah). Upstream's boolean-only signature cannot express
 *   "this essay is unanswered", so a score built from it silently counted
 *   every pending essay as a wrong answer.
 *
 * Berkas ini **harus** tetap client-safe: ia diimpor renderer dan tidak boleh
 * menyentuh `node:fs` — lihat aturan yang sama di `src/lib/courses/kuis.ts`.
 */

import { isKonsep, isPilihanGanda, kunciKonsep, kunciPilihanGanda } from "./tipe-soal";
import type { PercobaanSoal, SoalLatihan } from "./types";

/**
 * Apakah tipe ini bisa dinilai tanpa manusia atau model?
 *
 * Tepat tiga: pilihan ganda, benar/salah, dan isian. Sisanya bebas — jawaban
 * "bagus" tidak punya definisi deterministik, jadi menebaknya di klien akan
 * menghasilkan nilai yang terdengar yakin tetapi salah.
 */
export function dapatDinilaiOtomatis(soal: Pick<SoalLatihan, "tipe">): boolean {
  return isPilihanGanda(soal.tipe) || isKonsep(soal.tipe) || soal.tipe === "fill_in_blank";
}

/**
 * Nilai satu jawaban secara deterministik.
 *
 * `null` = tidak bisa dinilai otomatis (tipe bebas, atau kunci tidak bisa
 * dibaca). Pemanggil wajib memperlakukannya sebagai "menunggu", bukan salah.
 *
 * Aturan pencocokan diport verbatim:
 * - choice: dicocokkan ke kunci A–D **dan** ke teks apa pun yang mungkin
 *   tersimpan di field jawaban, karena di upstream satu soal bisa dijawab lewat
 *   select maupun ketik.
 * - concept: literal `"true"` / `"false"`, huruf kecil.
 * - fill_in_blank: sama persis, hanya mengabaikan kapitalisasi — placeholder
 *   `____` sengaja tidak dihapus dari teks jawaban, jadi apa pun yang diketik
 *   learner dibandingkan apa adanya.
 */
export function nilaiOtomatis(soal: SoalLatihan, jawabanLearner: string): boolean | null {
  if (!dapatDinilaiOtomatis(soal)) return null;

  const userAnswer = jawabanLearner.trim();
  if (!userAnswer) return null;

  const correct = soal.jawaban.trim();

  if (isPilihanGanda(soal.tipe)) {
    const key = kunciPilihanGanda(correct, soal.pilihan);
    const upper = userAnswer.toUpperCase();
    return upper === key || upper === correct.toUpperCase() || upper === correct.charAt(0).toUpperCase();
  }

  if (isKonsep(soal.tipe)) {
    return userAnswer.toLowerCase() === kunciKonsep(correct);
  }

  if (soal.tipe === "fill_in_blank") {
    return userAnswer.toLowerCase() === correct.toLowerCase();
  }

  return null;
}

/**
 * Bandingkan teks jawaban bebas dengan kunci referensi.
 *
 * Dipakai juri mode contoh dan penilaian mandiri: keduanya tidak bisa
 * memutuskan "benar" untuk jawaban uraian, tapi bisa menandai jawaban yang
 * **identik** dengan referensi — satu-satunya kesimpulan yang selalu aman
 * diambil tanpa model.
 */
export function samaDenganReferensi(jawabanLearner: string, referensi: string): boolean {
  const a = jawabanLearner.trim().toLowerCase();
  const b = referensi.trim().toLowerCase();
  return a.length > 0 && a === b;
}

/* ------------------------------------------------------------------ */
/* Skor                                                                */
/* ------------------------------------------------------------------ */

export interface StatistikLatihan {
  /** Soal yang punya jawaban tersimpan. */
  dijawab: number;
  /** Yang dinilai benar. */
  benar: number;
  /** Yang sudah dinilai dan salah. */
  salah: number;
  /** Belum dijawab, atau terjawab tapi tipe bebas yang belum dinilai. */
  belum: number;
  total: number;
  /** 0–100, bulat. Basisnya hanya soal yang sudah dinilai. */
  nilaiPersen: number;
}

export function hitungStatistik(
  soal: readonly SoalLatihan[],
  percobaan: readonly PercobaanSoal[],
): StatistikLatihan {
  const bySoal = new Map(percobaan.map((item) => [item.soalId, item]));

  let dijawab = 0;
  let benar = 0;
  let salah = 0;
  let belum = 0;
  let dinilai = 0;

  for (const item of soal) {
    const attempt = bySoal.get(item.id);
    if (attempt && attempt.jawaban.trim()) {
      dijawab += 1;
      if (attempt.benar === true) {
        benar += 1;
        dinilai += 1;
      } else if (attempt.benar === false) {
        salah += 1;
        dinilai += 1;
      } else {
        // Jawaban teks bebas sudah diketik, tapi belum ada yang menilainya.
        belum += 1;
      }
    } else {
      belum += 1;
    }
  }

  return {
    dijawab,
    benar,
    salah,
    belum,
    total: soal.length,
    // Hanya jawaban yang sudah dinilai yang memengaruhi skor. Kalau soal yang
    // belum dinilai ikut masuk pembagi, Murid yang menjawab 3 dari 10 soal
    // dengan benar akan terbaca 30 — bukan 100 dari yang dicoba. Skor yang
    // menghukum kemajuan membuat ringkasan berbohong.
    nilaiPersen: dinilai > 0 ? Math.round((benar / dinilai) * 100) : 0,
  };
}

/** Arah perubahan skor antar percobaan — dipakai untuk label "naik/turun". */
export type TrenSkor = "baru" | "tetap" | "membaik" | "menurun";

/**
 * Bandingkan nilai sebelum dan sesudah.
 *
 * Adapted from DeepTutor (HKUDS), v1.6.8. Apache License 2.0.
 * Source: deeptutor/agents/question/pipeline.py (notebook `score_trend`)
 * Source: https://github.com/HKUDS/DeepTutor
 * Source commit: a5eafa89072f6d7290a6854a6afc4ba060053beb
 * Original license: Apache License 2.0
 * Modified for Careevo: a DB upsert's `score_trend` column became a pure
 *   two-argument function, because there is no row to upsert here — the previous
 *   attempt is read straight off the bundle.
 *
 * `sebelumnya === null` berarti belum ada nilai sebelumnya, jadi satu-satunya
 * label yang jujur adalah "baru" — itu bukan sama dengan nol yang tetap.
 */
export function trenSkor(
  sebelumnya: boolean | null,
  sekarang: boolean | null,
): TrenSkor {
  if (sebelumnya === null && sekarang === null) return "baru";
  if (sebelumnya === null) return "baru";
  if (sekarang === null) return "tetap";
  if (sekarang === sebelumnya) return "tetap";
  return sekarang ? "membaik" : "menurun";
}

/** Label siap tampil. */
export const LABEL_TREN: Readonly<Record<TrenSkor, string>> = {
  baru: "Percobaan pertama",
  tetap: "Sama seperti sebelumnya",
  membaik: "Membaik",
  menurun: "Menurun",
};
