import { describe, expect, it } from "vitest";
import { hitungSkorJadwal } from "./jadwal";
import {
  BOBOT_RUBRIC,
  hitungSkorKarya,
  LABEL_RUBRIC,
  SKALA_RUBRIC_MAKS,
  URUTAN_RUBRIC,
  type RubricCriterion,
} from "./karya";
import { hitungSkorValidasi } from "./validasi";
import { hitungSkorTotal } from ".";

describe("hitungSkorJadwal", () => {
  it("A1: kepatuhan 100% dan target tercapai menghasilkan 30", () => {
    const result = hitungSkorJadwal({
      scheduledSessions: 4,
      attendedSessions: 4,
      actualHours: 10,
      weeklyTargetHours: 10,
    });
    expect(result.score).toBe(30);
    expect(result.complianceRatio).toBe(1);
    expect(result.hoursRatio).toBe(1);
  });

  it("A2: tidak pernah check-in menghasilkan 0", () => {
    const result = hitungSkorJadwal({
      scheduledSessions: 4,
      attendedSessions: 0,
      actualHours: 0,
      weeklyTargetHours: 10,
    });
    expect(result.score).toBe(0);
  });

  it("A3: jam melebihi target di-cap 100%", () => {
    const result = hitungSkorJadwal({
      scheduledSessions: 4,
      attendedSessions: 4,
      actualHours: 40,
      weeklyTargetHours: 10,
    });
    expect(result.hoursRatio).toBe(1);
    expect(result.score).toBe(30);
  });

  it("A10: skor parsial sesuai rumus (toleransi 0.01)", () => {
    const result = hitungSkorJadwal({
      scheduledSessions: 10,
      attendedSessions: 7,
      actualHours: 5,
      weeklyTargetHours: 10,
    });
    expect(result.complianceRatio).toBeCloseTo(0.7, 2);
    expect(result.hoursRatio).toBeCloseTo(0.5, 2);
    expect(result.score).toBe(19);
  });

  it("tanpa sesi terjadwal tidak menghasilkan pembagian nol", () => {
    const result = hitungSkorJadwal({
      scheduledSessions: 0,
      attendedSessions: 0,
      actualHours: 5,
      weeklyTargetHours: 10,
    });
    expect(result.complianceRatio).toBe(0);
    expect(result.score).toBe(5);
  });
});

describe("hitungSkorKarya", () => {
  it("A4: rubric semua 4/4 menghasilkan 40", () => {
    expect(
      hitungSkorKarya({
        kelengkapan: 4,
        kualitas: 4,
        orisinalitas: 4,
        ketepatan_brief: 4,
        dokumentasi: 4,
      }),
    ).toBe(40);
  });

  it("A5: rubric kosong menghasilkan 0", () => {
    expect(hitungSkorKarya(null)).toBe(0);
    expect(hitungSkorKarya(undefined)).toBe(0);
    expect(hitungSkorKarya({ kualitas: 4 })).toBe(0);
  });

  it("bobot kualitas 30% lebih besar dari dokumentasi 10%", () => {
    const base = {
      kelengkapan: 4,
      kualitas: 4,
      orisinalitas: 4,
      ketepatan_brief: 4,
      dokumentasi: 4,
    };
    const kualitasRendah = hitungSkorKarya({ ...base, kualitas: 0 });
    const dokumentasiRendah = hitungSkorKarya({ ...base, dokumentasi: 0 });
    expect(kualitasRendah).toBeLessThan(dokumentasiRendah);
  });
});

describe("label & urutan rubric", () => {
  const semua = Object.keys(BOBOT_RUBRIC) as RubricCriterion[];

  it("setiap kriteria punya label, dan label tidak kosong", () => {
    for (const kriteria of semua) {
      expect(LABEL_RUBRIC[kriteria], kriteria).toBeTruthy();
      expect(typeof LABEL_RUBRIC[kriteria]).toBe("string");
    }
  });

  it("LABEL_RUBRIC tidak punya kunci yang bukan kriteria", () => {
    const kunci = Object.keys(LABEL_RUBRIC).sort();
    expect(kunci).toEqual([...semua].sort());
  });

  it("URUTAN_RUBRIC memuat tepat semua kriteria, tanpa duplikat", () => {
    expect([...URUTAN_RUBRIC].sort()).toEqual([...semua].sort());
    expect(new Set(URUTAN_RUBRIC).size).toBe(URUTAN_RUBRIC.length);
  });

  it("URUTAN_RUBRIC urut dari bobot terbesar (kualitas 30% di depan)", () => {
    for (let i = 1; i < URUTAN_RUBRIC.length; i += 1) {
      const sebelum = BOBOT_RUBRIC[URUTAN_RUBRIC[i - 1]];
      const sesudah = BOBOT_RUBRIC[URUTAN_RUBRIC[i]];
      expect(sebelum).toBeGreaterThanOrEqual(sesudah);
    }
    expect(URUTAN_RUBRIC[0]).toBe("kualitas");
  });

  it("total bobot tepat 100%", () => {
    const total = semua.reduce((acc, k) => acc + BOBOT_RUBRIC[k], 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it("skala maksimum adalah 4 (label panel memakainya sebagai /4)", () => {
    expect(SKALA_RUBRIC_MAKS).toBe(4);
  });
});

describe("hitungSkorValidasi", () => {
  it("A6: approve + Socrates penuh + plagiasi lolos menghasilkan 30", () => {
    expect(
      hitungSkorValidasi({
        approved: true,
        socratesDraftScore: 100,
        plagiarismPassed: true,
      }),
    ).toBe(30);
  });

  it("tidak approve menghasilkan 0", () => {
    expect(
      hitungSkorValidasi({
        approved: false,
        socratesDraftScore: 100,
        plagiarismPassed: true,
      }),
    ).toBe(0);
  });

  it("Socrates kosong tidak menambah skor", () => {
    expect(
      hitungSkorValidasi({
        approved: true,
        socratesDraftScore: null,
        plagiarismPassed: true,
      }),
    ).toBe(25);
  });
});

describe("hitungSkorTotal", () => {
  it("A7: total maksimal 100", () => {
    expect(hitungSkorTotal(30, 40, 30)).toBe(100);
  });

  it("A7: total tidak pernah melebihi 100", () => {
    expect(hitungSkorTotal(50, 50, 50)).toBe(100);
  });

  it("A8: total minimal 0", () => {
    expect(hitungSkorTotal(0, 0, 0)).toBe(0);
    expect(hitungSkorTotal(-10, -10, -10)).toBe(0);
  });

  it("A9: hasil selalu integer", () => {
    expect(Number.isInteger(hitungSkorTotal(19.4, 20.6, 25.5))).toBe(true);
  });
});
