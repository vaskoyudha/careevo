import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Seed sesi reader — diuji dengan service-nya di-mock.
 *
 * Yang dikunci di sini adalah **fail-closed**: run yang kedaluwarsa atau tidak
 * aktif tidak boleh menghasilkan bukti. Kalau reader menandatangani bukti untuk
 * run mati, gerbang sesi di UI terbuka padahal server akan menolak
 * penyelesaiannya — peserta melihat modul yang "bisa diselesaikan" lalu ditolak.
 *
 * Yang **tidak** di-mock: `./session`. Bukti diperiksa dengan
 * `verifikasiBuktiSesi` yang asli, sehingga kolom `owner` yang ditandatangani
 * benar-benar diuji, bukan sekadar keberadaan token.
 */

const mocks = vi.hoisted(() => ({
  ambilRunAktif: vi.fn(),
  kedaluwarsaDb: vi.fn(),
  listEventRun: vi.fn(),
}));

vi.mock("./repository", () => ({
  ambilRunAktif: mocks.ambilRunAktif,
  listEventRun: mocks.listEventRun,
}));
vi.mock("./run-service", () => ({ kedaluwarsaDb: mocks.kedaluwarsaDb }));

import { sesiReaderAwal } from "./reader-sesi";
import { verifikasiBuktiSesi } from "./session";

function run(over: Record<string, unknown> = {}) {
  return {
    id: "run-1",
    userId: "u-1",
    courseId: "crs-1",
    integrityVersion: 1,
    state: "active",
    startedAt: new Date("2026-09-30T00:00:00.000Z"),
    ...over,
  };
}

/** Baris `learning_events` yang dikembalikan `listEventRun` yang di-mock. */
function event(over: Record<string, unknown> = {}) {
  return {
    id: "ev-1",
    learningRunId: "run-1",
    kind: "sesi_dimulai",
    sequence: 1,
    occurredAt: new Date("2026-09-30T00:01:00.000Z"),
    payloadRedacted: null,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SESSION_SECRET = "test-secret-yang-cukup-panjang-untuk-hmac";
});

