/**
 * Pemeriksaan statis untuk halaman dashboard peserta — **bukan** uji render.
 *
 * Repositori ini menjalankan Vitest di `environment: node` (tanpa jsdom), jadi
 * komponen server tidak bisa dirender di sini. Properti yang dijaga adalah
 * properti *batas*: halaman dashboard tidak boleh membaca data fixture dan
 * tidak boleh menampilkan klaim yang tidak bisa ditelusuri ke baris milik akun
 * yang sedang masuk. Pendekatan sumber-teks ini sama dengan yang dipakai
 * `src/lib/learning/security.test.ts`, dan alasannya juga sama: yang hilang
 * paling cepat di sini adalah sebuah kartu yang ditambahkan kembali.
 *
 * Uji ini sengaja memindai seluruh folder komponen dashboard, bukan satu
 * berkas. Akar masalahnya bukan satu berkas yang salah — folder itulah yang
 * memegang prototipe, dan berkas berikutnya akan menirunya.
 */

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../../..");
const BERKAS_DASHBOARD = path.join(ROOT, "src/app/(app)/dashboard/page.tsx");
const DIR_DASHBOARD = path.join(ROOT, "src/components/features/dashboard");

/**
 * Sumber seluruh komponen dashboard peserta, **termasuk subfoldernya**
 * (`jelajah/`). Pindaiannya rekursif karena komentar di atas menjanjikan
 * "seluruh folder", dan_folder_ itu sendiri yang memegang prototipe — sebuah
 * kartu yang ditambahkan di dalam `jelajah/` akan lolos begitu saja pada
 * pemindaian datar. `isFile()` menahan entri direktori agar tidak pernah
 * diteruskan ke `readFileSync` (dan tidak pernah melempar `EISDIR`), dan `nama`
 * disimpan relatif terhadap akar folder supaya pesan kegagalan menunjuk satu
 * berkas secara spesifik: `jelajah/program-card.tsx`.
 */
function sumberKomponenDashboard(): Array<{ nama: string; isi: string }> {
  return readdirSync(DIR_DASHBOARD, { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith(".tsx"))
    .map((d) => {
      const berkas = path.join(d.parentPath, d.name);
      return { nama: path.relative(DIR_DASHBOARD, berkas), isi: readFileSync(berkas, "utf8") };
    });
}

describe("dashboard peserta tidak mengklaim angka yang tidak bisa ditelusuri", () => {
  it("halaman dashboard tidak mengimpor profil fixture", () => {
    // `src/fixtures/profile.json` adalah profil fiktif "@budi" dengan skor 87/100.
    // Membacanya di sini membuat setiap akun yang masuk melihat rekam jejak orang
    // lain seolah-olah miliknya sendiri — dan itulah yang terjadi sebelum rencana ini.
    expect(readFileSync(BERKAS_DASHBOARD, "utf8")).not.toContain("@/lib/fixtures");
  });

  it("tidak ada komponen dashboard yang membaca profil fixture", () => {
    const komponen = sumberKomponenDashboard();
    // Penjaga untuk dua perulangan di berkas ini: kalau folder ini suatu saat
    // tidak memuat satu pun `.tsx`, keduanya jadi nol iterasi dan akan
    // melaporkan hijau tanpa menguji apa pun. Satu pemeriksaan sudah cukup
    // karena keduanya membaca sumber yang sama.
    expect(komponen.length).toBeGreaterThan(0);
    for (const { nama, isi } of komponen) {
      expect(`${nama}: ${isi}`, `${nama} mengimpor @/lib/fixtures`).not.toContain(
        "@/lib/fixtures",
      );
    }
  });

  it("kartu yang dihapus tidak kembali sebagai nama berkas", () => {
    // Nama berkasnya yang diperiksa: sebuah berkas bisa diganti namanya untuk
    // menghindari pemeriksaan lain, tapi ia tetap harus merender sesuatu, dan
    // apa pun yang dirender akan tertangkap oleh dua uji di atas.
    for (const { nama } of sumberKomponenDashboard()) {
      expect(nama).not.toBe("checkin-widget.tsx");
      expect(nama).not.toBe("dashboard-view.tsx");
    }
  });

  it("tidak ada sumber dashboard yang menjanjikan streak dan Navigator", () => {
    // Cakupannya harus mengikuti siapa saja yang bisa merender klaim itu, bukan
    // hanya `page.tsx`: kartu yang dikembalikan ke folder komponen lolos begitu
    // saja pada pemindaian satu berkas. Karena itu folder dipindai dengan
    // helper yang sama seperti dua uji di atas — termasuk `jelajah/`, tempat
    // prototipe pernah tinggal.
    //
    // Pindaian membaca seluruh isi berkas — komentar termasuk — jadi istilah
    // tidak bisa kembali masuk lewat copy maupun lewat komentar tanpa memaksa
    // keputusan yang sadar.
    const isiHalaman = readFileSync(BERKAS_DASHBOARD, "utf8");
    expect(
      isiHalaman,
      `${path.basename(BERKAS_DASHBOARD)} masih menjanjikan streak/Navigator`,
    ).not.toMatch(/streak|navigator/i);

    const komponen = sumberKomponenDashboard();
    // Penjaga untuk perulangan di berkas ini: kalau folder ini suatu saat tidak
    // memuat satu pun `.tsx`, iterasi di bawah jadi nol dan akan melaporkan hijau
    // tanpa menguji apa pun.
    expect(komponen.length).toBeGreaterThan(0);
    for (const { nama, isi } of komponen) {
      expect(`${nama}: ${isi}`, `${nama} masih menjanjikan streak/Navigator`).not.toMatch(
        /streak|navigator/i,
      );
    }
  });

  it("halaman tetap merender dua permukaan nyata", () => {
    // Penjaga penutup. Tanpa ini, cara termurah untuk membuat semua uji di atas
    // hijau adalah mengosongkan halaman — dan halaman kosong juga lolos. Jadi
    // yang diperiksa adalah *situs render*, bukan nama identifier: baris `import`
    // tidak pernah diawali `<`, jadi menghapus elemen sambil mempertahankan
    // importnya tidak akan lolos di sini. `tsconfig.json` tidak menyalakan
    // `noUnusedLocals` dan lint berjalan tanpa `--max-warnings=0`, jadi import
    // yang tak terpakai tidak akan tertangkap oleh perkakas lain.
    //
    // Rekomendasi personal dan tautan lowongan adalah dua hal yang benar-benar
    // ada, jadi keduanya harus tetap dirender. Polanya menerima props apa pun dan
    // tidak care self-closing atau tidak — yang diuji adalah "ada tag pembuka
    // untuk komponen ini", bukan format JSX-nya.
    const isi = readFileSync(BERKAS_DASHBOARD, "utf8");
    expect(isi).toMatch(/<DashboardRecommendations\b[^>]*>/);
    expect(isi).toMatch(/<JobInboxCard\b[^>]*>/);
  });
});
