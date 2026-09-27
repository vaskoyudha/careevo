import { describe, it, expect } from "vitest";
import {
  blokSchema,
  MAKS_KODE_KARAKTER,
  MAKS_STDIN_KARAKTER,
  MAKS_OUTPUT_HARAPAN_KARAKTER,
} from "./blok";

/** Blok kode valid tanpa field opsional lain. */
function kode(atas: Record<string, unknown> = {}) {
  return { id: "blk-1", tipe: "kode", bahasa: "cpp", kode: "int main(){}", ...atas };
}

/**
 * Tidak ada `describe("TIPE_BLOK")` di sini lagi, dan itu disengaja.
 *
   * Union tipe blok bukan milik test ini: ia dijaga `tsc` (lihat catatan panjang
 * di `blok.ts` dan `TipeBlok` di `@/types/course`). Test yang pernah ada di sini
 * menulis literal yang sama ke array yang juga ditulis test, jadi tidak ada
 * yang bisa gagal karena kontrak yang dinamai — persis kelas cacat "test yang
 * tidak bisa gagal".
 *
 * Yang boleh diuji runtime hanyalah **skema**: apakah `tipe` itu union
 * tertutup. Itu yang diperiksa di bawah, dan ini bisa gagal kalau diskriminator
 * dilonggarkan (`z.string()`, `z.enum` dengan nilai asing, cabang yang hilang)
 * — bukan kalau seseorang mengetik `"kode"` di dalam test.
 */
describe("blokSchema diskriminator tipe", () => {
  it("menolak tipe blok yang tidak dikenal", () => {
    // Union tertutup: `tipe` bukan string bebas. Tanpa ini, `BlokView` dan
    // `IsiBlok` bisa menerima bentuk yang tidak punya `case` dan bloknya hilang
    // tanpa satu pun error.
    const hasil = blokSchema.safeParse({
      id: "blk-1",
      tipe: "kerangka",
      segmen: [{ teks: "halo" }],
    });
    expect(hasil.success).toBe(false);
  });

  it("menolak tipe yang hanya berbeda kapitalnya", () => {
    // Bentuk yang sama persis dengan blok paragraf yang sah, hanya `tipe`-nya
    // disamarkan. `z.discriminatedUnion` harus menolak berdasarkan diskriminator
    // itu, bukan berdasarkan field lain.
    const hasil = blokSchema.safeParse({ id: "blk-1", tipe: "Paragraf" });
    expect(hasil.success).toBe(false);
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
