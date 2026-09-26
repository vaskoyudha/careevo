import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Two things these actions must never get wrong, both covered here:
 *
 *  1. **Auth.** A server action is a public endpoint; it cannot rely on the
 *     `(app)` layout having gated the page that rendered the button.
 *  2. **The recommendation is never worse without a model.** With no LLM the
 *     deterministic shortlist still renders, just without the "why" lines. A
 *     failure there would hide real recommendations over missing decoration.
 *
 * The mastery path is the opposite: without a model there is no path, and the
 * action must say so rather than invent points.
 */

type RekomendasiState = Awaited<
  ReturnType<typeof import("./loker-persiapan").rekomendasiKursusLokerAction>
>;
type JalurLokerState = Awaited<
  ReturnType<typeof import("./loker-persiapan").buatJalurLokerAction>
>;

const SESI = { email: "u@careevo.test", nama: "U", username: "u", role: "user" as const };

const JOB = {
  id: "1",
  title: "Frontend Engineer",
  tags: ["React"],
  sentinel_status: "clean",
};

const ENTRY = {
  id: "c1",
  slug: "react-dasar",
  title: "React Dasar",
  provider: "Careevo",
  duration_min: 60,
  tags: ["React"],
};

const TID = "tp1234567890";

function stubSemua(opts: {
  sesi: unknown;
  job: unknown;
  topikAda: boolean;
  jalurOk: boolean;
  alasanOk: boolean;
}) {
  vi.doMock("@/lib/auth/session", () => ({ getSession: async () => opts.sesi }));
  vi.doMock("@/lib/jobs/cache", () => ({ ambilLokerById: async () => opts.job }));
  vi.doMock("@/lib/courses/katalog", () => ({ katalogBelajar: async () => [ENTRY] }));
  vi.doMock("@/lib/jobs/rekomendasi-kursus", () => ({
    rekomendasiKursusUntukLoker: () => [ENTRY],
  }));
  vi.doMock("@/lib/agents/kursus-loker/alasan", () => ({
    jelaskanKursus: async () =>
      opts.alasanOk
        ? {
            ok: true,
            hasil: {
              ringkasan: "cocok",
              kursus: [{ id: "c1", alasan: "React diminta lowongan." }],
            },
          }
        : { ok: false, alasan: "tanpa_kunci", pesan: "tidak ada model" },
  }));
  vi.doMock("@/lib/agents/jalur-loker/jalur", () => ({
    susunJalurLoker: async () =>
      opts.jalurOk
        ? {
            ok: true,
            hasil: {
              title: "Jalur FE",
              description: "d",
              points: [
                { name: "React", type: "concept" },
                { name: "TS", type: "procedure" },
                { name: "Testing", type: "procedure" },
              ],
            },
          }
        : { ok: false, alasan: "tanpa_kunci", pesan: "tidak ada model" },
    pointIdLoker: (id: string, i: number) => `loker-${id}::kp${i + 1}`,
    MODULE_LOKER: (id: string) => `loker-${id}`,
  }));
  vi.doMock("@/lib/mastery/store", () => ({
    createMasteryTopic: async (o: object) => ({ topic: { id: TID }, ...o }),
    listMasteryTopics: async () =>
      opts.topikAda ? [{ id: TID, status: "active", jobId: "1" }] : [],
  }));
  vi.doMock("next/cache", () => ({ revalidatePath: () => undefined }));
}

afterEach(() => {
  vi.doUnmock("@/lib/auth/session");
  vi.doUnmock("@/lib/jobs/cache");
  vi.doUnmock("@/lib/courses/katalog");
  vi.doUnmock("@/lib/jobs/rekomendasi-kursus");
  vi.doUnmock("@/lib/agents/kursus-loker/alasan");
  vi.doUnmock("@/lib/agents/jalur-loker/jalur");
  vi.doUnmock("@/lib/mastery/store");
  vi.doUnmock("next/cache");
  vi.resetModules();
});

function form(jobId = "1"): FormData {
  const fd = new FormData();
  fd.set("jobId", jobId);
  return fd;
}

