import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  ambilRun: vi.fn(),
  catatKejadianRun: vi.fn(),
}));

vi.mock("./repository", () => ({
  ambilRun: mocks.ambilRun,
  catatKejadianRun: mocks.catatKejadianRun,
  akhiriRun: vi.fn(),
  ambilEnrollmentById: vi.fn(),
  ambilRunAktif: vi.fn(),
  buatRun: vi.fn(),
  listRun: vi.fn(),
}));

vi.mock("./session", () => ({
  BATAS_SESI_BAWAAN_MENIT: 30,
  buktiBaru: vi.fn(() => "bukti"),
  verifikasiBuktiSesi: vi.fn(),
}));

import { catatKejadianDb } from "./run-service";

const PRINCIPAL = { userId: "u1", email: "a@x.test", nama: "A" } as never;

describe("catatKejadianDb dengan sinyal browser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ambilRun.mockResolvedValue({ id: "r1", userId: "u1", state: "active" });
    mocks.catatKejadianRun.mockReturnValue({ id: "e1" });
  });

  it("membawa asal sinyal ke dalam payload", () => {
    return catatKejadianDb({
      principal: PRINCIPAL,
      runId: "r1",
      jenis: "paste_massal",
      visibilitas: "visible",
      detail: "400 karakter, jeda 30s",
      asal: "browser",
    }).then(() => {
      const p = mocks.catatKejadianRun.mock.calls[0][0].payloadRedacted;
      expect(p.asal).toBe("browser");
    });
  });

  it("memakai asal yang dihitung server bila klien tidak mengirim", () => {
    // `asal` dari klien tidak dipercaya penuh: ia hanya boleh membatasi nilai
    // ke empat asal yang sah, dan `server` adalah nilai gagal-tertutup yang
    // tidak menuduh.
    return catatKejadianDb({
      principal: PRINCIPAL,
      runId: "r1",
      jenis: "pindah_tab",
      visibilitas: "hidden",
    }).then(() => {
      const p = mocks.catatKejadianRun.mock.calls[0][0].payloadRedacted;
      expect(p.asal).toBe("server");
    });
  });

  it("menolak asal yang tidak dikenal dan memaksa ke server", () => {
    return catatKejadianDb({
      principal: PRINCIPAL,
      runId: "r1",
      jenis: "pindah_tab",
      visibilitas: "hidden",
      asal: "injeksi" as never,
    }).then(() => {
      const p = mocks.catatKejadianRun.mock.calls[0][0].payloadRedacted;
      expect(p.asal).toBe("server");
    });
  });
});
