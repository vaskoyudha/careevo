import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  ambilRun: vi.fn(),
  catatKejadianRun: vi.fn(),
  listRun: vi.fn(),
  listEventRun: vi.fn(),
}));

vi.mock("./repository", () => ({
  ambilRun: mocks.ambilRun,
  catatKejadianRun: mocks.catatKejadianRun,
  akhiriRun: vi.fn(),
  ambilEnrollmentById: vi.fn(),
  ambilRunAktif: vi.fn(),
  buatRun: vi.fn(),
  listRun: mocks.listRun,
  listEventRun: mocks.listEventRun,
}));

vi.mock("./session", () => ({
  BATAS_SESI_BAWAAN_MENIT: 30,
  buktiBaru: vi.fn(() => "bukti"),
  verifikasiBuktiSesi: vi.fn(),
}));

import { catatKejadianDb, petaKameraMulaiPemilik } from "./run-service";

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

/**
 * `petaKameraMulaiPemilik` — peta yang laporan belajar pakai untuk menyatakan
 * arti "terverifikasi".
 *
 * Yang dipatok di sini adalah properti yang guard `security.test.ts` **tidak
 * bisa** lihat: guard itu memindai tiga berkas halaman, jadi tidak pernah
 * membaca filter pemilik di dalam accessor. Tanpa test di sini, menghapus
 * `.filter((r) => r.userId === userId)` adalah edisi satu token yang lolos
 * seluruh suite — padahal `listRunStaf()` tanpa gate, jadi peta peserta lain
 * akan ikut terbaca di halaman satu peserta.
 */
describe("petaKameraMulaiPemilik", () => {
  const OWNER = "u1";
  const LAIN = "u2";

  function run(id: string, partial: { userId?: string; state?: string } = {}) {
    return { id, userId: partial.userId ?? OWNER, state: partial.state ?? "active" };
  }

  function kejadian(kind: string) {
    return { id: "e", learningRunId: "r", kind, sequence: 1, occurredAt: null, payloadRedacted: null };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("tidak memuat run milik peserta lain", async () => {
    mocks.listRun.mockResolvedValue([run("r-milik", { userId: LAIN })]);
    mocks.listEventRun.mockResolvedValue([kejadian("kamera_mulai")]);

    const peta = await petaKameraMulaiPemilik(OWNER);

    expect(peta.has("r-milik")).toBe(false);
    // Bukan sekadar tidak masuk peta: run milik orang lain juga tidak boleh
    // dibaca, jadi tidak ada yang bisa bocor lewat peta maupun lewat query.
    expect(mocks.listEventRun).not.toHaveBeenCalled();
  });

  it("memuat run yang ditutup dan kedaluwarsa, bukan hanya run aktif", async () => {
    // Peta sengaja **tidak** memfilter `state`. `jalurDariBukti` memakai
    // keanggotaan kunci untuk membedakan "run ini tidak punya `kamera_mulai`"
    // dari "run ini tidak bisa saya telusuri", jadi run yang sudah tertutup pun
    // harus tetap bisa ditelusuri. Penghematannya yang nanti menyaring ke run
    // aktif akan membuat modul yang sebenarnya bisa ditelusuri tampil sebagai
    // `terverifikasi_tanpa_bukti_kamera` — kalimat yang terbaca seperti temuan
    // tentang orangnya, bukan seperti data yang tidak ada.
    mocks.listRun.mockResolvedValue([
      run("r-aktif"),
      run("r-ditutup", { state: "completed" }),
      run("r-kedaluwarsa", { state: "expired" }),
    ]);
    mocks.listEventRun.mockResolvedValue([]);

    const peta = await petaKameraMulaiPemilik(OWNER);

    expect([...peta.keys()].sort()).toEqual(["r-aktif", "r-ditutup", "r-kedaluwarsa"]);
  });

  it("menandai true hanya run yang punya kejadian kamera_mulai", async () => {
    mocks.listRun.mockResolvedValue([run("r-kamera"), run("r-tanpa")]);
    mocks.listEventRun.mockImplementation(async (id: string) =>
      id === "r-kamera" ? [kejadian("kamera_mulai")] : [kejadian("sesi_dimulai")],
    );

    const peta = await petaKameraMulaiPemilik(OWNER);

    expect(peta.get("r-kamera")).toBe(true);
    // Run yang punya catatan lain bukan berarti kamera tercatat menyala: yang
    // dipatok adalah keberadaan `kamera_mulai`, bukan "ada isi".
    expect(peta.get("r-tanpa")).toBe(false);
  });

  it("peserta tanpa run memberi peta kosong, bukan error", async () => {
    mocks.listRun.mockResolvedValue([]);

    expect(await petaKameraMulaiPemilik(OWNER)).toEqual(new Map());
    expect(mocks.listEventRun).not.toHaveBeenCalled();
  });
});
