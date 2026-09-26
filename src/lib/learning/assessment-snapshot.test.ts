/**
 * Test unit snapshot + penilaian asesmen — murni, tanpa database dan tanpa disk.
 *
 * Yang dibuktikan di sini adalah sifat yang membuat ADR 0003 bisa dipercaya:
 *
 * 1. **`definitionVersion` deterministik.** Dua kuis dengan isi sama menghasilkan
 *    hash sama, dan urutan key objek tidak mengubahnya; satu perubahan isi
 *    mengubahnya. Tanpa ini, "definisi mana yang dinilai" tidak bisa diaudit.
 * 2. **Skor dihitung dari snapshot, bukan dari input klien.** Satu-satunya
 *    input adalah `selectedOption`; di luar rentang selalu salah.
 * 3. **Gagal-tertutup.** Snapshot rusak / tanpa soal tidak menghasilkan
 *    kelulusan, dan `totalSoal === 0` memberi skor 0 — bukan NaN atau 100.
 */

import { describe, expect, it } from "vitest";

import type { Kuis } from "@/types/course";

import {
  bacaSnapshotKuis,
  hitungSkorSnapshot,
  kanonik,
  lulusSnapshot,
  snapshotKuis,
} from "./assessment-snapshot";

/** Kuis contoh dengan dua soal: kunci 0 dan 2. */
function kuisContoh(overrides: Partial<Kuis> = {}): Kuis {
  return {
    id: "kuis-1",
    judul: "Dasar TypeScript",
    deskripsi: "Cek pemahaman dasar",
    nilai_lulus: 70,
    soal: [
      {
        id: "s1",
        pertanyaan: "Tipe apa untuk angka?",
        pilihan: ["number", "text", "boolean"],
        jawaban_benar: 0,
      },
      {
        id: "s2",
        pertanyaan: "Kata kunci konstanta?",
        pilihan: ["var", "let", "const"],
        jawaban_benar: 2,
      },
    ],
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("kanonik", () => {
  it("mengurutkan key objek secara rekursif tanpa mengubah urutan array", () => {
    expect(kanonik({ b: 1, a: { d: 2, c: [3, { f: 5, e: 4 }] } })).toEqual({
      a: { c: [3, { e: 4, f: 5 }], d: 2 },
      b: 1,
    });
  });

  it("tidak mengubah nilai primitif", () => {
    expect(kanonik(42)).toBe(42);
    expect(kanonik(null)).toBeNull();
    expect(kanonik("teks")).toBe("teks");
    expect(kanonik(undefined)).toBeUndefined();
  });
});

describe("snapshotKuis — definitionVersion stabil", () => {
  it("dua panggilan atas kuis yang sama menghasilkan version yang sama", () => {
    const kuis = kuisContoh();
    expect(snapshotKuis(kuis).definitionVersion).toBe(snapshotKuis(kuis).definitionVersion);
  });

  it("urutan key objek tidak memengaruhi hash", () => {
    const rapih = snapshotKuis(kuisContoh());

    // Snapshot yang sama persis, tetapi key disusun dalam urutan terbalik.
    const terbalik = {
      soal: kuisContoh().soal.map((s) => ({
        jawaban_benar: s.jawaban_benar,
        pilihan: [...s.pilihan],
        pertanyaan: s.pertanyaan,
        id: s.id,
      })),
      nilai_lulus: 70,
      judul: "Dasar TypeScript",
    };

    // Hash kanonik dari bentuk yang key-nya dibalik harus identik dengan hash
    // snapshot aslinya, karena `kanonik` menormalkan urutan key sebelum di-hash.
    expect(JSON.stringify(kanonik(terbalik))).toBe(JSON.stringify(kanonik(rapih.snapshot)));
  });

  it("perubahan isi soal mengubah hash", () => {
    const asli = snapshotKuis(kuisContoh()).definitionVersion;
    const diubah = snapshotKuis(
      kuisContoh({
        soal: [
          { id: "s1", pertanyaan: "Tipe apa untuk angka?", pilihan: ["number", "text", "boolean"], jawaban_benar: 1 },
          { id: "s2", pertanyaan: "Kata kunci konstanta?", pilihan: ["var", "let", "const"], jawaban_benar: 2 },
        ],
      }),
    ).definitionVersion;

    expect(diubah).not.toBe(asli);
  });

  it("perubahan nilai_lulus mengubah hash", () => {
    expect(snapshotKuis(kuisContoh({ nilai_lulus: 80 })).definitionVersion).not.toBe(
      snapshotKuis(kuisContoh()).definitionVersion,
    );
  });

  it("deskripsi dan timestamp bukan bagian definisi yang dinilai", () => {
    const dasar = snapshotKuis(kuisContoh()).definitionVersion;
    expect(snapshotKuis(kuisContoh({ deskripsi: "berbeda" })).definitionVersion).toBe(dasar);
    expect(
      snapshotKuis(kuisContoh({ updated_at: "2030-01-01T00:00:00.000Z" })).definitionVersion,
    ).toBe(dasar);
  });

  it("snapshot memuat soal, pilihan, kunci, dan nilai_lulus", () => {
    const { snapshot } = snapshotKuis(kuisContoh());
    expect(snapshot).toEqual({
      judul: "Dasar TypeScript",
      nilai_lulus: 70,
      soal: [
        { id: "s1", pertanyaan: "Tipe apa untuk angka?", pilihan: ["number", "text", "boolean"], jawaban_benar: 0 },
        { id: "s2", pertanyaan: "Kata kunci konstanta?", pilihan: ["var", "let", "const"], jawaban_benar: 2 },
      ],
    });
  });

  it("snapshot tidak ikut berubah bila kuis sumber dimutasi setelahnya", () => {
    const kuis = kuisContoh();
    const { snapshot } = snapshotKuis(kuis);
    kuis.soal[0].pilihan[0] = "DIUBAH";
    expect((snapshot.soal as Array<{ pilihan: string[] }>)[0].pilihan[0]).toBe("number");
  });
});

describe("hitungSkorSnapshot", () => {
  const kuis = kuisContoh();
  const { snapshot } = snapshotKuis(kuis);

  it("menghitung skor 100 saat semua jawaban benar", () => {
    const hasil = hitungSkorSnapshot(snapshot, [
      { questionId: "s1", selectedOption: 0 },
      { questionId: "s2", selectedOption: 2 },
    ]);

    expect(hasil.score).toBe(100);
    expect(hasil.totalSoal).toBe(2);
    expect(hasil.perSoal).toEqual([
      { questionId: "s1", isCorrect: true },
      { questionId: "s2", isCorrect: true },
    ]);
  });

  it("menghitung skor 0 saat semua jawaban salah", () => {
    const hasil = hitungSkorSnapshot(snapshot, [
      { questionId: "s1", selectedOption: 1 },
      { questionId: "s2", selectedOption: 0 },
    ]);
    expect(hasil.score).toBe(0);
  });

  it("membulatkan skor dari rasio benar/total", () => {
    // 1 dari 3 benar = 33.33 → 33.
    const tiga = {
      judul: "Tiga soal",
      nilai_lulus: 70,
      soal: [
        { id: "q1", pertanyaan: "a", pilihan: ["x", "y"], jawaban_benar: 0 },
        { id: "q2", pertanyaan: "b", pilihan: ["x", "y"], jawaban_benar: 0 },
        { id: "q3", pertanyaan: "c", pilihan: ["x", "y"], jawaban_benar: 0 },
      ],
    };
    expect(
      hitungSkorSnapshot(tiga, [
        { questionId: "q1", selectedOption: 0 },
        { questionId: "q2", selectedOption: 1 },
        { questionId: "q3", selectedOption: 1 },
      ]).score,
    ).toBe(33);

    // 2 dari 3 benar = 66.67 → 67.
    expect(
      hitungSkorSnapshot(tiga, [
        { questionId: "q1", selectedOption: 0 },
        { questionId: "q2", selectedOption: 0 },
        { questionId: "q3", selectedOption: 1 },
      ]).score,
    ).toBe(67);
  });

  it("menghitung selectedOption di luar rentang sebagai salah", () => {
    const hasil = hitungSkorSnapshot(snapshot, [
      { questionId: "s1", selectedOption: 99 },
      { questionId: "s2", selectedOption: -1 },
    ]);
    expect(hasil.score).toBe(0);
    expect(hasil.perSoal.every((p) => !p.isCorrect)).toBe(true);
  });

  it("soal yang tidak dikirim klien dihitung salah tanpa mengubah penyebut", () => {
    const hasil = hitungSkorSnapshot(snapshot, [{ questionId: "s1", selectedOption: 0 }]);
    expect(hasil.totalSoal).toBe(2);
    expect(hasil.score).toBe(50);
    expect(hasil.perSoal).toEqual([
      { questionId: "s1", isCorrect: true },
      { questionId: "s2", isCorrect: false },
    ]);
  });

  it("mengabaikan questionId yang tidak ada di snapshot", () => {
    const hasil = hitungSkorSnapshot(snapshot, [
      { questionId: "s1", selectedOption: 0 },
      { questionId: "s2", selectedOption: 2 },
      { questionId: "soal-hantu", selectedOption: 0 },
    ]);
    expect(hasil.score).toBe(100);
    expect(hasil.perSoal).toHaveLength(2);
  });

  it("pengiriman ganda satu soal memakai nilai pertama", () => {
    const hasil = hitungSkorSnapshot(snapshot, [
      { questionId: "s1", selectedOption: 0 },
      { questionId: "s1", selectedOption: 1 },
    ]);
    expect(hasil.perSoal[0]).toEqual({ questionId: "s1", isCorrect: true });
  });

  it("totalSoal 0 memberi skor 0, bukan 100 atau NaN", () => {
    const hasil = hitungSkorSnapshot({ judul: "kosong", nilai_lulus: 0, soal: [] }, []);
    expect(hasil.score).toBe(0);
    expect(hasil.totalSoal).toBe(0);
    expect(hasil.perSoal).toEqual([]);
  });

  it("snapshot rusak tidak menghasilkan skor kelulusan", () => {
    for (const rusak of [null, undefined, {}, { soal: "bukan-array" }, "teks", 42]) {
      const hasil = hitungSkorSnapshot(rusak, [{ questionId: "s1", selectedOption: 0 }]);
      expect(hasil.score).toBe(0);
      expect(hasil.totalSoal).toBe(0);
    }
  });

  it("snapshot dengan satu soal cacat dibaca sebagai tidak sah seluruhnya", () => {
    const cacat = {
      judul: "cacat",
      nilai_lulus: 70,
      soal: [
        { id: "s1", pertanyaan: "a", pilihan: ["x", "y"], jawaban_benar: 0 },
        { id: "s2", pertanyaan: "b", pilihan: "bukan-array", jawaban_benar: 0 },
      ],
    };
    expect(bacaSnapshotKuis(cacat)).toBeNull();
    expect(hitungSkorSnapshot(cacat, [])).toEqual({ score: 0, perSoal: [], totalSoal: 0 });
  });
});

describe("lulusSnapshot", () => {
  const { snapshot } = snapshotKuis(kuisContoh());

  it("lulus saat skor mencapai nilai_lulus", () => {
    expect(lulusSnapshot(snapshot, 70)).toBe(true);
    expect(lulusSnapshot(snapshot, 100)).toBe(true);
  });

  it("tidak lulus saat skor di bawah nilai_lulus", () => {
    expect(lulusSnapshot(snapshot, 69)).toBe(false);
    expect(lulusSnapshot(snapshot, 0)).toBe(false);
  });

  it("memakai nilai_lulus dari snapshot, bukan dari kuis yang sudah diubah", () => {
    const longgar = snapshotKuis(kuisContoh({ nilai_lulus: 50 })).snapshot;
    // Skor 60 lulus terhadap snapshot sendiri meski bank kini memakai 70.
    expect(lulusSnapshot(longgar, 60)).toBe(true);
    expect(lulusSnapshot(snapshot, 60)).toBe(false);
  });

  it("snapshot tanpa ambang yang sah tidak pernah lulus", () => {
    for (const rusak of [null, undefined, {}, { soal: [] }, { judul: "x", soal: [] }]) {
      expect(lulusSnapshot(rusak, 100)).toBe(false);
    }
  });

  it("skor tidak terhingga tidak lulus", () => {
    expect(lulusSnapshot(snapshot, Number.NaN)).toBe(false);
    expect(lulusSnapshot(snapshot, Number.POSITIVE_INFINITY)).toBe(false);
  });
});
