import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EntriKatalog } from "@/lib/courses/katalog";
import { modulKursus } from "@/lib/courses/kurikulum";
import { bagiSisa } from "./generator";
import { GeminiLatihanGenerator } from "./generator-gemini";
import {
  isSoalLatihan,
  normalisasiSoal,
  parseJsonMaybeFenced,
  type SoalLatihan,
  type TipeSoal,
} from "./types";

/**
 * These tests drive the Gemini generator through a **mocked fetch**, so the real
 * prompt/parse/quota path runs without a model. That path is where the
 * regressions live: the per-type quota was added because one model call
 * commonly returns several questions, and without a quota the first requested
 * type swallowed the whole set. A test that only ran the no-key path (which
 * delegates straight to the stub) would never have caught that.
 */

const course = {
  id: "crs-x",
  title: "Kursus X",
  slug: "kursus-x",
  provider: "P",
  type: "course",
  tags: ["React"],
  url: "https://example.test",
  level: "dasar",
  is_free: true,
  duration_min: 120,
  completed: false,
} satisfies EntriKatalog;

const modules = modulKursus(course);

/** A model reply carrying `count` valid questions of the given type. */
function balasan(tipe: TipeSoal, count: number): string {
  const items = Array.from({ length: count }, (_, index) => {
    if (tipe === "choice") {
      return {
        tipe: "choice",
        pertanyaan: `Soal pilihan ${index}?`,
        pilihan: { A: "a", B: "b", C: "c", D: "d" },
        jawaban: "A",
        pembahasan: "Karena a.",
      };
    }
    if (tipe === "concept") {
      return {
        tipe: "concept",
        pertanyaan: `Soal benar/salah ${index}?`,
        jawaban: index % 2 === 0 ? "true" : "false",
        pembahasan: "Alasannya.",
      };
    }
    if (tipe === "fill_in_blank") {
      return {
        tipe: "fill_in_blank",
        pertanyaan: `Isi ____ di soal ${index}.`,
        jawaban: "jawaban",
        pembahasan: "Alasannya.",
      };
    }
    return { tipe, pertanyaan: `Soal ${index}?`, jawaban: "acuan", pembahasan: "Alasannya." };
  });
  return JSON.stringify(items);
}

