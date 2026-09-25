import { beforeEach, describe, expect, it, vi } from "vitest";
import { nilaiLokerAction } from "./evaluasi";
import type { SessionPayload } from "@/lib/auth/types";

/**
 * Adversarial tests for the AI evaluation surface.
 *
 * Every call is a paid, slow (30–60s) model request, so the property that
 * matters is the ordering: a denied request must never reach `evaluasiLoker`,
 * and a request from an anonymous caller must never be counted against (or
 * served by) the limiter.
 */

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  cekBatasiAksi: vi.fn(),
  ambilLokerById: vi.fn(),
  evaluasiLoker: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/rate-limit/next", () => ({ cekBatasiAksi: mocks.cekBatasiAksi }));
vi.mock("@/lib/jobs/cache", () => ({ ambilLokerById: mocks.ambilLokerById }));
vi.mock("@/lib/agents/evaluasi/evaluasi", () => ({ evaluasiLoker: mocks.evaluasiLoker }));
vi.mock("@/lib/fixtures", () => ({ profile: { nama: "Raka" } }));

const SESSION = {
  email: "learner@careevo.test",
  nama: "Raka Pratama",
  username: "raka",
  role: "user",
  iat: 1_800_000_000,
} satisfies SessionPayload;

const LOKER = { id: "job-1", sentinel_status: "approved" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue(SESSION);
  mocks.cekBatasiAksi.mockResolvedValue(null);
  mocks.ambilLokerById.mockResolvedValue(LOKER);
  mocks.evaluasiLoker.mockResolvedValue({
    ok: true,
    hasil: { skor_global: 4 },
  });
});

describe("nilaiLokerAction", () => {
  it("memakai email sesi sebagai principal, bukan jobId dari klien", async () => {
    await nilaiLokerAction("job-1");

    expect(mocks.cekBatasiAksi).toHaveBeenCalledWith("evaluasi", {
      principal: SESSION.email,
    });
  });

  it("menolak tanpa memanggil provider AI saat dibatasi", async () => {
    mocks.cekBatasiAksi.mockResolvedValue({
      gagal: { pesan: "Batas terlampaui." },
    });

    const hasil = await nilaiLokerAction("job-1");

    expect(hasil).toMatchObject({ ok: false, pesan: "Batas terlampaui." });
    // Panggilan mahal tidak boleh terjadi: membatasi setelah provider dipanggil
    // tetap membakar biaya dan kuota.
    expect(mocks.evaluasiLoker).not.toHaveBeenCalled();
  });

  it("memeriksa pembatas setelah sesi dan sebelum membaca loker", async () => {
    mocks.cekBatasiAksi.mockResolvedValue({
      gagal: { pesan: "Batas terlampaui." },
    });

    await nilaiLokerAction("job-1");

    expect(mocks.getSession).toHaveBeenCalled();
    // Tanpa sesi tidak ada principal; membaca cache loker sebelum itu berarti
    // pemanggil anonim ikut menghabiskan jatah.
    expect(mocks.ambilLokerById).not.toHaveBeenCalled();
  });

  it("tidak memanggil pembatas untuk pemanggil anonim", async () => {
    mocks.getSession.mockResolvedValue(null);

    const hasil = await nilaiLokerAction("job-1");

    expect(hasil).toMatchObject({ ok: false, pesan: "Sesi tidak ditemukan." });
    // Menghitung request anonim akan memakai kunci tanpa principal dan, pada
    // pola lain, bisa menaruh semua anonim di satu bucket.
    expect(mocks.cekBatasiAksi).not.toHaveBeenCalled();
    expect(mocks.evaluasiLoker).not.toHaveBeenCalled();
  });

  it("tetap mengevaluasi saat pembatas mengizinkan", async () => {
    const hasil = await nilaiLokerAction("job-1");

    expect(mocks.evaluasiLoker).toHaveBeenCalledWith(LOKER, { nama: "Raka" });
    expect(hasil).toMatchObject({ ok: true });
  });

  it("tidak mengirim loker yang ditolak ke provider", async () => {
    mocks.ambilLokerById.mockResolvedValue({ id: "job-1", sentinel_status: "rejected" });

    const hasil = await nilaiLokerAction("job-1");

    expect(hasil).toMatchObject({ ok: false });
    expect(mocks.evaluasiLoker).not.toHaveBeenCalled();
  });
});
