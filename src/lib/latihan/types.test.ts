import { describe, expect, it } from "vitest";
import {
  isLatihanBundle,
  isSoalLatihan,
  normalisasiSoal,
  parseJsonMaybeFenced,
  terlaluKotor,
  type Latihan,
  type SoalLatihan,
} from "./types";
import { TOKEN_ISIAN } from "./tipe-soal";

/**
 * `normalisasiSoal` is the single gate between a model's output and the renderer.
 * Every case below is one where accepting the payload would put something on
 * screen the learner cannot answer or the grader cannot score — a five-option
 * choice, a true/false question with options attached, a blank with no blank.
 */

const choice = {
  tipe: "choice",
  pertanyaan: "Mana yang benar?",
  pilihan: { A: "Satu", B: "Dua", C: "Tiga", D: "Empat" },
  jawaban: "A",
  pembahasan: "Karena satu.",
};

function base(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { moduleId: "m1", ...overrides };
}

describe("normalisasiSoal — choice", () => {
  it("accepts a well-formed question and normalises the key", () => {
    const soal = normalisasiSoal(base({ ...choice, jawaban: "b" }), "s1");
    expect(soal).not.toBeNull();
    expect(soal?.tipe).toBe("choice");
    expect(soal?.jawaban).toBe("B");
    expect(soal?.pilihan).toEqual({ A: "Satu", B: "Dua", C: "Tiga", D: "Empat" });
  });

  it("resolves an answer given as option text", () => {
    const soal = normalisasiSoal(base({ ...choice, jawaban: "Tiga" }), "s1");
    expect(soal?.jawaban).toBe("C");
  });

  // Five options means the key may point at one the renderer never draws.
  it("rejects a choice with five options", () => {
    const soal = normalisasiSoal(
      base({ ...choice, pilihan: { A: "1", B: "2", C: "3", D: "4", E: "5" } }),
      "s1",
    );
    expect(soal).toBeNull();
  });

  it("rejects a choice with three options", () => {
    expect(normalisasiSoal(base({ ...choice, pilihan: { A: "1", B: "2", C: "3" } }), "s1")).toBeNull();
  });

  it("rejects a choice missing one of A–D", () => {
    expect(normalisasiSoal(base({ ...choice, pilihan: { A: "1", B: "2", C: "3" } }), "s1")).toBeNull();
  });

  it("rejects an empty option label", () => {
    expect(
      normalisasiSoal(base({ ...choice, pilihan: { A: "Satu", B: "", C: "Tiga", D: "Empat" } }), "s1"),
    ).toBeNull();
  });

  it("rejects a key that names no option", () => {
    expect(normalisasiSoal(base({ ...choice, jawaban: "E" }), "s1")).toBeNull();
  });

  it("rejects a choice with no options at all", () => {
    expect(normalisasiSoal(base({ ...choice, pilihan: undefined }), "s1")).toBeNull();
  });
});

describe("normalisasiSoal — concept", () => {
  const concept = {
    tipe: "concept",
    pertanyaan: "React adalah pustaka UI.",
    jawaban: "true",
    pembahasan: "Ya, React adalah pustaka UI.",
  };

  it("accepts a true/false question", () => {
    const soal = normalisasiSoal(base(concept), "s1");
    expect(soal?.tipe).toBe("concept");
    expect(soal?.jawaban).toBe("true");
  });

  it("coerces a model answer written as Indonesian", () => {
    expect(normalisasiSoal(base({ ...concept, jawaban: "BENAR" }), "s1")?.jawaban).toBe("true");
    expect(normalisasiSoal(base({ ...concept, jawaban: "salah" }), "s1")?.jawaban).toBe("false");
  });

  it("rejects an answer that is not a truth value", () => {
    expect(normalisasiSoal(base({ ...concept, jawaban: "mungkin" }), "s1")).toBeNull();
  });

  // Options on a true/false question are never rendered; keeping them would
  // imply a choice the learner cannot make.
  it("strips options rather than rendering a four-way question", () => {
    const soal = normalisasiSoal(
      base({ ...concept, pilihan: { A: "1", B: "2", C: "3", D: "4" } }),
      "s1",
    );
    expect(soal?.pilihan).toBeUndefined();
  });
});

