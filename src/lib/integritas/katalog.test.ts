import { describe, expect, it } from "vitest";
import {
  JENIS_PELANGGARAN,
  KATALOG_PELANGGARAN,
  definisiPelanggaran,
  jenisPelanggaranValid,
} from "./katalog";

describe("JENIS_PELANGGARAN", () => {
  it("mencakup seluruh katalog tanpa sisa", () => {
    // Katalog dan daftar dipisah bentuknya supaya CHECK di database dan union
    // type bisa membaca sumber yang sama. Kalau satu anggota jatuh, database
    // menolak nilai yang masih dipakai TypeScript — atau sebaliknya, UI
    // menawarkan pilihan yang tidak bisa disimpan.
    for (const jenis of JENIS_PELANGGARAN) {
      expect(Object.hasOwn(KATALOG_PELANGGARAN, jenis)).toBe(true);
    }
    expect(Object.keys(KATALOG_PELANGGARAN)).toHaveLength(JENIS_PELANGGARAN.length);
  });

  it("memakai bobot yang naik seiring beratnya pelanggaran", () => {
    // Bobot berurutan adalah keputusan produk yang bisa dibaca: ringan < sedang
    // < berat. Kalau suatu saat dibalik, tabel report akan menampilkan
    // "berat" di atas "ringan" dan bobotnya tidak menjelaskan apa pun.
    const bobot = JENIS_PELANGGARAN.map((j) => KATALOG_PELANGGARAN[j].bobot);
    for (let i = 1; i < bobot.length; i += 1) {
      expect(bobot[i]!).toBeGreaterThan(bobot[i - 1]!);
    }
  });

  it("memberi bobot paling ringan di bawah batas per course", () => {
    // Batas per course 20. Kalau pelanggaran "ringan" (bobot 5) sudah >= 20,
    // empat pelanggaran ringan di satu course akan menyamai pelanggaran berat
    // tunggal — dan batas itu jadi tidak lagi berarti apa pun.
    const ringan = JENIS_PELANGGARAN.filter(
      (j) => KATALOG_PELANGGARAN[j].tingkat === "ringan",
    );
    expect(ringan.length).toBeGreaterThan(0);
    for (const jenis of ringan) {
      expect(KATALOG_PELANGGARAN[jenis].bobot).toBeLessThan(20);
    }
  });

  it("tidak memakai kata yang menyatakan bersalah di label maupun detail", () => {
    // Batas ini bertahan setelah skor kejujuran diperkenalkan: yang dicatat
    // adalah catatan yang ditinjau manusia, dan kata vonis di output otomatis
    // menaikkan bukti yang tidak pernah ada. Vonis tetap mungkin — tapi ditulis
    // manusia di kolom `reason`, bukan di label yang dirender dari katalog.
    for (const jenis of JENIS_PELANGGARAN) {
      const d = KATALOG_PELANGGARAN[jenis];
      const teks = `${d.label} ${d.detail}`.toLowerCase();
      for (const kata of ["curang", "menyalin", "mencontek", "penyalahgunaan", "bersalah"]) {
        expect(`${jenis}: ${teks}`, `${jenis} memuat kata vonis "${kata}"`).not.toContain(kata);
      }
    }
  });
});

describe("definisiPelanggaran", () => {
  it("mengembalikan definisi untuk jenis yang sah", () => {
    expect(definisiPelanggaran("pola_salin_tempel")?.bobot).toBe(10);
  });

  it("mengembalikan null untuk jenis asing, bukan prototipe", () => {
    // `in` akan menerima "toString" dan mengembalikan fungsi prototipe di
    // tempat yang diharapkan sebuah definisi — lihat careevo-review §1.
    expect(definisiPelanggaran("toString")).toBeNull();
    expect(definisiPelanggaran("constructor")).toBeNull();
    expect(definisiPelanggaran("")).toBeNull();
  });

  it("validasi menolak jenis asing", () => {
    expect(jenisPelanggaranValid("plagiarisme")).toBe(true);
    expect(jenisPelanggaranValid("maling")).toBe(false);
  });
});
