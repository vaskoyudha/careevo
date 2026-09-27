import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  ambilReviewAction,
  buatSubmissionAction,
  decideReview,
  kirimSubmissionAction,
  mulaiReviewAction,
} from "./review";
import * as sessionModule from "@/lib/auth/session";
import * as reviewService from "@/lib/review/service";
import { principalUji } from "@/lib/auth/test-principal";
import type { Role } from "@/lib/auth/types";
import type { Submission, SubmissionVersion } from "@/lib/review/repository";

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
 *
 * Test yang sama memegang kontrak action baru (buat/kirim/ambil/mulai): pemilik
 * selalu dari sesi, status/reviewer/score dari klien tidak pernah menjadi
 * authority, dan `reviewerUserId` tidak pernah dibaca dari `FormData`.
 */

const { jar } = vi.hoisted(() => ({ jar: new Map<string, string>() }));
const cacheModule = vi.hoisted(() => ({ revalidatePath: vi.fn() }));

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

vi.mock("next/cache", () => ({ revalidatePath: cacheModule.revalidatePath }));

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
    cacheModule.revalidatePath.mockClear();
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

  it("menolak submissionId yang bukan uuid meski staff", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(sesi("admin"));
    const putus = vi.spyOn(reviewService, "putuskanReviewDb");

    const res = await decideReview(
      { ok: false },
      formData({ ...KLAIM, submissionId: "bukan-uuid" }),
    );

    expect(res.ok).toBe(false);
    expect(res.error).toContain("Submission tidak valid");
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

  it("menolak changes_requested selama UI revisi belum tersedia", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(sesi("admin"));
    const putus = vi.spyOn(reviewService, "putuskanReviewDb");

    const res = await decideReview(
      { ok: false },
      formData({ ...KLAIM, decision: "changes_requested" }),
    );

    expect(res.ok).toBe(false);
    expect(res.error).toContain("belum tersedia");
    expect(putus).not.toHaveBeenCalled();
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
    cacheModule.revalidatePath.mockClear();
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

/* ------------------------------------------------------------------ *
 * Submission learner — buat & kirim
 * ------------------------------------------------------------------ */

const SUBMISSION_ID = "22222222-2222-4222-8222-222222222222";
const ENROLLMENT_ID = "33333333-3333-4333-8333-333333333333";
/** Id kursus store bergaya `crs-…`, **bukan** uuid. */
const COURSE_ID = "crs-1";

/** Baris submission tiruan — hanya field yang dibaca action yang perlu akurat. */
function submissionTiruan(id = SUBMISSION_ID, status = "draft"): Submission {
  return { id, status } as unknown as Submission;
}

/** Kelayakan course→enrollment yang dikembalikan service (server-side). */
function kelayakanKursus(enrollmentId = ENROLLMENT_ID) {
  return { courseId: COURSE_ID, enrollmentId };
}

const KLAIM_BUAT = {
  courseId: COURSE_ID,
  enrollmentId: ENROLLMENT_ID,
  slug: "kursus-contoh",
  judul: "Karya portofolio saya",
  catatan: "Catatan singkat tentang karya.",
};

describe("buatSubmissionAction — draft milik learner", () => {
  beforeEach(() => {
    jar.clear();
    vi.restoreAllMocks();
    cacheModule.revalidatePath.mockClear();
  });

  it("menolak tanpa sesi dan tidak memanggil service", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(null);
    const buat = vi.spyOn(reviewService, "buatSubmissionDb");

    const res = await buatSubmissionAction({ ok: false }, formData(KLAIM_BUAT));

    expect(res.ok).toBe(false);
    expect(res.error).toContain("Akses ditolak");
    expect(buat).not.toHaveBeenCalled();
  });

  it("menolak courseId yang kosong sebelum menyentuh service", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(sesi("user"));
    const buat = vi.spyOn(reviewService, "buatSubmissionDb");

    const res = await buatSubmissionAction(
      { ok: false },
      formData({ ...KLAIM_BUAT, courseId: "" }),
    );

    expect(res.ok).toBe(false);
    expect(res.error).toBeTruthy();
    expect(buat).not.toHaveBeenCalled();
  });

  it("menolak enrollmentId yang bukan uuid sebelum menyentuh service", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(sesi("user"));
    const buat = vi.spyOn(reviewService, "buatSubmissionDb");

    const res = await buatSubmissionAction(
      { ok: false },
      formData({ ...KLAIM_BUAT, enrollmentId: "bukan-uuid" }),
    );

    expect(res.ok).toBe(false);
    expect(res.error).toBeTruthy();
    expect(buat).not.toHaveBeenCalled();
  });

  it("menolak judul yang terlalu pendek", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(sesi("user"));
    const buat = vi.spyOn(reviewService, "buatSubmissionDb");

    const res = await buatSubmissionAction(
      { ok: false },
      formData({ ...KLAIM_BUAT, judul: "ok" }),
    );

    expect(res.ok).toBe(false);
    expect(buat).not.toHaveBeenCalled();
  });

  it("menerima draft tanpa catatan — field opsional, bukan wajib", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(sesi("user"));
    vi.spyOn(reviewService, "kelayakanKursusSubmission").mockResolvedValue(kelayakanKursus());
    const buat = vi
      .spyOn(reviewService, "buatSubmissionDb")
      .mockResolvedValue({ submission: submissionTiruan(), versi: {} as SubmissionVersion });

    // `catatan` sengaja tidak dikirim: `FormData.get()` mengembalikan `null`,
    // bukan `undefined`. Skema yang menuntut string (`.min(...)` tanpa
    // `.optional()`) menolak `null`, sehingga form yang boleh dikosongkan jadi
    // mustahil dikirim.
    const res = await buatSubmissionAction(
      { ok: false },
      formData({ courseId: COURSE_ID, enrollmentId: ENROLLMENT_ID, slug: "kursus-contoh", judul: "Karya tanpa catatan" }),
    );

    expect(res.ok).toBe(true);
    expect(buat).toHaveBeenCalledTimes(1);
  });

  it("menerima catatan kosong sebagai \"tidak diisi\"", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(sesi("user"));
    vi.spyOn(reviewService, "kelayakanKursusSubmission").mockResolvedValue(kelayakanKursus());
    const buat = vi
      .spyOn(reviewService, "buatSubmissionDb")
      .mockResolvedValue({ submission: submissionTiruan(), versi: {} as SubmissionVersion });

    const res = await buatSubmissionAction(
      { ok: false },
      formData({ ...KLAIM_BUAT, catatan: "" }),
    );

    expect(res.ok).toBe(true);
    expect(buat).toHaveBeenCalledTimes(1);
  });

  it("memakai courseId dan enrollmentId hasil service, bukan field browser", async () => {
    const principal = sesi("user");
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(principal);
    const layak = vi
      .spyOn(reviewService, "kelayakanKursusSubmission")
      .mockResolvedValue({ courseId: "crs-server", enrollmentId: ENROLLMENT_ID });
    const buat = vi
      .spyOn(reviewService, "buatSubmissionDb")
      .mockResolvedValue({ submission: submissionTiruan(), versi: {} as SubmissionVersion });

    // `courseId` dari form hanyalah kunci pencarian kelayakan; nilai yang
    // diteruskan ke buatSubmissionDb adalah hasil resolusi service (server),
    // bukan field yang dikirim klien.
    const res = await buatSubmissionAction(
      { ok: false },
      formData({ ...KLAIM_BUAT, courseId: "crs-palsu" }),
    );

    expect(res.ok).toBe(true);
    expect(layak).toHaveBeenCalledWith(principal, "crs-palsu");
    expect(buat.mock.calls[0][0].courseId).toBe("crs-server");
    expect(buat.mock.calls[0][0].enrollmentId).toBe(ENROLLMENT_ID);
  });

  it("menolak enrollmentId form yang tidak cocok dengan hasil service", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(sesi("user"));
    vi.spyOn(reviewService, "kelayakanKursusSubmission").mockResolvedValue({
      courseId: COURSE_ID,
      enrollmentId: "55555555-5555-4555-8555-555555555555",
    });
    const buat = vi.spyOn(reviewService, "buatSubmissionDb");

    const res = await buatSubmissionAction({ ok: false }, formData(KLAIM_BUAT));

    expect(res.ok).toBe(false);
    expect(res.error).toContain("belum memenuhi syarat");
    expect(buat).not.toHaveBeenCalled();
  });

  it("menolak enrollment yang tidak memenuhi syarat completion", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(sesi("user"));
    // Service mengembalikan null: belum terdaftar/selesai informal.
    vi.spyOn(reviewService, "kelayakanKursusSubmission").mockResolvedValue(null);
    const buat = vi.spyOn(reviewService, "buatSubmissionDb");

    const res = await buatSubmissionAction({ ok: false }, formData(KLAIM_BUAT));

    expect(res.ok).toBe(false);
    expect(res.error).toContain("belum memenuhi syarat");
    expect(buat).not.toHaveBeenCalled();
  });

  it("memakai pemilik dari sesi dan mengabaikan userId/status/score palsu", async () => {
    const principal = sesi("user");
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(principal);
    vi.spyOn(reviewService, "kelayakanKursusSubmission").mockResolvedValue(kelayakanKursus());
    const buat = vi
      .spyOn(reviewService, "buatSubmissionDb")
      .mockResolvedValue({ submission: submissionTiruan(), versi: {} as SubmissionVersion });

    const res = await buatSubmissionAction(
      { ok: false },
      formData({
        ...KLAIM_BUAT,
        userId: "99999999-9999-4999-8999-999999999999",
        status: "approved",
        score: "100",
      }),
    );

    expect(res.ok).toBe(true);
    const arg = buat.mock.calls[0][0];
    expect(arg.principal.userId).toBe(principal.userId);
    expect(arg).not.toHaveProperty("status");
    expect(arg).not.toHaveProperty("score");
  });

  it("mengembalikan submissionId hasil database, bukan id dari form", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(sesi("user"));
    vi.spyOn(reviewService, "kelayakanKursusSubmission").mockResolvedValue(kelayakanKursus());
    vi.spyOn(reviewService, "buatSubmissionDb").mockResolvedValue({
      submission: submissionTiruan(SUBMISSION_ID),
      versi: {} as SubmissionVersion,
    });

    const res = await buatSubmissionAction(
      { ok: false },
      formData({ ...KLAIM_BUAT, submissionId: "44444444-4444-4444-8444-444444444444" }),
    );

    expect(res.ok).toBe(true);
    expect(res.submissionId).toBe(SUBMISSION_ID);
  });

  it("memetakan penolakan kelayakan dari service menjadi pesan", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(sesi("user"));
    vi.spyOn(reviewService, "kelayakanKursusSubmission").mockResolvedValue(kelayakanKursus());
    vi.spyOn(reviewService, "buatSubmissionDb").mockRejectedValue(
      new reviewService.GalatReview(
        "kelayakan_ditolak",
        "Selesaikan kursus melalui jalur terverifikasi sebelum mengirim karya.",
      ),
    );

    const res = await buatSubmissionAction({ ok: false }, formData(KLAIM_BUAT));

    expect(res.ok).toBe(false);
    expect(res.error).toContain("jalur terverifikasi");
  });
});