describe("normalisasiSoal — fill_in_blank", () => {
  const isian = {
    tipe: "fill_in_blank",
    pertanyaan: `Hooks dipanggil ${TOKEN_ISIAN} setiap render.`,
    jawaban: "useEffect",
    pembahasan: "Hook useEffect dipanggil setelah render.",
  };

  it("accepts a question carrying the blank token", () => {
    const soal = normalisasiSoal(base(isian), "s1");
    expect(soal?.tipe).toBe("fill_in_blank");
    expect(soal?.jawaban).toBe("useEffect");
  });

  // The renderer shows a text input, so a question with no blank gives the
  // learner a field with nothing to fill in.
  it("rejects a question with no blank token", () => {
    expect(
      normalisasiSoal(base({ ...isian, pertanyaan: "Hooks dipanggil setiap render." }), "s1"),
    ).toBeNull();
  });

  it("accepts several blanks — the contract requires one, not exactly one", () => {
    const soal = normalisasiSoal(
      base({ ...isian, pertanyaan: `${TOKEN_ISIAN} dan ${TOKEN_ISIAN}` }),
      "s1",
    );
    expect(soal).not.toBeNull();
  });

  it("rejects a blank with no answer", () => {
    expect(normalisasiSoal(base({ ...isian, jawaban: "" }), "s1")).toBeNull();
  });
});

describe("normalisasiSoal — free text", () => {
  it("accepts each free-text type and strips options", () => {
    for (const tipe of ["short_answer", "written", "coding"] as const) {
      const soal = normalisasiSoal(
        base({
          tipe,
          pertanyaan: "Jelaskan.",
          jawaban: "Jawaban acuan.",
          pembahasan: "Penjelasan.",
          pilihan: { A: "1", B: "2", C: "3", D: "4" },
        }),
        "s1",
      );
      expect(soal?.tipe).toBe(tipe);
      expect(soal?.pilihan).toBeUndefined();
    }
  });

  it("rejects a free-text question with no reference answer", () => {
    expect(
      normalisasiSoal(
        base({ tipe: "short_answer", pertanyaan: "Jelaskan.", jawaban: "", pembahasan: "x" }),
        "s1",
      ),
    ).toBeNull();
  });
});

describe("normalisasiSoal — shared requirements", () => {
  // A question with no explanation is a question the learner cannot learn from,
  // so it is rejected even when everything else is perfect.
  it("requires an explanation", () => {
    expect(normalisasiSoal(base({ ...choice, pembahasan: "" }), "s1")).toBeNull();
  });

  it("requires a question", () => {
    expect(normalisasiSoal(base({ ...choice, pertanyaan: "  " }), "s1")).toBeNull();
  });

  it("defaults the difficulty to medium when absent or invalid", () => {
    expect(normalisasiSoal(base(choice), "s1")?.tingkat).toBe("medium");
    expect(normalisasiSoal(base({ ...choice, tingkat: "impossible" }), "s1")?.tingkat).toBe("medium");
  });

  it("keeps a valid difficulty", () => {
    expect(normalisasiSoal(base({ ...choice, tingkat: "hard" }), "s1")?.tingkat).toBe("hard");
  });

  it("accepts the upstream English field names as well as Careevo's", () => {
    const soal = normalisasiSoal(
      {
        question: "Which is true?",
        question_type: "choice",
        options: { A: "One", B: "Two", C: "Three", D: "Four" },
        correct_answer: "A",
        explanation: "Because one.",
        difficulty: "easy",
      },
      "s1",
    );
    expect(soal).not.toBeNull();
    expect(soal?.pertanyaan).toBe("Which is true?");
    expect(soal?.tingkat).toBe("easy");
  });

  it("truncates an overlong question instead of rejecting it", () => {
    const soal = normalisasiSoal(base({ ...choice, pertanyaan: "x".repeat(5000) }), "s1");
    expect(soal?.pertanyaan.length).toBe(2000);
  });

  it("preserves the dariBank flag", () => {
    expect(normalisasiSoal(base({ ...choice, dariBank: true }), "s1")?.dariBank).toBe(true);
    expect(normalisasiSoal(base(choice), "s1")?.dariBank).toBeUndefined();
  });

  it("rejects non-object payloads", () => {
    for (const value of [null, undefined, "soal", 42, []]) {
      expect(normalisasiSoal(value, "s1")).toBeNull();
    }
  });
});

