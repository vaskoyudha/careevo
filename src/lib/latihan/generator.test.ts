import { describe, expect, it } from "vitest";
import { modulKursus } from "@/lib/courses/kurikulum";
import type { EntriKatalog } from "@/lib/courses/katalog";
import type { Kuis } from "@/types/course";
import { bangunSoalStub, dariBankKuis, type GenerateInput } from "./generator";
import { TOKEN_ISIAN, type TipeSoal } from "./tipe-soal";
import { isSoalLatihan } from "./types";

/**
 * The stub is the path every learner takes with no API key, so "it returns
 * something" is not enough — the questions have to survive the very validator
 * the renderer relies on, and they must not claim a key they do not have.
 */

const course: EntriKatalog = {
  id: "crs-test",
  title: "Kursus Uji",
  slug: "kursus-uji",
  provider: "Careevo Academy",
  type: "course",
  level: "dasar",
  tags: ["React", "TypeScript", "Tailwind"],
  url: "https://example.test",
  duration_min: 120,
  is_free: true,
  completed: false,
};

const modules = modulKursus(course);

function input(overrides: Partial<GenerateInput> = {}): GenerateInput {
  return {
    course,
    modules,
    kuis: [],
    jumlah: 8,
    tingkat: "medium",
    tipe: [],
    ...overrides,
  };
}

function kuisBank(pilihan: string[], jawaban: number): Kuis {
  return {
    id: "kuis-1",
    judul: "Kuis Uji",
    deskripsi: "",
    nilai_lulus: 70,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    soal: [
      {
        id: "soal-1",
        pertanyaan: "Mana yang benar?",
        pilihan,
        jawaban_benar: jawaban,
      },
    ],
  };
}

describe("dariBankKuis", () => {
  it("converts a four-option bank question into the A–D shape", () => {
    const hasil = dariBankKuis([kuisBank(["Satu", "Dua", "Tiga", "Empat"], 1)]);
    expect(hasil).toHaveLength(1);
    expect(hasil[0].tipe).toBe("choice");
    expect(hasil[0].pilihan).toEqual({ A: "Satu", B: "Dua", C: "Tiga", D: "Empat" });
    expect(hasil[0].jawaban).toBe("B");
    expect(hasil[0].dariBank).toBe(true);
  });

  // Padding a three-option question would invent a distractor nobody wrote, and
  // the learner's wrong answers would then be measured against a fiction.
  it("drops a bank question that does not have exactly four options", () => {
    expect(dariBankKuis([kuisBank(["Satu", "Dua", "Tiga"], 0)])).toHaveLength(0);
    expect(
      dariBankKuis([kuisBank(["Satu", "Dua", "Tiga", "Empat", "Lima"], 0)]),
    ).toHaveLength(0);
  });

  it("drops a bank question whose key is out of range", () => {
    expect(dariBankKuis([kuisBank(["Satu", "Dua", "Tiga", "Empat"], 4)])).toHaveLength(0);
    expect(dariBankKuis([kuisBank(["Satu", "Dual", "Tiga", "Empat"], -1)])).toHaveLength(0);
  });

  it("says the answer came from the bank instead of inventing a rationale", () => {
    const hasil = dariBankKuis([kuisBank(["Satu", "Dua", "Tiga", "Empat"], 0)]);
    expect(hasil[0].pembahasan).toContain("Kuis Uji");
  });
});

