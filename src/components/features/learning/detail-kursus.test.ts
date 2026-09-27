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
 * Kartu "Challenge praktik" — satu kontainer, isinya langsung di atas wallpaper.
 *
 * Kartu ini dulu memakai `PitaHeaderDither`: pita header berisi ground, dot
 * grid, video dithered lewat WebGL, dan veil — empat lapisan untuk satu baris
 * judul. Sekarang header-nya satu `.webp` statis
 * (`challenge-praktik-hero.webp`) yang jadi latar **seluruh** kartu.
 *
 * Dikunci dari sumber karena semuanya buta bagi gerbang repo: `typecheck`,
 * `lint`, `vitest`, dan `build` hijau baiklah gambarnya pita atau wallpaper
 * penuh, baiklah isinya di lembar putih atau langsung di atas gambar. Empat hal
 * yang bisa hilang diam-diam:
 *
 *  1. **Gambar benar-benar menutupi kartu.** `<Image>` harus anak langsung
 *     `<section>` dengan `fill` + `object-cover`. Kalau ia dibungkus pita
 *     `aspect-[1774/887]` lagi, gambar kembali jadi HEADER dan isi kartu
 *     kehilangan wallpaper-nya — persis cacat yang sudah diperbaiki sekali.
 *  2. **Tidak ada permukaan putih sama sekali.** `bg-white` di `<section>` dan
 *     `-mt-4 rounded-t-2xl bg-white` di lembar isinya adalah dua bidang putih
 *     yang bertumpuk; keduanya harus absen.
 *  3. **Tidak ada wash/scrim di atas gambar.** Kalau ditambah untuk mengejar
 *     keterbacaan, wallpaper-nya tertutup lagi.
 *  4. **`criteria` tetap tinggal di blok sendiri** (`bg-blue-50 ring-blue-100`).
 *     Blok itu boleh — ia panel penilaian, bukan "kartu putih" — dan
 *     `text-gray-600` 11px di atasnya hanya ~4.4:1.
 */
