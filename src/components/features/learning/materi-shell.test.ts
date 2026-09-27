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
 *    diturunkan dari pathname, rail tetap memuat semua modul, pane masuk ke
 *    kolom baca, dan drawer hidup sebagai **saudara flex** — bukan overlay yang
 *    menutupi pane.
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

  it("panel modul (bawah `lg`) ditutup saat pindah modul, dan fokusnya dikembalikan", () => {
    /**
     * Keadaan yang dijaga: shell hidup di `layout.tsx` dan **tidak di-remount**
     * saat berpindah modul — justru itu jaminan utama branch ini. Konsekuensinya
     * state `modulBuka` juga tidak di-reset sendiri, jadi panel "Daftar modul"
     * yang terbuka akan menutupi pane modul yang baru dipilih — di ponsel,
     * modulnya benar-benar tidak terlihat. Penutupannya harus eksplisit.
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
    expect(sumber).toMatch(/if \(modulBuka\) setModulBuka\(false\)/);
    // Fokus kembali setelah transisi terbuka → tertutup, dan `Escape` menangani
    // penutupan yang bukan navigasi (hanya hidup selama panel terbuka).
    expect(sumber).toMatch(/baruTertutup = bukaSebelumnya\.current && !modulBuka/);
    expect(sumber).toMatch(/tombolModulRef\.current\?\.focus\(\)/);
    expect(sumber).toMatch(/e\.key === "Escape"\) \{[\s\S]*?setModulBuka\(false\)/);
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
const { MateriShell, PanelModulMobile } = await import("./materi-shell");
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

/** Rail daftar modul — `<nav aria-label="Daftar modul">`. */
function railModul(html: string): string {
  return potongan(html, '<nav aria-label="Daftar modul"', "</nav>");
}

describe("MateriShell", () => {
  it("memilih modul aktif dari segmen terakhir pathname", () => {
    pathname.nilai = "/belajar/kursus-uji/materi/crs-1-m2";
    const html = render();
    // Judul bar adalah modul yang cocok dengan pathname, bukan modul pertama —
    // dan `aria-current` menunjuk baris rail yang sama, jadi keduanya tidak bisa
    // menyimpang.
    //
    // Judulnya diperiksa **di dalam bar**: rail memuat "Mendalami React" apa pun
    // modul yang aktif, jadi `toContain` seluruh-dokumen tetap hijau walau bar
    // menampilkan modul lain.
    expect(barFokus(html)).toContain("Mendalami React");
    const barisAktif = html.match(/<a [^>]*aria-current="page"[^>]*>/)?.[0];
    expect(barisAktif).toBeDefined();
    expect(barisAktif).toContain('href="/belajar/kursus-uji/materi/crs-1-m2"');
  });

  it("mendekode id modul yang ter-encode di URL", () => {
    // Tanpa `decodeURIComponent`, segmen ini tidak cocok dengan modul mana pun
    // dan bar jatuh ke modul pertama diam-diam — judul yang salah, tanpa error.
    // Diperiksa di dalam bar: rail memuat "Modul Berspasi" apa pun yang aktif.
    pathname.nilai = "/belajar/kursus-uji/materi/crs-1%20m3";
    expect(barFokus(render())).toContain("Modul Berspasi");
  });

  it("tidak melempar saat segmen pathname rusak", () => {
    // Navigasi lunak (`router.push`) dan transisi di dalam iframe tidak lewat
    // router, jadi segmen seperti ini bisa sampai ke render; navigasi keras ke
    // URL yang sama sudah ditolak router lebih dulu. `decodeURIComponent("%")`
    // melempar `URIError`, dan galat saat render menggusur **seluruh** reader.
    // Yang benar: segmen dipakai mentah → tidak cocok → jatuh ke modul pertama,
    // bar tetap punya judul.
    pathname.nilai = "/belajar/kursus-uji/materi/%";
    expect(barFokus(render())).toContain("Orientasi");
  });

  it("jatuh ke modul pertama saat segmen pathname tidak cocok", () => {
    // Id basi (tautan lama) tetap merender bar dengan judul, bukan bar tanpa
    // modul; `page.tsx` yang memutuskan 404 untuk id yang benar-benar tidak ada.
    // Diperiksa di dalam bar: rail selalu memuat "Orientasi".
    pathname.nilai = "/belajar/kursus-uji/materi/id-yang-sudah-tidak-ada";
    expect(barFokus(render())).toContain("Orientasi");
  });

  it("merender rail, pane, dan drawer sebagai saudara di satu baris flex", () => {
    pathname.nilai = "/belajar/kursus-uji/materi/crs-1-m1";
    const html = render();
    // Baris flex di bawah bar fokus wajib punya rantai `min-h-0`: tanpa itu
    // kolom-kolom flex menolak menyusut di bawah tinggi isinya.
    expect(html).toContain('<div class="flex min-h-0 flex-1">');
    // Rail tetap memuat modul lain — peta kemajuan yang menetap.
    expect(html).toContain('href="/belajar/kursus-uji/materi/crs-1-m2"');
    // Pane masuk ke kolom baca.
    expect(html).toContain('<main class="min-w-0 flex-1');
    expect(html).toContain("Isi modul.");
    // Drawer adalah `<aside>` **saudara** rail dan main di dalam satu baris flex,
    // bukan portal/overlay: itu yang membuat docking `xl` Task 6 bekerja — ia
    // menggeser pane, bukan menutupinya.
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
    expect(html).toContain('<div class="flex h-dvh flex-col overflow-hidden bg-white">');
    expect(html).not.toContain("min-h-dvh");
  });

  it("menyembunyikan drawer sampai tombol tutor ditekan", () => {
    pathname.nilai = "/belajar/kursus-uji/materi/crs-1-m1";
    const html = render();
    // `aria-expanded="false"` pada tombol dan `hidden` pada `<aside>` harus
    // sejalan; kalau tidak, tombol mengaku tertutup sementara panelnya terbuka.
    // Di-scope ke tombol drawer: sejak tombol "Daftar modul" ada, bar
    // merender **dua** `aria-expanded="false"`, dan assertion seluruh-dokumen
    // tidak lagi membuktikan tombol mana yang dibicarakan.
    const tombol = html.match(/<button [^>]*aria-controls="drawer-tutor"[^>]*>/)?.[0];
    expect(tombol).toBeDefined();
    expect(tombol).toContain('aria-expanded="false"');
    expect(html).toMatch(/<aside id="drawer-tutor"[^>]*class="[^"]*\bhidden\b/);
    // Panel modul **tidak** dirender saat tertutup — bukan hanya disembunyikan
    // dengan kelas. Daftar modulnya tidak boleh ada dua kali di layar `lg`, dan
    // di bawah `lg` panelnya hanya ada kalau dibuka.
    expect(html).not.toContain('id="panel-modul"');
  });

  it("menandai modul yang sudah selesai dari prop `selesai`", () => {
    pathname.nilai = "/belajar/kursus-uji/materi/crs-1-m1";
    const html = render({ selesai: ["crs-1-m1"] });
    // Dua pengawatan terpisah, jadi keduanya diperiksa di tempatnya masing-masing:
    // `Selesai` seluruh-dokumen sudah terpenuhi oleh rail sendirian, sehingga
    // menjatuhkan `sudah` dari bar tidak akan terlihat.
    expect(railModul(html)).toContain("Selesai");
    expect(barFokus(html)).toContain("Selesai");
  });
});

/**
 * Panel "Daftar modul" — pengganti rail di bawah `lg` (spec §3.1).
 *
 * `PanelModulMobile` dirender **langsung**, bukan lewat `MateriShell`: ia hanya
 * muncul dari state `useState`, dan di lingkungan `node` tanpa jsdom
 * `renderToStaticMarkup` tidak menjalankan efek maupun klik, jadi tidak ada cara
 * membuka panelnya dari luar. Merendernya langsung justru yang membuat properti
 * yang paling mudah rusak bisa diperiksa: panel memuat `MateriRail` **yang
 * sama**, punya id yang dirujuk `aria-controls` tombol, dan membawa `lg:hidden`
 * yang mencegahnya tampil di samping rail permanen.
 */
describe("PanelModulMobile", () => {
  it("memakai ulang MateriRail — bukan daftar modul kedua", () => {
    const html = renderToStaticMarkup(
      createElement(PanelModulMobile, {
        slug: "kursus-uji",
        modul: MODUL,
        modulAktif: "crs-1-m1",
        selesai: [],
      }),
    );
    // Semua modul, dengan tautan reader-nya, dari komponen rail yang sama.
    expect(html).toContain('nav aria-label="Daftar modul"');
    expect(html).toContain('href="/belajar/kursus-uji/materi/crs-1-m1"');
    expect(html).toContain('href="/belajar/kursus-uji/materi/crs-1-m2"');
    // Id berspasi sengaja tidak di-encode di sini: yang dikunci adalah "panel
    // ini merender rail yang sama", bukan aturan encoding tautan rail (yang
    // sudah punya test sendiri di `materi-rail.test.ts`).
    expect(html.match(/<a /g) ?? []).toHaveLength(MODUL.length);
  });

  it("membawa id yang dirujuk `aria-controls` tombol, dan hanya di bawah `lg`", () => {
    const html = renderToStaticMarkup(
      createElement(PanelModulMobile, {
        slug: "kursus-uji",
        modul: MODUL,
        modulAktif: "crs-1-m1",
        selesai: [],
      }),
    );
    // `MateriFocusBar` memasang `aria-controls="panel-modul"`; rujukan yang
    // menunjuk id tidak ada tidak menjaga apa pun.
    expect(html).toContain('id="panel-modul"');
    // Di `lg` ke atas rail `w-72` sudah permanen, jadi tanpa `lg:hidden` panel
    // ini muncul sebagai daftar modul **kedua** — di dokumen yang sama.
    const pembungkus = html.match(/<div id="panel-modul"[^>]*>/)?.[0];
    expect(pembungkus).toBeDefined();
    expect(pembungkus).toContain("lg:hidden");
    // Ia menggulir sendiri dan dibatasi tinggi: tanpa itu ia menggelembungkan
    // baris flex yang membatasi tinggi shell.
    expect(pembungkus).toContain("overflow-y-auto");
    expect(pembungkus).toContain("min-h-0");
  });
});
