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

  it("tidak ada sumber dashboard yang menjanjikan Navigator", () => {
    // **Cakupan sengaja dipersempit, bukan dihapus.** Dulu seluruh pola
    // `/streak|navigator/i` dilarang; sekarang `streak` tampil sebagai angka
    // nyata dari `learning_runs` (lihat `kartu-streak.tsx`), jadi melarangnya
    // sama dengan melarang fitur yang justru diminta. Yang tetap dilarang adalah
    // `navigator` — tidak ada satu pun "Navigator" yang bisa ditelusuri ke baris
    // milik akun yang masuk.
    //
    // Cakupannya tetap mengikuti siapa saja yang bisa merender klaim itu: kartu
    // yang dikembalikan ke folder komponen lolos begitu saja pada pemindaian satu
    // berkas. Karena itu folder dipindai dengan helper yang sama seperti dua uji
    // di atas — termasuk `jelajah/`, tempat prototipe pernah tinggal.
    //
    // Pindaian membaca seluruh isi berkas — komentar termasuk — jadi istilah
    // tidak bisa kembali masuk lewat copy maupun lewat komentar tanpa memaksa
    // keputusan yang sadar.
    const isiHalaman = readFileSync(BERKAS_DASHBOARD, "utf8");
    expect(
      isiHalaman,
      `${path.basename(BERKAS_DASHBOARD)} masih menjanjikan Navigator`,
    ).not.toMatch(/navigator/i);

    const komponen = sumberKomponenDashboard();
    // Penjaga untuk perulangan di berkas ini: kalau folder ini suatu saat tidak
    // memuat satu pun `.tsx`, iterasi di bawah jadi nol dan akan melaporkan hijau
    // tanpa menguji apa pun.
    expect(komponen.length).toBeGreaterThan(0);
    for (const { nama, isi } of komponen) {
      expect(`${nama}: ${isi}`, `${nama} masih menjanjikan Navigator`).not.toMatch(/navigator/i);
    }
  });

  it("angka streak dan skor hanya boleh datang dari lapisan server", () => {
    // Penyesuaian yang mengikuti bagian di atas. Melonggarkan larangan `streak`
    // membuka pintu kedua: komponen bisa menghitung streak sendiri dari state
    // modul, atau membaca angka dari fixture — keduanya terlihat benar di layar
    // dan tidak bisa ditelusuri ke `learning_runs`.
    //
    // Yang dijaga di sini adalah **sumbernya**, bukan kata kuncinya:
    // `kartu-streak.tsx` harus menerima angka dari luar, dan tidak boleh memanggil
    // fungsi hitung kehadiran sendiri. Aturan hitungannya teruji di
    // `kehadiran.test.ts`; yang di sini adalah "dipanggil dari mana".
    //
    // Pindaian ini membaca komentar juga, jadi penyebutan nama fungsi di dalam
    // dokumentasi komponen akan membuat test ini merah — itu disengaja: nama
    // fungsi hanya boleh muncul di berkas yang benar-benar memanggilnya.
    const streak = path.join(DIR_DASHBOARD, "kartu-streak.tsx");
    const isiStreak = readFileSync(streak, "utf8");
    expect(isiStreak).toMatch(/hariBeruntun/);
    expect(isiStreak, "kartu-streak menghitung streak sendiri di klien").not.toMatch(
      /ringkasKehadiran|hitungStreak|listRunUser/,
    );
    expect(isiStreak, "kartu-streak memakai jam peramban").not.toMatch(
      /Date\.now\(\)|toLocaleDateString/,
    );
  });

  it("kartu skor tidak menghitung skor sendiri dan tidak membaca fixture", () => {
    // Sama seperti di atas, untuk skor: angka harus diteruskan dari
    // `skorIntegritasDb`, bukan dihitung ulang dari `integrity_violations` yang
    // justru tidak boleh ada di bundel browser sama sekali.
    const skor = path.join(DIR_DASHBOARD, "kartu-skor.tsx");
    const isiSkor = readFileSync(skor, "utf8");
    expect(isiSkor).not.toContain("@/lib/fixtures");
    expect(isiSkor, "kartu-skor menghitung skor sendiri").not.toMatch(
      /hitungSkorIntegritas|integrityViolations|getDb/,
    );
    // Baris ini juga membaca komentar, jadi nama fungsi tidak boleh disebut di
    // dokumentasi komponen ini (lihat catatan di atas).
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

  it("halaman merender kelima permukaan angka tanpa menjaga daftar nama berkasnya", () => {
    // Penjaga penutup untuk bagian yang barusan dilonggarkan. Menghapus satu
    // blok dari dashboard harus terlihat di sini, bukan diam-diam membuat
    // halaman lebih tipis. Yang diperiksa adalah *situs render* — identifier
    // yang tak terpakai tidak akan tertangkap perkakas lain, karena
    // `tsconfig.json` tidak menyalakan `noUnusedLocals` dan lint berjalan tanpa
    // `--max-warnings=0`.
    //
    // `pilihCourseDilanjutkan` ikut diperiksa karena "lanjutkan" adalah
    // permukaan dengan rules; mengosongkan pemanggilnya akan membuat kartu
    // selalu menampilkan empty state tanpa error.
    const isi = readFileSync(BERKAS_DASHBOARD, "utf8");
    expect(isi).toMatch(/<KartuProfil\b[^>]*>/);
    expect(isi).toMatch(/<KartuStreak\b[^>]*>/);
    expect(isi).toMatch(/<KartuSkor\b[^>]*>/);
    expect(isi).toMatch(/<KartuLanjutkan\b[^>]*>/);
    expect(isi).toMatch(/<KartuSertifikat\b[^>]*>/);
    expect(isi).toMatch(/pilihCourseDilanjutkan\(/);
  });
});