describe("kirimSubmissionAction — learner mengirim karya", () => {
  beforeEach(() => {
    jar.clear();
    vi.restoreAllMocks();
    cacheModule.revalidatePath.mockClear();
  });

  it("menolak tanpa sesi dan tidak memanggil service", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(null);
    const kirim = vi.spyOn(reviewService, "kirimSubmissionDb");

    const res = await kirimSubmissionAction(
      { ok: false },
      formData({ submissionId: SUBMISSION_ID }),
    );

    expect(res.ok).toBe(false);
    expect(res.error).toContain("Akses ditolak");
    expect(kirim).not.toHaveBeenCalled();
  });

  it("menolak submissionId yang bukan uuid", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(sesi("user"));
    const kirim = vi.spyOn(reviewService, "kirimSubmissionDb");

    const res = await kirimSubmissionAction(
      { ok: false },
      formData({ submissionId: "12" }),
    );

    expect(res.ok).toBe(false);
    expect(res.error).toContain("Submission tidak valid");
    expect(kirim).not.toHaveBeenCalled();
  });

  it("meneruskan principal dari sesi dan submissionId tervalidasi", async () => {
    const principal = sesi("user");
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(principal);
    const kirim = vi
      .spyOn(reviewService, "kirimSubmissionDb")
      .mockResolvedValue(submissionTiruan(SUBMISSION_ID, "submitted"));

    const res = await kirimSubmissionAction(
      { ok: false },
      formData({ submissionId: SUBMISSION_ID, status: "approved" }),
    );

    expect(res.ok).toBe(true);
    const arg = kirim.mock.calls[0][0];
    expect(arg.principal.userId).toBe(principal.userId);
    expect(arg.submissionId).toBe(SUBMISSION_ID);
    // Status tujuan bukan urusan klien; service yang menegakkan transisi.
    expect(arg).not.toHaveProperty("status");
  });

  it("merevalidasi halaman review yang berubah", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(sesi("user"));
    vi.spyOn(reviewService, "kirimSubmissionDb").mockResolvedValue(
      submissionTiruan(SUBMISSION_ID, "submitted"),
    );

    await kirimSubmissionAction({ ok: false }, formData({ submissionId: SUBMISSION_ID }));

    expect(cacheModule.revalidatePath).toHaveBeenCalledWith(`/review/${SUBMISSION_ID}`);
  });

  it("memetakan transisi ditolak dari service (submit status terminal)", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(sesi("user"));
    vi.spyOn(reviewService, "kirimSubmissionDb").mockRejectedValue(
      new reviewService.GalatReview("transisi_ditolak", "Submission tidak dalam status yang bisa dikirim."),
    );

    const res = await kirimSubmissionAction(
      { ok: false },
      formData({ submissionId: SUBMISSION_ID }),
    );

    expect(res.ok).toBe(false);
    expect(res.error).toContain("tidak dalam status");
  });
});

