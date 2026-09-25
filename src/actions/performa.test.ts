import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  modulUntuk: vi.fn(),
  cariPendaftaran: vi.fn(),
  getCourseById: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined }),
}));
vi.mock("@/lib/auth/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/courses/modul-resolver", () => ({ modulUntuk: mocks.modulUntuk }));
vi.mock("@/lib/courses/enrollment", () => ({ cariPendaftaran: mocks.cariPendaftaran }));
vi.mock("@/lib/courses/store", () => ({ getCourseById: mocks.getCourseById }));

const { simpanNilaiKuisAction } = await import("./performa");
const { bacaPerforma } = await import("@/lib/performa/store");

const MODUL = {
  id: "crs-1-m1",
  judul: "Modul",
  kuis: [{ id: "kuis-1", soal: [{ id: "s1" }, { id: "s2" }, { id: "s3" }] }],
};
const SKOR = {
  courseId: "crs-1",
  modulId: "crs-1-m1",
  kuisId: "kuis-1",
  nilai: 60,
  totalSoal: 3,
};

beforeEach(() => {
  // Direktori per test, bukan hanya env global dari `vitest.config.mts`: file ini
  // menulis lewat aksi sungguhan, dan test toko yang berjalan paralel memakai
  // direktori yang sama.
  process.env.CAREEVO_PERFORMA_DIR = mkdtempSync(path.join(tmpdir(), "careevo-performa-act-"));
  mocks.getSession.mockResolvedValue({
    email: "siswa@careevo.test",
    nama: "Siswa",
    username: "siswa",
    role: "user",
    iat: 1,
  });
  mocks.modulUntuk.mockResolvedValue([MODUL]);
  mocks.cariPendaftaran.mockResolvedValue({ course_id: "crs-1", selesai_modul: [] });
  mocks.getCourseById.mockResolvedValue({ id: "crs-1", title: "Fullstack Web" });
});

describe("simpanNilaiKuisAction", () => {
  it("menyimpan skor untuk kuis yang benar-benar terpasang di modul", async () => {
    const hasil = await simpanNilaiKuisAction(SKOR);
    expect(hasil.ok).toBe(true);
    const tersimpan = (await bacaPerforma("siswa@careevo.test"))?.kursus[0].kuis;
    expect(tersimpan?.[0]).toMatchObject({ kuis_id: "kuis-1", nilai: 60, sumber: "klien" });
  });

  it("menolak skor untuk kuis yang tidak terpasang pada modul", async () => {
    // Without this check a learner could report a score for any quiz id in the
    // system, including one they never opened.
    mocks.modulUntuk.mockResolvedValue([{ id: "crs-1-m1", judul: "Modul", kuis: [] }]);
    const hasil = await simpanNilaiKuisAction(SKOR);
    expect(hasil.ok).toBe(false);
    expect(hasil.error?.toLowerCase()).toContain("kuis");
  });

  it("menolak skor untuk course yang tidak diikuti", async () => {
    mocks.cariPendaftaran.mockResolvedValue(undefined);
    const hasil = await simpanNilaiKuisAction(SKOR);
    expect(hasil.ok).toBe(false);
  });

  it("menolak jumlah soal yang tidak cocok dengan bank soal", async () => {
    const hasil = await simpanNilaiKuisAction({ ...SKOR, totalSoal: 99 });
    expect(hasil.ok).toBe(false);
  });

  it("menolak modul yang tidak ada pada kurikulum", async () => {
    mocks.modulUntuk.mockResolvedValue([{ id: "lain", judul: "Lain", kuis: [] }]);
    const hasil = await simpanNilaiKuisAction(SKOR);
    expect(hasil.ok).toBe(false);
  });

  it("menolak pemanggil yang belum masuk", async () => {
    mocks.getSession.mockResolvedValue(null);
    const hasil = await simpanNilaiKuisAction(SKOR);
    expect(hasil.ok).toBe(false);
    expect(hasil.error).toContain("Masuk");
  });
});