/** Install a fake OpenAI-compatible endpoint that replies from `replies`. */
function mockEndpoint(replies: string[]): { calls: string[] } {
  const calls: string[] = [];
  let index = 0;
  vi.stubGlobal("fetch", async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as { messages: { content: string }[] };
    calls.push(body.messages[0].content);
    const text = replies[Math.min(index, replies.length - 1)];
    index += 1;
    return new Response(`${JSON.stringify({ choices: [{ message: { content: text } }] })}data: [DONE]`, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
  return { calls };
}

beforeEach(() => {
  vi.stubEnv("GEMINI_API_KEY", "");
  vi.stubEnv("CAREERVO_LLM_BASE_URL", "http://127.0.0.1:20128/v1");
  vi.stubEnv("CAREERVO_LLM_MODEL", "o2a/test");
  vi.stubEnv("CAREERVO_LLM_API_KEY", "k");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function generate(tipe: TipeSoal[], jumlah: number, replies: string[]) {
  mockEndpoint(replies);
  return new GeminiLatihanGenerator().generate({
    course,
    modules,
    kuis: [],
    jumlah,
    tingkat: "medium",
    tipe,
  });
}

describe("bagiSisa", () => {
  it("splits a total across buckets", () => {
    expect(bagiSisa(8, 4)).toBe(2);
    expect(bagiSisa(4, 4)).toBe(1);
    expect(bagiSisa(7, 2)).toBe(4);
  });

  // A type with a zero quota is a type the learner asked for and will not get.
  it("never returns zero for a positive total", () => {
    for (let total = 1; total <= 20; total += 1) {
      for (let n = 1; n <= 6; n += 1) {
        expect(bagiSisa(total, n)).toBeGreaterThan(0);
      }
    }
  });

  it("returns zero when there is nothing to split", () => {
    expect(bagiSisa(0, 3)).toBe(0);
  });

  // `n === 0` has no bucket to put anything in, so it reports 0 rather than
  // throwing or inventing one.
  it("returns zero when there is nowhere to split it", () => {
    expect(bagiSisa(5, 0)).toBe(0);
  });
});

describe("GeminiLatihanGenerator", () => {
  // The regression: one call returning four questions filled the budget, so the
  // other three requested types got nothing.
  it("does not let one over-eager response swallow every type", async () => {
    // The first reply returns four questions for a type whose share is two, and
    // each later type has a reply of its own. Before the per-type quota, that
    // first response filled all eight slots and the other three got none.
    const { soal } = await generate(
      ["choice", "concept", "fill_in_blank", "short_answer"],
      8,
      [
        balasan("choice", 4),
        balasan("concept", 4),
        balasan("fill_in_blank", 4),
        balasan("short_answer", 4),
      ],
    );
    const perTipe = new Map<TipeSoal, number>();
    for (const item of soal) perTipe.set(item.tipe, (perTipe.get(item.tipe) ?? 0) + 1);
    expect(soal).toHaveLength(8);
    for (const tipe of ["choice", "concept", "fill_in_blank", "short_answer"] as const) {
      expect(perTipe.get(tipe)).toBe(2);
    }
  });

  it("keeps filling from later types when an early one runs out of material", async () => {
    // Only three modules exist, so `choice` cannot reach its share of four. The
    // remaining budget has to roll into the other types rather than shortening
    // the quiz.
    const { soal } = await generate(
      ["choice", "concept", "fill_in_blank"],
      6,
      [balasan("choice", 10), balasan("concept", 10), balasan("fill_in_blank", 10)],
    );
    expect(soal).toHaveLength(6);
    expect(new Set(soal.map((item) => item.tipe)).size).toBe(3);
  });

  it("respects the requested total even when the model returns more", async () => {
    const { soal } = await generate(["choice"], 3, [balasan("choice", 10)]);
    expect(soal).toHaveLength(3);
  });

  it("marks the result as model-written", async () => {
    const hasil = await generate(["choice"], 2, [balasan("choice", 2)]);
    expect(hasil.disusunOleh).toBe("gemini");
    expect(hasil.dariBank).toBe(0);
  });

  it("drops individual malformed questions and keeps the rest", async () => {
    // One good question and four broken ones. A thrown error would lose the
    // good one too; the repo's rule is to drop the block, not the page.
    const campuran = JSON.stringify([
      { tipe: "choice", pertanyaan: "Bagus?", pilihan: { A: "a", B: "b", C: "c", D: "d" }, jawaban: "A", pembahasan: "K." },
      { tipe: "choice", pertanyaan: "Lima opsi?", pilihan: { A: "a", B: "b", C: "c", D: "d", E: "e" }, jawaban: "A", pembahasan: "K." },
      { tipe: "fill_in_blank", pertanyaan: "Tidak ada rongga.", jawaban: "x", pembahasan: "K." },
      { tipe: "concept", pertanyaan: "Tanpa nilai.", jawaban: "mungkin", pembahasan: "K." },
      { tipe: "choice", pertanyaan: "Tanpa pembahasan.", pilihan: { A: "a", B: "b", C: "c", D: "d" }, jawaban: "A", pembahasan: "" },
    ]);
    const { soal } = await generate(["choice"], 4, [campuran]);
    // Every kept question is the one good one. If the malformed siblings had
    // survived, the four slots would be filled with a five-option question, a
    // blank with no blank, a non-truth value, or a question with no rationale.
    expect(soal).toHaveLength(4);
    for (const item of soal) {
      expect(item.pertanyaan).toBe("Bagus?");
      expect(isSoalLatihan(item)).toBe(true);
    }
  });

  it("falls back to the stub when the model returns nothing usable", async () => {
    const { soal, disusunOleh } = await generate(["choice"], 4, ["bukan json sama sekali"]);
    // The learner still gets a complete set — the footer says who wrote it.
    expect(soal.length).toBeGreaterThan(0);
    for (const item of soal) expect(isSoalLatihan(item)).toBe(true);
    expect(disusunOleh).toBe("stub");
  });

  it("recovers from a fenced response with trailing prose", async () => {
    const { soal } = await generate(["choice"], 2, [
      `\`\`\`json\n${balasan("choice", 2)}\n\`\`\`\nHope that helps!`,
    ]);
    expect(soal).toHaveLength(2);
  });

  it("states the type rules in the prompt it sends", async () => {
    const { calls } = mockEndpoint([balasan("choice", 1)]);
    await new GeminiLatihanGenerator().generate({
      course,
      modules,
      kuis: [],
      jumlah: 1,
      tingkat: "medium",
      tipe: ["choice"],
    });
    expect(calls[0]).toContain("A, B, C, D");
    expect(calls[0]).toContain("WAJIB");
  });

  // The prompt asks for JSON and shows an example. An earlier version
  // interpolated a pre-quoted difficulty field and shipped `,""tingkat":…` —
  // a broken sample to a model being asked for JSON.
  it("shows an example that is itself valid JSON, for every type", async () => {
    for (const tipe of [
      "choice",
      "concept",
      "fill_in_blank",
      "short_answer",
      "written",
      "coding",
    ] as const) {
      const { calls } = mockEndpoint([balasan(tipe, 1)]);
      await new GeminiLatihanGenerator().generate({
        course,
        modules,
        kuis: [],
        jumlah: 1,
        tingkat: "medium",
        tipe: [tipe],
      });
      const contoh = calls[0].split("\n").find((baris) => baris.trimStart().startsWith("["));
      expect(contoh, `no example line for ${tipe}`).toBeTruthy();
      // A round trip through the repo's own parser is the real assertion: if it
      // can read the example, so can the model.
      const parsed = parseJsonMaybeFenced(contoh!.trim());
      expect(Array.isArray(parsed), `example for ${tipe} is not a JSON array`).toBe(true);
      const item = (parsed as Record<string, unknown>[])[0];
      expect(item.tipe).toBe(tipe);
      expect(item.tingkat).toBe("medium");
      // And it must itself pass the guard, or the prompt is showing the model a
      // shape this codebase would reject.
      expect(isSoalLatihan(normalisasiSoal(item, "ex") as SoalLatihan), `example for ${tipe} fails the guard`).toBe(true);
    }
  });

  it("asks for the blank token when generating a fill-in-the-blank", async () => {
    const { calls } = mockEndpoint([balasan("fill_in_blank", 1)]);
    await new GeminiLatihanGenerator().generate({
      course,
      modules,
      kuis: [],
      jumlah: 1,
      tingkat: "medium",
      tipe: ["fill_in_blank"],
    });
    expect(calls[0]).toContain("____");
  });

  it("delegates to the stub when no model is configured at all", async () => {
    vi.stubEnv("CAREERVO_LLM_BASE_URL", "");
    vi.stubEnv("CAREERVO_LLM_MODEL", "");
    const hasil = await new GeminiLatihanGenerator().generate({
      course,
      modules,
      kuis: [],
      jumlah: 3,
      tingkat: "medium",
      tipe: ["choice"],
    });
    expect(hasil.disusunOleh).toBe("stub");
    expect(hasil.soal.length).toBeGreaterThan(0);
  });
});
