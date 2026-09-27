import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  catatPelanggaran: vi.fn(),
  listPelanggaranAktif: vi.fn(),
  listPelanggaranCourse: vi.fn(),
  listSemuaPelanggaran: vi.fn(),
  pulihkanPelanggaran: vi.fn(),
  pulihkanSemuaPelanggaranCourse: vi.fn(),
  ambilEnrollment: vi.fn(),
  ambilRolesAktif: vi.fn(),
  transaksi: vi.fn(),
  catatAudit: vi.fn(),
}));

/**
 * Transaksi palsu: `fn(tx)` dijalankan dengan objek yang punya `insert` rantai.
 * `audit` ikut memakai API yang sama, jadi tanpa `insert` di sini test gagal di
 * `tx.insert is not a function` — bukan di assertion yang menguji perilaku.
 */
function transaksiPalsu(): (fn: (tx: unknown) => unknown) => Promise<unknown> {
  return async (fn: (tx: unknown) => unknown) =>
    fn({ insert: () => ({ values: () => ({}) }) });
}

vi.mock("./repository", () => ({
  catatPelanggaran: mocks.catatPelanggaran,
  listPelanggaranAktif: mocks.listPelanggaranAktif,
  listPelanggaranCourse: mocks.listPelanggaranCourse,
  listSemuaPelanggaran: mocks.listSemuaPelanggaran,
  pulihkanPelanggaran: mocks.pulihkanPelanggaran,
  pulihkanSemuaPelanggaranCourse: mocks.pulihkanSemuaPelanggaranCourse,
}));

vi.mock("@/lib/db/client", () => ({
  getDb: () => ({ transaction: mocks.transaksi }),
  denganTransaksi: mocks.transaksi,
}));

vi.mock("@/lib/learning/repository", () => ({
  ambilEnrollment: mocks.ambilEnrollment,
}));

vi.mock("@/lib/auth/identity-repository", () => ({
  ambilRolesAktif: mocks.ambilRolesAktif,
}));

import {
  catatPelanggaranDb,
  pulihkanPelanggaranDb,
  ringkasanPelanggaranCourseDb,
  skorIntegritasDb,
} from "./service";

const STAF = {
  userId: "u-staf",
  email: "staf@careevo.test",
  nama: "Verifikator",
  username: "verifikator",
  roles: ["verifikator"],
  role: "verifikator",
  iat: 0,
} as never;

const PESERTA = {
  userId: "u-peserta",
  email: "peserta@careevo.test",
  nama: "Peserta",
  username: "peserta",
  roles: ["user"],
  role: "user",
  iat: 0,
} as never;

describe("catatPelanggaranDb — gerbang staf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaksi.mockImplementation(transaksiPalsu());
    mocks.catatPelanggaran.mockResolvedValue({
      id: "v1",
      userId: "u-peserta",
      courseId: "c1",
      kind: "pola_salin_tempel",
      penalty: 10,
      reason: "asal",
      status: "active",
    });
    mocks.ambilEnrollment.mockResolvedValue({
      id: "e1",
      userId: "u-peserta",
      courseId: "c1",
    });
    // Default: role dari database masih berlaku. Test yang butuh role dicabut
    // menimpanya sendiri, supaya "gagal baca" tidak tersamar jadi "gagal gate".
    mocks.ambilRolesAktif.mockResolvedValue(["verifikator"]);
  });

  it("menolak peserta biasa", async () => {
    // Tanpa gerbang ini, siapa pun yang punya sesi bisa menurunkan skor orang
    // lain hanya dengan memanggil action. Penegakannya di server, bukan di UI.
    await expect(
      catatPelanggaranDb({
        principal: PESERTA,
        userId: "u-peserta",
        courseId: "c1",
        kind: "plagiarisme",
        reason: "saya saja yang menuduh",
      }),
    ).rejects.toThrow(/akses/i);
    expect(mocks.catatPelanggaran).not.toHaveBeenCalled();
  });

  it("menolak admin yang tidak ada di daftar roles", async () => {
    // `role` (adapter kompatibilitas) tidak boleh jadi pintu masuk baru:
    // kalau ia cukup, pencabutan role tidak berlaku sampai cookie kedaluwarsa.
    const palsu = { ...(STAF as object), roles: ["user"], role: "admin" };
    await expect(
      catatPelanggaranDb({
        principal: palsu as never,
        userId: "u-peserta",
        courseId: "c1",
        kind: "plagiarisme",
        reason: "x",
      }),
    ).rejects.toThrow(/akses/i);
  });

  it("menerima verifikator", async () => {
    const hasil = await catatPelanggaranDb({
      principal: STAF,
      userId: "u-peserta",
      courseId: "c1",
      kind: "pola_salin_tempel",
      reason: "Menempel 400 karakter saat asesmen modul 3.",
    });
    expect(hasil.id).toBe("v1");
    expect(mocks.catatPelanggaran).toHaveBeenCalledTimes(1);
  });
});

