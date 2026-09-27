import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

/**
 * Kontrak: **"Selanjutnya" di bar kaki reader memakai gradien merek.**
 *
 * "Selanjutnya" adalah satu-satunya aksi **maju** di halaman reader, jadi ia
 * yang membawa `--brand-grad` — ramp yang sama dengan CTA "Daftar" di navbar,
 * tombol "Pindai lowongan baru", dan `Button variant="brand"`. Dua tombol lain
 * di bar itu ("Sebelumnya", "AI Mastery") tetap netral: kalau ketiganya
 * berwarna, tidak ada lagi yang menonjol dan gradiennya kehilangan artinya.
 *
 * Kenapa ini butuh penjaga sendiri, bukan cukup ditempel di tes perilaku:
 * kegagalannya **tidak bisa dilihat** oleh `typecheck`, `lint`, maupun
 * `vitest` yang memeriksa struktur DOM —
 *
 * 1. Varian tombolnya diganti ke netral tetap menghasilkan HTML yang sama
 *    bentuknya; yang hilang hanya warnanya.
 * 2. Yang lebih halus: menumpuk kelas netral **di samping** varian merek.
 *    `.chrome-btn`/`.chrome-btn-brand` di `globals.css` tidak berada di dalam
 *    `@layer` Tailwind, sedangkan kelas seperti `text-gray-700` ada di
 *    `@layer utilities` — jadi CSS yang tak berlapis menang, labelnya jadi
 *    abu-abu di atas gradiennya, dan hover-nya tidak terlihat sama sekali.
 *    Nol error.
 * 3. Dan menulis gradiennya sendiri (`linear-gradient(...)`) alih-alih
 *    memakai token akan membuat tombol ini jadi satu-satunya tombol merek
 *    dengan ramp yang berbeda. Ramp-nya sengaja TIDAK digelapkan: `#bfdbfe`
 *    di ujung pale memang tidak lolos AA untuk label putih, dan itu keputusan
 *    merek yang sudah dicatat di `globals.css`.
 *
 * **Mekanismenya berganti, kontraknya tidak.** Dulu tombol maju memakai kelas
 * `brand-fill` yang dikarang di komponen ini; sekarang ia memakai kelas navbar
 * yang sebenarnya (`chrome-btn chrome-btn-brand`), persis `DashboardButton`.
 * Itu justru lebih kuat dari sebelumnya: `brand-fill` hanya menyalin warnanya,
 * sedangkan `chrome-btn-brand` ikut membawa tinggi, radius, bayangan, dan
 * `transform` hover/active yang sama dengan navbar. Karena itu tes di bawah
 * menuntut **nama kelas yang nyata**, bukan sekadar "ada token gradien di suatu
 * tempat".
 *
 * Berkas tes ini terpisah dari `materi-foot-bar.test.ts` dengan sengaja:
 * berkas itu berisi struktur bar dan sedang ditulis terpisah, jadi
 * menumpangkan penjaga warna ke dalamnya berarti dua pekerjaan menyentuh satu
 * berkas yang sama.
 *
 * Diukur di Chromium pada `/belajar/net-dotnet-enterprise/materi/<modul>`
 * (1440px dan 390px): `background-image` tombolnya
 * `linear-gradient(to right bottom, rgb(59,130,246), rgb(96,165,250),
 * rgb(191,219,254))` — yaitu `--brand-grad` apa adanya — dengan `color:
 * rgb(255,255,255)`, `border-radius: 12px`, dan tinggi 44px di kedua lebar.
 * Ketiganya identik dengan `a.chrome-btn-brand` di navbar pada pengukuran yang
 * sama.
 */

const AKAR = fileURLToPath(new URL("../../../../", import.meta.url));
const BERKAS = join(AKAR, "src/components/features/learning/materi-foot-bar.tsx");
const CSS = readFileSync(join(AKAR, "src/app/globals.css"), "utf8");

/** Sumber tanpa komentar: komentar di berkas itu menjelaskan ramp-nya, jadi
 *  menguji teks mentah akan gagal justru karena dokumentasinya benar. */
function tanpaKomentar(teks: string): string {
  return teks
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "$1");
}

const SUMBER = tanpaKomentar(readFileSync(BERKAS, "utf8"));

