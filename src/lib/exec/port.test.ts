import { describe, it, expect } from "vitest";
import { hasilGagal, petakanStatus, type StatusJalankan } from "./port";

const SEMUA: StatusJalankan[] = [
  "sukses",
  "gagal_kompilasi",
  "waktu_habis",
  "memori_habis",
  "proses_habis",
  "ditolak",
  "galat_runner",
];

describe("petakanStatus", () => {
  it("memetakan setiap status ke judul yang tidak kosong", () => {
    for (const status of SEMUA) {
      expect(petakanStatus(status).judul.length).toBeGreaterThan(0);
    }
  });

  it("tidak pernah menampilkan angka exit mentah ke peserta", () => {
    // P4 spec. Angka 255 dan 137 adalah detail internal podman. Kalau angka
    // ini bocor ke peserta, peserta membaca angka yang tidak menjelaskan apa pun.
    for (const status of SEMUA) {
      const petakan = petakanStatus(status);
      expect(petakan.judul).not.toMatch(/\b(124|137|255)\b/);
      expect(petakan.detail ?? "").not.toMatch(/\b(124|137|255)\b/);
    }
  });

  it("menyatakan batas pelayanan tanpa menyalahkan peserta", () => {
    // Batas 10 detik dan 512 MB adalah limit layanan, bukan kesalahan orang.
    const terlarang = /kamu|kamu salah|tidak mampu|gagal mengerjakan/;
    for (const status of ["waktu_habis", "memori_habis", "proses_habis"] as const) {
      expect(petakanStatus(status).judul.toLowerCase()).not.toMatch(terlarang);
    }
  });

  it("menyatakan angka batasnya sendiri", () => {
    expect(petakanStatus("waktu_habis").detail).toContain("10 detik");
    expect(petakanStatus("memori_habis").detail).toContain("512 MB");
    expect(petakanStatus("proses_habis").detail).toContain("64 proses");
  });

  it("hanya sukses yang bernada sukses", () => {
    expect(petakanStatus("sukses").nada).toBe("sukses");
    for (const status of SEMUA.filter((s) => s !== "sukses")) {
      expect(petakanStatus(status).nada).not.toBe("sukses");
    }
  });

  it("gagal_kompilasi tidak meringkas pesan compiler", () => {
    // Yang ditampilkan adalah stderr GCC apa adanya. Ringkasan akan jadi
    // penurunan kualitas, jadi pemeta tidak boleh menimpanya dengan detail.
    const petakan = petakanStatus("gagal_kompilasi");
    expect(petakan.detail).toBeUndefined();
    expect(petakan.nada).toBe("galat");
  });
});

describe("hasilGagal", () => {
  it("mengisi stdout kosong dan durasi nol", () => {
    const hasil = hasilGagal("memori_habis");
    expect(hasil.stdout).toBe("");
    expect(hasil.durasiMs).toBe(0);
    expect(hasil.status).toBe("memori_habis");
  });

  it("menyimpan stderr bila diberikan", () => {
    expect(hasilGagal("gagal_kompilasi", "error: expected ';'").stderr).toBe(
      "error: expected ';'",
    );
  });

  it("tidak mengarang exitCode untuk status semantik", () => {
    // Status semantik sudah membawa artinya. Mengisi exitCode di sini hanya
    // menciptakan jalan bagi UI untuk menampilkannya.
    expect(hasilGagal("waktu_habis").exitCode).toBeNull();
  });
});
