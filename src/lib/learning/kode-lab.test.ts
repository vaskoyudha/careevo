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

  it("mematikan pager halaman di kolom prosa", () => {
    // Bar kaki reader sudah punya tombol maju ("Selanjutnya"). Pager halaman di
    // dasar kolom kiri akan jadi tombol "Berikutnya" kedua di layar yang sama,
    // dengan tujuan berbeda (halaman vs modul).
    expect(sumber).toContain("sembunyikanPager");
  });

  it("mengisi tinggi area baca, bukan memakai kartu putih bertumpuk", () => {
    // Editor di lab adalah **alat kerja**, bukan contoh di tengah prosa. Kolom
    // kanannya mengambil `flex-1` dari rantai flex shell → pane, dan `KodeView`
    // diberi `flex-1` supaya editor mengisi ruang yang tersisa. Kalau rantainya
    // putus, editor tumbuh mengikuti isinya dan pane hasilnya keluar layar.
    //
    // Tingginya sengaja **tidak** dihitung dari `100dvh`: itu salah begitu
    // `CourseSessionPrompt` ikut memakan tinggi di atasnya (kolomnya meleset
    // turun dan dasarnya terselip di balik bar kaki). `min-h-0` di sepanjang
    // rantai adalah yang membuat kolom flex boleh menyusut di bawah tinggi
    // isinya — tanpa itu `flex-1` tidak berarti apa-apa.
    expect(sumber).toContain("lg:flex-1");
    // Lantai supaya editor tetap punya ruang kerja saat halaman juga memuat
    // kuis; tinggi sebenarnya dibagi lewat rantai flex di atasnya.
    expect(sumber).toContain("lg:min-h-[20rem]");
    expect(sumber).toContain("lg:sticky");
    expect(sumber).toContain("lg:h-full");
    // Tidak ada tinggi viewport yang dipatok dengan angka ajaib. Yang benar
    // adalah rantai flex di atas; `h-[calc(...)]`/`h-[min(...)]` adalah
    // persis pola yang gagal begitu isi di atas kolom ikut berubah tinggi.
    expect(sumber).not.toMatch(/h-\[(calc|min)\(/);
    // `min-h-0 flex-1` pada `KodeView` adalah pasangan `flex-1` yang membuat
    // kotaknya boleh lebih pendek dari isinya.
    expect(sumber).toMatch(/className="min-h-0 flex-1"/);
  });
});
