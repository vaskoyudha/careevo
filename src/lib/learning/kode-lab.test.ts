import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * `KodeLab` sebagai berkas sumber.
 *
 * Lingkungan test repo ini `node` tanpa jsdom, jadi `KodeView` (CodeMirror)
 * tidak bisa dirender di sini — ia mengukur DOM saat dibangun. Yang bisa dan
 * **harus** dijaga dari sumber adalah janji-janji yang membuat lab ini benar
 * dan mudah rusak diam-diam:
 *
 * 1. **Satu editor, bukan dua.** Blok latihan diangkat ke kolom kanan, dan
 *    kolom kiri memakai `HalamanView` yang sama dengan `sembunyikanKodeDijalankan`
 *    menyala. Kalau flag itu hilang, latihannya muncul dua kali — sekali sebagai
 *    panel baca, sekali sebagai editor — dan tidak ada test render yang melihatnya
 *    (HTML-nya tetap valid).
 * 2. **Editor menyala `editable`.** Di jalur baca editor mati; di lab mengetik
 *    adalah tujuannya. Lupa menyalakannya membuat lab jadi tontonan.
 * 3. **Tidak ada jalur eksekusi kedua.** Lab tidak boleh memanggil
 *    `/api/jalankan` sendiri; seluruh eksekusi tetap milik `KodeView`.
 *
 * Pola yang sama dipakai `kode-view.test.ts` dan `halaman-view.test.ts`:
 * properti yang tidak bisa dijangkau `typecheck`/`lint`/render dikunci di sini.
 */
const sumber = readFileSync(
  fileURLToPath(new URL("../../components/features/learning/kode-lab.tsx", import.meta.url)),
  "utf8",
);

describe("KodeLab sebagai berkas sumber", () => {
  it("menyembunyikan blok latihan di kolom prosa", () => {
    // Tanpa ini, satu latihan tampil dua kali: sekali sebagai panel baca di
    // kolom kiri, sekali sebagai editor di kolom kanan.
    expect(sumber).toContain("sembunyikanKodeDijalankan");
    expect(sumber).toContain("<HalamanView");
  });

  it("memakai KodeView yang sama, dengan susunan lab dan editor menyala", () => {
    // Satu komponen editor untuk baca dan tulis (P1 spec): jalur kedua akan
    // menyimpang dari yang pertama. `editable` adalah yang membedakan lab dari
    // jalur baca.
    expect(sumber).toContain("<KodeView");
    expect(sumber).toContain('susunan="lab"');
    expect(sumber).toMatch(/\beditable\b/);
  });

  it("mengambil blok latihan dari predikat bersama, bukan menyaring sendiri", () => {
    // Predikat "blok mana yang bisa dijalankan" hidup di `blok.ts`; menyaring
    // ulang di sini berarti dua jawaban yang bisa berbeda tanpa error.
    expect(sumber).toContain("blokKodeDijalankan(");
  });

  it("tidak membuka jalur eksekusi kedua", () => {
    // Eksekusi tetap milik `KodeView`. Lab tidak boleh memanggil route atau
    // menjalankan apa pun sendiri.
    expect(sumber).not.toContain("/api/jalankan");
    expect(sumber).not.toContain("child_process");
  });

  it("tidak pernah memakai dangerouslySetInnerHTML", () => {
    expect(sumber).not.toContain("dangerouslySetInnerHTML");
  });
});
