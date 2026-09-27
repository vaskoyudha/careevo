import { describe, it, expect } from "vitest";
import {
  blokSchema,
  TIPE_BLOK,
  MAKS_KODE_KARAKTER,
  MAKS_STDIN_KARAKTER,
  MAKS_OUTPUT_HARAPAN_KARAKTER,
} from "./blok";

/** Blok kode valid tanpa field opsional lain. */
function kode(atas: Record<string, unknown> = {}) {
  return { id: "blk-1", tipe: "kode", bahasa: "cpp", kode: "int main(){}", ...atas };
}

describe("TIPE_BLOK", () => {
  it("memuat kode sebagai tipe keenam", () => {
    expect(TIPE_BLOK).toContain("kode");
    expect(TIPE_BLOK).toHaveLength(6);
  });
});

describe("blokSchema varian kode", () => {
  it("menerima blok kode dengan bahasa cpp", () => {
    expect(blokSchema.safeParse(kode()).success).toBe(true);
  });

  it("memberi id kosong saat tidak dikirim, supaya store yang mengisinya", () => {
    const hasil = blokSchema.parse({ tipe: "kode", bahasa: "cpp", kode: "int main(){}" });
    expect(hasil.id).toBe("");
  });

  it("menolak bahasa di luar union tertutup", () => {
    // `bahasa` masuk ke pemilihan image kontainer. String bebas membuat
    // image bisa dipilih dari mana saja.
    expect(blokSchema.safeParse(kode({ bahasa: "python" })).success).toBe(false);
  });

  it("menolak bahasa yang hilang", () => {
    expect(
      blokSchema.safeParse({ id: "blk-1", tipe: "kode", kode: "int main(){}" }).success,
    ).toBe(false);
  });

  it("membuang field tak dikenal, jadi kiriman tidak bisa menyelip", () => {
    const hasil = blokSchema.parse(kode({ nyusup: "hai" }));
    expect("nyusup" in hasil).toBe(false);
  });

  it("membuang segmen, supaya renderer tidak bisa menampilkan prosa di blok kode", () => {
    // `segmen` milik paragraf. Kalau tidak dibuang, ia tersimpan dan
    // `jumlahKata` bisa menghitungnya sebagai kata baca.
    const hasil = blokSchema.parse(kode({ segmen: [{ teks: "halo" }] }));
    expect("segmen" in hasil).toBe(false);
  });

  it("membatasi panjang kode", () => {
    expect(blokSchema.safeParse(kode({ kode: "a".repeat(MAKS_KODE_KARAKTER + 1) })).success).toBe(
      false,
    );
  });

  it("membatasi panjang kode awal", () => {
    // `kodeAwal` memakai konstanta yang sama dengan `kode` tapi punya pesan
    // sendiri, jadi batasnya bisa dilepas tanpa terlihat dari sisi lain.
    expect(
      blokSchema.safeParse(kode({ kodeAwal: "a".repeat(MAKS_KODE_KARAKTER + 1) })).success,
    ).toBe(false);
  });

  it("membatasi panjang stdin", () => {
    expect(
      blokSchema.safeParse(kode({ stdin: "a".repeat(MAKS_STDIN_KARAKTER + 1) })).success,
    ).toBe(false);
  });

  it("membatasi panjang keluaran yang diharapkan", () => {
    expect(
      blokSchema.safeParse(
        kode({ outputHarapan: "a".repeat(MAKS_OUTPUT_HARAPAN_KARAKTER + 1) }),
      ).success,
    ).toBe(false);
  });

  it("menerima stdin, keluaran harapan, dan sakelar boleh jalan", () => {
    expect(
      blokSchema.safeParse(
        kode({ stdin: "Budi", outputHarapan: "Halo, Budi!", dapatDijalankan: true }),
      ).success,
    ).toBe(true);
  });
});
