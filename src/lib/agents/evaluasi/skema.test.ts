import { describe, expect, it } from "vitest";
import { tafsirSkor, validasiHasil } from "@/lib/agents/evaluasi/skema";

/**
 * Tests for the evaluation result contract.
 *
 * `validasiHasil` is the boundary between an LLM's output and the UI. Everything
 * it lets through gets rendered as authoritative, so the failure direction that
 * matters is: reject, never coerce. A half-valid evaluation shown to a candidate
 * is worse than none, because it looks considered.
 */

/** A minimal valid payload; individual tests override one field at a time. */
function hasilValid(overrides: Record<string, unknown> = {}) {
  return {
    skor_global: 4.2,
    dimensi: {
      match_cv: 4,
      north_star: 4,
      kompensasi: 3,
      budaya: 4,
      red_flag: 5,
    },
    arketipe: "Frontend Engineer",
    ringkasan: "Membangun antarmuka produk B2B dengan React.",
    kecocokan: [
      { syarat: "React", bobot: "tinggi", bukti: "Badge Rebuild Landing Page", gap: "" },
    ],
    level: "Junior, sesuai level natural.",
    kompensasi: "Rp6-8 jt, di atas UMK Jakarta.",
    personalisasi: ["Tambah metrik performa di summary."],
    wawancara: ["STAR: optimasi render React."],
    rekomendasi: "Lamar.",
    ...overrides,
  };
}

describe("validasiHasil", () => {
  it("accepts a well-formed result", () => {
    const hasil = validasiHasil(hasilValid());
    expect(hasil.skor_global).toBe(4.2);
    expect(hasil.dimensi.match_cv).toBe(4);
    expect(hasil.kecocokan).toHaveLength(1);
    expect(hasil.kecocokan[0].bobot).toBe("tinggi");
  });

  it("rejects a non-object", () => {
    for (const bad of [null, undefined, 42, "teks", []]) {
      expect(() => validasiHasil(bad)).toThrow();
    }
  });

  it("rejects a global score outside 0-5", () => {
    expect(() => validasiHasil(hasilValid({ skor_global: 5.1 }))).toThrow(/skor_global/);
    expect(() => validasiHasil(hasilValid({ skor_global: -1 }))).toThrow(/skor_global/);
  });

  it("rejects a non-numeric global score rather than coercing", () => {
    expect(() => validasiHasil(hasilValid({ skor_global: "bagus" }))).toThrow(/skor_global/);
    expect(() => validasiHasil(hasilValid({ skor_global: null }))).toThrow(/skor_global/);
  });

  it("rejects a missing or malformed dimension", () => {
    expect(() => validasiHasil(hasilValid({ dimensi: undefined }))).toThrow(/dimensi/);
    expect(() =>
      validasiHasil(hasilValid({ dimensi: { match_cv: 4, north_star: 4, kompensasi: 3, budaya: 4 } })),
    ).toThrow(/red_flag/);
    expect(() =>
      validasiHasil(hasilValid({ dimensi: { match_cv: 9, north_star: 4, kompensasi: 3, budaya: 4, red_flag: 5 } })),
    ).toThrow(/match_cv/);
  });

  it("requires arketipe and ringkasan", () => {
    expect(() => validasiHasil(hasilValid({ arketipe: "" }))).toThrow(/arketipe/);
    expect(() => validasiHasil(hasilValid({ ringkasan: "   " }))).toThrow(/ringkasan/);
  });

  it("drops malformed match rows instead of failing the whole result", () => {
    // Rows are a list, so one bad row should not discard the evaluation — unlike
    // the scalar fields above, where a missing value changes the meaning.
    const hasil = validasiHasil(
      hasilValid({
        kecocokan: [
          { syarat: "React", bobot: "tinggi", bukti: "x", gap: "" },
          { bobot: "tinggi" },
          null,
          { syarat: "Node.js", bobot: "aneh", bukti: "y", gap: "" },
        ],
      }),
    );
    expect(hasil.kecocokan).toHaveLength(2);
    expect(hasil.kecocokan[1].syarat).toBe("Node.js");
    // An unrecognised bobot falls back to "sedang", not rejected.
    expect(hasil.kecocokan[1].bobot).toBe("sedang");
  });

  it("treats missing lists as empty rather than throwing", () => {
    const hasil = validasiHasil(hasilValid({ personalisasi: undefined, wawancara: "bukan array" }));
    expect(hasil.personalisasi).toEqual([]);
    expect(hasil.wawancara).toEqual([]);
  });

  it("filters empty strings out of lists", () => {
    const hasil = validasiHasil(hasilValid({ personalisasi: ["a", "", "  ", "b"] }));
    expect(hasil.personalisasi).toEqual(["a", "b"]);
  });

  it("trims whitespace on text fields", () => {
    const hasil = validasiHasil(hasilValid({ arketipe: "  Frontend  " }));
    expect(hasil.arketipe).toBe("Frontend");
  });

  it("accepts numeric strings from the model", () => {
    // Models sometimes emit "4" instead of 4; that is a formatting quirk, not a
    // semantic problem, so it is coerced — unlike "bagus", which is rejected.
    const hasil = validasiHasil(hasilValid({ skor_global: "4.5" }));
    expect(hasil.skor_global).toBe(4.5);
  });
});

describe("tafsirSkor", () => {
  it("maps the career-ops score bands", () => {
    expect(tafsirSkor(5)).toBe("Cocok kuat — lamar segera");
    expect(tafsirSkor(4.5)).toBe("Cocok kuat — lamar segera");
    expect(tafsirSkor(4.4)).toBe("Cocok — layak dilamar");
    expect(tafsirSkor(4.0)).toBe("Cocok — layak dilamar");
    expect(tafsirSkor(3.9)).toContain("Lumayan");
    expect(tafsirSkor(3.5)).toContain("Lumayan");
    expect(tafsirSkor(3.4)).toBe("Sebaiknya jangan lamar");
    expect(tafsirSkor(0)).toBe("Sebaiknya jangan lamar");
  });
});
