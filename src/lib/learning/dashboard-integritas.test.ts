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

/** Sumber seluruh komponen dashboard peserta. */
function sumberKomponenDashboard(): Array<{ nama: string; isi: string }> {
  return readdirSync(DIR_DASHBOARD)
    .filter((f) => f.endsWith(".tsx"))
    .map((f) => ({ nama: f, isi: readFileSync(path.join(DIR_DASHBOARD, f), "utf8") }));
}

describe("dashboard peserta tidak mengklaim angka yang tidak bisa ditelusuri", () => {
  it("halaman dashboard tidak mengimpor profil fixture", () => {
    // `src/fixtures/profile.json` adalah profil fiktif "@budi" dengan skor 87/100.
    // Membacanya di sini membuat setiap akun yang masuk melihat rekam jejak orang
    // lain seolah-olah miliknya sendiri — dan itulah yang terjadi sebelum rencana ini.
    expect(readFileSync(BERKAS_DASHBOARD, "utf8")).not.toContain("@/lib/fixtures");
  });

  it("tidak ada komponen dashboard yang membaca profil fixture", () => {
    for (const { nama, isi } of sumberKomponenDashboard()) {
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

  it("copy halaman tidak lagi menjanjikan streak dan Navigator", () => {
    // `PageHead.lead` di halaman ini masih menyebut "Jadwal, streak, rekomendasi
    // Navigator" — janji yang tidak lagi didukung halaman mana pun setelah Task 2.
    const isi = readFileSync(BERKAS_DASHBOARD, "utf8");
    expect(isi).not.toMatch(/streak/i);
    expect(isi).not.toMatch(/navigator/i);
  });

  it("halaman tetap menampilkan dua permukaan nyata", () => {
    // Penjaga penutup. Tanpa ini, cara termurah untuk membuat semua uji di
    // atas hijau adalah mengosongkan halaman — dan halaman kosong juga lolos.
    // Rekomendasi personal dan tauran lowongan adalah dua hal yang benar-benar
    // ada, jadi keduanya harus tetap di sini.
    const isi = readFileSync(BERKAS_DASHBOARD, "utf8");
    expect(isi).toContain("DashboardRecommendations");
    expect(isi).toContain("JobInboxCard");
  });
});
