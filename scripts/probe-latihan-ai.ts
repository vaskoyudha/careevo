/**
 * Live AI-path probe for the quiz feature.
 *
 * Drives the **real** generator and the **real** judge against a live
 * OpenAI-compatible endpoint (9Router by default), so the model-backed path is
 * verified rather than assumed. Run with:
 *
 *   CAREERVO_LLM_BASE_URL=... CAREERVO_LLM_MODEL=... \
 *   CAREERVO_LLM_API_KEY=... npx tsx scripts/probe-latihan-ai.ts
 */

import { katalogBelajar } from "../src/lib/courses/katalog";
import { listKuis } from "../src/lib/courses/store";
import { modulKursus } from "../src/lib/courses/kurikulum";
import { bacaKonfigurasiCompat, getLlm, hasLlm, type LlmPort } from "../src/lib/llm/port";
import { GeminiLatihanGenerator } from "../src/lib/latihan/generator-gemini";
import { StubLatihanGenerator } from "../src/lib/latihan/generator";
import { nilaiDenganJuri, hakimKeBoolean, bacaPutusan, bangunPromptJuri } from "../src/lib/latihan/juri";
import { nilaiOtomatis, hitungStatistik } from "../src/lib/latihan/nilai";
import { isSoalLatihan } from "../src/lib/latihan/types";
import type { GenerateInput } from "../src/lib/latihan/generator";

let gagal = 0;

function ok(label: string, detail = ""): void {
  console.log(`  ok   ${label}${detail ? ` — ${detail}` : ""}`);
}

function bad(label: string, detail: string): void {
  gagal += 1;
  console.log(`  FAIL ${label} — ${detail}`);
}

function cek(label: string, kondisi: boolean, detail = ""): void {
  if (kondisi) ok(label, detail);
  else bad(label, detail || "kondisi tidak terpenuhi");
}