describe("sesiReaderAwal", () => {
  it("mengembalikan bukti + runId untuk run aktif yang belum kedaluwarsa", async () => {
    mocks.ambilRunAktif.mockResolvedValue(run());
    mocks.kedaluwarsaDb.mockReturnValue(false);

    mocks.listEventRun.mockResolvedValue([
      event({ kind: "sesi_dimulai", sequence: 2 }),
      event({ kind: "kamera_gagal", sequence: 3, payloadRedacted: { visibilitas: null } }),
    ]);

    const hasil = await sesiReaderAwal({ userId: "u-1", courseId: "crs-1", policyVersion: 1 });

    expect(hasil).not.toBeNull();
    expect(hasil?.runId).toBe("run-1");
    // Bukti harus token bertanda tangan, bukan string kosong.
    expect(hasil?.bukti).toContain(".");
    expect(hasil?.mulaiAt).toBe("2026-09-30T00:00:00.000Z");
    // Kejadian ikut di-seed (spec §3.2): tanpa ini `KejadianPanel` mulai kosong
    // setelah muat ulang dan melaporkan "0 celah" untuk run yang sudah punya
    // celah. `kamera_gagal` diklasifikasi celah; `sesi_dimulai` kejadian biasa.
    expect(hasil?.kejadian).toEqual([
      {
        at: "2026-09-30T00:01:00.000Z",
        jenis: "sesi_dimulai",
        jenis_klasifikasi: "kejadian",
        visibilitas: null,
      },
      {
        at: "2026-09-30T00:01:00.000Z",
        jenis: "kamera_gagal",
        jenis_klasifikasi: "celah",
        visibilitas: null,
      },
    ]);

    /**
     * Bukti harus **terbuka** untuk pemiliknya, dan hanya itu.
     *
     * `toContain(".")` saja tidak menjaga apa pun: ia hijau selama tokennya ada,
     * termasuk saat tanda tangannya dihitung untuk kolom yang salah. Yang
     * di-round-trip di sini adalah modul `./session` **asli** (hanya
     * `./repository` dan `./run-service` yang di-mock), jadi tanda tangan di
     * dalam `bukti` dihitung kode produksi, bukan oleh tes. Properti normalisasi
     * kolom `owner` sendiri diuji di tes berikutnya; di sini yang dikunci adalah
     * kolom-kolom lain ikut tanda tangan.
     */
    expect(
      verifikasiBuktiSesi(hasil!.bukti, { courseId: "crs-1", owner: "u-1", policyVersion: 1 }),
    ).not.toBeNull();
    expect(
      verifikasiBuktiSesi(hasil!.bukti, { courseId: "crs-1", owner: "u-2", policyVersion: 1 }),
    ).toBeNull();
    expect(
      verifikasiBuktiSesi(hasil!.bukti, { courseId: "crs-2", owner: "u-1", policyVersion: 1 }),
    ).toBeNull();
    expect(
      verifikasiBuktiSesi(hasil!.bukti, { courseId: "crs-1", owner: "u-1", policyVersion: 2 }),
    ).toBeNull();
  });

  it("menormalkan kolom `owner` bukti ke huruf kecil tanpa spasi tepi", async () => {
    /**
     * Aturan yang diklaim doc block `reader-sesi.ts:27-30`: `owner` di dalam
     * token adalah `users.id` yang di-lowercase — definisi yang sama dengan
     * `pemilikBukti` di `run-service.ts:69`, yang **tidak diekspor** (dan
     * `akses.ts` tidak boleh disentuh, jadi ia tidak bisa diimpor untuk
     * dibandingkan). Kalau salah satu sisi berubah tanpa yang lain,
     * `verifikasiBuktiSesi` mengembalikan `null` untuk token yang sah — gerbang
     * sesi menutup padahal sesinya masih berjalan. Itu justru kegagalan yang
     * keberadaannya membuat `sesiReaderAwal` ada.
     *
     * `userId` sengaja bermasalah bentuknya (huruf besar + spasi tepi) supaya
     * tes ini **bisa** gagal: dengan `u-1` yang sudah ternormalisasi, menghapus
     * `.trim().toLowerCase()` tidak mengubah apa pun dan assertion-nya hijau
     * tanpa membuktikan apa pun.
     */
    mocks.ambilRunAktif.mockResolvedValue(run());
    mocks.kedaluwarsaDb.mockReturnValue(false);
    mocks.listEventRun.mockResolvedValue([]);

    const hasil = await sesiReaderAwal({ userId: "  U-1  ", courseId: "crs-1", policyVersion: 1 });
    expect(hasil).not.toBeNull();

    // Terbuka untuk pemilik yang dinormalkan — inilah yang merah kalau
    // normalisasinya hilang (tokennya lalu memuat "  U-1  " mentah).
    expect(
      verifikasiBuktiSesi(hasil!.bukti, { courseId: "crs-1", owner: "u-1", policyVersion: 1 }),
    ).not.toBeNull();
    // Dan tertutup untuk pemilik yang hurufnya berbeda: normalisasi bukan
    // pencocokan yang longgar, hanya kolom yang ditandatangani.
    expect(
      verifikasiBuktiSesi(hasil!.bukti, { courseId: "crs-1", owner: "U-1", policyVersion: 1 }),
    ).toBeNull();
  });

  it("mengembalikan null saat tidak ada run aktif", async () => {
    mocks.ambilRunAktif.mockResolvedValue(null);
    expect(await sesiReaderAwal({ userId: "u-1", courseId: "crs-1", policyVersion: 1 })).toBeNull();
    // Run yang tidak ada tidak boleh diuji kedaluwarsanya, dan tidak boleh
    // menghasilkan satu pun bacaan event (biaya sia-sia pada jalur tersering).
    expect(mocks.kedaluwarsaDb).not.toHaveBeenCalled();
    expect(mocks.listEventRun).not.toHaveBeenCalled();
  });

  it("mengembalikan null saat run sudah kedaluwarsa", async () => {
    mocks.ambilRunAktif.mockResolvedValue(run());
    mocks.kedaluwarsaDb.mockReturnValue(true);
    expect(await sesiReaderAwal({ userId: "u-1", courseId: "crs-1", policyVersion: 1 })).toBeNull();
    // Run kedaluwarsa tidak boleh dibaca event-nya: gagal-tertutup di atas
    // menolak sebelum bacaan apa pun.
    expect(mocks.listEventRun).not.toHaveBeenCalled();
  });

  it("mengembalikan null saat policyVersion run berbeda dari kebijakan sekarang", async () => {
    // Kebijakan yang naik versi membatalkan bukti lama. Menandatangani ulang
    // dengan versi baru untuk run versi lama akan membuat server menolaknya
    // (`buktikanSesiDb` membandingkan `integrityVersion`), jadi lebih baik
    // jujur tidak ada sesi.
    mocks.ambilRunAktif.mockResolvedValue(run({ integrityVersion: 1 }));
    mocks.kedaluwarsaDb.mockReturnValue(false);
    expect(await sesiReaderAwal({ userId: "u-1", courseId: "crs-1", policyVersion: 2 })).toBeNull();
    expect(mocks.listEventRun).not.toHaveBeenCalled();
  });
});