describe("catatPelanggaranDb — Snapshot penalti", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaksi.mockImplementation(transaksiPalsu());
    mocks.catatPelanggaran.mockResolvedValue({ id: "v1" });
    mocks.ambilEnrollment.mockResolvedValue({ id: "e1", userId: "u-peserta", courseId: "c1" });
    mocks.ambilRolesAktif.mockResolvedValue(["verifikator"]);
  });

  it("menyalin bobot dari katalog, bukan menerima dari klien", async () => {
    // Klien tidak pernah menentukan besar penalti. Kalau `penalty` diterima dari
    // FormData, reviewer bisa memilih 1 dan membuat skor tidak berarti apa-apa.
    await catatPelanggaranDb({
      principal: STAF,
      userId: "u-peserta",
      courseId: "c1",
      kind: "plagiarisme",
      reason: "asal",
    });
    const arg = mocks.catatPelanggaran.mock.calls[0]![1] as { penalty: number; kind: string };
    expect(arg.penalty).toBe(20);
    expect(arg.kind).toBe("plagiarisme");
  });

  it("menolak jenis yang tidak ada di katalog", async () => {
    await expect(
      catatPelanggaranDb({
        principal: STAF,
        userId: "u-peserta",
        courseId: "c1",
        kind: "maling" as never,
        reason: "x",
      }),
    ).rejects.toThrow();
    expect(mocks.catatPelanggaran).not.toHaveBeenCalled();
  });

  it("menolak alasan kosong", async () => {
    await expect(
      catatPelanggaranDb({
        principal: STAF,
        userId: "u-peserta",
        courseId: "c1",
        kind: "plagiarisme",
        reason: "   ",
      }),
    ).rejects.toThrow();
    expect(mocks.catatPelanggaran).not.toHaveBeenCalled();
  });

  it("menolak pencatatan di course yang tidak dimiliki peserta", async () => {
    // Enrollment milik orang lain berarti yang diminta tidak boleh ditandai.
    // Tanpa cek ini, pengalihan id bisa menempelkan pelanggaran ke akun yang
    // benar tapi course yang salah.
    mocks.ambilEnrollment.mockResolvedValue({
      id: "e9",
      userId: "u-orang",
      courseId: "c1",
    });
    await expect(
      catatPelanggaranDb({
        principal: STAF,
        userId: "u-peserta",
        courseId: "c1",
        kind: "plagiarisme",
        reason: "x",
      }),
    ).rejects.toThrow();
  });

  it("menyaring bukti sebelum menyimpan", async () => {
    // `evidence_redacted` bisa memuat id run dan kunci Private; penyaringan
    // memakai helper yang sama dengan audit supaya tidak ada definisi kedua.
    await catatPelanggaranDb({
      principal: STAF,
      userId: "u-peserta",
      courseId: "c1",
      kind: "pola_salin_tempel",
      reason: "asal",
      bukti: { run_id: "r1", token: "rahasia-yang-tidak-boleh-disimpan" },
    });
    const arg = mocks.catatPelanggaran.mock.calls[0]![1] as { evidenceRedacted: unknown };
    expect(arg.evidenceRedacted).toEqual({ run_id: "r1" });
  });
});

