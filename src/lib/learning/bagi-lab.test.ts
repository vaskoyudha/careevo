import { describe, expect, it } from "vitest";
import {
  BAGI_AWAL,
  bagiDariGeser,
  bagiDariPapanKetik,
  batasBagi,
  bacaBagi,
  kePersen,
  LANGKAH_PAPAN_KETIK,
  MIN_KANAN,
  MIN_KIRI,
} from "./bagi-lab";

/**
 * Matematika pembagi kolom lab.
 *
 * Diuji langsung karena tiga hal yang gampang salah dan tidak terlihat di layar:
 *
 * 1. **Penjepitan minimum.** Tanpa ini, menyeret pembagi sampai ujung membuat
 *    salah satu kolom selebar nol — peserta kehilangan editornya, bukan sekadar
 *    tata letaknya jelek.
 * 2. **Koreksi setengah `gap`.** Pembaginya duduk di tengah celah antar kolom,
 *    jadi posisi pointer harus dikoreksi. Tanpa koreksi itu, setiap kali mulai
 *    menyeret kolomnya melompat setengah `gap`, dan kolomnya tidak pernah persis
 *    mengikuti kursor.
 * 3. **Nilai tersimpan yang rusak.** `0`/`1`/teks sampah di `localStorage`
 *    berasal dari luar UI ini (tidak ada jalur yang bisa menghasilkannya), jadi
 *    ia harus ditolak ke `BAGI_AWAL`, bukan dipulihkan jadi tata letak ekstrem
 *    yang tidak bisa dibuat sendiri oleh peserta.
 */
describe("bagi-lab — batas minimum", () => {
  it("menghitung batas terhadap ruang efektif, bukan lebar wadah penuh", () => {
    // Ruang efektif = lebar wadah − gap, karena itulah yang benar-benar dibagi
    // dua kolom. Menghitungnya terhadap lebar penuh membuat batas meleset satu
    // gap dan kolom terkecil jadi lebih sempit daripada minimumnya.
    const { min, max, efektif } = batasBagi({ lebarWadah: 1000, minKiri: 280, minKanan: 340, gap: 20 });
    expect(efektif).toBe(980);
    expect(min).toBeCloseTo(280 / 980, 6);
    expect(max).toBeCloseTo(1 - 340 / 980, 6);
  });

  it("wadah terlalu sempit mengembalikan rentang terbalik, bukan minimum palsu", () => {
    // 300px tidak cukup untuk 280 + 340. Mengembalikan `min > max` membuat
    // pemanggil bisa jatuh ke pembagian rata; memaksa salah satu minimum akan
    // membuat kolom lain lenyap.
    const { min, max } = batasBagi({ lebarWadah: 300, minKiri: 280, minKanan: 340, gap: 20 });
    expect(min).toBeGreaterThan(max);
  });
});

describe("bagi-lab — seret", () => {
  it("mengoreksi setengah gap supaya kolom tidak melompat", () => {
    // Pointer tepat di tepi kiri ruang efektif (x = gap/2) berarti bagi 0.
    // Tanpa koreksi, nilai itu jadi (gap/2)/efektif > 0 dan kolomnya melompat.
    const bagi = bagiDariGeser({ x: 10, lebarWadah: 1000, minKiri: 0, minKanan: 0, gap: 20 });
    expect(bagi).toBeCloseTo(0, 6);
  });

  it("titik tengah wadah menghasilkan pembagian seimbang", () => {
    const bagi = bagiDariGeser({ x: 500, lebarWadah: 1000, minKiri: 0, minKanan: 0, gap: 20 });
    // (500 − 10) / 980
    expect(bagi).toBeCloseTo(490 / 980, 6);
  });

  it("tidak pernah melewati minimum kolom", () => {
    // Seret jauh ke kiri: kolom materi tidak boleh lebih sempit dari MIN_KIRI.
    const kiri = bagiDariGeser({ x: -500, lebarWadah: 1000, minKiri: MIN_KIRI, minKanan: MIN_KANAN, gap: 20 });
    const { min } = batasBagi({ lebarWadah: 1000, minKiri: MIN_KIRI, minKanan: MIN_KANAN, gap: 20 });
    expect(kiri).toBeCloseTo(min, 6);
    // Dan kolom kanan yang tersisa tidak lebih sempit dari MIN_KANAN.
    const efektif = 980;
    expect(efektif * (1 - kiri)).toBeGreaterThanOrEqual(MIN_KANAN - 1e-6);

    // Seret jauh ke kanan: cermin dari kasus di atas.
    const kanan = bagiDariGeser({ x: 5000, lebarWadah: 1000, minKiri: MIN_KIRI, minKanan: MIN_KANAN, gap: 20 });
    expect(efektif * kanan).toBeGreaterThanOrEqual(MIN_KIRI - 1e-6);
  });

  it("jatuh ke pembagian rata saat wadah terlalu sempit", () => {
    const bagi = bagiDariGeser({ x: 100, lebarWadah: 300, minKiri: MIN_KIRI, minKanan: MIN_KANAN, gap: 20 });
    expect(bagi).toBe(BAGI_AWAL);
  });
});

