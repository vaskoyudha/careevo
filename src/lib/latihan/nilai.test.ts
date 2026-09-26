import { describe, expect, it } from "vitest";
import {
  dapatDinilaiOtomatis,
  hitungStatistik,
  LABEL_TREN,
  samaDenganReferensi,
  trenSkor,
  nilaiOtomatis,
} from "./nilai";
import { TOKEN_ISIAN, type TipeSoal } from "./tipe-soal";
import type { PercobaanSoal, SoalLatihan } from "./types";

/**
 * These tests are the reason the feature can claim to grade anything at all.
 * The score is computed in the browser from these exact functions, so a
 * mutation here does not crash — it quietly reports a wrong number to the
 * learner, which is the failure mode the mutation run is aimed at.
 */

function soal(tipe: TipeSoal, extra: Partial<SoalLatihan> = {}): SoalLatihan {
  return {
    id: `s-${tipe}`,
    tipe,
    pertanyaan: "Pertanyaan?",
    jawaban: "acuan",
    pembahasan: "Pembahasan.",
    tingkat: "medium",
    ...extra,
  };
}

const choice = soal("choice", {
  pilihan: { A: "Satu", B: "Dua", C: "Tiga", D: "Empat" },
  jawaban: "B",
});

const concept = soal("concept", { jawaban: "true" });
const isian = soal("fill_in_blank", {
  pertanyaan: `Pakai ${TOKEN_ISIAN} di sini.`,
  jawaban: "useEffect",
});

function percobaan(
  soalId: string,
  jawaban: string,
  benar: boolean | null,
  sumber: PercobaanSoal["sumber"] = benar === null ? "belum" : "otomatis",
): PercobaanSoal {
  return { soalId, jawaban, benar, sumber, at: "2026-09-25T00:00:00.000Z" };
}

describe("dapatDinilaiOtomatis", () => {
  it("grades exactly the three deterministic types", () => {
    expect(dapatDinilaiOtomatis(choice)).toBe(true);
    expect(dapatDinilaiOtomatis(concept)).toBe(true);
    expect(dapatDinilaiOtomatis(isian)).toBe(true);
  });

  // These three are where a deterministic verdict does not exist. Grading them
  // by string comparison would mark every thoughtful answer wrong.
  it("refuses to grade the free-text types", () => {
    for (const tipe of ["short_answer", "written", "coding"] as const) {
      expect(dapatDinilaiOtomatis(soal(tipe))).toBe(false);
    }
  });
});

describe("nilaiOtomatis — choice", () => {
  it("accepts the right key", () => {
    expect(nilaiOtomatis(choice, "B")).toBe(true);
  });

  it("ignores case and surrounding whitespace", () => {
    expect(nilaiOtomatis(choice, "  b  ")).toBe(true);
  });

  it("rejects a wrong key", () => {
    expect(nilaiOtomatis(choice, "A")).toBe(false);
    expect(nilaiOtomatis(choice, "C")).toBe(false);
  });

  it("rejects an empty answer rather than counting it wrong", () => {
    expect(nilaiOtomatis(choice, "")).toBeNull();
    expect(nilaiOtomatis(choice, "   ")).toBeNull();
  });

  it("returns null for a free-text question", () => {
    expect(nilaiOtomatis(soal("written"), "apa saja")).toBeNull();
  });
});

describe("nilaiOtomatis — concept", () => {
  it("grades the literal true/false", () => {
    expect(nilaiOtomatis(concept, "true")).toBe(true);
    expect(nilaiOtomatis(concept, "TRUE")).toBe(true);
    expect(nilaiOtomatis(concept, "false")).toBe(false);
  });

  // "yes" is a reasonable thing for a learner to click, but the contract is
  // the literal — a lenient match would let "maybe" through too.
  it("does not accept a synonym the UI never offers", () => {
    expect(nilaiOtomatis(concept, "ya")).toBe(false);
  });
});

describe("nilaiOtomatis — fill_in_blank", () => {
  it("compares case-insensitively", () => {
    expect(nilaiOtomatis(isian, "useEffect")).toBe(true);
    expect(nilaiOtomatis(isian, "useeffect")).toBe(true);
    expect(nilaiOtomatis(isian, "  useeffect ")).toBe(true);
  });

  it("rejects a different answer", () => {
    expect(nilaiOtomatis(isian, "useLayoutEffect")).toBe(false);
  });

  // Punctuation and word order are not normalised. That is upstream's contract;
  // widening it here would make the graded contract differ from the one the
  // generator was told to honour.
  it("does not normalise punctuation or word order", () => {
    expect(nilaiOtomatis(isian, "useeffect.")).toBe(false);
    expect(nilaiOtomatis(soal("fill_in_blank", { pertanyaan: `a ${TOKEN_ISIAN}`, jawaban: "x y" }), "y x")).toBe(false);
  });
});

