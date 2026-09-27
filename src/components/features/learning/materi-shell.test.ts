import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ModulKursus } from "@/lib/courses/kurikulum";

/**
 * Shell reader — dua kelas properti yang tidak bisa dijaga di tempat lain.
 *
 * 1. **Struktur**: shell dan provider sesi harus hidup di `materi/layout.tsx`,
 *    bukan di halaman. Properti ini tidak bisa diuji dengan render — sebuah
 *    `page.tsx` yang memuat ulang shell tetap menghasilkan HTML yang sama.
 *    Satu-satunya cara membuktikannya adalah membaca berkas sumbernya, seperti
 *    `src/lib/learning/security.test.ts:11–22`. Kalau seseorang memindahkan
 *    shell ke halaman, seluruh alasan task ini ada (sesi dan percakapan tutor
 *    tidak hilang saat berpindah modul) hilang tanpa satu pun tes lain gagal.
 * 2. **Perilaku render**: yang bisa dibuktikan dari HTML adalah modul aktif
 *    diturunkan dari pathname, pane masuk ke kolom baca, dan drawer hidup
 *    sebagai **saudara flex** — bukan overlay yang menutupi pane.
 *
 * Daftar modul tidak lagi punya kolom rail: ia hidup di panel silabus
 * (`reader-silabus.tsx`), yang `portal` ke `<body>` dan karenanya tidak muncul
 * di `renderToStaticMarkup` saat tertutup. Yang dijaga di sini hanyalah
 * pengawatan prop-nya ke bar; panelnya sendiri diuji di `reader-silabus.test.ts`.
 *
 * Yang **tidak** diuji di sini: efek, CSS, dan perilaku navigasi. Lingkungan
 * test repo ini `node` tanpa jsdom, jadi `usePathname` dipalsukan; menguji
 * "klik modul tidak me-remount" hanya mungkin di peramban. Penolakan
 * penyelesaian (`pesan`) diuji di `materi-focus-bar.test.ts`, tempat barisnya
 * benar-benar dirender — di sini hanya pengawatan prop-nya yang bisa dijaga.
 */

// Empat tingkat: `src/components/features/learning` → akar repo. Berkas ini
// lebih dalam dua tingkat daripada `src/lib/learning/security.test.ts`, jadi
// jumlah `..`-nya beda; menyalin polanya apa adanya menunjuk `src/src/...`.
const ROOT = path.resolve(__dirname, "../../../..");
const BERKAS_LAYOUT = path.join(ROOT, "src/app/(focus)/belajar/[slug]/materi/layout.tsx");
const BERKAS_PAGE = path.join(ROOT, "src/app/(focus)/belajar/[slug]/materi/[modulId]/page.tsx");
const BERKAS_SHELL = path.join(ROOT, "src/components/features/learning/materi-shell.tsx");

function isi(berkas: string): string {
  return readFileSync(berkas, "utf8");
}

/**
 * Sumber tanpa komentar — untuk pemeriksaan **struktur**.
 *
 * Kedua berkas ini sengaja memuat prosa Indonesia yang menyebut nama komponen
 * tepat yang tidak boleh ada di halaman (`page.tsx` menjelaskan kenapa shell
 * *tidak* di sini, dan menyebut `CourseSessionProvider` untuk itu). Menguji teks
 * mentah berarti tesnya gagal karena dokumentasinya bagus — dan kalau
 * komentarnya dihapus agar tesnya hijau, justru alasan keputusan strukturalnya
 * yang hilang. Jadi yang diperiksa adalah kode, bukan prosa.
 *
 * Komentar blok dan `//` baris (yang didahului spasi/awal baris, supaya
 * `https://` di dalam string tidak dimakan) dibuang.
 */
function tanpaKomentar(berkas: string): string {
  return isi(berkas)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "$1");
}