describe("kursus — kartu 'Challenge praktik'", () => {
  /** Blok JSX milik kartu praktiknya, dari `<section` yang dilabeli judul itu. */
  const penanda = 'aria-labelledby="judul-praktik"';
  const mulai = SUMBER.indexOf(penanda);
  const blok = SUMBER.slice(mulai, SUMBER.indexOf("</section>", mulai));

  // `blok` mulai di tengah tag pembuka (setelah `aria-labelledby`), jadi tag
  // `<section>`-nya dirakit ulang di sini. `>` pertama adalah penutup tag itu:
  // tidak ada `>` di dalam nilai `aria-labelledby` maupun `className`.
  const akhirTagSection = blok.indexOf(">");
  const tagSection = `<section ${blok.slice(0, akhirTagSection + 1)}`;
  const isiKartu = blok.slice(akhirTagSection + 1);

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

  it("menjadikan gambar latar SELURUH kartu, bukan pita header", () => {
    // Gambar harus anak langsung `<section>`, jadi yang dilapisi `fill` adalah
    // kotak kartu seutuhnya — bukan pita `aspect-[1774/887]` yang hanya
    // setinggi beberapa ratus piksel di atas lembar isinya.
    const img = isiKartu.match(/<Image[\s\S]*?\/>/)?.[0] ?? "";
    expect(img, "<Image> kartu praktik tidak ditemukan").not.toBe("");

    // Tidak ada pembungkus antara `<section>` dan `<Image>`.
    expect(
      isiKartu.slice(0, isiKartu.indexOf("<Image")).trim(),
      "gambar dibungkus div — ia jadi pita header, bukan latar kartu",
    ).toBe("");

    // `fill` + `object-cover` menutupi kotak tanpa sisa dan tanpa distort.
    expect(img, "gambar latar tidak memakai `fill`").toMatch(/\bfill\b/);
    expect(img, "gambar latar tidak `object-cover`").toMatch(/object-cover/);

    // Pita `aspect-[1774/887]` adalah bentuk lama: gambar di HEADER saja.
    expect(
      blok,
      "pita aspect-[1774/887] kembali — gambar jadi header",
    ).not.toContain("aspect-[1774/887]");

    // Tidak ada wash/scrim di atas gambar — wallpaper harus terbaca apa adanya.
    const gradien = blok.match(/bg-\[linear-gradient\([^\]]*\)\]/g) ?? [];
    expect(
      gradien,
      `masih ada lapisan gradien (${gradien.join(", ")}) — wallpaper tertutup`,
    ).toHaveLength(0);
    expect(blok, "masih ada wash putih di atas gambar").not.toMatch(
      /rgba\(255,255,255,0\.\d+\)/,
    );
  });

  it("tidak punya permukaan putih: kontainernya yang memegang isi", () => {
    // Dua bidang putih pernah bertumpuk: `bg-white` di `<section>` untuk isi,
    // lalu `-mt-4 rounded-t-2xl bg-white` sebagai lembar isinya. Keduanya
    // lenyap; yang tersisa hanya kontainer transparan di atas wallpaper.
    const section = tagSection;
    expect(section, "tag <section> kartu praktik tidak ditemukan").not.toBe("");
    expect(section, "<section> masih punya bg-white").not.toMatch(/\bbg-white\b/);
    // `relative` wajib supaya `fill` punya kotak acuan yang benar.
    expect(section, "<section> tidak `relative` — `fill` tanpa acuan").toMatch(
      /(?<![\w:-])relative/,
    );
    // `overflow-hidden` + radius yang memotong gambar mengikuti kartu.
    expect(section, "<section> tidak memotong gambar ke radius kartu").toMatch(
      /overflow-hidden/,
    );
    expect(section, "<section> kehilangan radius kartu").toMatch(/rounded-2xl/);

    // Lembar isinya harus polos: tanpa latar, tanpa tumpang tindih, tanpa
    // radius parsial — semuanya sisa perangkat "lemar yang menumpuk arsip".
    const lembar = blok.match(/className="relative z-10 px-5[^"]*"/)?.[0] ?? "";
    expect(lembar, "lembar isi tidak ditemukan").not.toBe("");
    expect(lembar, "lembar isi masih punya latar").not.toMatch(/\bbg-\S/);
    expect(lembar, "lembar isi masih menumpuk ke atas").not.toMatch(/-mt-/);
    expect(lembar, "lembar isi masih berujung membulat").not.toMatch(
      /rounded-t-2xl/,
    );
    expect(lembar, "lembar isi tidak di atas gambar").toMatch(/z-10/);

    // Judul tetap menempel di atas dan tetap memakai tinta gelap: putih di atas
    // wallpaper pucat hanya ~1.1:1.
    const barisJudul = blok.match(/className="[^"]*gap-2\.5[^"]*"/)?.[0] ?? "";
    expect(barisJudul, "baris judul tidak ditemukan").not.toBe("");
    expect(barisJudul, "judul tidak menempel di atas").toContain("items-start");
    expect(blok, "judul tidak memakai tinta gelap #0a3d62").toContain("#0a3d62");
    expect(
      blok,
      "judul memakai text-white — di atas wallpaper pucat ~1.1:1",
    ).not.toMatch(/text-white/);
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

/**
 * Kontrak: **tonggak ruang kerja di silabus punya tiga keadaan, dan hijau
 * hanya berarti "sudah ada karya".**
 *
 * Ditulis setelah bug yang benar-benar terlihat di peramban: versi pertama
 * mewarnai "terbuka" dan "sudah dikerjakan" dengan `bg-emerald-500` yang sama.
 * Akibatnya tonggak yang baru terbuka — peserta belum mengumpulkan apa pun —
 * terbaca seolah projectnya sudah selesai, karena hijau adalah warna yang
 * dipakai baris modul di atasnya untuk "selesai". Peserta melaporkannya sebagai
 * "kenapa hijau padahal saya belum submit", dan laporan itu benar.
 *
 * Yang dijaga di sini adalah **pemetaan warna ke arti**, bukan nilai warnanya:
 * tiga keadaan harus punya tiga nada yang berbeda, dan hijau harus terikat pada
 * `adaKarya` saja. Menukar `adaKarya` dengan `!terkunci` akan membuat bug itu
 * kembali, dan test ini gagal karenanya.
 */
describe("silabus — tonggak 'Project akhir: ruang kerja'", () => {
  // Slice dimulai dari `<li` pembuka tonggak, **bukan** dari teks judulnya:
  // ikon dan kelas nadanya ada di atas judul, jadi memotong dari judul akan
  // membuat assertion warna memeriksa wilayah yang salah — dan test yang
  // memeriksa wilayah yang salah tetap hijau sambil tidak menjaga apa pun.
  const awalTonggak = SUMBER.lastIndexOf("<li", SUMBER.indexOf("Project akhir: ruang kerja"));
  const BLOK = SUMBER.slice(awalTonggak, SUMBER.indexOf("</ol>", SUMBER.indexOf("Project akhir: ruang kerja")));

  it("ada di dalam <ol> kurikulum, bukan kartu terpisah di luar daftar", () => {
    // Di luar daftar ia terbaca sebagai promosi, bukan sebagai langkah yang
    // harus diselesaikan. Yang memisahkan keduanya hanyalah posisi markup.
    const indeksTonggak = SUMBER.indexOf("Project akhir: ruang kerja");
    const indeksOlTutup = SUMBER.indexOf("</ol>", SUMBER.indexOf('<ol className="space-y-3">'));
    expect(indeksTonggak, "tonggak tidak ditemukan").toBeGreaterThan(-1);
    expect(
      indeksTonggak,
      "tonggak berada setelah </ol> — ia akan terbaca sebagai promosi",
    ).toBeLessThan(indeksOlTutup);
  });

  it("hijau terikat pada adaKarya, bukan pada 'tidak terkunci'", () => {
    // Inilah bug aslinya. `!terkunci` berarti "boleh mulai"; `adaKarya` berarti
    // "sudah dikerjakan". Menyamakan keduanya membuat tonggak yang baru terbuka
    // tampil selesai.
    expect(BLOK, "warna hijau tidak memakai adaKarya").toMatch(
      /proyek\.adaKarya\s*\?\s*"bg-emerald-500/,
    );
    expect(
      BLOK,
      "hijau dipakai untuk !terkunci — tonggak baru terbuka akan terbaca selesai",
    ).not.toMatch(/!\s*proyek\.terkunci\s*\?\s*"bg-emerald-500/);
  });

  it("keadaan terkunci tidak memakai gray-100 yang terbaca sebagai putih", () => {
    // `gray-100` (243,244,246) hanya 12 tingkat dari kartu putih (255,255,255),
    // sehingga lingkaran kecil 28px terbaca sebagai putih dan ikonnya hilang.
    expect(BLOK, "ikon terkunci memakai gray-100 — praktis tidak terlihat").not.toMatch(
      /proyek\.terkunci\s*\?\s*"bg-gray-100/,
    );
    expect(BLOK, "ikon terkunci tidak punya cincin penegas").toMatch(/ring-1 ring-gray-300/);
  });

  it("tiga keadaan memakai tiga nada ikon yang berbeda", () => {
    // Terkunci: abu + cincin. Terbuka: putih + cincin biru. Dikerjakan: hijau.
    expect(BLOK).toContain("bg-gray-200 text-gray-500 ring-1 ring-gray-300");
    expect(BLOK).toContain("bg-white text-[#0056D2] ring-1 ring-[rgba(147,197,253,0.7)]");
    expect(BLOK).toContain("bg-emerald-500 text-white");
  });

  it("tombol 'Lihat karya' hanya muncul saat karyanya ada", () => {
    expect(BLOK).toMatch(/proyek\.adaKarya \? \(/);
    expect(BLOK).toContain("Lihat karya");
  });

  it("tombol sekunder tidak memakai chrome-btn polos", () => {
    // `chrome-btn` adalah tombol ikon 40x40px (`width: 40px`), jadi label teks
    // di dalamnya meluber keluar tombol dan terlihat sebagai gumpalan putih.
    // Ini pernah terjadi di sini; konvensi repo untuk aksi sekunder di atas
    // kartu putih adalah `Button variant="outline"`.
    expect(
      BLOK,
      "tombol sekunder memakai chrome-btn polos — labelnya akan meluber",
    ).not.toMatch(/className="chrome-btn[^"]*">\s*Lihat karya/);
    expect(BLOK, "tombol sekunder bukan Button outline").toMatch(/variant="outline"/);
  });

  it("tombolnya ditumpuk, bukan sebaris, supaya label panjang tidak memaksa bungkus", () => {
    // Sebaris membuat label panjang ("Lanjutkan di ruang kerja") memaksa label
    // pendek ("Lihat karya") membungkus jadi dua baris — terlihat rusak.
    expect(BLOK, "tombol tidak ditumpuk").toMatch(/flex-col[^"]*gap-2/);
    expect(BLOK, "label tombol bisa membungkus").toContain("whitespace-nowrap");
  });
});