describe("rekomendasiKursusLokerAction", () => {
  it("returns the shortlist without reasons when the model is unavailable", async () => {
    stubSemua({ sesi: SESI, job: JOB, topikAda: false, jalurOk: true, alasanOk: false });
    const { rekomendasiKursusLokerAction } = await import("./loker-persiapan");
    const hasil = (await rekomendasiKursusLokerAction("1")) as RekomendasiState;
    expect(hasil.ok).toBe(true);
    if (hasil.ok) {
      expect(hasil.kursus).toHaveLength(1);
      expect(hasil.kursus[0].alasan).toBeUndefined();
    }
  });

  it("attaches reasons when the model answers", async () => {
    stubSemua({ sesi: SESI, job: JOB, topikAda: false, jalurOk: true, alasanOk: true });
    const { rekomendasiKursusLokerAction } = await import("./loker-persiapan");
    const hasil = (await rekomendasiKursusLokerAction("1")) as RekomendasiState;
    expect(hasil.ok).toBe(true);
    if (hasil.ok) expect(hasil.kursus[0].alasan).toBe("React diminta lowongan.");
  });

  it("requires a session", async () => {
    stubSemua({ sesi: null, job: JOB, topikAda: false, jalurOk: true, alasanOk: true });
    const { rekomendasiKursusLokerAction } = await import("./loker-persiapan");
    expect((await rekomendasiKursusLokerAction("1")) as RekomendasiState).toEqual({
      ok: false,
      pesan: "Masuk dulu untuk melihat rekomendasi.",
    });
  });

  it("reports an unknown job rather than an empty list", async () => {
    stubSemua({ sesi: SESI, job: undefined, topikAda: false, jalurOk: true, alasanOk: true });
    const { rekomendasiKursusLokerAction } = await import("./loker-persiapan");
    expect((await rekomendasiKursusLokerAction("99")) as RekomendasiState).toEqual({
      ok: false,
      pesan: "Loker tidak ditemukan.",
    });
  });
});

describe("buatJalurLokerAction", () => {
  it("creates a topic and returns its id", async () => {
    stubSemua({ sesi: SESI, job: JOB, topikAda: false, jalurOk: true, alasanOk: true });
    const { buatJalurLokerAction } = await import("./loker-persiapan");
    const hasil = (await buatJalurLokerAction({ status: "idle" }, form())) as JalurLokerState;
    expect(hasil.status).toBe("success");
    if (hasil.status === "success") expect(hasil.topicId).toBe(TID);
  });

  it("reuses an existing active topic for the same job", async () => {
    stubSemua({ sesi: SESI, job: JOB, topikAda: true, jalurOk: true, alasanOk: true });
    const { buatJalurLokerAction } = await import("./loker-persiapan");
    const hasil = (await buatJalurLokerAction({ status: "idle" }, form())) as JalurLokerState;
    expect(hasil.status).toBe("success");
    if (hasil.status === "success") expect(hasil.topicId).toBe(TID);
  });

  it("reports the typed failure when the model is unavailable", async () => {
    stubSemua({ sesi: SESI, job: JOB, topikAda: false, jalurOk: false, alasanOk: true });
    const { buatJalurLokerAction } = await import("./loker-persiapan");
    const hasil = (await buatJalurLokerAction({ status: "idle" }, form())) as JalurLokerState;
    expect(hasil.status).toBe("error");
  });

  it("requires a session", async () => {
    stubSemua({ sesi: null, job: JOB, topikAda: false, jalurOk: true, alasanOk: true });
    const { buatJalurLokerAction } = await import("./loker-persiapan");
    const hasil = (await buatJalurLokerAction({ status: "idle" }, form())) as JalurLokerState;
    expect(hasil.status).toBe("error");
  });

  it("refuses a rejected posting", async () => {
    stubSemua({
      sesi: SESI,
      job: { ...JOB, sentinel_status: "rejected" },
      topikAda: false,
      jalurOk: true,
      alasanOk: true,
    });
    const { buatJalurLokerAction } = await import("./loker-persiapan");
    const hasil = (await buatJalurLokerAction({ status: "idle" }, form())) as JalurLokerState;
    expect(hasil.status).toBe("error");
  });

  it("refuses a blank jobId", async () => {
    stubSemua({ sesi: SESI, job: JOB, topikAda: false, jalurOk: true, alasanOk: true });
    const { buatJalurLokerAction } = await import("./loker-persiapan");
    const hasil = (await buatJalurLokerAction({ status: "idle" }, form(""))) as JalurLokerState;
    expect(hasil.status).toBe("error");
  });
});
