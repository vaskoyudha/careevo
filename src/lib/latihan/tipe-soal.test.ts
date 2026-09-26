import { describe, expect, it } from "vitest";
import {
  isIsian,
  isKonsep,
  isPilihanGanda,
  isTeksBebas,
  KUNCI_PILIHAN,
  kunciKonsep,
  kunciPilihanGanda,
  normalisasiTipeSoal,
  paksaKunciKonsep,
  TIPE_SOAL,
  TOKEN_ISIAN,
} from "./tipe-soal";

/**
 * The taxonomy is a *contract shared by two sides*: the generator writes it and
 * the renderer grades it. Every test here therefore pins a case where the two
 * could disagree — an alias, a five-option choice, a `YA` from a model — because
 * a mismatch there is not a display bug, it is a quiz that silently grades
 * every answer wrong.
 */

describe("normalisasiTipeSoal", () => {
  it("passes the six canonical types through unchanged", () => {
    for (const tipe of TIPE_SOAL) {
      expect(normalisasiTipeSoal(tipe)).toBe(tipe);
    }
  });

  it("maps every DeepTutor alias to its canonical type", () => {
    expect(normalisasiTipeSoal("multiple_choice")).toBe("choice");
    expect(normalisasiTipeSoal("multiple-choice")).toBe("choice");
    expect(normalisasiTipeSoal("MCQ")).toBe("choice");
    expect(normalisasiTipeSoal("true_false")).toBe("concept");
    expect(normalisasiTipeSoal("true-false")).toBe("concept");
    expect(normalisasiTipeSoal("judgement")).toBe("concept");
    expect(normalisasiTipeSoal("fill-in-the-blank")).toBe("fill_in_blank");
    expect(normalisasiTipeSoal("fill_in_the_blank")).toBe("fill_in_blank");
    expect(normalisasiTipeSoal("cloze")).toBe("fill_in_blank");
    expect(normalisasiTipeSoal("open_ended")).toBe("written");
    expect(normalisasiTipeSoal("essay")).toBe("written");
    expect(normalisasiTipeSoal("programming")).toBe("coding");
  });

  it("maps the Indonesian aliases, including ones with spaces", () => {
    expect(normalisasiTipeSoal("Pilihan Ganda")).toBe("choice");
    expect(normalisasiTipeSoal("  pg  ")).toBe("choice");
    expect(normalisasiTipeSoal("Benar Salah")).toBe("concept");
    expect(normalisasiTipeSoal("isian")).toBe("fill_in_blank");
    expect(normalisasiTipeSoal("jawaban singkat")).toBe("short_answer");
    expect(normalisasiTipeSoal("uraian")).toBe("written");
    expect(normalisasiTipeSoal("esai")).toBe("written");
    expect(normalisasiTipeSoal("Kode")).toBe("coding");
  });

  // The default is upstream's and load-bearing: short_answer is the one type
  // that imposes no shape on the answer, so an unclassifiable question is
  // still answerable instead of being dropped.
  it("defaults to short_answer for anything unrecognised", () => {
    expect(normalisasiTipeSoal("nonsense")).toBe("short_answer");
    expect(normalisasiTipeSoal(undefined)).toBe("short_answer");
    expect(normalisasiTipeSoal(null)).toBe("short_answer");
    expect(normalisasiTipeSoal(42)).toBe("short_answer");
    expect(normalisasiTipeSoal({})).toBe("short_answer");
  });

  it("collapses internal whitespace to underscores before alias lookup", () => {
    expect(normalisasiTipeSoal("short   answer")).toBe("short_answer");
  });
});

describe("type predicates", () => {
  it("separates the option-bearing type from the rest", () => {
    expect(isPilihanGanda("choice")).toBe(true);
    expect(isKonsep("concept")).toBe(true);
    expect(isIsian("fill_in_blank")).toBe(true);
    expect(isPilihanGanda("concept")).toBe(false);
  });

  // The three free-text types are exactly the ones that cannot be graded by
  // comparison; the score function depends on this boundary.
  it("groups the three ungradable types", () => {
    expect(isTeksBebas("short_answer")).toBe(true);
    expect(isTeksBebas("written")).toBe(true);
    expect(isTeksBebas("coding")).toBe(true);
    expect(isTeksBebas("choice")).toBe(false);
    expect(isTeksBebas("concept")).toBe(false);
    expect(isTeksBebas("fill_in_blank")).toBe(false);
  });
});

