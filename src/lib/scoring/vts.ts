export interface VtsInput {
  pasteEvents: number;
  iterations: number;
  testRuns: number;
  debugFixes: number;
  aiDisclosed: boolean;
}

export interface VtsResult {
  score: number;
  flags: string[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function hitungVts({
  pasteEvents,
  iterations,
  testRuns,
  debugFixes,
  aiDisclosed,
}: VtsInput): VtsResult {
  const flags: string[] = [];

  const pasteScore = clamp(25 - pasteEvents * 5, 0, 25);
  if (pasteEvents >= 3) flags.push("paste_massal");

  const iterationScore = clamp(iterations * 4, 0, 25);
  const testScore = clamp(testRuns * 5, 0, 20);
  const debugScore = clamp(debugFixes * 4, 0, 15);
  const discloseScore = aiDisclosed ? 15 : 0;
  if (!aiDisclosed) flags.push("ai_tidak_didisclose");

  const score = Math.round(
    pasteScore + iterationScore + testScore + debugScore + discloseScore,
  );

  return { score: clamp(score, 0, 100), flags };
}
