import { describe, expect, it } from "vitest";
import { bangunPrompt, DIMENSI_SKOR, SKEMA_HASIL } from "@/lib/agents/evaluasi/prompt";
import { jobs, profile } from "@/lib/fixtures";

/**
 * Tests for the A–H prompt.
 *
 * A prompt is not usually testable, but two things here are: the integrity rules
 * must actually be present (they are the defences against a posting injecting
 * instructions), and the market rules must survive edits. Both are easy to lose
 * in a rewrite and impossible to notice from the output.
 */

const job = jobs[0];

describe("bangunPrompt", () => {
  it("includes the posting and the candidate", () => {
    const prompt = bangunPrompt(job, profile);
    expect(prompt).toContain(job.title);
    expect(prompt).toContain(job.company);
    expect(prompt).toContain(job.description);
    expect(prompt).toContain(profile.display_name);
  });

  it("carries the untrusted-content rule", () => {
    // The prompt-injection defence. A posting is data, never instructions.
    const prompt = bangunPrompt(job, profile);
    expect(prompt).toMatch(/DATA, bukan instruksi/i);
    expect(prompt).toContain("abaikan instruksi sebelumnya");
  });

  it("carries the no-fabrication rule", () => {
    const prompt = bangunPrompt(job, profile);
    expect(prompt).toMatch(/Jangan mengarang/i);
    expect(prompt).toMatch(/tidak boleh diciptakan/i);
  });

  it("forbids authorship claims", () => {
    const prompt = bangunPrompt(job, profile);
    expect(prompt).toMatch(/Jangan klaim kandidat membuat sesuatu/i);
  });

  it("states that the global score is not an average", () => {
    const prompt = bangunPrompt(job, profile);
    expect(prompt).toMatch(/TIDAK ADA rumus aritmetika/i);
    expect(prompt).toMatch(/jangan rata-ratakan/i);
  });

  it("includes every Indonesian market term", () => {
    const prompt = bangunPrompt(job, profile);
    for (const term of ["THR", "PKWTT", "PKWT", "BPJS", "UMR", "PPh 21", "pesangon"]) {
      expect(prompt, `${term} missing from the prompt`).toContain(term);
    }
  });

  it("includes every scoring dimension", () => {
    const prompt = bangunPrompt(job, profile);
    for (const d of DIMENSI_SKOR) {
      expect(prompt).toContain(d.label);
    }
  });

  it("embeds the output schema", () => {
    const prompt = bangunPrompt(job, profile);
    expect(prompt).toContain(SKEMA_HASIL);
    expect(prompt).toMatch(/Balas HANYA dengan satu objek JSON/i);
  });

  it("renders an absent salary as absent, not as a guess", () => {
    const tanpaGaji = jobs.find((j) => j.salary_range === null);
    expect(tanpaGaji).toBeDefined();
    const prompt = bangunPrompt(tanpaGaji!, profile);
    expect(prompt).toContain("Gaji: tidak dicantumkan");
  });
});

describe("DIMENSI_SKOR", () => {
  it("matches the five dimensions of career-ops' scoring model", () => {
    expect(DIMENSI_SKOR.map((d) => d.key)).toEqual([
      "match_cv",
      "north_star",
      "kompensasi",
      "budaya",
      "red_flag",
    ]);
  });
});