describe("struktur reader — shell tinggal di layout", () => {
  it("layout merender provider sesi dan shell", () => {
    const sumber = tanpaKomentar(BERKAS_LAYOUT);
    expect(sumber).toContain("<CourseSessionProvider");
    expect(sumber).toContain("<MateriShell");
  });

  it("halaman modul tetap tipis — tanpa provider, shell, atau drawer", () => {
    // Inilah tes yang gagal begitu shell dipindahkan ke `page.tsx`. Ketiganya
    // diperiksa terpisah supaya pesan kegagalannya menyebut mana yang bocor.
    const sumber = tanpaKomentar(BERKAS_PAGE);
    expect(sumber).not.toContain("CourseSessionProvider");
    expect(sumber).not.toContain("MateriShell");
    expect(sumber).not.toContain("TutorDrawer");
  });

  it("layout tidak menyentuh `modulId` — modul aktif diturunkan di klien", () => {
    // Layout hanya menerima `slug`. Kalau ia mulai membaca `params.modulId`,
    // modul aktif pindah ke server, dan justru itu yang memaksa shell kembali ke
    // halaman — tempat ia di-remount tiap navigasi.
    expect(tanpaKomentar(BERKAS_LAYOUT)).not.toContain("modulId");
    expect(isi(BERKAS_SHELL)).toContain("usePathname()");
  });

  it("shell tetap komponen klien", () => {
    expect(isi(BERKAS_SHELL).startsWith('"use client";')).toBe(true);
  });

  it("shell menyalurkan penolakan penyelesaian ke bar fokus", () => {
    // Baris itu sendiri diuji di `materi-focus-bar.test.ts`; yang dijaga di sini
    // adalah pengawatannya, karena menjatuhkan prop ini membuat penolakan
    // server kembali tidak terlihat — persis keluhan yang sedang diperbaiki.
    const sumber = isi(BERKAS_SHELL);
    expect(sumber).toMatch(/const \{ jalankan, pending, pesan \} = useSelesaikanModul\(/);
    expect(sumber).toMatch(/pesan=\{pesan\}/);
  });

  it("panel silabus ditutup saat pindah modul, dan fokusnya dikembalikan", () => {
    /**
     * Keadaan yang dijaga: shell hidup di `layout.tsx` dan **tidak di-remount**
     * saat berpindah modul — justru itu jaminan utama branch ini. Konsekuensinya
     * state `silabusBuka` juga tidak di-reset sendiri, jadi panel silabus yang
     * terbuka akan menutupi pane modul yang baru dipilih — modulnya benar-benar
     * tidak terlihat. Penutupannya harus eksplisit.
     *
     * Kenapa diperiksa dari sumber, bukan dari render: repo ini lingkungan
     * `node` tanpa jsdom, jadi efek **tidak berjalan** di `renderToStaticMarkup`.
     * Properti "navigasi menutup panel" hanya bisa dibuktikan di peramban; yang
     * bisa dikunci di sini adalah bentuk efeknya — ia bergantung pada `pathname`
     * (identitas tujuan, bukan sinyal sekali pakai), sehingga tidak bergantung
     * pada rail memberitahu shell, dan ia mengembalikan fokus ke tombolnya.
     *
     * Assertion sengaja sempit: `useEffect` yang benar-benar ada, dengan
     * `pathname` dan `modulBuka` di daftar dependensinya, dan `focus()` di
     * dalamnya. Kalau efeknya diganti menjadi sesuatu tanpa dependensi, atau
     * fokusnya dihapus, test ini merah.
     */
    const sumber = isi(BERKAS_SHELL);
    // Penutupan oleh navigasi di-reset saat render (bukan setState di dalam
    // effect — itu memicu render berantai dan ditolak lint), dengan `pathname`
    // sebagai pemicunya. Assertion-nya sempit: cabang reset membandingkan
    // pathname, lalu menutup panel hanya bila sedang terbuka.
    expect(sumber).toMatch(/pathnameSebelumnya !== pathname/);
    expect(sumber).toMatch(/if \(silabusBuka\) setSilabusBuka\(false\)/);
    // Fokus kembali setelah transisi terbuka → tertutup. `Escape` sendiri hidup
    // di `reader-silabus.tsx` (panelnya), jadi di sini hanya pengembalian fokus
    // milik shell yang bisa dijaga.
    expect(sumber).toMatch(/baruTertutup = silabusSebelumnya\.current && !silabusBuka/);
    expect(sumber).toMatch(/tombolSilabusRef\.current\?\.focus\(\)/);
  });
});

/**
 * `usePathname`/`useRouter` dipalsukan.
 *
 * `vi.mock` diangkat ke atas seluruh impor berkas ini, jadi shell menerima
 * versi palsunya walau diimpor secara statis. Di lingkungan `node` ini wajib:
 * hook aslinya membaca konteks App Router yang tidak ada di luar peramban.
 */
const pathname = vi.hoisted(() => ({ nilai: "/belajar/kursus-uji/materi/crs-1-m1" }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathname.nilai,
  useRouter: () => ({ refresh: () => {} }),
}));

