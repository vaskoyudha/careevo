/**
 * Penjaga profil publik — **uji statis**.
 *
 * Repo menjalankan Vitest di `environment: node` (tanpa jsdom), jadi halaman
 * tidak bisa dirender di sini. Yang dijaga adalah *batas* yang paling mudah
 * hilang diam-diam, dan keduanya sudah menelan satu bug nyata.
 *
 * **1. Skor yang tampil harus berasal dari database, bukan fixture.**
 * `/p/[username]` sebelumnya menampilkan `profile.score_total` dari
 * `src/fixtures/profile.json` — angka milik profil fiktif, di halaman yang
 * justru dibaca perekrut. `npm run check` dan `next build` tidak menangkapnya:
 * keduanya hijau saat angka milik orang lain sedang dipajang.
 *
 * **2. Akun database harus ikut dalam keputusan "profil tidak ditemukan".**
 * Ini bug kedua, ditemukan lewat browser: blok skor & sertifikat diletakkan
 * **setelah** early-return, sehingga akun mana pun yang tidak punya profil
 * fixture dan belum pernah menyimpan resume — yaitu setiap akun yang bukan akun
 * demo — tidak pernah menampilkan skor dan sertifikatnya sama sekali. Halaman
 * tetap `200` dan tidak error, jadi tidak ada gate yang menangkapnya.
 *
 * Pindaian membaca seluruh isi berkas termasuk komentar, jadi urutan
 * pemanggilan pada sumber sama dengan yang diuji di sini.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../../..");
const BERKAS = path.join(ROOT, "src/app/(public)/p/[username]/page.tsx");

const isi = readFileSync(BERKAS, "utf8");

/** Posisi karakter pertama kemunculan `needle`, atau -1. */
function posisi(needle: string): number {
  return isi.indexOf(needle);
}