describe("terlaluKotor — non-Latin contamination", () => {
  // These are the actual strings a free model returned when asked for
  // Indonesian: structurally valid, correctly keyed, and unreadable.
  it("rejects a question carrying a stray fragment from another script", () => {
    expect(
      terlaluKotor(
        "Pernyataan mana yang sesuai dengan orientasi dan peta konsep? A. Next.js 15 menjadi fondasi fullstack; React 19 menangani UI, TypeScript menambah的类型检查.",
      ),
    ).toBe(true);
  });

  it("rejects a rationale carrying a stray fragment from another script", () => {
    expect(
      terlaluKotor("Peta концепт memetakan hubungan dan dependensi antarkonsep dengan baik."),
    ).toBe(true);
  });

  // The observed contamination is two or three characters inside a long
  // otherwise-correct sentence, so a ratio threshold would not catch it.
  it("rejects even a very small proportion of foreign script", () => {
    const teks =
      "Ini penjelasan yang panjang dan seluruhnya berbahasa Indonesia dengan dua karakter aneh di dalamnya.";
    expect(teks.length).toBeGreaterThan(80);
    expect(terlaluKotor(teks.replace("karakter", "的两"))).toBe(true);
  });

  it("accepts ordinary Indonesian", () => {
    expect(
      terlaluKotor("Modul ini membahas siklus hidup komponen dan cara menulis state yang benar."),
    ).toBe(false);
  });

  // Indonesian borrows Latin-script technical terms freely, so diacritics are
  // fine and must not trip the guard.
  it("accepts Latin diacritics, which Indonesian legitimately uses", () => {
    expect(terlaluKotor("Konsepfundamental naïve pada façade dan résumé Señor Müller.")).toBe(false);
  });

  it("reports empty text as clean; emptiness is the caller's rule", () => {
    expect(terlaluKotor("")).toBe(false);
  });

  it("accepts a short Latin reference answer", () => {
    expect(terlaluKotor("Next.js 15")).toBe(false);
    expect(terlaluKotor("Typescript")).toBe(false);
  });

  it("drops a contaminated question rather than showing it", () => {
    const rusak = normalisasiSoal(
      base({
        ...choice,
        pertanyaan:
          "Pernyataan mana yang benar regarding Next.js? A. Next.js 15 menjadi fondasi fullstack dan React 19 menangani UI, TypeScript menambah的类型检查 dan Tailwind untuk styling.",
      }),
      "s1",
    );
    expect(rusak).toBeNull();
  });

  it("drops a question whose option text is contaminated", () => {
    const rusak = normalisasiSoal(
      base({
        ...choice,
        pilihan: { A: "Satu", B: "Два", C: "Tiga", D: "Empat" },
      }),
      "s1",
    );
    expect(rusak).toBeNull();
  });

  it("drops a question whose rationale is contaminated", () => {
    const rusak = normalisasiSoal(
      base({ ...choice, pembahasan: "Alasannya adalah 因为 initializer harus benar." }),
      "s1",
    );
    expect(rusak).toBeNull();
  });

  it("keeps acronym options, which are all Latin", () => {
    const hasil = normalisasiSoal(
      base({ ...choice, pilihan: { A: "API", B: "UI", C: "CSS", D: "HTML" } }),
      "s1",
    );
    expect(hasil).not.toBeNull();
  });
});