const { CourseSessionProvider } = await import("./course-session");
const { MateriShell } = await import("./materi-shell");
const { kebijakanDefault } = await import("@/lib/courses/kebijakan");

const MODUL: ModulKursus[] = [
  { id: "crs-1-m1", judul: "Orientasi", ringkasan: "r", durasi_min: 10, url: "https://contoh.test" },
  { id: "crs-1-m2", judul: "Mendalami React", ringkasan: "r", durasi_min: 10, url: "https://contoh.test" },
  // Id dengan spasi: id modul tersimpan datang dari admin dan boleh memuat
  // karakter yang di-encode di URL.
  { id: "crs-1 m3", judul: "Modul Berspasi", ringkasan: "r", durasi_min: 10, url: "https://contoh.test" },
];

function render(over: { selesai?: string[] } = {}) {
  // `children` dioper lewat properti, bukan argumen ketiga `createElement`: di
  // React 19 types `children` adalah properti wajib `CourseSessionProvider`, dan
  // bentuk tiga-argumennya gagal typecheck dengan TS2769 — sama seperti helper di
  // test sibling.
  const isiShell = {
    slug: "kursus-uji",
    kursusJudul: "Kursus Uji",
    kursusPenyedia: "Careevo",
    kursusId: "crs-1",
    kebijakan: kebijakanDefault(),
    modul: MODUL,
    selesai: over.selesai ?? [],
    tutorSrc: "/embed/chat?course=crs-1",
    children: createElement("p", null, "Isi modul."),
  };
  const isiProvider = {
    courseId: "crs-1",
    kebijakan: kebijakanDefault(),
    children: createElement(MateriShell, isiShell),
  };
  return renderToStaticMarkup(createElement(CourseSessionProvider, isiProvider));
}

/**
 * Potongan HTML antara dua penanda — untuk assertion yang **tidak boleh** bisa
 * dipenuhi oleh bagian lain dokumen.
 *
 * Assertion judul modul selama ini memakai `toContain(<judul>)` di seluruh
 * dokumen, dan itu tidak bisa gagal: `MateriRail` selalu merender **semua** modul
 * dari fixture yang sama (`:130-136`), jadi judul modul mana pun sudah ada di
 * dokumen apa pun yang aktif — menghapus `decodeURIComponent` dari sumber tetap
 * membuatnya hijau. Properti "modul mana yang aktif" hanya dimiliki bar fokus,
 * jadi assertion-nya di-scope ke sana. Penanda yang hilang membuat test merah
 * (string kosong tidak lolos `toContain` mana pun), bukan lulus diam-diam.
 */
function potongan(html: string, buka: string, tutup: string): string {
  const awal = html.indexOf(buka);
  const akhir = html.indexOf(tutup, awal);
  expect(awal, `penanda ${buka} tidak ditemukan`).toBeGreaterThanOrEqual(0);
  expect(akhir, `penutup ${tutup} tidak ditemukan`).toBeGreaterThan(awal);
  return html.slice(awal, akhir);
}

/** Bar fokus — satu-satunya `<header>` di render shell. */
function barFokus(html: string): string {
  return potongan(html, "<header", "</header>");
}