describe("bagi-lab — papan ketik", () => {
  it("panah menggeser satu langkah dan menghormati minimum yang sama", () => {
    const dasar = { bagi: 0.5, lebarWadah: 1000, minKiri: MIN_KIRI, minKanan: MIN_KANAN, gap: 20 };
    expect(bagiDariPapanKetik({ ...dasar, tombol: "ArrowRight" })).toBeCloseTo(
      0.5 + LANGKAH_PAPAN_KETIK,
      6,
    );
    expect(bagiDariPapanKetik({ ...dasar, tombol: "ArrowLeft" })).toBeCloseTo(
      0.5 - LANGKAH_PAPAN_KETIK,
      6,
    );
  });

  it("Home dan End berhenti di batas, bukan di 0 dan 1", () => {
    // 0/1 berarti satu kolom hilang. Batas yang benar adalah minimum kolom.
    const dasar = { bagi: 0.5, lebarWadah: 1000, minKiri: MIN_KIRI, minKanan: MIN_KANAN, gap: 20 };
    const { min, max } = batasBagi({ lebarWadah: 1000, minKiri: MIN_KIRI, minKanan: MIN_KANAN, gap: 20 });
    expect(bagiDariPapanKetik({ ...dasar, tombol: "Home" })).toBeCloseTo(min, 6);
    expect(bagiDariPapanKetik({ ...dasar, tombol: "End" })).toBeCloseTo(max, 6);
    expect(bagiDariPapanKetik({ ...dasar, tombol: "Home" })).toBeGreaterThan(0);
    expect(bagiDariPapanKetik({ ...dasar, tombol: "End" })).toBeLessThan(1);
  });

  it("menolak tombol yang bukan urusannya", () => {
    const hasil = bagiDariPapanKetik({
      bagi: 0.5,
      tombol: "ArrowRight",
      lebarWadah: 300,
      minKiri: MIN_KIRI,
      minKanan: MIN_KANAN,
      gap: 20,
    });
    // Wadah terlalu sempit: tidak ada gerakan yang sah.
    expect(hasil).toBeNull();
  });
});

describe("bagi-lab — nilai tersimpan", () => {
  it("menolak nilai rusak dan ekstrem ke null", () => {
    expect(bacaBagi(null)).toBeNull();
    expect(bacaBagi(undefined)).toBeNull();
    expect(bacaBagi("")).toBeNull();
    expect(bacaBagi("bukan angka")).toBeNull();
    expect(bacaBagi("0")).toBeNull();
    expect(bacaBagi("1")).toBeNull();
    expect(bacaBagi("-0.4")).toBeNull();
    expect(bacaBagi("1.5")).toBeNull();
    expect(bacaBagi("NaN")).toBeNull();
  });

  it("menerima proporsi yang sah", () => {
    expect(bacaBagi("0.5")).toBe(0.5);
    expect(bacaBagi("0.25")).toBeCloseTo(0.25, 6);
    expect(bacaBagi("0.999")).toBeCloseTo(0.999, 6);
  });
});

describe("bagi-lab — persentase", () => {
  it("membulatkan untuk aria-valuenow", () => {
    expect(kePersen(0.5)).toBe(50);
    expect(kePersen(0.333)).toBe(33);
    expect(kePersen(0.666)).toBe(67);
  });
});