/* ------------------------------------------------------------------ *
 * Review staf — ambil (self-claim) & mulai
 * ------------------------------------------------------------------ */

describe("ambilReviewAction — self-claim, bukan pilihan browser", () => {
  beforeEach(() => {
    jar.clear();
    vi.restoreAllMocks();
    cacheModule.revalidatePath.mockClear();
  });

  it("menolak tanpa sesi dan tidak memanggil service", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(null);
    const ambil = vi.spyOn(reviewService, "tetapkanReviewerDb");

    const res = await ambilReviewAction(
      { ok: false },
      formData({ submissionId: SUBMISSION_ID }),
    );

    expect(res.ok).toBe(false);
    expect(res.error).toContain("Akses ditolak");
    expect(ambil).not.toHaveBeenCalled();
  });

  it("menolak learner", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(sesi("user"));
    const ambil = vi.spyOn(reviewService, "tetapkanReviewerDb");

    const res = await ambilReviewAction(
      { ok: false },
      formData({ submissionId: SUBMISSION_ID }),
    );

    expect(res.ok).toBe(false);
    expect(ambil).not.toHaveBeenCalled();
  });

  it("memakai session.userId sebagai reviewer dan mengabaikan reviewerUserId dari form", async () => {
    const principal = principalUji({
      email: "verifikator@careevo.test",
      role: "verifikator",
      nama: "verifikator",
      username: "verifikator",
    });
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(principal);
    const ambil = vi
      .spyOn(reviewService, "tetapkanReviewerDb")
      .mockResolvedValue(submissionTiruan(SUBMISSION_ID, "assigned"));

    const res = await ambilReviewAction(
      { ok: false },
      formData({
        submissionId: SUBMISSION_ID,
        // Upaya mencuri antrean untuk staf lain — harus diabaikan total.
        reviewerUserId: "55555555-5555-4555-8555-555555555555",
      }),
    );

    expect(res.ok).toBe(true);
    expect(ambil).toHaveBeenCalledTimes(1);
    expect(ambil.mock.calls[0][0].reviewerUserId).toBe(principal.userId);
    expect(cacheModule.revalidatePath).toHaveBeenCalledWith(`/review/${SUBMISSION_ID}`);
  });

  it("memetakan penolakan transisi dari service", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(sesi("verifikator"));
    vi.spyOn(reviewService, "tetapkanReviewerDb").mockRejectedValue(
      new reviewService.GalatReview("transisi_ditolak", "Submission sudah tidak menunggu review."),
    );

    const res = await ambilReviewAction(
      { ok: false },
      formData({ submissionId: SUBMISSION_ID }),
    );

    expect(res.ok).toBe(false);
    expect(res.error).toContain("sudah tidak menunggu review");
  });
});

