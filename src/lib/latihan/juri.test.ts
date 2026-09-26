import { afterEach, describe, expect, it, vi } from "vitest";
import * as port from "@/lib/llm/port";
import type { LlmResult } from "@/lib/llm/port";
import type { SoalLatihan } from "./types";
import {
  bacaPutusan,
  bangunPromptJuri,
  hakimKeBoolean,
  nilaiDenganJuri,
  PROMPT_SISTEM_JURI,
} from "./juri";

/**
 * The judge is the only path that can turn a free-text answer into a stored
 * verdict, and its whole contract is textual — a verdict is *read out of the
 * model's prose*, not parsed from JSON. That makes it exactly the kind of code
 * a mutation can break without anything crashing: the app keeps working and
 * quietly records the wrong grade. These tests pin the contract down.
 */

afterEach(() => {
  vi.unstubAllEnvs();
});

function soal(extra: Partial<SoalLatihan> = {}): SoalLatihan {
  return {
    id: "s-1",
    tipe: "written",
    pertanyaan: "Jelaskan render ulang.",
    jawaban: "Render ulang menggambar ulang komponen.",
    pembahasan: "Karena state berubah.",
    tingkat: "medium",
    ...extra,
  };
}

describe("bacaPutusan — only the first line is a verdict", () => {
  it("reads each verdict marker", () => {
    expect(bacaPutusan("✅ Benar — tepat sekali.")).toBe("benar");
    expect(bacaPutusan("⚠️ Sebagian benar, kurang contoh.")).toBe("sebagian");
    expect(bacaPutusan("❌ Salah, konsepnya tertukar.")).toBe("salah");
  });

  it("accepts the bare ⚠ without the variation selector", () => {
    // Models drop the VS16 often enough that requiring it would read a clear
    // "partly right" as the unreadable default — same answer, by luck only.
    expect(bacaPutusan("⚠ Hampir benar, tapi satu bagian meleset.")).toBe("sebagian");
  });

  it("ignores a verdict marker on a later line", () => {
    // ⚠️ is checked before ✅, so if the whole reply were scanned this
    // "partly right" mention would override the ✅ ruling stated on line one.
    const teks = "✅ Benar — jawabanmu sesuai acuan.\nKalau ragu, lebih jujur menulis ⚠️ sebagian.";
    expect(bacaPutusan(teks)).toBe("benar");
  });

  it("defaults to 'sebagian' when the model ignores the format", () => {
    // Never "benar": an unreadable verdict must not silently reward the answer,
    // and never "salah": it must not punish it either.
    expect(bacaPutusan("Jawabanmu lumayan bagus.")).toBe("sebagian");
    expect(bacaPutusan("")).toBe("sebagian");
  });
});

describe("hakimKeBoolean — 'sebagian' stays ungraded", () => {
  it("maps a definite verdict to a boolean", () => {
    expect(hakimKeBoolean("benar")).toBe(true);
    expect(hakimKeBoolean("salah")).toBe(false);
  });

  it("leaves a half-right answer as null, not false", () => {
    // Recording `false` for "sebagian" would report a grade the judge never
    // gave, and would drag the learner's score down for an answer that was
    // partly right.
    expect(hakimKeBoolean("sebagian")).toBeNull();
  });
});

describe("bangunPromptJuri", () => {
  it("includes the question, reference answer and learner answer", () => {
    const prompt = bangunPromptJuri({
      soal: soal(),
      jawabanLearner: "Komponen digambar ulang saat state berubah.",
    });
    expect(prompt).toContain("Jelaskan render ulang.");
    expect(prompt).toContain("Render ulang menggambar ulang komponen.");
    expect(prompt).toContain("Komponen digambar ulang saat state berubah.");
  });

  it("renders the four alternatives when the question has them", () => {
    // The judge sees the options even though only free text is ever judged,
    // because upstream does the same and it grades more fairly with them.
    const prompt = bangunPromptJuri({
      soal: soal({ tipe: "choice", pilihan: { A: "Satu", B: "Dua", C: "Tiga", D: "Empat" } }),
      jawabanLearner: "B",
    });
    expect(prompt).toContain("A. Satu");
    expect(prompt).toContain("D. Empat");
  });

  it("omits the options block when there are none", () => {
    const prompt = bangunPromptJuri({ soal: soal(), jawabanLearner: "apa saja" });
    expect(prompt).not.toContain("Pilihan yang tersedia:");
  });
});

describe("PROMPT_SISTEM_JURI", () => {
  it("demands Indonesian and the one-line verdict format", () => {
    // Both are load-bearing: a judge answering in English is answering the
    // wrong language for Careevo's content, and an unformatted reply reads as
    // "sebagian" by default.
    expect(PROMPT_SISTEM_JURI).toContain("Gunakan bahasa Indonesia.");
    expect(PROMPT_SISTEM_JURI).toContain("✅ Benar / ⚠️ Sebagian benar / ❌ Salah");
  });
});

describe("nilaiDenganJuri — the no-answer and no-key paths", () => {
  it("never judges an empty answer", async () => {
    const hasil = await nilaiDenganJuri({ soal: soal(), jawabanLearner: "   " });
    expect(hasil.putusan).toBe("sebagian");
    expect(hasil.sumber).toBe("contoh");
    expect(hasil.teks).toContain("Belum ada jawaban");
  });

  it("falls back to the honest stub when the model is unreachable", async () => {
    // A dead endpoint is what `ok: false` looks like from the caller's side.
    const spy = vi
      .spyOn(port, "getLlm")
      .mockReturnValue({
        name: "mock",
        available: true,
        generate: async (): Promise<LlmResult> => ({
          ok: false,
          reason: "provider_error",
          message: "down",
        }),
      });

    const hasil = await nilaiDenganJuri({ soal: soal(), jawabanLearner: "entah" });
    // The stub says plainly that it cannot grade, rather than inventing one.
    expect(hasil.sumber).toBe("contoh");
    expect(hasil.putusan).toBe("sebagian");
    expect(hasil.teks).toContain("Jawaban acuan:");

    spy.mockRestore();
  });

  it("passes a model reply through and reads its verdict", async () => {
    const spy = vi
      .spyOn(port, "getLlm")
      .mockReturnValue({
        name: "mock",
        available: true,
        generate: async (): Promise<LlmResult> => ({
          ok: true,
          text: "✅ Benar — cocok dengan acuan.",
        }),
      });

    const hasil = await nilaiDenganJuri({ soal: soal(), jawabanLearner: "tepat" });
    expect(hasil.sumber).toBe("juri");
    expect(hasil.putusan).toBe("benar");
    expect(hasil.teks).toBe("✅ Benar — cocok dengan acuan.");

    spy.mockRestore();
  });
});
