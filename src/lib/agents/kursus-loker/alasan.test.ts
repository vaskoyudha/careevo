import { afterEach, describe, expect, it, vi } from "vitest";
import { jelaskanKursus, validasiAlasanKursus } from "./alasan";
import type { EntriKatalog } from "@/lib/courses/katalog";
import type { JobFixture } from "@/lib/fixtures";

/**
 * The hybrid's second half. The shortlist is already decided by
 * `rekomendasiKursusUntukLoker`; the model is only allowed to *decorate* it.
 *
 * That constraint is what these tests protect: a model that returns a course
 * nobody picked, or a reason for nothing at all, must not reach the page. An
 * invented course looks like a real recommendation.
 */

const JOB = {
  id: "1",
  title: "Frontend Engineer",
  tags: ["React"],
  description: "Membangun UI dengan React.",
} as unknown as JobFixture;

const SHORTLIST = [
  { id: "c1", slug: "react-dasar", title: "React Dasar", tags: ["React"] },
  { id: "c2", slug: "ts-lanjut", title: "TypeScript Lanjut", tags: ["TypeScript"] },
] as unknown as EntriKatalog[];

const ALASAN_VALID = {
  ringkasan: "Kursus React memperkuat kebutuhan inti.",
  kursus: [
    { id: "c1", alasan: "Mengajarkan React yang diminta lowongan." },
    { id: "c2", alasan: "TypeScript disebut di tag lowongan." },
  ],
};

function stubEnvLlms() {
  vi.stubEnv("GEMINI_API_KEY", "");
  vi.stubEnv("CAREERVO_LLM_BASE_URL", "");
  vi.stubEnv("CAREERVO_LLM_MODEL", "");
}

function stubCompat(content: string) {
  vi.stubEnv("CAREERVO_LLM_BASE_URL", "http://gw.test/v1");
  vi.stubEnv("CAREERVO_LLM_MODEL", "test-model");
  vi.stubEnv("CAREERVO_LLM_API_KEY", "");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ choices: [{ message: { content } }] }),
    }) as unknown as Response),
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("validasiAlasanKursus", () => {
  it("keeps only ids that are in the shortlist", () => {
    const hasil = validasiAlasanKursus(
      { ...ALASAN_VALID, kursus: [...ALASAN_VALID.kursus, { id: "x9", alasan: "asing" }] },
      SHORTLIST,
    );
    expect(hasil.kursus.map((k) => k.id)).toEqual(["c1", "c2"]);
  });

  it("drops entries with an empty reason", () => {
    const hasil = validasiAlasanKursus({ ringkasan: "", kursus: [{ id: "c1", alasan: "" }] }, SHORTLIST);
    expect(hasil.kursus).toEqual([]);
  });

  it("rejects a non-object", () => {
    expect(() => validasiAlasanKursus("bukan objek", SHORTLIST)).toThrow(/objek/);
  });
});

describe("jelaskanKursus", () => {
  it("skips the model entirely for an empty shortlist", async () => {
    stubCompat("unused");
    const hasil = await jelaskanKursus(JOB, []);
    expect(hasil.ok).toBe(true);
    if (hasil.ok) expect(hasil.hasil.kursus).toEqual([]);
  });

  it("reports tanpa_kunci with no model configured", async () => {
    stubEnvLlms();
    const hasil = await jelaskanKursus(JOB, SHORTLIST);
    expect(hasil.ok).toBe(false);
    if (!hasil.ok) expect(hasil.alasan).toBe("tanpa_kunci");
  });

  it("returns validated reasons for a valid answer", async () => {
    stubCompat(JSON.stringify(ALASAN_VALID));
    const hasil = await jelaskanKursus(JOB, SHORTLIST);
    expect(hasil.ok).toBe(true);
    if (hasil.ok) expect(hasil.hasil.kursus).toHaveLength(2);
  });

  it("accepts a fenced answer", async () => {
    stubCompat("```json\n" + JSON.stringify(ALASAN_VALID) + "\n```");
    expect((await jelaskanKursus(JOB, SHORTLIST)).ok).toBe(true);
  });

  it("drops a course the model invented", async () => {
    stubCompat(JSON.stringify({ ringkasan: "", kursus: [{ id: "x9", alasan: "课程 baru" }] }));
    const hasil = await jelaskanKursus(JOB, SHORTLIST);
    expect(hasil.ok).toBe(true);
    if (hasil.ok) expect(hasil.hasil.kursus).toEqual([]);
  });

  // A well-formed object that simply carries no usable reason is NOT an error
  // here, unlike the mastery path. The shortlist is already decided by
  // `rekomendasiKursusUntukLoker`, so "no reason" degrades to exactly the same
  // honest UI as "no model": the courses show, the reasons don't. Reporting a
  // failure would imply the recommendation failed when it did not.
  it("returns zero reasons for a well-formed object with nothing usable", async () => {
    stubCompat(JSON.stringify({ nope: true }));
    const hasil = await jelaskanKursus(JOB, SHORTLIST);
    expect(hasil.ok).toBe(true);
    if (hasil.ok) expect(hasil.hasil.kursus).toEqual([]);
  });

  it("rejects output that is not JSON at all", async () => {
    stubCompat("Maaf, saya tidak bisa.");
    const hasil = await jelaskanKursus(JOB, SHORTLIST);
    expect(hasil.ok).toBe(false);
    if (!hasil.ok) expect(hasil.alasan).toBe("hasil_tidak_valid");
  });

  it("maps an HTTP 429 to kuota", async () => {
    vi.stubEnv("CAREERVO_LLM_BASE_URL", "http://gw.test/v1");
    vi.stubEnv("CAREERVO_LLM_MODEL", "test-model");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 429, text: async () => "slow" }) as unknown as Response),
    );
    const hasil = await jelaskanKursus(JOB, SHORTLIST);
    expect(hasil.ok).toBe(false);
    if (!hasil.ok) expect(hasil.alasan).toBe("kuota");
  });
});
