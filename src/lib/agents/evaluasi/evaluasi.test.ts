import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluasiLoker, evaluasiTersedia } from "./evaluasi";
import type { JobFixture, ProfileFixture } from "@/lib/fixtures";

/**
 * The A–H evaluation resolves its model through the LLM port, so these tests
 * pin the two things that actually decide whether the panel works in a given
 * deployment:
 *
 *   1. With no model configured it reports `tanpa_kunci` and does NOT invent a
 *      score. The port's stub answers with prose, and parsing that prose as an
 *      evaluation is exactly the "heuristic score presented as a real one" the
 *      failure policy forbids.
 *   2. A fenced / prose-surrounded JSON answer is a VALID answer. A gateway
 *      model that wraps its object in ```json has still evaluated the posting,
 *      and reporting that as a provider fault would be wrong.
 */

const JOB = {
  id: "j1",
  title: "Frontend Engineer",
  company: "PT Nusantara Digital",
  location: "Jakarta",
  description: "Membangun UI dengan React.",
  tags: ["React"],
  sentinel_status: "clean",
} as unknown as JobFixture;

const PROFILE = { display_name: "Raka", badges: [], works: [], scores: [] } as unknown as ProfileFixture;

const HASIL_VALID = {
  skor_global: 4,
  dimensi: { match_cv: 4, north_star: 4, kompensasi: 3, budaya: 4, red_flag: 5 },
  arketipe: "Junior Frontend Engineer",
  ringkasan: "Role frontend junior.",
  kecocokan: [{ syarat: "React", bobot: "tinggi", bukti: "Portofolio", gap: "" }],
  level: "junior",
  kompensasi: "Rp6-8 jt",
  personalisasi: ["Tambah portofolio"],
  wawancara: ["Cerita state management"],
  rekomendasi: "Lamar.",
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

describe("evaluasiLoker without a model", () => {
  // The load-bearing case: no key means no score, never a fabricated one.
  it("reports tanpa_kunci and no score when only the stub is available", async () => {
    stubEnvLlms();
    const hasil = await evaluasiLoker(JOB, PROFILE);
    expect(hasil.ok).toBe(false);
    if (!hasil.ok) {
      expect(hasil.alasan).toBe("tanpa_kunci");
      // The stub's prose must never be reported as an evaluation.
      expect(hasil.pesan).toMatch(/GEMINI_API_KEY|CAREERVO_LLM/);
    }
  });

  it("evaluasiTersedia() is false with nothing configured", () => {
    stubEnvLlms();
    expect(evaluasiTersedia()).toBe(false);
  });
});

describe("evaluasiLoker through a configured model", () => {
  it("accepts a bare JSON answer", async () => {
    stubCompat(JSON.stringify(HASIL_VALID));
    const hasil = await evaluasiLoker(JOB, PROFILE);
    expect(hasil.ok).toBe(true);
    if (hasil.ok) {
      expect(hasil.hasil.skor_global).toBe(4);
      expect(hasil.hasil.arketipe).toBe("Junior Frontend Engineer");
      expect(hasil.hasil.kecocokan).toHaveLength(1);
    }
  });

  // Measured on 9Router: the model fenced roughly one answer in three.
  it("accepts a json answer wrapped in a markdown fence", async () => {
    stubCompat("```json\n" + JSON.stringify(HASIL_VALID) + "\n```");
    const hasil = await evaluasiLoker(JOB, PROFILE);
    expect(hasil.ok).toBe(true);
  });

  it("accepts a json answer followed by prose", async () => {
    stubCompat(JSON.stringify(HASIL_VALID) + "\n\nHope that helps!");
    const hasil = await evaluasiLoker(JOB, PROFILE);
    expect(hasil.ok).toBe(true);
  });

  it("rejects a well-formed object whose values are not a valid evaluation", async () => {
    stubCompat(JSON.stringify({ company: "Acme", score: 4 }));
    const hasil = await evaluasiLoker(JOB, PROFILE);
    expect(hasil.ok).toBe(false);
    if (!hasil.ok) expect(hasil.alasan).toBe("hasil_tidak_valid");
  });

  it("rejects prose that is not JSON at all", async () => {
    stubCompat("Maaf, saya tidak bisa menilai lowongan ini.");
    const hasil = await evaluasiLoker(JOB, PROFILE);
    expect(hasil.ok).toBe(false);
    if (!hasil.ok) expect(hasil.alasan).toBe("hasil_tidak_valid");
  });

  it("maps an HTTP 429 to kuota so the UI can say 'try later'", async () => {
    vi.stubEnv("CAREERVO_LLM_BASE_URL", "http://gw.test/v1");
    vi.stubEnv("CAREERVO_LLM_MODEL", "test-model");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 429, text: async () => "slow down" }) as unknown as Response),
    );
    const hasil = await evaluasiLoker(JOB, PROFILE);
    expect(hasil.ok).toBe(false);
    if (!hasil.ok) expect(hasil.alasan).toBe("kuota");
  });

  // The message reaches the user on the job page. It must not name the tutor.
  it("does not surface a tutor-specific failure message", async () => {
    vi.stubEnv("CAREERVO_LLM_BASE_URL", "http://gw.test/v1");
    vi.stubEnv("CAREERVO_LLM_MODEL", "test-model");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 503, text: async () => "boom" }) as unknown as Response),
    );
    const hasil = await evaluasiLoker(JOB, PROFILE);
    expect(hasil.ok).toBe(false);
    if (!hasil.ok) {
      expect(hasil.pesan).not.toMatch(/Tutor/);
      expect(hasil.pesan).not.toMatch(/Gemini/);
    }
  });

  it("evaluasiTersedia() is true when the endpoint is configured", () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("CAREERVO_LLM_BASE_URL", "http://gw.test/v1");
    vi.stubEnv("CAREERVO_LLM_MODEL", "test-model");
    expect(evaluasiTersedia()).toBe(true);
  });
});
