import { describe, it, expect } from "vitest";
import { modulSchema, updateModulSchema } from "./modul";

const valid = {
  judul: "Dasar React Hooks",
  ringkasan: "Mengenal useState dan useEffect lewat latihan terarah.",
  durasi_min: 45,
};

describe("modulSchema", () => {
  it("meloloskan modul yang benar dan memangkas teks", () => {
    const parsed = modulSchema.safeParse({
      judul: "  Dasar React Hooks  ",
      ringkasan: "  Mengenal useState lewat latihan nyata.  ",
      durasi_min: 45,
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.judul).toBe("Dasar React Hooks");
      expect(parsed.data.ringkasan).toBe("Mengenal useState lewat latihan nyata.");
    }
  });

  it("meng-coerce durasi dari string FormData", () => {
    const parsed = modulSchema.safeParse({ ...valid, durasi_min: "150" });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.durasi_min).toBe(150);
    }
  });

  it("menolak judul dan ringkasan di bawah batas bawah", () => {
    const parsed = modulSchema.safeParse({
      judul: "AB",
      ringkasan: "Pendek",
      durasi_min: 10,
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      expect(fieldErrors.judul).toBeDefined();
      expect(fieldErrors.ringkasan).toBeDefined();
    }
  });

  it("menolak judul dan ringkasan di atas batas atas", () => {
    const parsed = modulSchema.safeParse({
      judul: "A".repeat(121),
      ringkasan: "B".repeat(501),
      durasi_min: 10,
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      expect(fieldErrors.judul).toBeDefined();
      expect(fieldErrors.ringkasan).toBeDefined();
    }
  });

  it("menolak durasi nol, negatif, dan desimal", () => {
    for (const durasi of [0, -5, 1.5]) {
      const parsed = modulSchema.safeParse({ ...valid, durasi_min: durasi });
      expect(parsed.success, String(durasi)).toBe(false);
    }
  });

  it("mendukung pembaruan parsial", () => {
    const parsed = updateModulSchema.safeParse({ judul: "Judul Baru Saja" });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.judul).toBe("Judul Baru Saja");
      expect(parsed.data.durasi_min).toBeUndefined();
    }
  });
});
