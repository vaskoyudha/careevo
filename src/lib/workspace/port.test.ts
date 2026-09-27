import { describe, it, expect } from "vitest";
import { petakanWorkspace, type StatusWorkspace } from "./port";

const SEMUA: StatusWorkspace[] = ["ok", "penuh", "terkunci", "tidak_sah", "galat_manajer"];

describe("petakanWorkspace", () => {
  it("memetakan setiap status ke judul yang tidak kosong", () => {
    for (const status of SEMUA) {
      expect(petakanWorkspace(status).judul.length).toBeGreaterThan(0);
    }
  });

  it("menyatakan kapasitas sebagai batas layanan, bukan kesalahan peserta", () => {
    // Alasan yang sama dengan `petakanStatus("batas_dilampaui")`: batas
    // kapasitas adalah limit pelayanan. Kalimat yang menyalahkan peserta
    // mengirimnya ke tempat yang salah.
    const terlarang = /kamu salah|kamu gagal|tidak mampu|jangan|dilarang/;
    for (const status of SEMUA) {
      const petakan = petakanWorkspace(status);
      expect(petakan.judul.toLowerCase()).not.toMatch(terlarang);
      expect((petakan.detail ?? "").toLowerCase()).not.toMatch(terlarang);
    }
  });

  it("menyebut angka kapasitasnya bila diberikan", () => {
    // Tanpa angka, "sedang penuh" terbaca seperti kegagalan acak.
    const detail = petakanWorkspace("penuh", 12).detail ?? "";
    expect(detail).toContain("12");
  });

  it("tidak mengarang angka kapasitas bila tidak diberikan", () => {
    const detail = petakanWorkspace("penuh").detail ?? "";
    expect(detail).not.toMatch(/\b\d+\b/);
  });

  it("terkunci menyebut jalur yang membukanya", () => {
    // Peserta yang melihat "terkunci" harus tahu apa yang membukanya, bukan
    // hanya bahwa ia tertutup.
    const detail = petakanWorkspace("terkunci").detail ?? "";
    expect(detail).toMatch(/Project/i);
    expect(detail).toMatch(/terverifikasi/i);
  });

  it("galat_manajer menyebut layanan tidak tersedia tanpa sebab internal", () => {
    const petakan = petakanWorkspace("galat_manajer");
    expect(petakan.nada).toBe("galat");
    // Podman, image, dan volume adalah detail internal mesin ini.
    const petakan2 = `${petakan.judul} ${petakan.detail ?? ""}`.toLowerCase();
    expect(petakan2).not.toMatch(/podman|image|volume|kontainer/);
  });

  it("hanya galat_manajer dan tidak_sah yang bernada galat", () => {
    expect(petakanWorkspace("galat_manajer").nada).toBe("galat");
    expect(petakanWorkspace("tidak_sah").nada).toBe("galat");
    for (const status of ["ok", "penuh", "terkunci"] as const) {
      expect(petakanWorkspace(status).nada).not.toBe("galat");
    }
  });
});
