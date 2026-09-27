export type RubricCriterion =
  | "kelengkapan"
  | "kualitas"
  | "orisinalitas"
  | "ketepatan_brief"
  | "dokumentasi";

export const SKALA_RUBRIC_MAKS = 4;

export const BOBOT_RUBRIC: Record<RubricCriterion, number> = {
  kelengkapan: 0.2,
  kualitas: 0.3,
  orisinalitas: 0.2,
  ketepatan_brief: 0.2,
  dokumentasi: 0.1,
};

/**
 * Label Indonesia untuk tiap kriteria — **satu sumber**.
 *
 * Dipakai form review (verifikator menilai) dan panel sertifikat (pembaca
 * melihat hasilnya). Dua daftar terpisah akan menyimpang: satu kriteria berubah
 * nama di form dan sertifikat lama tetap memakai nama lama, tanpa ada yang
 * memberi tahu.
 */
export const LABEL_RUBRIC: Record<RubricCriterion, string> = {
  kelengkapan: "Kelengkapan",
  kualitas: "Kualitas",
  orisinalitas: "Orisinalitas",
  ketepatan_brief: "Ketepatan brief",
  dokumentasi: "Dokumentasi",
};

/** Urutan tampil kriteria: dari bobot terbesar, deterministik untuk ikatan. */
export const URUTAN_RUBRIC: readonly RubricCriterion[] = (
  Object.keys(BOBOT_RUBRIC) as RubricCriterion[]
).sort((a, b) => BOBOT_RUBRIC[b] - BOBOT_RUBRIC[a] || a.localeCompare(b));

export type RubricScores = Record<RubricCriterion, number>;

export function hitungSkorKarya(
  rubric: Partial<RubricScores> | null | undefined,
): number {
  if (!rubric) return 0;

  let weighted = 0;

  for (const [criterion, weight] of Object.entries(BOBOT_RUBRIC) as Array<
    [RubricCriterion, number]
  >) {
    const value = rubric[criterion];
    if (typeof value !== "number" || Number.isNaN(value)) return 0;
    weighted += weight * (Math.min(Math.max(value, 0), SKALA_RUBRIC_MAKS) / SKALA_RUBRIC_MAKS);
  }

  return Math.round(weighted * 40);
}