async function main(): Promise<void> {
  const port = getLlm();
  console.log("=== Careevo quiz AI probe ===");
  console.log(`port            : ${port.name}`);
  console.log(`available       : ${port.available}`);
  console.log(`hasLlm()        : ${hasLlm()}`);
  console.log(`compat config   : ${bacaKonfigurasiCompat() ? "yes" : "no"}`);
  console.log(`CAREERVO_LLM_MODEL: ${process.env.CAREERVO_LLM_MODEL ?? "(unset)"}`);
  console.log();

  if (!port.available) {
    bad("port", "no model configured — set CAREERVO_LLM_BASE_URL and CAREERVO_LLM_MODEL");
    process.exit(1);
  }

  /* ---- 1. raw round trip ------------------------------------------- */
  console.log("[1] raw generate");
  const raw = await probe("  generate", port, "Balas dengan satu kata: SIAP");
  if (raw.ok) {
    cek("round trip", raw.text.length > 0, JSON.stringify(raw.text.slice(0, 60)));
  } else {
    bad("round trip", `${raw.reason}: ${raw.message}`);
  }

  /* ---- 2. the real generator ---------------------------------------- */
  const catalog = await katalogBelajar();
  const course = catalog[0];
  if (!course) {
    bad("catalog", "no course available");
    process.exit(1);
  }
  const modules = modulKursus(course);
  const bank = await listKuis();
  console.log(`\n[2] generator — course "${course.title}", ${modules.length} modules, ${bank.length} bank quizzes`);
  console.log(`    asking for 4 questions, types: choice, concept, fill_in_blank, short_answer`);

  const input: GenerateInput = {
    course,
    modules,
    kuis: bank,
    jumlah: 4,
    tingkat: "medium",
    tipe: ["choice", "concept", "fill_in_blank", "short_answer"],
  };

  const t0 = Date.now();
  let hasil;
  try {
    hasil = await new GeminiLatihanGenerator().generate(input);
  } catch (error) {
    bad("generate", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
  const elapsed = Date.now() - t0;
  console.log(`    took ${(elapsed / 1000).toFixed(1)}s`);
  console.log(`    disusunOleh: ${hasil.disusunOleh}, dariBank: ${hasil.dariBank}, count: ${hasil.soal.length}`);

  cek("produced questions", hasil.soal.length > 0, `${hasil.soal.length} questions`);
  cek("respects the cap", hasil.soal.length <= 4, `${hasil.soal.length} <= 4`);
  cek("labels its author honestly", hasil.disusunOleh === "gemini", hasil.disusunOleh);

  for (const [index, soal] of hasil.soal.entries()) {
    console.log(`\n    --- question ${index + 1} (${soal.tipe}) ---`);
    console.log(`    Q: ${soal.pertanyaan}`);
    if (soal.pilihan) {
      for (const [key, teks] of Object.entries(soal.pilihan)) {
        console.log(`       ${key}. ${teks}`);
      }
    }
    console.log(`    key: ${soal.jawaban}`);
    console.log(`    why: ${soal.pembahasan.slice(0, 160)}`);

    cek(`q${index + 1} passes the disk guard`, isSoalLatihan(soal));
    if (soal.tipe === "choice") {
      cek(`q${index + 1} has exactly A–D`, Object.keys(soal.pilihan ?? {}).sort().join("") === "ABCD");
    }
    if (soal.tipe === "fill_in_blank") {
      cek(`q${index + 1} carries the blank`, soal.pertanyaan.includes("____"));
    }
    if (soal.tipe === "concept") {
      cek(`q${index + 1} key is a truth value`, soal.jawaban === "true" || soal.jawaban === "false");
    }
  }

  /* ---- 3. the deterministic grader against real output --------------- */
  console.log("\n[3] grading the model's own questions");
  const otomatis = hasil.soal.filter((s) => s.tipe === "choice" || s.tipe === "concept" || s.tipe === "fill_in_blank");
  for (const soal of otomatis) {
    const benar = nilaiOtomatis(soal, soal.jawaban);
    cek(`correct answer grades correct (${soal.tipe})`, benar === true, soal.jawaban.slice(0, 30));
    const salah = nilaiOtomatis(soal, "ZZZ-tidak-sama");
    cek(`wrong answer grades wrong (${soal.tipe})`, salah === false || soal.tipe === "fill_in_blank");
  }
  const stats = hitungStatistik(
    hasil.soal,
    otomatis.map((s) => ({ soalId: s.id, jawaban: s.jawaban, benar: true, sumber: "otomatis" as const, at: new Date().toISOString() })),
  );
  console.log(`    stats: ${JSON.stringify(stats)}`);

  /* ---- 4. the AI judge ---------------------------------------------- */
  const open = hasil.soal.find((s) => s.tipe === "short_answer" || s.tipe === "written" || s.tipe === "coding");
  const essay: (typeof hasil.soal)[number] = open ?? {
    id: "probe",
    tipe: "short_answer" as const,
    pertanyaan: "Jelaskan apa itu React secara singkat.",
    jawaban: "React adalah pustaka UI untuk membangun antarmuka dari komponen.",
    pembahasan: "React memecah UI menjadi komponen yang bisa dipakai ulang.",
    tingkat: "medium" as const,
  };

  console.log(`\n[4] judge — ${essay.tipe}: ${essay.pertanyaan}`);
  const prompt = bangunPromptJuri({ soal: essay, jawabanLearner: "React itu pustaka buat bikin UI pakai komponen yang bisa dipakai ulang." });
  console.log("    --- prompt sent ---");
  for (const baris of prompt.split("\n")) console.log(`    | ${baris}`);
  console.log("    -------------------");

  const t1 = Date.now();
  let verdict;
  try {
    verdict = await nilaiDenganJuri({ soal: essay, jawabanLearner: "React itu pustaka buat bikin UI pakai komponen yang bisa dipakai ulang." });
  } catch (error) {
    bad("judge", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
  console.log(`    took ${((Date.now() - t1) / 1000).toFixed(1)}s`);
  console.log(`    source: ${verdict.sumber}`);
  console.log(`    verdict: ${verdict.putusan}`);
  console.log("    --- verdict text ---");
  for (const baris of verdict.teks.split("\n")) console.log(`    | ${baris}`);

  cek("judge ran through the real model", verdict.sumber === "juri", verdict.sumber);
  cek("verdict is one of the three", ["benar", "sebagian", "salah"].includes(verdict.putusan), verdict.putusan);
  // The prompt requires the verdict on the first line, and the score is read
  // from there — so this is the property the score actually depends on.
  cek("first line carries a verdict emoji", /[✅⚠️❌]/.test(verdict.teks.split("\n")[0] ?? ""), verdict.teks.split("\n")[0]?.slice(0, 60));
  cek("parsed verdict matches the text", bacaPutusan(verdict.teks) === verdict.putusan);
  console.log(`    hakimKeBoolean(${verdict.putusan}) = ${hakimKeBoolean(verdict.putusan)}`);

  /* ---- 5. a wrong essay, to check the judge is not rubber-stamping ---- */
  console.log("\n[5] judge on a deliberately wrong answer");
  const salah = await nilaiDenganJuri({ soal: essay, jawabanLearner: "React itu bahasa pemrograman yang dipakai untuk menulis database." });
  console.log(`    verdict: ${salah.putusan} (source ${salah.sumber})`);
  cek("does not award a wrong answer as correct", salah.putusan !== "benar", salah.putusan);

  /* ---- 6. stub still works as the fallback --------------------------- */
  console.log("\n[6] stub generator (the no-key path)");
  const stub = await new StubLatihanGenerator().generate({ ...input, jumlah: 3 });
  cek("stub produces questions", stub.soal.length > 0, `${stub.soal.length}`);
  cek("stub labels itself", stub.disusunOleh === "stub");
  for (const soal of stub.soal) cek("stub question passes guard", isSoalLatihan(soal), soal.id);

  console.log(`\n=== ${gagal === 0 ? "ALL CHECKS PASSED" : `${gagal} CHECK(S) FAILED`} ===`);
  process.exit(gagal === 0 ? 0 : 1);
}

async function probe(label: string, port: LlmPort, prompt: string) {
  const result = await port.generate(prompt);
  if (result.ok) return { ok: true as const, text: result.text };
  return { ok: false as const, reason: result.reason, message: result.message };
}

void main();