describe("profil publik — skor bukan fixture", () => {
  it("tidak pernah membaca skor dari fixture", () => {
    // `getProfile` masih dipakai untuk badge/karya/timeline fixture, jadi yang
    // diperiksa adalah **field skor**-nya, bukan seluruh import.
    expect(isi).not.toMatch(/profile\.score_total|profile\?\.score_total/);
  });

  it("menampilkan skor dari reader database", () => {
    expect(isi).toMatch(/skorIntegritasDb\(/);
  });

  it("menampilkan sertifikat dari reader database", () => {
    // Sertifikat adalah yang menjawab pertanyaan perekrut yang sebenarnya —
    // "kompetensinya bisa dibuktikan?" — lewat tautan yang tidak butuh login.
    expect(isi).toMatch(/listSertifikatUserId\(/);
    expect(isi).toMatch(/href=\{`\/verify\/\$\{s\.token\}`\}/);
  });
});

describe("profil publik — akun ikut dalam keputusan not-found", () => {
  it("membaca akun sebelum pemeriksaan profil tidak ditemukan", () => {
    // Urutan ini yang diperbaiki. `cariUserUntukProfil` harus muncul **sebelum**
    // `if (!profile && !resume ...)`, kalau tidak blok skor/sertifikat berada di
    // belakang early-return dan tidak pernah dirender untuk akun non-demo.
    const bacaAkun = posisi("cariUserUntukProfil(decoded)");
    const cekNotFound = posisi("!profile && !resume");
    expect(bacaAkun, "cariUserUntukProfil tidak ditemukan di halaman").toBeGreaterThan(-1);
    expect(cekNotFound, "pemeriksaan not-found tidak ditemukan").toBeGreaterThan(-1);
    expect(
      bacaAkun,
      "akun dibaca SETELAH pemeriksaan not-found, jadi blok skor tidak akan pernah dirender",
    ).toBeLessThan(cekNotFound);
  });

  it("memakai akun sebagai salah satu syarat halaman ditemukan", () => {
    // Ini yang membuat pemeriksaan di atas berarti. Tanpa `&& !akun`, akun yang
    // hanya ada di database tetap mengembalikan halaman "tidak ditemukan".
    expect(isi).toMatch(/!profile && !resume && !akun/);
  });
});

describe("profil publik — batas yang tidak boleh dilanggar", () => {
  it("tidak menulis rincian per kategori pelanggaran ke halaman tanpa login", () => {
    // Profil ini dibaca tanpa kredensial. "Meninggalkan sesi terverifikasi: 3"
    // adalah data pribadi; yang boleh tampil hanya apakah ada catatan dan
    // jumlahnya.
    expect(isi).not.toMatch(/DAFTAR_PELANGGARAN|kategoriPelanggaran\b.*map\(/);
  });

  it("tidak memakai kata vonis di copy yang dirender otomatis", () => {
    // Batas yang sama seperti `katalog.test.ts`; di halaman publik dampaknya
    // lebih besar karena tidak ada konteks yang menjelaskan menilai.
    for (const kata of ["curang", "menyalin", "mencontek", "penyalahgunaan", "bersalah"]) {
      expect(isi.toLowerCase(), `halaman publik memuat kata vonis "${kata}"`).not.toContain(kata);
    }
  });
});

/**
 * Panel verifikator — satu-satunya jalan manusia masuk ke
 * `integrity_violations`.
 *
 * Tanpa penjaga ini, menghapus `FormPelanggaran` dari halaman detail
 * integritas akan membuat **seluruh sistem skor tidak bisa dipakai**: tidak ada
 * satu pun-catatan yang bisa tercatat, sehingga skor selamanya 100 untuk semua
 * orang. Tidak ada test lain yang menangkapnya, dan tidak ada error pun yang
 * muncul.
 */
describe("panel verifikator", () => {
  const HALAMAN = path.join(ROOT, "src/app/(verifikator)/performa/integritas/[owner]/page.tsx");
  const FORM = path.join(ROOT, "src/components/features/performa/form-pelanggaran.tsx");
  const isiHalaman = readFileSync(HALAMAN, "utf8");
  const isiForm = readFileSync(FORM, "utf8");

  it("halaman detail integritas tetap merender form pencatatan", () => {
    expect(isiHalaman).toMatch(/<FormPelanggaran\b[^>]*>/);
  });

  it("halaman detail integritas menampilkan skor dari fungsi yang sama", () => {
    // Kalau halaman staf menghitung skor sendiri, angka yang dilihat reviewer
    // bisa berbeda dari yang dilihat peserta — dan itu angka yang jadi keputusan.
    expect(isiHalaman).toMatch(/skorIntegritasDb\(/);
  });

  it("halaman detail integritas menampilkan catatan yang sudah diputuskan", () => {
    expect(isiHalaman).toMatch(/listSemuaPelanggaran\(/);
  });

  it("form tidak pernah mengirim besaran penalti", () => {
    // Ini yang menjaga skor tetap berarti. Field penalti di form berarti
    // reviewer bisa memilih sendiri ukurannya, dan Zod di action tidak akan
    // menolaknya karena field itu memang tidak ada di sana.
    expect(isiForm).not.toMatch(/name="penalty"|name="bobot"|name="points"/);
  });

  it("form memakai katalog yang sama dengan database", () => {
    // `<select>` harus offering nilai yang CHECK database terima. Katalog
    // diimpor, bukan ditulis ulang di komponen.
    expect(isiForm).toMatch(/DAFTAR_PELANGGARAN/);
  });

  it("action memvalidasi jenis terhadap katalog", () => {
    const aksi = readFileSync(path.join(ROOT, "src/actions/integritas.ts"), "utf8");
    expect(aksi).toMatch(/z\.enum\(JENIS_PELANGGARAN/);
  });

  it("form menjelaskan bahwa bobotnya ditentukan server", () => {
    // Tanpa kalimat ini, reviewer akan mencari field penalti yang memang tidak
    // ada dan menyimpulkan form-nya rusak.
    expect(isiForm).toContain("ditentukan server");
  });
});
