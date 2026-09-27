import { describe, expect, it } from "vitest";
import { LANGKAH_FIELD, langkahSalah } from "./langkah";
import { onboardingSchema } from "@/lib/validation/onboarding";

/**
 * `completeOnboardingAction` mengembalikan `errors` per-field, dan wizard
 * memakai peta ini untuk melompat ke langkah yang salah serta menandai field-nya.
 * Field yang ada di server tapi tak ada di peta kembali jadi tidak terlihat —
 * persis bug yang sudah terjadi di sini: `errors` dihitung lalu dibuang.
 *
 * Karena itu daftar field diperiksa terhadap skema, bukan ditulis manual dan
 * dipercaya begitu saja.
 */
describe("peta field onboarding ke langkah", () => {
  it("menakup setiap field yang schema punya", () => {
    for (const field of Object.keys(onboardingSchema.shape)) {
      expect(LANGKAH_FIELD[field], `field "${field}" belum dipetakan ke langkah`).toBeDefined();
    }
  });

  it("tidak memetakan field yang tidak ada di schema", () => {
    for (const field of Object.keys(LANGKAH_FIELD)) {
      expect(Object.keys(onboardingSchema.shape), `peta punya field "${field}" yang asing`).toContain(
        field,
      );
    }
  });
});

describe("langkahSalah", () => {
  it("memberi langkah pertama yang punya galat", () => {
    expect(langkahSalah({ goal: "Pilih tujuan belajar" })).toBe(2);
    expect(langkahSalah({ interests: "Pilih minimal 1 minat" })).toBe(1);
    expect(langkahSalah({ experience: "Pilih level" })).toBe(0);
  });

  it("memilih paling awal ketika beberapa langkah salah sekaligus", () => {
    // Server menolak seluruh profil sekaligus, jadi galat bisa datang di banyak
    // langkah. Orang harus diarahkan ke yang paling awal, bukan yang terakhir.
    expect(
      langkahSalah({
        experience: "Pilih level pengalaman",
        goal: "Pilih tujuan belajar",
        weeklyHours: "Pilih target jam per minggu",
      }),
    ).toBe(0);
  });

  it("mengembalikan null saat tidak ada galat atau field-nya tak dikenal", () => {
    expect(langkahSalah(undefined)).toBeNull();
    expect(langkahSalah({})).toBeNull();
    expect(langkahSalah({ consent: "wajib" })).toBeNull();
  });
});
