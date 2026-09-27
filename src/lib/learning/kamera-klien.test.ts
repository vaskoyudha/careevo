import { describe, expect, it } from "vitest";
import {
  AMBANG_WAJAH_HILANG_DETIK,
  perluCatatWajahHilang,
  statusWajah,
} from "./kamera-klien";

describe("statusWajah", () => {
  it("membedakan tidak ada, satu, dan lebih dari satu", () => {
    expect(statusWajah(0)).toBe("tidak_ada");
    expect(statusWajah(1)).toBe("satu");
    expect(statusWajah(3)).toBe("lebih_dari_satu");
  });

  it("menganggap jumlah negatif tidak ada", () => {
    // Model kadang mengembalikan nilai di luar rentang; perlakukan sebagai
    // "tidak ada" agar tidak menciptakan `wajah_kedua` dari angka negatif.
    expect(statusWajah(-1)).toBe("tidak_ada");
  });

  it("menganggap nilai non-finite tidak ada", () => {
    // `NaN` dan `Infinity` tidak punya arti sebagai jumlah wajah. Keduanya
    // gagal-tertutup ke "tidak ada": angka yang tidak bisa dibaca tidak boleh
    // menciptakan `wajah_kedua` (atau `wajah_tidak_terdeteksi`) dari nilai
    // yang tidak pernah diukur.
    expect(statusWajah(Number.NaN)).toBe("tidak_ada");
    expect(statusWajah(Number.POSITIVE_INFINITY)).toBe("tidak_ada");
  });
});

describe("perluCatatWajahHilang", () => {
  const mulai = 1_000_000;

  it("tidak mencatat sebelum ambang 10 detik", () => {
    const sejakMs = mulai + (AMBANG_WAJAH_HILANG_DETIK - 1) * 1000;
    expect(perluCatatWajahHilang("tidak_ada", sejakMs, mulai)).toBeNull();
  });

  it("mencatat tepat di ambang dengan durasi dalam detik", () => {
    const sejakMs = mulai - AMBANG_WAJAH_HILANG_DETIK * 1000;
    const hasil = perluCatatWajahHilang("tidak_ada", sejakMs, mulai);
    expect(hasil).toEqual({ durasi_detik: AMBANG_WAJAH_HILANG_DETIK });
  });

  it("tidak mencatat ketika wajah ada", () => {
    const sejakMs = mulai - 60_000;
    expect(perluCatatWajahHilang("satu", sejakMs, mulai)).toBeNull();
  });

  it("tidak mencatat bila belum pernah ada wajah sama sekali", () => {
    // `null` = tidak tahu kapan wajah terakhir terlihat (mis. kamera baru
    // dinyalakan di tengah sesi). Mencatat durasi dari `null` akan mengarang
    // angka yang tidak pernah diukur.
    expect(perluCatatWajahHilang("tidak_ada", null, mulai)).toBeNull();
  });

  it("tidak mencatat apa pun saat jam melompat mundur", () => {
    // Koreksi sadar terhadap rencana: Step 1 rencana memakai kasus yang sama
    // (`sejakMs` 10 detik *di depan* `sekarang`) dan mengharapkan
    // `{ durasi_detik: 0 }` — sementara tes "tidak mencatat sebelum ambang"
    // di atas memakai 9 detik di depan dan mengharapkan `null`. Keduanya
    // tidak bisa benar bersamaan: selisih -9s → null tetapi -10s → 0 tidak
    // berasal dari satu aturan apa pun. Yang dipilih di sini adalah aturan
    // gagal-tertutup — durasi yang tidak bisa diukur tidak menjadi catatan,
    // karena "celah 0 detik" adalah temuan yang mengarang bukti.
    const sejakMs = mulai + 10_000;
    expect(perluCatatWajahHilang("tidak_ada", sejakMs, mulai)).toBeNull();
  });

  it("tidak mencatat `lebih_dari_satu` sebagai wajah hilang", () => {
    // Dua wajah bukan nol wajah: sinyalnya beda (`wajah_kedua`), dan
    // mencampurkannya membuat celah terhitung dari kehadiran orang.
    const sejakMs = mulai - 60_000;
    expect(perluCatatWajahHilang("lebih_dari_satu", sejakMs, mulai)).toBeNull();
  });
});
