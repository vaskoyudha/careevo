import { describe, it, expect } from "vitest";
import { BATAS_BERKAS_SNAPSHOT, ringkasBerkas, segmenDiabaikan } from "./snapshot";

describe("segmenDiabaikan", () => {
  it("mengabaikan direktori keluaran alat", () => {
    for (const path of [
      "node_modules/express/index.js",
      ".git/config",
      "vendor/lib/a.c",
      "target/debug/app",
      "build/out.o",
      "dist/bundle.js",
      ".next/server.js",
    ]) {
      expect(segmenDiabaikan(path)).toBe(true);
    }
  });

  it("mengabaikan direktori milik code-server sendiri", () => {
    // Ini yang membuat snapshot tidak memuat konfigurasi editor dan berkas sesi
    // alih-alih pekerjaan peserta.
    for (const path of [".cache/x", ".local/share/code-server/y", ".config/code-server/config.yaml"]) {
      expect(segmenDiabaikan(path)).toBe(true);
    }
  });

  it("mengabaikan pada kedalaman mana pun, bukan hanya di akar", () => {
    expect(segmenDiabaikan("src/deep/nested/node_modules/a.js")).toBe(true);
  });

  it("tidak mengabaikan nama yang hanya mirip", () => {
    // Pencocokan pada segmen, bukan substring: direktori yang namanya memuat
    // kata itu harus tetap ikut. Kalau tidak, pekerjaan peserta yang sah hilang
    // dari snapshot tanpa penjelasan.
    for (const path of [
      "src/my-node_modules-notes.md",
      "docs/buildings.md",
      "src/vendorless.c",
      "app/distribusi.cpp",
      "node_modules_backup/a.js",
    ]) {
      expect(segmenDiabaikan(path)).toBe(false);
    }
  });

  it("mengabaikan nilai yang bukan teks (fail-closed)", () => {
    expect(segmenDiabaikan(undefined as unknown as string)).toBe(true);
    expect(segmenDiabaikan(42 as unknown as string)).toBe(true);
  });
});

describe("ringkasBerkas", () => {
  it("mengurai keluaran find menjadi path dan ukuran", () => {
    const hasil = ringkasBerkas("120\tsrc/main.cpp\n45\tREADME.md\n");
    expect(hasil.berkas).toEqual([
      { path: "README.md", ukuran: 45 },
      { path: "src/main.cpp", ukuran: 120 },
    ]);
    expect(hasil.total).toBe(2);
    expect(hasil.terpotong).toBe(false);
  });

  it("mengurutkan hasil, sehingga dua snapshot dari isi yang sama identik", () => {
    // Tanpa urutan tetap, urutan `find` yang berbeda membuat diff submission
    // terlihat berubah padahal isinya sama.
    const a = ringkasBerkas("1\tb.txt\n1\ta.txt\n1\tc.txt\n");
    const b = ringkasBerkas("1\tc.txt\n1\tb.txt\n1\ta.txt\n");
    expect(a.berkas).toEqual(b.berkas);
    expect(a.berkas.map((x) => x.path)).toEqual(["a.txt", "b.txt", "c.txt"]);
  });

  it("menyaring direktori yang diabaikan", () => {
    const hasil = ringkasBerkas(
      ["9\tnode_modules/a.js", "9\tsrc/main.cpp", "9\t.git/config", "9\t.config/x"].join("\n"),
    );
    expect(hasil.berkas.map((x) => x.path)).toEqual(["src/main.cpp"]);
    expect(hasil.total).toBe(1);
  });

  it("membuang baris yang tidak bisa dibaca, bukan menjadikannya 0 byte", () => {
    // "Tidak ada data" bukan "nol byte". Menampilkan 0 byte untuk berkas yang
    // tidak terbaca membuat reviewer mengira berkasnya kosong.
    const hasil = ringkasBerkas(["bukan-angka\tx.txt", "12\t", "\t12", "12\ty.txt"].join("\n"));
    expect(hasil.berkas).toEqual([{ path: "y.txt", ukuran: 12 }]);
  });

  it("membuang path absolut, supaya path mesin ini tidak bocor ke snapshot", () => {
    const hasil = ringkasBerkas("12\t/home/coder/project/x.txt\n12\tsrc/y.txt\n");
    expect(hasil.berkas.map((x) => x.path)).toEqual(["src/y.txt"]);
  });

  it("memotong pada batas dan menandainya", () => {
    const baris = Array.from({ length: 10 }, (_, i) => `1\tf${String(i).padStart(2, "0")}.txt`);
    const hasil = ringkasBerkas(baris.join("\n"), 3);
    expect(hasil.berkas).toHaveLength(3);
    expect(hasil.terpotong).toBe(true);
    // `total` melaporkan jumlah sebelum pemotongan, supaya UI bisa menyebut
    // "3 dari 10" alih-alih "3".
    expect(hasil.total).toBe(10);
  });

  it("tidak menandai terpotong bila jumlahnya tepat di batas", () => {
    const baris = Array.from({ length: 3 }, (_, i) => `1\tf${i}.txt`);
    const hasil = ringkasBerkas(baris.join("\n"), 3);
    expect(hasil.berkas).toHaveLength(3);
    expect(hasil.terpotong).toBe(false);
  });

  it("jatuh ke batas bawaan bila maks tidak masuk akal", () => {
    // Bug tidak boleh mengubah arti "semua berkas" menjadi "tidak ada berkas".
    for (const maks of [Number.NaN, -1, 1.5, Number.POSITIVE_INFINITY]) {
      const hasil = ringkasBerkas("1\ta.txt\n", maks);
      expect(hasil.berkas).toHaveLength(1);
    }
  });

  it("mengembalikan daftar kosong untuk masukan yang bukan teks", () => {
    for (const buruk of [null, undefined, 42, {}, []]) {
      expect(ringkasBerkas(buruk).berkas).toEqual([]);
      expect(ringkasBerkas(buruk).total).toBe(0);
    }
  });

  it("menerima keluaran kosong sebagai daftar kosong, bukan galat", () => {
    const hasil = ringkasBerkas("");
    expect(hasil.berkas).toEqual([]);
    expect(hasil.terpotong).toBe(false);
  });

  it("menangani nama berkas yang memuat spasi", () => {
    // Karena pemisahnya TAB dan `find` memakai `-printf '%s\t%P\n'`, spasi di
    // nama berkas tidak memecah baris.
    const hasil = ringkasBerkas("10\tmy file with spaces.cpp\n");
    expect(hasil.berkas).toEqual([{ path: "my file with spaces.cpp", ukuran: 10 }]);
  });

  it("BATAS_BERKAS_SNAPSHOT adalah angka yang masuk akal", () => {
    expect(Number.isInteger(BATAS_BERKAS_SNAPSHOT)).toBe(true);
    expect(BATAS_BERKAS_SNAPSHOT).toBeGreaterThan(0);
  });
});