describe("MateriShell", () => {
  /**
   * Modul mana yang aktif, dibaca dari **tombol penyelesaian di bar**.
   *
   * Dulu properti ini diamati lewat judul modul di bar (`>Mendalami React<`).
   * Blok judul itu sudah dihapus dari bar — judul kursusnya mengulang pemicu
   * silabus, dan nama modul punya rumahnya sendiri di panel silabus — jadi
   * pengamatan itu ikut hilang bersama elemennya.
   *
   * Sinyal penggantinya berasal dari nilai yang sama: `sudah` di bar adalah
   * `selesai.includes(modulAktif.id)`, jadi tombolnya berubah mengikuti modul
   * yang **benar-benar diresolusi** dari pathname. Itu justru lebih tepat
   * daripada mencocokkan judul: sebuah teks bisa muncul dari tempat lain di
   * dokumen, sedangkan `aria-pressed` di bar hanya bisa benar kalau modulnya
   * benar.
   *
   * Caranya: tandai **satu** modul selesai, lalu tuntut bar berbunyi `Selesai`
   * untuk modul itu. Arah sebaliknya diuji juga — tanpa assertion negatifnya,
   * bar yang selalu berbunyi `Selesai` akan lolos.
   */
  function labelTombolSelesai(html: string): string {
    return barFokus(html).includes(">Selesai</button>") ? "Selesai" : "Tandai selesai";
  }

  it("memilih modul aktif dari segmen terakhir pathname", () => {
    pathname.nilai = "/belajar/kursus-uji/materi/crs-1-m2";
    // Hanya m2 yang selesai. Kalau shell jatuh ke modul pertama (m1), tombolnya
    // berbunyi "Tandai selesai" dan test ini merah.
    expect(labelTombolSelesai(render({ selesai: ["crs-1-m2"] }))).toBe("Selesai");
    // Arah sebaliknya: yang selesai modul **lain**, jadi bar tidak boleh
    // mengklaim modul aktif sudah selesai.
    expect(labelTombolSelesai(render({ selesai: ["crs-1-m1"] }))).toBe("Tandai selesai");
  });

  it("mendekode id modul yang ter-encode di URL", () => {
    // Tanpa `decodeURIComponent`, segmen ini tidak cocok dengan modul mana pun
    // dan shell jatuh ke modul pertama diam-diam — modul yang salah, tanpa error.
    pathname.nilai = "/belajar/kursus-uji/materi/crs-1%20m3";
    expect(labelTombolSelesai(render({ selesai: ["crs-1 m3"] }))).toBe("Selesai");
  });

  it("tidak melempar saat segmen pathname rusak", () => {
    // Navigasi lunak (`router.push`) dan transisi di dalam iframe tidak lewat
    // router, jadi segmen seperti ini bisa sampai ke render; navigasi keras ke
    // URL yang sama sudah ditolak router lebih dulu. `decodeURIComponent("%")`
    // melempar `URIError`, dan galat saat render menggusur **seluruh** reader.
    // Yang benar: segmen dipakai mentah → tidak cocok → jatuh ke modul pertama,
    // dan bar tetap punya modul.
    pathname.nilai = "/belajar/kursus-uji/materi/%";
    expect(labelTombolSelesai(render({ selesai: ["crs-1-m1"] }))).toBe("Selesai");
  });

  it("jatuh ke modul pertama saat segmen pathname tidak cocok", () => {
    // Id basi (tautan lama) tetap merender bar dengan modul, bukan bar tanpa
    // modul; `page.tsx` yang memutuskan 404 untuk id yang benar-benar tidak ada.
    pathname.nilai = "/belajar/kursus-uji/materi/id-yang-sudah-tidak-ada";
    expect(labelTombolSelesai(render({ selesai: ["crs-1-m1"] }))).toBe("Selesai");
  });

  it("merender pane dan drawer sebagai saudara di satu baris flex", () => {
    pathname.nilai = "/belajar/kursus-uji/materi/crs-1-m1";
    const html = render();
    // Baris flex di bawah bar fokus wajib punya rantai `min-h-0`: tanpa itu
    // kolom-kolom flex menolak menyusut di bawah tinggi isinya.
    expect(html).toContain('<div class="relative flex min-h-0 flex-1">');
    // Pane masuk ke kolom baca. `h-full` penting sejak bar kaki dikeluarkan dari
    // aliran: `main` kini satu-satunya penentu tinggi di dalam pembungkus
    // `relative`, dan tanpa `h-full` ia runtuh ke tinggi isinya sehingga
    // `overflow-y-auto`-nya tidak pernah menggulir.
    expect(html).toContain('<main class="h-full min-w-0 overflow-y-auto');
    expect(html).toContain("Isi modul.");
    // Drawer adalah `<aside>` **saudara** pembungkus baca di dalam satu baris
    // flex, bukan portal: pembungkus `relative` itu adalah containing block-nya
    // di `xl` (`.reader-drawer` di globals.css), jadi baris baca — bukan
    // viewport — yang menentukan tinggi drawer, dan `top: 0` berarti "tepat di
    // bawah bar fokus". Drawer sengaja di luar pembungkus baca supaya bar kaki
    // yang `absolute` tidak pernah mengukur/merambah ke area drawer.
    expect(html).toMatch(/<aside id="drawer-tutor"[^>]*class="[^"]*\bhidden\b/);
  });

  it("membatasi tinggi shell — kolom yang menggulir, bukan dokumen", () => {
    pathname.nilai = "/belajar/kursus-uji/materi/crs-1-m1";
    // Diukur di Chrome headless 1440×900 dengan pane 2600px: `min-h-dvh` tidak
    // membatasi baris flex, jadi rail dan `main` ikut setinggi modul
    // (`overflow-y-auto` keduanya hampa), drawer ter-dock `xl` menjadi setinggi
    // itu, akar `h-dvh` iframe AI Mastery mengikutinya, dan composer tutor
    // berakhir di `composerTop=2566` — tidak terjangkau selama membaca bagian
    // atas modul. `h-dvh overflow-hidden` memindahkan gulir ke baris, pola yang
    // sudah dipakai reader ter-dock repo ini (`book-reader.tsx:31`).
    const html = render();
    expect(html).toContain('<div class="reader-shell flex h-dvh flex-col overflow-hidden">');
    expect(html).not.toContain("min-h-dvh");
  });

  it("menaruh ajakan sesi di atas kartu materi, bukan di bar fokus", () => {
    /**
     * Permintaan yang sebenarnya: kartu verifikasi kuning harus **di atas
     * kartu materi**, bukan di dalam bar fokus.
     *
     * Alasannya bentuk, bukan isi — bar fokus `sticky`, jadi apa pun yang
     * tinggal di dalamnya ikut mengambang sepanjang modul, dan kartu amber
     * setinggi beberapa baris menutupi judul modul tepat saat peserta
     * membacanya.
     *
     * Diperiksa lewat **urutan di HTML**, bukan `toContain`: kedua komponen
     * ada di dokumen yang sama dalam keadaan seed `wajib`, jadi keberadaan
     * saja tidak membuktikan siapa yang di atas siapa. Yang dijaga adalah
     * urutan render — kartu sesi mendahului isi modul.
     */
    pathname.nilai = "/belajar/kursus-uji/materi/crs-1-m1";
    const html = render();
    const kartuSesi = html.indexOf("Course ini mewajibkan sesi terverifikasi");
    const isiModul = html.indexOf("Isi modul.");
    // Penanda yang hilang membuat test merah, bukan lulus diam-diam.
    expect(kartuSesi, "kartu ajakan sesi tidak dirender").toBeGreaterThanOrEqual(0);
    expect(isiModul, "isi modul tidak dirender").toBeGreaterThanOrEqual(0);
    expect(kartuSesi).toBeLessThan(isiModul);

    // Keduanya harus berada di kolom baca (`<main>`) — kalau kartu sesi
    // kembali ke dalam `<header>`, urutannya masih "di atas" markup modul dan
    // assertion di atas tetap hijau tanpa perubahan yang diklaimnya.
    const main = potongan(html, "<main", "</main>");
    expect(main).toContain("Course ini mewajibkan sesi terverifikasi");
    expect(barFokus(html)).not.toContain("Course ini mewajibkan sesi terverifikasi");
  });

  it("menyembunyikan drawer sampai tombol tutor ditekan", () => {
    pathname.nilai = "/belajar/kursus-uji/materi/crs-1-m1";
    const html = render();
    // `aria-expanded="false"` pada tombol dan `hidden` pada `<aside>` harus
    // sejalan; kalau tidak, tombol mengaku tertutup sementara panelnya terbuka.
    // Di-scope ke tombol drawer: bar merender **dua** `aria-expanded="false"`
    // (drawer dan pemicu silabus), dan assertion seluruh-dokumen tidak lagi
    // membuktikan tombol mana yang dibicarakan.
    const tombol = html.match(/<button [^>]*aria-controls="drawer-tutor"[^>]*>/)?.[0];
    expect(tombol).toBeDefined();
    expect(tombol).toContain('aria-expanded="false"');
    expect(html).toMatch(/<aside id="drawer-tutor"[^>]*class="[^"]*\bhidden\b/);
    // Panel silabus **tidak** dirender saat tertutup — bukan hanya disembunyikan
    // dengan kelas. Ia `portal` ke `<body>`, jadi daftar modulnya benar-benar
    // tidak ada sampai dibuka; tidak ada panel tersembunyi yang bisa dijangkau
    // Tab.
    expect(html).not.toContain('id="reader-panel-silabus"');
  });

  it("menandai modul yang sudah selesai dari prop `selesai`", () => {
    pathname.nilai = "/belajar/kursus-uji/materi/crs-1-m1";
    // Daftar modulnya hidup di panel (`portal`, tidak ada saat tertutup), jadi
    // satu-satunya tempat status "selesai" bisa dilihat tanpa membuka panel
    // adalah tombol "Tandai selesai" di bar — dan itulah yang dijaga di sini.
    expect(barFokus(render({ selesai: ["crs-1-m1"] }))).toContain("Selesai");
  });
});
