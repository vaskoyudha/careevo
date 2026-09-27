import { describe, expect, it } from "vitest";
import { hitungJejak, jedaSnapshot, type SnapshotProses } from "./proses";
import type { RingkasanBerkas } from "./snapshot";

/** Ringkasan snapshot dari pasangan `path:ukuran`, tanpa `terpotong`. */
function snap(at: string, berkas: Array<[string, number]>): SnapshotProses {
  return {
    at,
    ringkasan: {
      berkas: berkas.map(([path, ukuran]) => ({ path, ukuran })),
      terpotong: false,
      total: berkas.length,
    } satisfies RingkasanBerkas,
  };
}

describe("hitungJejak", () => {
  it("tanpa snapshot menghasilkan jejak kosong", () => {
    const hasil = hitungJejak([]);
    expect(hasil).toEqual({ jejak: [], observasi: 0, hilang: 0, adaTerpotong: false });
  });

  it("satu snapshot: satu kemunculan, tanpa perubahan", () => {
    const hasil = hitungJejak([snap("2026-10-03T10:00:00.000Z", [["src/main.cpp", 120]])]);
    expect(hasil.observasi).toBe(1);
    expect(hasil.jejak).toHaveLength(1);
    expect(hasil.jejak[0]).toMatchObject({
      path: "src/main.cpp",
      ukuranAwal: 120,
      ukuranAkhir: 120,
      perubahan: 0,
      kemunculan: 1,
      hilang: false,
    });
  });

  it("menghitung perubahan hanya saat ukuran benar-benar berbeda", () => {
    // Ukuran sama antar observasi bukan "perubahan": berkasnya tidak berubah.
    const hasil = hitungJejak([
      snap("2026-10-03T10:00:00.000Z", [["a.cpp", 100]]),
      snap("2026-10-03T10:05:00.000Z", [["a.cpp", 100]]),
      snap("2026-10-03T10:10:00.000Z", [["a.cpp", 180]]),
      snap("2026-10-03T10:15:00.000Z", [["a.cpp", 180]]),
    ]);
    expect(hasil.jejak[0]!.perubahan).toBe(1);
    expect(hasil.jejak[0]!.kemunculan).toBe(4);
    expect(hasil.jejak[0]!.ukuranAwal).toBe(100);
    expect(hasil.jejak[0]!.ukuranAkhir).toBe(180);
  });

  it("mengurutkan snapshot sendiri sebelum menghitung", () => {
    // Pemanggilnya kode server; urutan pemanggilan tidak dijamin. Jejak yang
    // tersusun salah akan melaporkan perubahan yang tidak pernah terjadi.
    const naik = hitungJejak([
      snap("2026-10-03T10:00:00.000Z", [["a.cpp", 100]]),
      snap("2026-10-03T10:05:00.000Z", [["a.cpp", 300]]),
    ]);
    const turun = hitungJejak([
      snap("2026-10-03T10:05:00.000Z", [["a.cpp", 300]]),
      snap("2026-10-03T10:00:00.000Z", [["a.cpp", 100]]),
    ]);
    expect(turun).toEqual(naik);
    expect(naik.jejak[0]!.perubahan).toBe(1);
  });

  it("mengabaikan snapshot yang waktunya tidak terbaca", () => {
    const hasil = hitungJejak([
      snap("bukan-waktu", [["a.cpp", 999]]),
      snap("2026-10-03T10:00:00.000Z", [["a.cpp", 100]]),
    ]);
    // Snapshot buruk tidak dihitung, dan tidak menggeser apa pun.
    expect(hasil.observasi).toBe(1);
    expect(hasil.jejak[0]!.ukuranAwal).toBe(100);
  });

  it("menandai hilang hanya pada observasi terakhir", () => {
    // Snapshot tengah yang tidak memuat sebuah berkas lebih sering berarti
    // snapshot tidak lengkap daripada berkas yang dihapus.
    const hasil = hitungJejak([
      snap("2026-10-03T10:00:00.000Z", [["a.cpp", 100], ["b.cpp", 50]]),
      snap("2026-10-03T10:05:00.000Z", [["a.cpp", 120]]),
      snap("2026-10-03T10:10:00.000Z", [["a.cpp", 120]]),
    ]);
    const b = hasil.jejak.find((j) => j.path === "b.cpp")!;
    expect(b.hilang).toBe(true);
    expect(hasil.hilang).toBe(1);
    expect(hasil.jejak.find((j) => j.path === "a.cpp")!.hilang).toBe(false);
  });

  it("menyaddenyatakan berkasnya masih ada setelah sempat hilang", () => {
    const hasil = hitungJejak([
      snap("2026-10-03T10:00:00.000Z", [["a.cpp", 100]]),
      snap("2026-10-03T10:05:00.000Z", [["a.cpp", 120]]),
      snap("2026-10-03T10:10:00.000Z", [["a.cpp", 150]]),
    ]);
    expect(hasil.jejak[0]!.hilang).toBe(false);
    expect(hasil.jejak[0]!.perubahan).toBe(2);
    expect(hasil.hilang).toBe(0);
  });

  it("berkas dengan nama seperti prototipe tetap punya entri sendiri", () => {
    // `__proto__` dan `constructor` pada objek biasa akan mengambil entri
    // prototipe alih-alih creates entri baru.
    const hasil = hitungJejak([
      snap("2026-10-03T10:00:00.000Z", [
        ["__proto__", 10],
        ["constructor", 20],
        ["toString", 30],
      ]),
    ]);
    const paths = hasil.jejak.map((j) => j.path).sort();
    expect(paths).toEqual(["__proto__", "constructor", "toString"]);
    expect(hasil.jejak.find((j) => j.path === "__proto__")!.ukuranAwal).toBe(10);
  });

  it("menyatakan ada yang terpotong, jangan disembunyikan", () => {
    // Kalau ada berkas yang tidak masuk snapshot, perubahan pada berkas itu
    // tidak akan pernah terlihat. Jejak yang tampak lengkap adalah kebohongan.
    const terpotong: SnapshotProses = {
      at: "2026-10-03T10:00:00.000Z",
      ringkasan: { berkas: [{ path: "a.cpp", ukuran: 10 }], terpotong: true, total: 900 },
    };
    expect(hitungJejak([terpotong]).adaTerpotong).toBe(true);
    expect(hitungJejak([snap("2026-10-03T10:00:00.000Z", [["a.cpp", 10]])]).adaTerpotong).toBe(
      false,
    );
  });

  it("mengurutkan dari perubahan terbanyak, lalu path", () => {
    const hasil = hitungJejak([
      snap("2026-10-03T10:00:00.000Z", [
        ["b.cpp", 1],
        ["a.cpp", 1],
        ["c.cpp", 1],
      ]),
      snap("2026-10-03T10:05:00.000Z", [
        ["b.cpp", 2],
        ["a.cpp", 2],
        ["c.cpp", 9],
        ["c.cpp", 3],
      ]),
    ]);
    // c.cpp berubah sekali; a dan b tidak berubah sama sekali.
    expect(hasil.jejak.map((j) => j.path)).toEqual(["c.cpp", "a.cpp", "b.cpp"]);
  });

  it("deterministik untuk input yang sama", () => {
    const masukan = [
      snap("2026-10-03T10:05:00.000Z", [["a.cpp", 200]]),
      snap("2026-10-03T10:00:00.000Z", [["a.cpp", 100]]),
    ];
    expect(hitungJejak(masukan)).toEqual(hitungJejak(masukan));
  });
});

describe("jedaSnapshot", () => {
  it("menghitung jarak dalam detik, dari yang terlama", () => {
    const snapshots = [
      snap("2026-10-03T10:00:00.000Z", [["a", 1]]),
      snap("2026-10-03T10:01:00.000Z", [["a", 2]]),
      snap("2026-10-03T10:10:00.000Z", [["a", 3]]),
    ];
    // Jarak: 60 detik lalu 540 detik; yang terbesar lebih dulu.
    expect(jedaSnapshot(snapshots)).toEqual([540, 60]);
  });

  it("snapshot tunggal tidak punya jeda", () => {
    expect(jedaSnapshot([snap("2026-10-03T10:00:00.000Z", [["a", 1]])])).toEqual([]);
    expect(jedaSnapshot([])).toEqual([]);
  });

  it("waktu identik menghasilkan jeda nol, bukan jeda acak", () => {
    const snapshots = [
      snap("2026-10-03T10:00:00.000Z", [["a", 1]]),
      snap("2026-10-03T10:00:00.000Z", [["a", 2]]),
    ];
    expect(jedaSnapshot(snapshots)).toEqual([0]);
  });
});