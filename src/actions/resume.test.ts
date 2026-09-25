import { beforeEach, describe, expect, it, vi } from "vitest";
import { unggahBerkasAction } from "./resume";
import type { SessionPayload } from "@/lib/auth/types";
import type { Resume } from "@/lib/resume/types";

/**
 * Adversarial tests for the resume PDF upload action.
 *
 * Reading `file.arrayBuffer()` is the expensive step, so the rate limit has to
 * run before it. The principal is the session email (never the submitted slot or
 * filename), which is what stops a caller from rotating IPs to escape the limit.
 */

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  cekBatasiAksi: vi.fn(),
  ambilResume: vi.fn(),
  simpanResume: vi.fn(),
  simpanBerkas: vi.fn(),
  hapusBerkas: vi.fn(),
  validasiBerkas: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/rate-limit/next", () => ({ cekBatasiAksi: mocks.cekBatasiAksi }));
vi.mock("@/lib/resume/store", () => ({
  ambilResume: mocks.ambilResume,
  simpanResume: mocks.simpanResume,
  simpanBerkas: mocks.simpanBerkas,
  hapusBerkas: mocks.hapusBerkas,
}));
vi.mock("@/lib/resume/types", async (importAsli) => {
  const asli = await importAsli<typeof import("@/lib/resume/types")>();
  return { ...asli, validasiBerkas: mocks.validasiBerkas };
});
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

const SESSION = {
  email: "raka@careevo.test",
  nama: "Raka Pratama",
  username: "raka",
  role: "user",
  iat: 1_800_000_000,
} satisfies SessionPayload;

const RESUME = {
  owner: SESSION.email,
  username: "raka",
  headline: "",
  ringkasan: "",
  kontak: {},
  pengalaman: [],
  proyek: [],
  pendidikan: [],
  skill: [],
  sertifikasi: [],
  berkas: { cv: null, portofolio: null },
} as unknown as Resume;

/** A body that throws if read — proves the handler short-circuited first. */
function berkasTerlarang(): File {
  const file = new File([new Uint8Array([1])], "cv.pdf", { type: "application/pdf" });
  Object.defineProperty(file, "arrayBuffer", {
    value: () => {
      throw new Error("body tidak boleh dibaca");
    },
  });
  return file;
}

/** A normal readable PDF stand-in for the paths that must proceed. */
function berkasBiasa(): File {
  return new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])], "cv.pdf", {
    type: "application/pdf",
  });
}

function form(slot = "cv", berkas: File = berkasBiasa()): FormData {
  const data = new FormData();
  data.set("slot", slot);
  data.set("file", berkas);
  return data;
}

function formTerlarang(slot = "cv"): FormData {
  return form(slot, berkasTerlarang());
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue(SESSION);
  mocks.ambilResume.mockResolvedValue(RESUME);
  mocks.cekBatasiAksi.mockResolvedValue(null);
  mocks.validasiBerkas.mockReturnValue({ ok: true });
});

describe("unggahBerkasAction", () => {
  it("memakai email sesi sebagai principal", async () => {
    mocks.simpanBerkas.mockResolvedValue({ nama: "cv.pdf" });

    const hasil = await unggahBerkasAction({ ok: false }, form());

    expect(mocks.cekBatasiAksi).toHaveBeenCalledWith("unggahResume", {
      principal: SESSION.email,
    });
    expect(hasil.ok).toBe(true);
  });

  it("menolak tanpa membaca body saat dibatasi", async () => {
    mocks.cekBatasiAksi.mockResolvedValue({
      gagal: { pesan: "Batas terlampaui." },
    });

    // `berkasTerlarang()` melempar bila `arrayBuffer()` dipanggil, jadi lolosnya
    // test ini membuktikan body tidak pernah dibaca.
    const hasil = await unggahBerkasAction({ ok: false }, formTerlarang());

    expect(hasil).toMatchObject({ ok: false, message: "Batas terlampaui." });
    expect(mocks.validasiBerkas).not.toHaveBeenCalled();
    expect(mocks.simpanBerkas).not.toHaveBeenCalled();
    expect(mocks.simpanResume).not.toHaveBeenCalled();
  });

  it("tidak memanggil pembatas saat sesi tidak ada", async () => {
    mocks.getSession.mockResolvedValue(null);

    const hasil = await unggahBerkasAction({ ok: false }, formTerlarang());

    expect(hasil).toMatchObject({ ok: false, message: "Sesi berakhir. Masuk ulang dulu." });
    expect(mocks.cekBatasiAksi).not.toHaveBeenCalled();
    expect(mocks.validasiBerkas).not.toHaveBeenCalled();
  });

  it("tetap memvalidasi berkas saat pembatas mengizinkan", async () => {
    mocks.validasiBerkas.mockReturnValue({ ok: false, pesan: "Bukan PDF." });

    const hasil = await unggahBerkasAction({ ok: false }, form());

    expect(hasil).toMatchObject({ ok: false, message: "Bukan PDF." });
    expect(mocks.validasiBerkas).toHaveBeenCalled();
    expect(mocks.simpanBerkas).not.toHaveBeenCalled();
  });
});