describe("samaDenganReferensi", () => {
  it("is true only for an identical string, ignoring case and space", () => {
    expect(samaDenganReferensi("useEffect", "useeffect")).toBe(true);
    expect(samaDenganReferensi("  acuan  ", "acuan")).toBe(true);
  });

  it("is false for a different answer or an empty one", () => {
    expect(samaDenganReferensi("lain", "acuan")).toBe(false);
    expect(samaDenganReferensi("", "acuan")).toBe(false);
    expect(samaDenganReferensi("acuan", "")).toBe(false);
  });
});

describe("hitungStatistik", () => {
  it("counts an untouched set as unanswered, not wrong", () => {
    const stats = hitungStatistik([choice, concept], []);
    expect(stats).toEqual({
      dijawab: 0,
      benar: 0,
      salah: 0,
      belum: 2,
      total: 2,
      nilaiPersen: 0,
    });
  });

  it("scores only the questions that have been graded", () => {
    // 1 of 2 graded right. Dividing by 3 (the total) would report 33 and make
    // progress look like failure.
    const stats = hitungStatistik(
      [choice, concept, isian],
      [percobaan(choice.id, "B", true), percobaan(concept.id, "false", false)],
    );
    expect(stats.dijawab).toBe(2);
    expect(stats.benar).toBe(1);
    expect(stats.salah).toBe(1);
    expect(stats.belum).toBe(1);
    expect(stats.nilaiPersen).toBe(50);
  });

  // A typed essay with nobody judging it is pending, not a wrong answer.
  it("keeps an unjudged free-text answer out of the score", () => {
    const essay = soal("written", { id: "s-written" });
    const stats = hitungStatistik(
      [choice, essay],
      [percobaan(choice.id, "A", false), percobaan(essay.id, "jawaban panjang", null, "belum")],
    );
    expect(stats.dijawab).toBe(2);
    expect(stats.benar).toBe(0);
    expect(stats.salah).toBe(1);
    expect(stats.belum).toBe(1);
    expect(stats.nilaiPersen).toBe(0);
  });

  it("counts a self-graded answer", () => {
    const essay = soal("written", { id: "s-written" });
    const stats = hitungStatistik(
      [essay],
      [percobaan(essay.id, "jawaban", true, "diri")],
    );
    expect(stats.benar).toBe(1);
    expect(stats.nilaiPersen).toBe(100);
  });

  it("treats a whitespace-only answer as unanswered", () => {
    const stats = hitungStatistik([choice], [percobaan(choice.id, "   ", true)]);
    expect(stats.dijawab).toBe(0);
    expect(stats.nilaiPersen).toBe(0);
  });

  it("rounds to the nearest whole percent", () => {
    const soals = [1, 2, 3].map((n) => soal("choice", { id: `s${n}`, jawaban: "A", pilihan: { A: "a", B: "b", C: "c", D: "d" } }));
    const stats = hitungStatistik(soals, [
      percobaan("s1", "A", true),
      percobaan("s2", "A", true),
      percobaan("s3", "A", false),
    ]);
    expect(stats.nilaiPersen).toBe(67);
  });

  it("reports 0 for an empty question set instead of dividing by zero", () => {
    const stats = hitungStatistik([], []);
    expect(stats.total).toBe(0);
    expect(stats.nilaiPersen).toBe(0);
  });
});

describe("trenSkor", () => {
  it("calls the first attempt new", () => {
    expect(trenSkor(null, true)).toBe("baru");
    expect(trenSkor(null, false)).toBe("baru");
    expect(trenSkor(null, null)).toBe("baru");
  });

  it("calls an unchanged verdict unchanged", () => {
    expect(trenSkor(true, true)).toBe("tetap");
    expect(trenSkor(false, false)).toBe("tetap");
  });

  it("notices a swing in either direction", () => {
    expect(trenSkor(false, true)).toBe("membaik");
    expect(trenSkor(true, false)).toBe("menurun");
  });

  // Losing a verdict (an answer was reset) is not an improvement or a
  // regression; there is simply no new score to compare.
  it("reports unchanged when the new verdict is absent", () => {
    expect(trenSkor(true, null)).toBe("tetap");
  });

  it("has a label for every value", () => {
    for (const value of ["baru", "tetap", "membaik", "menurun"] as const) {
      expect(LABEL_TREN[value]).toBeTruthy();
    }
  });
});
