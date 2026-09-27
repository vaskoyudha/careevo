import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

/**
 * Kontrak: **aksi modul di silabus adalah satu tombol merek, di kanan kartu.**
 *
 * Halaman kursus (`/belajar/[slug]`) adalah silabus: daftar modul yang mengantar
 * peserta ke reader. Dulu tiap baris punya dua hal di kanan-kirinya:
 *
 * 1. tautan teks kecil "Buka materi" yang duduk **di dalam baris meta**
 *    (`90 mnt · 2 halaman`), terbaca sebagai keterangan, bukan sebagai pintu
 *    masuk; dan
 * 2. tombol "Tandai selesai" di slot kanan kartu — salinan kedua dari aturan
 *    penyelesaian yang sudah hidup di reader (`materi-shell.tsx`).
 *
 * Sekarang keduanya diganti satu tombol merek di kanan kartu. Yang dijaga di
 * sini bukan selera, melainkan tiga properti yang semuanya bisa hilang tanpa
 * satu pun error:
 *
 * 1. **Kelasnya kelas navbar yang nyata**, bukan salinan warnanya. `chrome-btn
 *    chrome-btn-brand` membawa tinggi, radius `--radius`, `--brand-grad`,
 *    bayangan, dan `transform` hover/active yang sama dengan `DashboardButton`
 *    dan tombol `Daftar`. Menulis `bg-[#0056D2] rounded-full px-4` menghasilkan
 *    HTML yang bentuknya sama dan tidak ada gerbang yang bisa melihat bedanya —
 *    lihat alasan yang sama di `materi-foot-bar-brand.test.ts`.
 * 2. **Ia berada di slot kanan**, bukan lagi di baris meta. Kalau ia kembali ke
 *    dalam `<p>` meta, kelasnya masih benar dan tombolnya masih tampil, jadi
 *    satu-satunya cara mengunci posisinya adalah bentuk markup-nya.
 * 3. **"Tandai selesai" tidak dirender di sini lagi.** Modul ditandai selesai
 *    oleh reader, begitu halaman terakhirnya tercapai dan sesi terverifikasi
 *    berjalan. Menghidupkan kembali salinan itu bukan kegagalan tampilan: ia
 *    jalur penyelesaian kedua yang bisa menyimpang dari `pilihJalurPenyelesaian`
 *    (dijaga di `selesaikan-modul.test.ts`).
 *
 * Diperiksa dari **teks sumber**, bukan render: `detail-kursus.tsx` adalah
 * komponen klien yang membaca konteks sesi, dan lingkungan test repo ini `node`
 * tanpa jsdom. Yang dijaga di sini adalah bentuk kode — pola yang sudah dipakai
 * `materi-shell.test.ts` dan `materi-foot-bar-brand.test.ts`.
 */

const AKAR = fileURLToPath(new URL("../../../../", import.meta.url));
const CSS = readFileSync(join(AKAR, "src/app/globals.css"), "utf8");

/** Sumber tanpa komentar: komentarnya menjelaskan tombol ini panjang-lebar,
 *  jadi menguji teks mentah akan gagal justru karena dokumentasinya benar. */
function tanpaKomentar(teks: string): string {
  return teks
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "$1");
}

const SUMBER = tanpaKomentar(
  readFileSync(
    join(AKAR, "src/components/features/learning/detail-kursus.tsx"),
    "utf8",
  ),
);

/** Blok JSX baris modul — dari `<ol className="space-y-3">` sampai `</ol>`. */
const BLOK_MODUL = SUMBER.slice(
  SUMBER.indexOf('<ol className="space-y-3">'),
  SUMBER.indexOf("</ol>"),
);