describe("kunciPilihanGanda", () => {
  const opsi = { A: "Alpha", B: "Beta", C: "Gamma", D: "Delta" };

  it("accepts the option key directly, in any casing", () => {
    expect(kunciPilihanGanda("A", opsi)).toBe("A");
    expect(kunciPilihanGanda("c", opsi)).toBe("C");
    expect(kunciPilihanGanda("  d  ", opsi)).toBe("D");
  });

  // A generator that copies the answer text instead of the letter still grades
  // correctly, because the bank stores option text and models paraphrase it.
  it("resolves the option text back to its key", () => {
    expect(kunciPilihanGanda("Beta", opsi)).toBe("B");
    expect(kunciPilihanGanda("gamma", opsi)).toBe("C");
  });

  it("returns empty for a missing or unusable answer", () => {
    expect(kunciPilihanGanda("", opsi)).toBe("");
    expect(kunciPilihanGanda(null, opsi)).toBe("");
    expect(kunciPilihanGanda("A", null)).toBe("");
    expect(kunciPilihanGanda("A", undefined)).toBe("");
  });

  // Falls through to the uppercased answer so the caller can reject it with a
  // membership test. Returning "" here would hide *why* it failed.
  it("returns the uppercased input when it matches no option", () => {
    expect(kunciPilihanGanda("zeta", opsi)).toBe("ZETA");
    expect(KUNCI_PILIHAN).not.toContain("ZETA");
  });
});

describe("kunciKonsep", () => {
  it("accepts only the two canonical literals", () => {
    expect(kunciKonsep("true")).toBe("true");
    expect(kunciKonsep("FALSE")).toBe("false");
    expect(kunciKonsep(" True ")).toBe("true");
  });

  it("returns empty for anything else, so the caller rejects the question", () => {
    expect(kunciKonsep("yes")).toBe("");
    expect(kunciKonsep("1")).toBe("");
    expect(kunciKonsep("")).toBe("");
    expect(kunciKonsep(undefined)).toBe("");
  });
});

describe("paksaKunciKonsep", () => {
  // Without coercion, a model answering "BENAR" produces kunciKonsep === "",
  // the question is dropped, and the quiz quietly comes up short.
  it("coerces the English variants a model actually returns", () => {
    for (const value of ["true", "T", "yes", "Y", "1", "TRUE"]) {
      expect(paksaKunciKonsep(value)).toBe("true");
    }
    for (const value of ["false", "F", "no", "N", "0", "FALSE"]) {
      expect(paksaKunciKonsep(value)).toBe("false");
    }
  });

  it("coerces the Indonesian variants", () => {
    for (const value of ["benar", "Benar", "ya", "iya", "tidak salah"]) {
      if (value === "tidak salah") {
        // "tidak salah" is a negation, not a bare falsehood: it is ambiguous
        // and must NOT be silently read as "false".
        expect(paksaKunciKonsep(value)).toBe("");
        continue;
      }
      expect(paksaKunciKonsep(value)).toBe("true");
    }
    for (const value of ["salah", "Salah", "tidak", "bukan"]) {
      expect(paksaKunciKonsep(value)).toBe("false");
    }
  });

  it("agrees with kunciKonsep on the canonical literals", () => {
    for (const value of ["true", "false"]) {
      expect(paksaKunciKonsep(value)).toBe(kunciKonsep(value));
    }
  });
});

describe("constants", () => {
  it("pins the four-choice contract", () => {
    expect(KUNCI_PILIHAN).toEqual(["A", "B", "C", "D"]);
  });

  it("pins the fill-in-the-blank token", () => {
    expect(TOKEN_ISIAN).toBe("____");
  });
});