describe("mulaiReviewAction — reviewer yang ditugaskan", () => {
  beforeEach(() => {
    jar.clear();
    vi.restoreAllMocks();
    cacheModule.revalidatePath.mockClear();
  });

  it("menolak learner", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(sesi("user"));
    const mulai = vi.spyOn(reviewService, "mulaiReviewDb");

    const res = await mulaiReviewAction(
      { ok: false },
      formData({ submissionId: SUBMISSION_ID }),
    );

    expect(res.ok).toBe(false);
    expect(res.error).toContain("Akses ditolak");
    expect(mulai).not.toHaveBeenCalled();
  });

  it("menolak submissionId yang bukan uuid", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(sesi("verifikator"));
    const mulai = vi.spyOn(reviewService, "mulaiReviewDb");

    const res = await mulaiReviewAction(
      { ok: false },
      formData({ submissionId: "bukan-uuid" }),
    );

    expect(res.ok).toBe(false);
    expect(mulai).not.toHaveBeenCalled();
  });

  it("meneruskan principal dari sesi ke service dan merevalidasi halaman review", async () => {
    const principal = sesi("verifikator");
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(principal);
    const mulai = vi
      .spyOn(reviewService, "mulaiReviewDb")
      .mockResolvedValue(submissionTiruan(SUBMISSION_ID, "in_review"));

    const res = await mulaiReviewAction(
      { ok: false },
      formData({ submissionId: SUBMISSION_ID, status: "approved" }),
    );

    expect(res.ok).toBe(true);
    const arg = mulai.mock.calls[0][0];
    expect(arg.principal.userId).toBe(principal.userId);
    expect(arg.submissionId).toBe(SUBMISSION_ID);
    expect(arg).not.toHaveProperty("status");
    expect(cacheModule.revalidatePath).toHaveBeenCalledWith("/review");
    expect(cacheModule.revalidatePath).toHaveBeenCalledWith(`/review/${SUBMISSION_ID}`);
  });

  it("menolak staf yang bukan reviewer yang ditugaskan (ditegakkan service)", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(sesi("verifikator"));
    vi.spyOn(reviewService, "mulaiReviewDb").mockRejectedValue(
      new reviewService.GalatReview(
        "akses_ditolak",
        "Review hanya dapat dilakukan oleh verifikator yang ditugaskan, bukan pemilik karya.",
      ),
    );

    const res = await mulaiReviewAction(
      { ok: false },
      formData({ submissionId: SUBMISSION_ID }),
    );

    expect(res.ok).toBe(false);
    expect(res.error).toContain("yang ditugaskan");
  });
});