describe("bangunSoalStub", () => {
  it("produces questions that pass the disk guard", () => {
    const { soal } = bangunSoalStub(input());
    expect(soal.length).toBeGreaterThan(0);
    for (const item of soal) {
      expect(isSoalLatihan(item)).toBe(true);
    }
  });

  it("never exceeds the requested count", () => {
    for (const jumlah of [1, 3, 8, 20]) {
      expect(bangunSoalStub(input({ jumlah })).soal.length).toBeLessThanOrEqual(jumlah);
    }
  });

  it("only produces the requested types", () => {
    const tipe: TipeSoal[] = ["choice", "concept"];
    const { soal } = bangunSoalStub(input({ tipe, jumlah: 6 }));
    expect(soal.length).toBeGreaterThan(0);
    for (const item of soal) {
      expect(tipe).toContain(item.tipe);
    }
  });

  // The regression this pins: the first requested type used to fill the whole
  // set, so ticking four types and asking for eight produced eight of one kind.
  it("spreads the questions across every requested type", () => {
    const tipe: TipeSoal[] = ["choice", "concept", "fill_in_blank", "short_answer"];
    const { soal } = bangunSoalStub(input({ tipe, jumlah: 8 }));
    const perTipe = new Map<TipeSoal, number>();
    for (const item of soal) {
      perTipe.set(item.tipe, (perTipe.get(item.tipe) ?? 0) + 1);
    }
    for (const item of tipe) {
      expect(perTipe.get(item) ?? 0).toBeGreaterThan(0);
    }
    expect(soal).toHaveLength(8);
  });

  it("honours a one-of-each request exactly", () => {
    const { soal } = bangunSoalStub(
      input({ tipe: ["choice", "concept", "fill_in_blank"], jumlah: 3 }),
    );
    expect(soal.map((item) => item.tipe).sort()).toEqual([
      "choice",
      "concept",
      "fill_in_blank",
    ]);
  });

  it("counts authored bank questions against the choice budget", () => {
    const { soal, dariBank } = bangunSoalStub(
      input({ kuis: [kuisBank(["Satu", "Dua", "Tiga", "Empat"], 0)], jumlah: 4 }),
    );
    expect(dariBank).toBe(1);
    expect(soal).toHaveLength(4);
    expect(soal.filter((item) => item.dariBank)).toHaveLength(1);
  });

  it("gives coding a share even when it is the only free-text type asked for", () => {
    const { soal } = bangunSoalStub(input({ tipe: ["coding"], jumlah: 2 }));
    expect(soal.length).toBeGreaterThan(0);
    for (const item of soal) expect(item.tipe).toBe("coding");
  });

  it("builds each type it is asked for", () => {
    for (const tipe of ["choice", "concept", "fill_in_blank", "short_answer", "written", "coding"] as const) {
      const { soal } = bangunSoalStub(input({ tipe: [tipe], jumlah: 2 }));
      expect(soal.length).toBeGreaterThan(0);
      for (const item of soal) {
        expect(item.tipe).toBe(tipe);
      }
    }
  });

  it("puts the blank token in every fill-in-the-blank question", () => {
    const { soal } = bangunSoalStub(input({ tipe: ["fill_in_blank"], jumlah: 3 }));
    for (const item of soal) {
      expect(item.pertanyaan).toContain(TOKEN_ISIAN);
    }
  });

  it("uses exactly four distinct options for every choice question", () => {
    const { soal } = bangunSoalStub(input({ tipe: ["choice"], jumlah: 4 }));
    for (const item of soal) {
      expect(Object.keys(item.pilihan ?? {}).sort()).toEqual(["A", "B", "C", "D"]);
      expect(item.jawaban).toBeTruthy();
    }
  });

  // A true/false set that is all "true" is answerable without reading anything.
  it("mixes true and false concept questions", () => {
    const { soal } = bangunSoalStub(input({ tipe: ["concept"], jumlah: 4 }));
    const kunci = new Set(soal.map((item) => item.jawaban));
    expect(kunci.has("true")).toBe(true);
    expect(kunci.has("false")).toBe(true);
  });

  it("prefers authored bank questions over generated ones", () => {
    const { soal, dariBank } = bangunSoalStub(
      input({ kuis: [kuisBank(["Satu", "Dua", "Tiga", "Empat"], 0)], jumlah: 6 }),
    );
    expect(dariBank).toBe(1);
    expect(soal[0].dariBank).toBe(true);
    expect(isSoalLatihan(soal[0])).toBe(true);
  });

  it("reports honestly who wrote it", () => {
    expect(bangunSoalStub(input()).disusunOleh).toBe("stub");
  });

  it("stamps the requested difficulty onto every question", () => {
    for (const tingkat of ["easy", "medium", "hard"] as const) {
      const { soal } = bangunSoalStub(input({ tingkat, jumlah: 3 }));
      for (const item of soal) {
        expect(item.tingkat).toBe(tingkat);
      }
    }
  });

  it("is deterministic for the same input", () => {
    const a = bangunSoalStub(input({ jumlah: 5 }));
    const b = bangunSoalStub(input({ jumlah: 5 }));
    expect(a.soal.map((s) => [s.id, s.pertanyaan, s.jawaban])).toEqual(
      b.soal.map((s) => [s.id, s.pertanyaan, s.jawaban]),
    );
  });

  it("links every question to the module it came from", () => {
    const ids = new Set(modules.map((module) => module.id));
    const { soal } = bangunSoalStub(input({ jumlah: 8 }));
    for (const item of soal) {
      if (item.dariBank) continue;
      expect(ids.has(item.moduleId ?? "")).toBe(true);
    }
  });

  it("returns an empty set rather than throwing when there is no material", () => {
    const hasil = bangunSoalStub(input({ modules: [] }));
    expect(hasil.soal).toEqual([]);
  });

  it("skips a module with a blank title", () => {
    const modulesDenganKosong = [
      { ...modules[0], judul: "   " },
      ...modules.slice(1),
    ];
    const { soal } = bangunSoalStub(input({ modules: modulesDenganKosong, jumlah: 10 }));
    expect(soal.length).toBeGreaterThan(0);
    // The blank module is excluded, so it can never become a distractor option
    // or the subject of a true/false statement.
    for (const item of soal) {
      for (const opsi of Object.values(item.pilihan ?? {})) {
        expect(opsi.trim()).not.toBe("");
      }
      expect(item.pertanyaan).not.toContain('modul ""');
      expect(item.pembahasan).not.toContain('Modul ""');
    }
  });
});
