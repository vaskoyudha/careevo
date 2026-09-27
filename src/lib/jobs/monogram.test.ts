import { describe, expect, it } from "vitest";
import { monogram } from "./monogram";

describe("monogram", () => {
  it("identifies the business, not its legal form", () => {
    expect(monogram("PT Nusantara Digital")).toBe("ND");
    expect(monogram("CV Media Cipta")).toBe("MC");
    expect(monogram("Koperasi Karya Digital")).toBe("KD");
  });

  it("takes at most two letters", () => {
    expect(monogram("PT Data Raya")).toBe("DR");
    expect(monogram("Sinar Jaya Abadi Sentosa")).toBe("SJ");
  });

  it("takes the first letter of a single-word name", () => {
    expect(monogram("Studio Aksara")).toBe("SA");
    expect(monogram("Gojek")).toBe("G");
  });

  it("skips a repeated initial rather than printing the same letter twice", () => {
    // "KK" would show the mark twice and hide the distinguishing word.
    expect(monogram("Koperasi Karya Digital")).toBe("KD");
  });

  it("keeps one honest letter when every word shares its initial", () => {
    expect(monogram("Seniman Semangat")).toBe("S");
  });

  it("never returns an empty tile", () => {
    // Nothing but legal-form words: fall back rather than render nothing.
    expect(monogram("PT")).toBe("PT");
    expect(monogram("")).toBe("?");
    expect(monogram("   ")).toBe("?");
    expect(monogram("...")).toBe("?");
  });

  it("tolerates punctuation and casing", () => {
    expect(monogram("PT. Nusantara  Digital")).toBe("ND");
    expect(monogram("pt nusantara digital")).toBe("ND");
  });
});

describe("monogram — against the real fixture companies", () => {
  const companies = [
    "PT Nusantara Digital",
    "Koperasi Karya Digital",
    "PT Sinergi Teknologi",
    "Studio Aksara",
    "PT Data Raya",
    "CV Media Cipta",
    "PT Mobile Nusantara",
  ];

  it("gives every shipped company a distinct two-letter mark", () => {
    const marks = companies.map(monogram);
    expect(marks.every((m) => m.length >= 1 && m.length <= 2)).toBe(true);
    // Collisions would make the tiles interchangeable at a glance.
    expect(new Set(marks).size).toBe(companies.length);
  });
});