describe("skorIntegritasDb", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("menghitung skor dari pelanggaran aktif saja", async () => {
    mocks.listPelanggaranAktif.mockResolvedValue([
      { id: "a", courseId: "c1", penalty: 5, status: "active" },
      { id: "b", courseId: "c2", penalty: 20, status: "active" },
    ]);
    const hasil = await skorIntegritasDb("u-peserta");
    expect(hasil.skor).toBe(75);
    expect(hasil.jumlahAktif).toBe(2);
  });

  it("memberi 100 untuk akun tanpa pelanggaran", async () => {
    mocks.listPelanggaranAktif.mockResolvedValue([]);
    const hasil = await skorIntegritasDb("u-peserta");
    expect(hasil.skor).toBe(100);
  });
});

describe("ringkasanPelanggaranCourseDb", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("menghasilkan satu baris per jenis katalog, termasuk yang nol", async () => {
    // Katalog yang utuh, bukan hanya yang punya data: kalau tabel report hanya
    // menampilkan yang tercatat, peserta tidak bisa melihat apa yang *tidak*
    // ada — dan "0" adalah informasi, bukan kekosongan.
    mocks.listPelanggaranCourse.mockResolvedValue([
      { id: "a", courseId: "c1", kind: "meninggalkan_sesi", penalty: 5, status: "active" },
      {
        id: "b",
        courseId: "c1",
        kind: "meninggalkan_sesi",
        penalty: 5,
        status: "expunged",
      },
    ]);
    const hasil = await ringkasanPelanggaranCourseDb("u-peserta", "c1");
    const totalBaris = hasil.reduce((n, b) => n + b.jumlah, 0);
    // Dua baris tercatat untuk `meninggalkan_sesi`, satu sudah dipulihkan.
    expect(hasil.find((b) => b.jenis === "meninggalkan_sesi")).toMatchObject({
      jumlah: 2,
      jumlahAktif: 1,
      jumlahDipulihkan: 1,
    });
    // Katalog utuh: `plagiarisme` tetap punya baris, jumlahnya nol.
    expect(hasil.find((b) => b.jenis === "plagiarisme")?.jumlah).toBe(0);
    expect(totalBaris).toBe(2);
  });

  it("menandai baris katalog yang tidak punya data sebagai kosong", async () => {
    mocks.listPelanggaranCourse.mockResolvedValue([]);
    const hasil = await ringkasanPelanggaranCourseDb("u-peserta", "c1");
    for (const b of hasil) {
      expect(b.jumlah).toBe(0);
      expect(b.jumlahAktif).toBe(0);
    }
  });
});

describe("pulihkanPelanggaranDb", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaksi.mockImplementation(transaksiPalsu());
  });

  it("menolak peserta biasa", async () => {
    await expect(
      pulihkanPelanggaranDb({ principal: PESERTA, id: "v1", alasan: "saya mau balikin" }),
    ).rejects.toThrow(/akses/i);
  });

  it("menerima staf dan menyimpan alasan pemulihan", async () => {
    mocks.pulihkanPelanggaran.mockResolvedValue({ id: "v1", status: "expunged" });
    await pulihkanPelanggaranDb({
      principal: STAF,
      id: "v1",
      alasan: "Revisi coursework: bukti salin-tempel terjadi sebelum kebijakan baru.",
    });
    const arg = mocks.pulihkanPelanggaran.mock.calls[0]![1] as { alasan: string };
    expect(arg.alasan).toContain("kebijakan baru");
  });
});