describe("silabus — aksi modul", () => {
  it("memakai kelas merek navbar, bukan ramp tulisan sendiri", () => {
    expect(BLOK_MODUL, "blok daftar modul tidak ditemukan").not.toBe("");
    // Kelas navbar yang nyata, dan kelas itu memang ada di CSS.
    expect(BLOK_MODUL).toContain("chrome-btn chrome-btn-brand");
    expect(CSS).toMatch(/\.chrome-btn-brand \{[\s\S]*?background:\s*var\(--brand-grad\)/);
    // Tidak ada gradien/hex latar yang ditulis tangan di baris modulnya.
    expect(BLOK_MODUL).not.toMatch(/linear-gradient|bg-\[#|from-\[#|to-\[#/);
  });

  it("duduk di slot kanan kartu, bukan di dalam baris meta", () => {
    // Slotnya elemen saudara **setelah** kolom teks (`min-w-0 flex-1`), dan
    // sebelum `</li>`. Kalau ia dipindah kembali ke dalam `<p className="mt-1.5
    // ...">` meta, urutannya berubah dan assertion ini merah.
    const kolomTeks = BLOK_MODUL.indexOf('className="min-w-0 flex-1"');
    const slotAksi = BLOK_MODUL.indexOf("shrink-0 self-center");
    const penutup = BLOK_MODUL.lastIndexOf("</li>");
    expect(kolomTeks, "kolom teks modul tidak ditemukan").toBeGreaterThanOrEqual(0);
    expect(slotAksi, "slot aksi kanan tidak ditemukan").toBeGreaterThan(kolomTeks);
    expect(slotAksi).toBeLessThan(penutup);

    // Dan baris meta sudah tidak memuat tautan "Buka materi" lagi.
    const barisMeta = BLOK_MODUL.slice(
      BLOK_MODUL.indexOf('<p className="mt-1.5'),
      BLOK_MODUL.indexOf("</p>", BLOK_MODUL.indexOf('<p className="mt-1.5')),
    );
    expect(barisMeta, "baris meta modul tidak ditemukan").not.toBe("");
    expect(barisMeta).not.toContain("Buka materi");
  });

  it("tetap menuju reader untuk modul berisi dan tab baru untuk tautan luar", () => {
    // `punyaIsi` memilih **tujuan**, bukan gaya: modul berisi halaman/kuis/
    // lampiran masuk reader; modul yang hanya punya tautan luar membuka
    // sumbernya di tab baru, dan itu sebabnya panah ↗ masih ada di sana.
    //
    // Modul berisi sekarang lewat **gerbang** (`GerbangMulaiCourse`), bukan
    // `Link` langsung: tombolnya menyimpan id modulnya dulu, dan gerbang itu
    // yang mengantar ke reader setelah prasyaratnya beres. Karena itu yang
    // dijaga di sini adalah pengawatan id modulnya — kalau `setModulDituju(m.id)`
    // hilang, tombolnya membuka dialog untuk modul yang salah (atau kosong).
    expect(BLOK_MODUL).toContain("setModulDituju(m.id)");
    expect(SUMBER).toContain("hrefTujuan={`/belajar/${kursus.slug}/materi/${modulDituju ?? \"\"}`}");
    expect(BLOK_MODUL).toContain("Buka materi ↗");
    expect(BLOK_MODUL).toContain('target="_blank"');
  });

  it("tidak lagi merender tombol penyelesaian", () => {
    // Jalur penyelesaian hidup di reader saja. Teks tombolnya, `aria-pressed`-nya,
    // dan state "modul sedang disimpan"-nya (`modulSibuk`) semuanya ikut hilang —
    // bukan hanya disembunyikan CSS.
    expect(BLOK_MODUL).not.toContain("Tandai selesai");
    expect(BLOK_MODUL).not.toContain("aria-pressed");
    expect(SUMBER).not.toContain("modulSibuk");
  });
});

/**
 * Kartu aksi sidebar — "Lanjutkan belajar".
 *
 * Tombol ini dulu berbentuk pil penuh (`rounded-full`). Yang diminta: bentuknya
 * disamakan dengan tombol navbar, yaitu sudut `--radius-md` (14px) seperti kontrol
 * produk lain — aturan DESIGN.md line 66. Dikunci dari sumber karena
 * `typecheck`/`vitest` buta terhadap piksel, dan radiusnya bisa kembali jadi
 * `rounded-full` tanpa satu pun error di tempat lain.
 */
describe("kursus — CTA 'Lanjutkan belajar'", () => {
  /**
   * Potongan JSX **milik tombol itu sendiri** — dari `href={\`/belajar/...` sampai
   * labelnya. Sengaja diikat ke bentuk `href` yang khas tombol ini (bukan sekadar
   * jarak N karakter ke belakang): beberapa ratus karakter di atasnya ada bilah
   * progres yang memang `rounded-full`, jadi jendela lebar akan menangkap pil itu
   * dan assertion negatifnya gagal di kode yang benar.
   */
  const mulaiCta = SUMBER.indexOf("href={`/belajar/${kursus.slug}/materi/${modulBerikutnya.id}`}");
  const blokCta = SUMBER.slice(mulaiCta, SUMBER.indexOf("Lanjutkan belajar", mulaiCta));

  it("memakai sudut `--radius-md`, bukan pil penuh", () => {
    expect(mulaiCta, "CTA 'Lanjutkan belajar' tidak ditemukan").toBeGreaterThanOrEqual(0);
    expect(blokCta).toContain("rounded-[var(--radius-md)]");
    expect(blokCta).not.toMatch(/rounded-full/);
  });
});

/**
 * Kartu "Challenge praktik" — arsip gambar + lembar putih yang menumpuknya.
 *
 * Kartu ini dulu memakai `PitaHeaderDither`: pita header berisi ground, dot
 * grid, video dithered lewat WebGL, dan veil — empat lapisan untuk satu baris
 * judul. Sekarang header-nya satu `.webp` statis (`challenge-praktik-hero.webp`)
 * plus wash arah, dan isinya diangkat ke lembar putih berujung membulat.
 *
 * Dikunci dari sumber karena semuanya buta bagi gerbang repo: `typecheck`,
 * `lint`, `vitest`, dan `build` hijau baiklah header-nya `.webp` atau gradien
 * rata, baiklah isinya menumpuk atau tidak. Tiga hal yang bisa hilang diam-diam:
 *
 *  1. **Kelas wash-nya.** Tanpa wash, garis tipis di separuh kiri arsip itu
 *     lewat tepat di bawah judul — cacat render, bukan dekorasi. Nilai alphanya
 *     juga berarti: `0.9`+ di 34% pertama yang menahan judul, lalu turun ke `0`
 *     supaya kartu kaca di kanan tetap terlihat.
 *  2. **`-mt-4` + `rounded-t-2xl` + `bg-white` + `z-10`.** Empat kelas satu
 *     paket, perangkat yang sama dengan kartu katalog dan panel loker.
 *  3. **`criteria` tinggal di blok sendiri** (`bg-blue-50 ring-blue-100`),
 *     bukan empat baris lepas di badan kartu.
 */
describe("kursus — kartu 'Challenge praktik'", () => {
  /** Blok JSX milik kartu praktiknya, dari `<section` yang dilabeli judul itu. */
  const penanda = 'aria-labelledby="judul-praktik"';
  const mulai = SUMBER.indexOf(penanda);
  const blok = SUMBER.slice(mulai, SUMBER.indexOf("</section>", mulai));

  it("memakai aset gambar sebagai header, bukan media dither", () => {
    expect(mulai, "kartu 'Challenge praktik' tidak ditemukan").toBeGreaterThanOrEqual(0);
    expect(blok, "aset header tidak ditemukan").toContain(
      "/images/belajar/challenge-praktik-hero.webp",
    );
    // Gambarnya dekoratif: tanpa alt, tidak ada teks yang perlu dibaca.
    expect(blok).toMatch(/alt=""/);
    // Media dither harus benar-benar hilang dari kartu ini.
    expect(blok, "media dither kembali ke kartu praktik").not.toMatch(
      /PitaHeaderDither|DitheredHeroBackdrop/,
    );
    // Dan impornya tidak boleh tertinggal di berkas ini sama sekali.
    expect(SUMBER).not.toContain("pita-header-dither");
  });

  it("menahan judul dengan wash arah, bukan scrim penuh", () => {
    // Wash kiri-ke-kanan dengan alpha menurun; DESIGN.md mengizinkan wash arah
    // dan melarang scrim penuh.
    const wash = blok.match(/bg-\[linear-gradient\(90deg,([^\]]*)\)\]/)?.[1] ?? "";
    expect(wash, "wash arah pada arsip header tidak ditemukan").not.toBe("");

    const alphas = [...wash.matchAll(/rgba\(255,255,255,([\d.]+)\)/g)].map((m) =>
      Number(m[1]),
    );
    expect(alphas.length, "stop wash tidak ditemukan").toBeGreaterThanOrEqual(3);
    // Stop pertama harus pekat: itulah yang menutup garis tipis di bawah judul.
    expect(
      alphas[0],
      `alpha awal wash ${alphas[0]} tidak cukup menutup garis di bawah judul`,
    ).toBeGreaterThanOrEqual(0.9);
    // Dan harus TURUN ke 0 supaya kartu kaca di kanan tetap terlihat.
    expect(
      alphas[alphas.length - 1],
      "wash tidak habis di sisi kanan; kartu kaca arsipnya ikut tertutup",
    ).toBe(0);
    for (let i = 1; i < alphas.length; i++) {
      expect(alphas[i]).toBeLessThan(alphas[i - 1]);
    }
  });

  it("mengangkat isinya ke lembar putih membulat yang menumpuk arsip", () => {
    const lembar =
      (blok.match(/className="[^"]*"/g) ?? []).find((k) =>
        k.includes("rounded-t-2xl"),
      ) ?? "";
    expect(lembar, "lembar putih berujung membulat tidak ditemukan").not.toBe("");

    const tumpang = lembar.match(/(?<![\w:-])-mt-(\d+)/)?.[1];
    expect(tumpang, "lembar tidak menumpuk arsip").not.toBeUndefined();
    expect(
      Number(tumpang) * 4,
      `-mt-${tumpang} hanya menumpuk ${Number(tumpang) * 4}px, kurang dari radius 16px`,
    ).toBeGreaterThanOrEqual(16);
    expect(lembar, "lembar tidak menutup arsip dengan putih").toMatch(/\bbg-white\b/);
    expect(lembar, "lembar tidak diposisikan").toMatch(/(?<![\w:-])relative/);
    expect(lembar, "lembar tidak dinaikkan di atas arsip").toMatch(/z-10/);
  });

  it("mengelompokkan standar penilaian di blok sendiri", () => {
    // `criteria` adalah satu-satunya isi kartu ini yang benar-benar dibutuhkan
    // peserta. Kalau ia kembali jadi empat baris lepas, kontraknya hilang.
    expect(blok, "blok 'Yang dinilai' tidak dikelompokkan").toMatch(
      /rounded-xl bg-blue-50[^"]*ring-1 ring-blue-100/,
    );
    expect(blok).toContain("Yang dinilai");
    expect(blok).toContain("tugas.criteria.map");
    // Eyebrow-nya `text-gray-600`, bukan `text-gray-500`: di atas `bg-blue-50`
    // tinta 11px itu turun ke bawah 4.5:1 (terukur 4.01:1).
    expect(blok).not.toMatch(/uppercase[^"]*text-gray-500/);
  });
});
