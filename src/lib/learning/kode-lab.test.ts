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

  it("menyediakan pembagi kolom yang lebarnya bisa diatur peserta", () => {
    // Permintaan pemilik produk: kolom materi dan editor bisa dilebarkan-
    // sempitkan. Yang gampang hilang tanpa satu pun error:
    //
    //  1. **Pembaginya hilang** — kolomnya kembali terkunci separuh-separuh, dan
    //     peserta yang kodenya panjang tidak bisa melebarkan editornya.
    //  2. **Track grid-nya tidak menyusut** — `1fr` di dalam grid sama dengan
    //     `minmax(auto, 1fr)`, jadi kolomnya menolak mengecil di bawah lebar
    //     isinya. Seretnya lalu terasa "mentok" di satu arah. Karena itu aturan
    //     track-nya wajib `minmax(0, …)`.
    //  3. **Nilai tersimpannya tidak dipakai** — pembagiannya kembali ke tengah
    //     setiap halaman dimuat.
    expect(sumber).toContain("<PembagiLab");
    expect(sumber).toContain("useBagiLab(");
    expect(sumber).toContain("--lab-bagi");
    // Aturan track-nya hidup di CSS; yang dijaga di sini cuma bentuknya.
    expect(sumber).not.toMatch(/lg:grid-cols-2/);
    const css = readFileSync(
      fileURLToPath(new URL("../../app/globals.css", import.meta.url)),
      "utf8",
    );
    expect(css).toMatch(/grid-template-columns: var\(--lab-bagi/);
    expect(css).toMatch(/minmax\(0, 1fr\) 6px minmax\(0, 1fr\)/);
  });

  it("merentangkan kartu materi dan memakai lebar penuh sampai tepi", () => {
    // Permintaan pemilik produk, dengan CodeChef sebagai acuan: panel materi dan
    // panel editor membentang sampai tepi kiri-kanan, dan kolomnya berhenti
    // tepat di atas bar kaki — bukan menggantung dengan celah kosong di bawah.
    //
    // Tiga hal yang dijaga, semuanya properti CSS yang tidak akan gagal di
    // `typecheck`/`lint`/render mana pun:
    //
    //  1. Kartu materi menerima `lab-kartu-penuh`, yang membuatnya
    //     `min-height: 100%` di dalam kolom yang menggulir.
    //  2. Halaman lab melepas `max-w-3xl`; tanpa itu lebarnya kembali 768px.
    //  3. Padding samping `main` dikecilkan (bukan dihapus) lewat
    //     `lab-isi-penuh`, supaya kartunya hampir menyentuh tepi tanpa benar-
    //     benar menempel — sudut membulat yang menyentuh tepi viewport
    //     terpotong.
    expect(sumber).toContain("lab-kartu-penuh");
    const css = readFileSync(
      fileURLToPath(new URL("../../app/globals.css", import.meta.url)),
      "utf8",
    );
    expect(css).toMatch(/\.reader-shell \.lab-isi-penuh \{[\s\S]*?padding-left: 0\.75rem/);
    expect(css).toMatch(/\.lab-kartu-penuh \{[\s\S]*?min-height: 100%/);
    // Padding dalam kartu materi ikut dirapatkan, dari `p-5 sm:p-7` (28px).
    expect(css).toMatch(/\.lab-kolom-kiri article \{[\s\S]*?--lab-pad-kartu: 1\.25rem/);
    // Halaman lab melepas `max-w-3xl` dan melepas padding `main`-nya; halaman
    // prosa tidak boleh ikut dilebarkan (1280px terlalu panjang untuk dibaca).
    const shell = readFileSync(
      fileURLToPath(new URL("../../components/features/learning/materi-shell.tsx", import.meta.url)),
      "utf8",
    );
    expect(shell).toContain("lab-isi-penuh");
    expect(shell).toContain("mx-auto w-full max-w-3xl");
    expect(shell).not.toMatch(/lebarLab \? "max-w-6xl"/);
  });

  it("memakai permukaan IDE, bukan kartu putih bertumpuk", () => {
    // Editor di lab adalah **alat kerja**, bukan contoh di tengah prosa: kartu
    // gelap dengan baris tab `main.cpp`, permukaan editor, dan bilah jalankan.
    // Kalau kelasnya hilang, bloknya kembali jadi panel baca biasa.
    expect(sumber).toContain("lg:sticky");
    expect(sumber).toContain("lg:h-full");
    expect(sumber).toContain("lg:overflow-y-auto");
  });

  it("tidak meregangkan editor mengisi sisa viewport", () => {
    // Koreksi dari versi pertama: `flex-1` + `height: 100%` membuat program 12
    // baris mendapat kotak gelap 548px — ~300px ruang kosong di dalam editor,
    // dan tombol Jalankan melayang jauh di bawah kode terakhir. Tinggi editor
    // harus mengikuti isinya, dibatasi lantai dan batas atas di `globals.css`.
    //
    // Dijaga dari sumber: ini properti CSS yang tidak akan gagal di
    // `typecheck`, `lint`, maupun render mana pun — hanya terlihat di layar.
    expect(sumber).not.toMatch(/className="min-h-0 flex-1"/);
    // Kolom **kanan** tidak lagi memakai `h-full`: hanya kolom kiri (bahan
    // bacaan) yang menggulir di dalam kolomnya sendiri.
    const kolomKanan = sumber.match(/className="(lab-kolom-kanan[^"]*)"/)?.[1] ?? "";
    expect(kolomKanan, "kolom kanan tidak ditemukan").not.toBe("");
    expect(kolomKanan).not.toContain("h-full");
    const css = readFileSync(
      fileURLToPath(new URL("../../app/globals.css", import.meta.url)),
      "utf8",
    );
    // `.kode-view-lab` tidak boleh lagi `height: 100%`, dan scroller-nya harus
    // punya batas atas yang jelas.
    const blokLab = css.match(/\.kode-view-lab \{([\s\S]*?)\n\}/)?.[1] ?? "";
    expect(blokLab).not.toContain("height: 100%");
    expect(css).toMatch(/\.kode-view-lab \.cm-scroller \{[\s\S]*?max-height: min\(62vh, 640px\)/);
  });
});
