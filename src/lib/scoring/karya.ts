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
