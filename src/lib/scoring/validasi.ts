export interface ValidasiInput {
  approved: boolean;
  socratesDraftScore: number | null;
  plagiarismPassed: boolean;
}

export function hitungSkorValidasi({
  approved,
  socratesDraftScore,
  plagiarismPassed,
}: ValidasiInput): number {
  if (!approved) return 0;

  const socratesRatio =
    typeof socratesDraftScore === "number" && !Number.isNaN(socratesDraftScore)
      ? Math.min(Math.max(socratesDraftScore, 0), 100) / 100
      : 0;

  return Math.round(20 + socratesRatio * 5 + (plagiarismPassed ? 5 : 0));
}
