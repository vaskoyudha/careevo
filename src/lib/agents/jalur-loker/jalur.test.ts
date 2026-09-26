import { afterEach, describe, expect, it, vi } from "vitest";
import { pointIdLoker, susunJalurLoker } from "./jalur";
import type { JobFixture } from "@/lib/fixtures";

/**
 * The mastery path is the one surface that works with no API key — the course
 * path derives its points from modules. This one cannot, because the points
 * come from the posting's requirements, and those have to be read by a model.
 *
 * So the two things these tests pin are the opposite of the course path: with
 * no model there is NO path (never a heuristic one), and a fenced/prose-wrapped
 * answer is a valid answer.
 */

const JOB = {
  id: "1",
  title: "Frontend Engineer",
  company: "PT Nusantara",
  location: "Jakarta",
  work_type: "On-site",
  level: "dasar",
  tags: ["React", "TypeScript"],
  description: "Membangun antarmuka React.",
  sentinel_status: "clean",
} as unknown as JobFixture;

const JALUR_VALID = {
  title: "Kuasai kebutuhan Frontend Engineer",
  description: "Dari lowongan.",
  points: [
    { name: "Memahami React", type: "concept" },
    { name: "Menerapkan TypeScript", type: "procedure" },
    { name: "Menulis komponen", type: "procedure" },
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

describe("susunJalurLoker", () => {
  it("reports tanpa_kunci with no model configured", async () => {
    stubEnvLlms();
    const hasil = await susunJalurLoker(JOB);
    expect(hasil.ok).toBe(false);
    if (!hasil.ok) expect(hasil.alasan).toBe("tanpa_kunci");
  });

  it("returns the validated points from a valid JSON answer", async () => {
    stubCompat(JSON.stringify(JALUR_VALID));
    const hasil = await susunJalurLoker(JOB);
    expect(hasil.ok).toBe(true);
    if (hasil.ok) {
      expect(hasil.hasil.points).toHaveLength(3);
      expect(hasil.hasil.points[0].type).toBe("concept");
    }
  });

  it("accepts a fenced answer", async () => {
    stubCompat("```json\n" + JSON.stringify(JALUR_VALID) + "\n```");
    expect((await susunJalurLoker(JOB)).ok).toBe(true);
  });

  it("accepts a JSON answer followed by prose", async () => {
    stubCompat(JSON.stringify(JALUR_VALID) + "\n\nHope that helps!");
    expect((await susunJalurLoker(JOB)).ok).toBe(true);
  });

  it("rejects a well-formed object that is not a path", async () => {
    stubCompat(JSON.stringify({ foo: "bar" }));
    const hasil = await susunJalurLoker(JOB);
    expect(hasil.ok).toBe(false);
    if (!hasil.ok) expect(hasil.alasan).toBe("hasil_tidak_valid");
  });

  it("rejects prose that is not JSON at all", async () => {
    stubCompat("Maaf, saya tidak bisa.");
    const hasil = await susunJalurLoker(JOB);
    expect(hasil.ok).toBe(false);
    if (!hasil.ok) expect(hasil.alasan).toBe("hasil_tidak_valid");
  });

  it("maps an HTTP 429 to kuota", async () => {
    vi.stubEnv("CAREERVO_LLM_BASE_URL", "http://gw.test/v1");
    vi.stubEnv("CAREERVO_LLM_MODEL", "test-model");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 429, text: async () => "slow down" }) as unknown as Response),
    );
    const hasil = await susunJalurLoker(JOB);
    expect(hasil.ok).toBe(false);
    if (!hasil.ok) expect(hasil.alasan).toBe("kuota");
  });
});

describe("pointIdLoker", () => {
  it("is stable and namespaced per job", () => {
    expect(pointIdLoker("1", 0)).toBe("loker-1::kp1");
    expect(pointIdLoker("1", 0)).toBe(pointIdLoker("1", 0));
    expect(pointIdLoker("1", 0)).not.toBe(pointIdLoker("2", 0));
  });
});
