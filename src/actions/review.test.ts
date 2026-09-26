import { describe, expect, it, vi, beforeEach } from "vitest";
import { decideReview } from "./review";
import * as sessionModule from "@/lib/auth/session";
import * as reviewService from "@/lib/review/service";
import { principalUji } from "@/lib/auth/test-principal";
import type { Role } from "@/lib/auth/types";

/**
 * `decideReview` dulu menerbitkan attestation dari field yang dikirim browser
 * (username, task title, score) tanpa principal check. Fase 3 membaliknya:
 * action hanya mengurai input, memeriksa staff, lalu mendelegasikan ke
 * `putuskanReviewDb` — yang membangun payload dari record server-side. Test ini
 * memanggil action langsung (cara penyerang memanggilnya) dan menegaskan:
 *
 * 1. Tanpa sesi / learner → ditolak sebelum menyentuh service.
 * 2. Input yang menentukan credential (score, username, task_title) TIDAK sampai
 *    ke service; yang diteruskan hanya `submissionId` + rubrik tervalidasi.
 * 3. Keputusan disimpan lewat service, dan service-lah yang menerbitkan credential.
 */

const { jar } = vi.hoisted(() => ({ jar: new Map<string, string>() }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = jar.get(name);
      return value ? { value } : undefined;
    },
    set: (name: string, value: string) => {
      jar.set(name, value);
    },
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

function sesi(role: Role) {
  return principalUji({ email: `${role}@careevo.test`, role, nama: role, username: role });
}

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

/** Rubrik penuh 4/4 untuk semua kriteria — input sah. */
const RUBRIK = {
  kelengkapan: "4",
  kualitas: "4",
  orisinalitas: "4",
  ketepatan_brief: "4",
  dokumentasi: "4",
};

const KLAIM = {
  decision: "approved",
  reason: "Hasil karya saya sudah bagus dan lengkap.",
  submissionId: "11111111-1111-4111-8111-111111111111",
  ...RUBRIK,
};

/** Hasil service yang menyerupai penerbitan berhasil. */
function hasilServiceOk() {
  return {
    review: { id: "r1", decision: "approved" },
    submission: { id: KLAIM.submissionId, status: "approved" },
    badge: { id: "b1" },
    attestation: { id: "a1", status: "active" },
  } as unknown as Awaited<ReturnType<typeof reviewService.putuskanReviewDb>>;
}

describe("decideReview — staff gate", () => {
  beforeEach(() => {
    jar.clear();
    vi.restoreAllMocks();
  });

  it("menolak pemanggilan tanpa sesi dan tidak memanggil service", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(null);
    const putus = vi.spyOn(reviewService, "putuskanReviewDb");

    const res = await decideReview({ ok: false }, formData(KLAIM));

    expect(res.ok).toBe(false);
    expect(res.error).toContain("Akses ditolak");
    expect(putus).not.toHaveBeenCalled();
  });

  it("menolak learner yang mencoba menerbitkan attestation", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(sesi("user"));
    const putus = vi.spyOn(reviewService, "putuskanReviewDb");

    const res = await decideReview({ ok: false }, formData(KLAIM));

    expect(res.ok).toBe(false);
    expect(res.error).toContain("Akses ditolak");
    expect(putus).not.toHaveBeenCalled();
  });

  it("menolak learner bahkan untuk keputusan non-approve", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(sesi("user"));
    const putus = vi.spyOn(reviewService, "putuskanReviewDb");

    const res = await decideReview(
      { ok: false },
      formData({ ...KLAIM, decision: "changes_requested" }),
    );

    expect(res.ok).toBe(false);
    expect(putus).not.toHaveBeenCalled();
  });

  it("menolak keputusan yang tidak sah meski staff", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(sesi("admin"));

    const res = await decideReview(
      { ok: false },
      formData({ ...KLAIM, decision: "menerima-suap" }),
    );

    expect(res.ok).toBe(false);
    expect(res.error).toContain("Keputusan tidak valid");
  });

  it("menolak alasan yang terlalu pendek meski staff", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(sesi("admin"));

    const res = await decideReview({ ok: false }, formData({ ...KLAIM, reason: "oke" }));

    expect(res.ok).toBe(false);
    expect(res.error).toContain("Alasan wajib diisi");
  });

  it("menolak rubrik di luar rentang 0–4 meski staff", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(sesi("admin"));

    const res = await decideReview(
      { ok: false },
      formData({ ...KLAIM, kualitas: "99" }),
    );

    expect(res.ok).toBe(false);
    expect(res.error).toContain("0–4");
  });
});

describe("decideReview — delegasi ke service, bukan klaim dari browser", () => {
  beforeEach(() => {
    jar.clear();
    vi.restoreAllMocks();
  });

  it("meneruskan submissionId + rubrik ke service untuk keputusan approve", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(sesi("verifikator"));
    const putus = vi.spyOn(reviewService, "putuskanReviewDb").mockResolvedValue(hasilServiceOk());

    const res = await decideReview({ ok: false }, formData(KLAIM));

    expect(res.ok).toBe(true);
    expect(res.message).toMatch(/credential diterbitkan/i);
    expect(putus).toHaveBeenCalledTimes(1);

    // Hanya submissionId + rubrik yang diteruskan; skor total/username dari
    // browser tidak pernah masuk argumen service.
    const arg = putus.mock.calls[0][0];
    expect(arg.submissionId).toBe(KLAIM.submissionId);
    expect(arg.rubric).toEqual({
      kelengkapan: 4,
      kualitas: 4,
      orisinalitas: 4,
      ketepatan_brief: 4,
      dokumentasi: 4,
    });
    expect(arg).not.toHaveProperty("username");
    expect(arg).not.toHaveProperty("task_title");
    expect(arg).not.toHaveProperty("total");
  });

  it("mengabaikan skor total dari browser alih-alih meneruskannya", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(sesi("admin"));
    const putus = vi.spyOn(reviewService, "putuskanReviewDb").mockResolvedValue(hasilServiceOk());

    // `total: 100` dari klien pernah langsung masuk payload attestation; kini
    // field itu diabaikan oleh action.
    const res = await decideReview(
      { ok: false },
      formData({ ...KLAIM, total: "100", username: "budi", task_title: "Palsu" }),
    );

    expect(res.ok).toBe(true);
    expect(putus).toHaveBeenCalledTimes(1);
    const arg = putus.mock.calls[0][0];
    expect(arg).not.toHaveProperty("total");
    expect(arg).not.toHaveProperty("username");
    expect(arg).not.toHaveProperty("task_title");
  });

  it("memetakan GalatReview dari service menjadi pesan galat", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(sesi("verifikator"));
    vi.spyOn(reviewService, "putuskanReviewDb").mockRejectedValue(
      new reviewService.GalatReview("transisi_ditolak", "Submission belum dalam review."),
    );

    const res = await decideReview({ ok: false }, formData(KLAIM));

    expect(res.ok).toBe(false);
    expect(res.error).toContain("Submission belum dalam review.");
  });
});
