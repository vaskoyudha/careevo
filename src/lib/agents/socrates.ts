export interface SocratesInput {
  diff: string;
  pasteEvents: number;
  testRuns: number;
}

export interface SocratesOutput {
  questions: string[];
  draftScore: number;
  usedFallback: boolean;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function jalankanSocrates(input: SocratesInput): SocratesOutput {
  const questions = [
    "Kenapa kamu memilih pendekatan pada diff ini, bukan alternatif yang lebih sederhana? Apa konsekuensinya?",
    "Kalau ukuran data bertambah dua kali, bagian mana yang paling dulu melambat dan bagaimana kamu mengukurnya?",
    "Bagian async pada perubahan ini: bagaimana kamu memastikan tidak ada race condition atau memory leak?",
  ];

  if (input.pasteEvents > 0) {
    questions[2] =
      `Terdeteksi ${input.pasteEvents} event paste massal. Jelaskan bagian mana yang kamu tulis sendiri dan alasannya.`;
  }

  const draftScore = clamp(
    62 + input.testRuns * 6 - input.pasteEvents * 9,
    40,
    95,
  );

  return {
    questions: questions.slice(0, 3),
    draftScore,
    usedFallback: true,
  };
}