/** Blok JSX tombol "Selanjutnya" — dari `{sesudah ? (` sampai cabang `) : (`. */
const BLOK_LANJUT = SUMBER.match(/\{sesudah \? \([\s\S]*?\) : \(/)?.[0] ?? "";
/** Blok JSX tombol "Sebelumnya" — dari `{sebelum ? (` sampai cabang `) : (`. */
const BLOK_SEBELUM = SUMBER.match(/\{sebelum \? \([\s\S]*?\) : \(/)?.[0] ?? "";

describe("bar kaki reader — gradien tombol maju", () => {
  it("memakai kelas merek navbar, bukan ramp tulisan sendiri", () => {
    // `chrome-btn-brand` membawa `--brand-grad` + `--brand-shadow` + `color: #fff`
    // sekaligus (lihat blok `.chrome-btn-brand`). Menulis gradiennya sendiri di
    // sini berarti ramp kedua yang bisa melenceng dari ramp navbar.
    expect(BLOK_LANJUT, "blok tombol 'Selanjutnya' tidak ditemukan").not.toBe("");
    expect(BLOK_LANJUT).toContain("kelasPrimer");
    // Kelas primernya benar-benar kelas navbar, dan kelas itu ada di CSS.
    const defPrimer = SUMBER.split("kelasPrimer = ")[1]?.split(";")[0] ?? "";
    expect(defPrimer).toContain("chrome-btn-brand");
    expect(CSS).toMatch(/--brand-grad:\s*linear-gradient/);
    expect(CSS).toMatch(/\.chrome-btn-brand \{[\s\S]*?background:\s*var\(--brand-grad\)/);
    // Tidak ada gradien/hex yang ditulis tangan di komponennya.
    expect(SUMBER).not.toMatch(/linear-gradient|from-\[#|bg-\[#|to-\[#/);
  });

  it("hanya tombol maju yang berwarna", () => {
    // "Sebelumnya" dan AI Mastery tetap netral. Kalau gradiennya disebar ke
    // ketiganya, tombol maju berhenti terbaca sebagai aksi utama.
    //
    // Diuji dari **pemakaian**, bukan dari definisi kelasnya: menukar
    // `kelasSekunder` menjadi `kelasPrimer` pada tombol AI Mastery tidak akan
    // terdeteksi kalau yang diperiksa hanya "kelasPrimer berisi chrome-btn-brand".
    const blokAI = SUMBER.split('aria-controls="drawer-tutor"')[1]?.split("</button>")[0] ?? "";
    expect(blokAI, "blok tombol AI Mastery tidak ditemukan").toContain("kelasSekunder");
    expect(blokAI).not.toContain("kelasPrimer");
    // Dan yang memakai `kelasPrimer` adalah tombol maju.
    expect(BLOK_LANJUT).toContain("kelasPrimer");
    // "Sebelumnya" juga netral.
    expect(BLOK_SEBELUM, "blok tombol 'Sebelumnya' tidak ditemukan").not.toBe("");
    expect(BLOK_SEBELUM).toContain("kelasSekunder");
    expect(BLOK_SEBELUM).not.toContain("kelasPrimer");
  });

  it("tidak menumpuk kelas netral di atas varian merek", () => {
    // Kegagalan senyap yang paling mudah terjadi: `chrome-btn-brand` +
    // `chrome-btn-white`. Keduanya tak berlapis dengan spesifisitas sama, jadi
    // yang menang adalah yang terakhir di `globals.css` — dan urutan itu bisa
    // berubah tanpa satu pun error muncul.
    expect(BLOK_LANJUT).not.toContain("kelasSekunder");
    expect(BLOK_LANJUT).not.toContain("chrome-btn-white");
    // Tombol "Selanjutnya" yang nonaktif (modul terakhir) tetap boleh abu-abu —
    // itu cabang `else`, bukan tombol yang ber-`kelasPrimer`.
    const blokMati = SUMBER.match(/title="Ini modul terakhir"[\s\S]{0,400}/)?.[0] ?? "";
    expect(blokMati, "tombol mati di modul terakhir tidak ditemukan").not.toBe("");
    expect(blokMati).toContain("kelasMati");
  });

  it("tidak mengurangi lantai target sentuh 44px demi gradiennya", () => {
    // Gradien tidak boleh datang dengan harga tinggi tombol. `chrome-btn`
    // tingginya 40px, jadi `!h-11` yang menaikkannya ke lantai 44px; dan karena
    // labelnya disembunyikan di bawah 641px, `!min-w-11` yang menjaga lebarnya.
    expect(SUMBER).toContain("!h-11");
    expect(SUMBER).toContain("!min-w-11");
  });
});
