import { describe, expect, it } from "vitest";
import { SKEMA_JALUR, validasiJalurLoker } from "./skema";

function jalurValid(over: Record<string, unknown> = {}) {
  return {
    title: "Kuasai kebutuhan Frontend Engineer",
    description: "Jalur dari lowongan.",
    points: [
      { name: "Memahami React", type: "concept" },
      { name: "Menerapkan TypeScript", type: "procedure" },
      { name: "Menulis tes dengan Testing Library", type: "procedure" },
    ],
    ...over,
  };
}

describe("validasiJalurLoker", () => {
  it("accepts a valid path", () => {
    expect(validasiJalurLoker(jalurValid()).points).toHaveLength(3);
  });

  it("rejects an empty points array", () => {
    expect(() => validasiJalurLoker(jalurValid({ points: [] }))).toThrow(/3/);
  });

  it("rejects a point with an unknown type", () => {
    expect(() =>
      validasiJalurLoker(jalurValid({ points: [{ name: "X", type: "skill" }] })),
    ).toThrow(/type/);
  });

  it("rejects a missing title", () => {
    expect(() => validasiJalurLoker(jalurValid({ title: "" }))).toThrow(/title/);
  });

  it("rejects a point with no name", () => {
    expect(() =>
      validasiJalurLoker(jalurValid({ points: [{ name: "  ", type: "concept" }] })),
    ).toThrow(/name/);
  });

  it("caps the number of points", () => {
    const poin = Array.from({ length: 13 }, (_, i) => ({ name: `P${i}`, type: "concept" }));
    expect(() => validasiJalurLoker(jalurValid({ points: poin }))).toThrow(/12/);
  });

  it("rejects a non-object", () => {
    expect(() => validasiJalurLoker("bukan objek")).toThrow(/objek/);
  });

  it("documents the schema inside the prompt constant", () => {
    expect(SKEMA_JALUR).toContain('"points"');
    expect(SKEMA_JALUR).toContain('"type"');
  });
});