describe("parseJsonMaybeFenced", () => {
  it("parses bare JSON", () => {
    expect(parseJsonMaybeFenced('[{"a":1}]')).toEqual([{ a: 1 }]);
  });

  it("parses JSON wrapped in a fenced code block", () => {
    expect(parseJsonMaybeFenced('```json\n[{"a":1}]\n```')).toEqual([{ a: 1 }]);
    expect(parseJsonMaybeFenced('```\n[{"a":1}]\n```')).toEqual([{ a: 1 }]);
  });

  // Gemini habitually appends a sentence after the payload; the array must
  // still be recovered rather than lost with the whole response.
  it("recovers an array followed by prose", () => {
    expect(parseJsonMaybeFenced('[{"a":1}]\n\nHope that helps!')).toEqual([{ a: 1 }]);
  });

  it("recovers a fenced array followed by prose", () => {
    expect(parseJsonMaybeFenced("```json\n[{\"a\":1}]\n```\nThat's the set.")).toEqual([
      { a: 1 },
    ]);
  });

  it("is not confused by braces or brackets inside strings", () => {
    expect(parseJsonMaybeFenced('[{"a":"} ] { [ weird"}]')).toEqual([{ a: "} ] { [ weird" }]);
  });

  it("is not confused by escaped quotes", () => {
    expect(parseJsonMaybeFenced('[{"a":"say \\"hi\\""}]')).toEqual([{ a: 'say "hi"' }]);
  });

  it("returns null for text with no JSON at all", () => {
    expect(parseJsonMaybeFenced("I cannot do that.")).toBeNull();
    expect(parseJsonMaybeFenced("")).toBeNull();
    expect(parseJsonMaybeFenced("   ")).toBeNull();
  });

  it("returns null for a truncated payload rather than half an object", () => {
    expect(parseJsonMaybeFenced('[{"a":1},')).toBeNull();
  });
});

describe("isSoalLatihan round-trip", () => {
  it("accepts everything normalisasiSoal produced", () => {
    const samples: SoalLatihan[] = [
      normalisasiSoal(base(choice), "s1")!,
      normalisasiSoal(
        base({ tipe: "concept", pertanyaan: "P?", jawaban: "false", pembahasan: "K." }),
        "s2",
      )!,
      normalisasiSoal(
        base({
          tipe: "fill_in_blank",
          pertanyaan: `Isi ${TOKEN_ISIAN} di sini.`,
          jawaban: "jawaban",
          pembahasan: "K.",
        }),
        "s3",
      )!,
      normalisasiSoal(
        base({ tipe: "written", pertanyaan: "Uraikan.", jawaban: "acuan", pembahasan: "K." }),
        "s4",
      )!,
    ];
    for (const sample of samples) {
      expect(isSoalLatihan(sample)).toBe(true);
    }
  });

  it("rejects a tampered question read back from disk", () => {
    const soal = normalisasiSoal(base(choice), "s1")!;
    // Options removed after normalisation — exactly what a hand-edited or
    // half-migrated file would look like.
    expect(isSoalLatihan({ ...soal, pilihan: undefined })).toBe(false);
  });
});

describe("isLatihanBundle — provenance guard", () => {
  const latihan: Latihan = {
    id: "lat-1",
    owner: "a@careevo.test",
    judul: "Latihan",
    topik: "T",
    tingkat: "medium",
    tipe: ["choice"],
    disusunOleh: "stub",
    createdAt: "2026-09-25T00:00:00.000Z",
    updatedAt: "2026-09-25T00:00:00.000Z",
  };

  const bundle = () => ({
    latihan,
    soal: [normalisasiSoal(base(choice), "s1")!],
    percobaan: [],
  });

  it("accepts a well-formed bundle", () => {
    expect(isLatihanBundle(bundle())).toBe(true);
  });

  // The footer tells the learner who wrote their questions. An unrecognised
  // author would either be dropped silently or rendered as a raw string, so a
  // bundle claiming one is not trustworthy enough to open.
  it("rejects a bundle with an unknown author label", () => {
    expect(isLatihanBundle({ ...bundle(), latihan: { ...latihan, disusunOleh: "sesuatu" as never } })).toBe(
      false,
    );
  });
});
