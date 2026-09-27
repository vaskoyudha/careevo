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
    expect(BLOK_MODUL).toContain("/belajar/${kursus.slug}/materi/${m.id}");
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
   * Potongan JSX **milik tombol itu sendiri** — dari `href={hrefLanjut}` sampai
   * labelnya. Sengaja diikat ke `hrefLanjut` (bukan sekadar jarak N karakter ke
   * belakang): beberapa ratus karakter di atasnya ada bilah progres yang memang
   * `rounded-full`, jadi jendela lebar akan menangkap pil itu dan assertion
   * negatifnya gagal di kode yang benar.
   */
  const mulaiCta = SUMBER.indexOf("href={hrefLanjut}");
  const blokCta = SUMBER.slice(mulaiCta, SUMBER.indexOf("Lanjutkan belajar", mulaiCta));

  it("memakai sudut `--radius-md`, bukan pil penuh", () => {
    expect(mulaiCta, "CTA 'Lanjutkan belajar' tidak ditemukan").toBeGreaterThanOrEqual(0);
    expect(blokCta).toContain("rounded-[var(--radius-md)]");
    expect(blokCta).not.toMatch(/rounded-full/);
  });
});
