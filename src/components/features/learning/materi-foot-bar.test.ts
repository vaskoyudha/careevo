import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MateriFootBar } from "./materi-foot-bar";
import type { ModulKursus } from "@/lib/courses/kurikulum";

/**
 * Bar kaki reader — "sebelumnya | AI Mastery | selanjutnya".
 *
 * Empat properti yang tidak bisa dijaga di tempat lain:
 *
 * 1. **Ketiga tombol ada, dan tiap ujung dinonaktifkan di ujung kurikulum.**
 *    Modul pertama tidak punya "sebelumnya" dan modul terakhir tidak punya
 *    "selanjutnya". Tombolnya tetap dirender (bukan dihilangkan) supaya dua
 *    tombol lain tidak melompat posisi saat berpindah modul — dan `sr-only`-nya
 *    yang memberi tahu pembaca layar sebabnya.
 * 2. **Tujuan "sebelumnya"/"selanjutnya" benar**, termasuk saat id modul tidak
 *    cocok dengan kurikulum (id basi): shell jatuh ke modul pertama, jadi bar ini
 *    harus menghitung posisinya dari daftar yang sama.
 * 3. **Tombol AI Mastery mengendalikan drawer yang sudah ada**, bukan membuka
 *    halaman baru: `aria-controls` menunjuk `#drawer-tutor` dan `aria-expanded`
 *    mengikuti statusnya, sama seperti tombol tutor di bar atas.
 * 4. **Kebijakan `tanpa_ai` menonaktifkan tombolnya dengan alasan apa adanya**
 *    dari `putuskanAkses`, bukan kalimat karangan klien.
 *
 * Repo ini lingkungan `node` tanpa jsdom, jadi yang diuji adalah HTML hasil
 * render — bukan perilaku klik (itu dijaga di peramban sungguhan, bukan di sini).
 */

const ROOT = path.resolve(__dirname, "../../../..");
const CSS = readFileSync(path.join(ROOT, "src/app/globals.css"), "utf8");
const BERKAS = path.join(ROOT, "src/components/features/learning/materi-foot-bar.tsx");

function tanpaKomentar(berkas: string): string {
  return readFileSync(berkas, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "$1");
}

const MODUL: ModulKursus[] = [
  { id: "crs-1-m1", judul: "Orientasi", ringkasan: "r", durasi_min: 10, url: "https://a.test" },
  { id: "crs-1-m2", judul: "Inti", ringkasan: "r", durasi_min: 10, url: "https://a.test" },
  { id: "crs-1-m3", judul: "Penutup", ringkasan: "r", durasi_min: 10, url: "https://a.test" },
];

function render(over: {
  modulAktif?: string;
  bolehTutor?: boolean;
  alasanTutor?: string;
  drawerBuka?: boolean;
} = {}) {
  return renderToStaticMarkup(
    createElement(MateriFootBar, {
      slug: "kursus-uji",
      modulSemua: MODUL,
      modulAktif: over.modulAktif ?? "crs-1-m2",
      drawerBuka: over.drawerBuka ?? false,
      onToggleDrawer: () => {},
      bolehTutor: over.bolehTutor ?? true,
      alasanTutor: over.alasanTutor,
    }),
  );
}

/** Tag `<a>`/`<button>` yang memuat penanda tertentu, apa adanya. */
function kontrol(html: string, penanda: string): string {
  const tag = html.match(new RegExp(`<(?:a|button) [^>]*${penanda}[^>]*>`))?.[0];
  expect(tag, `kontrol dengan penanda ${penanda} tidak ditemukan`).toBeDefined();
  return tag!;
}

describe("MateriFootBar — navigasi antar-modul", () => {
  it("menautkan ke modul sebelumnya dan berikutnya", () => {
    const html = render({ modulAktif: "crs-1-m2" });
    expect(html).toContain('href="/belajar/kursus-uji/materi/crs-1-m1"');
    expect(html).toContain('href="/belajar/kursus-uji/materi/crs-1-m3"');
  });

  it("menyebut judul modulnya di nama aksesibel, bukan sekadar arah", () => {
    // "Sebelumnya" saja tidak memberi tahu **ke mana**, dan di layar sempit
    // labelnya terpotong — jadi nama aksesibelnya yang membawa judulnya.
    const html = render({ modulAktif: "crs-1-m2" });
    expect(html).toContain('aria-label="Sebelumnya: Orientasi"');
    expect(html).toContain('aria-label="Selanjutnya: Penutup"');
  });

  it("menonaktifkan 'Sebelumnya' di modul pertama, tapi tetap merendernya", () => {
    // Tetap dirender, bukan dihilangkan: tombol yang hilang membuat dua tombol
    // lain melompat posisi saat berpindah modul. `sr-only` menyebut sebabnya,
    // supaya pembaca layar tidak mengumumkan tombol mati tanpa keterangan.
    const html = render({ modulAktif: "crs-1-m1" });
    const sebelum = kontrol(html, 'title="Ini modul pertama"');
    expect(sebelum).toContain("disabled");
    expect(sebelum).toContain('aria-disabled="true"');
    expect(html).toContain("ini modul pertama");
    // Tanpa tautan ke modul sebelum m1 — tidak ada modul seperti itu.
    expect(html).not.toContain('aria-label="Sebelumnya:');
  });

  it("menonaktifkan 'Selanjutnya' di modul terakhir, tapi tetap merendernya", () => {
    const html = render({ modulAktif: "crs-1-m3" });
    const lanjut = kontrol(html, 'title="Ini modul terakhir"');
    expect(lanjut).toContain("disabled");
    expect(html).toContain("ini modul terakhir");
    expect(html).not.toContain('aria-label="Selanjutnya:');
  });

  it("memperlakukan id modul basi sebagai modul pertama", () => {
    // Shell jatuh ke `modul[0]` saat segmen pathname tidak cocok dengan modul
    // mana pun. Bar ini harus memakai daftar yang sama, kalau tidak "sebelumnya"
    // menunjuk modul yang tidak pernah ditampilkan.
    const html = render({ modulAktif: "id-yang-sudah-tidak-ada" });
    expect(html).toContain('title="Ini modul pertama"');
    expect(html).toContain('aria-label="Selanjutnya: Inti"');
  });
});

describe("MateriFootBar — pintu AI Mastery", () => {
  it("mengendalikan drawer tutor yang sudah ada, bukan pindah halaman", () => {
    // Drawer tutor (`#drawer-tutor`) sudah hidup di reader; tombol ini pintu
    // kedua ke sana. Kalau ia menjelma tautan, peserta kehilangan posisi
    // bacanya — dan iframe AI Mastery di drawer dimuat ulang.
    const html = render({ drawerBuka: false });
    const tombol = kontrol(html, 'aria-controls="drawer-tutor"');
    // Ada **dua** kontrol ber-`aria-controls="drawer-tutor"` di reader (bar atas
    // dan bar bawah), jadi yang diperiksa adalah tombol berlabel AI Mastery.
    expect(html).toContain('aria-label="AI Mastery"');
    expect(tombol).toContain('aria-expanded="false"');
    // Labelnya diperiksa dari HTML utuh: `kontrol()` hanya mengembalikan tag
    // pembukanya, jadi teks di dalamnya tidak akan pernah ada di situ.
    expect(html).toContain("<span>AI Mastery</span>");
    // Bukan tautan ke halaman: tidak ada `href` pada tombol ini.
    expect(tombol.startsWith("<button")).toBe(true);
  });

  it("melaporkan drawer yang sedang terbuka lewat aria-expanded", () => {
    // `aria-expanded` yang tidak pernah berubah adalah bug: statusnya harus
    // mencerminkan drawer-nya, sama seperti tombol tutor di bar atas.
    expect(render({ drawerBuka: true })).toContain('aria-expanded="true"');
  });

  it("menonaktifkan tombolnya saat kebijakan melarang, dengan alasan server apa adanya", () => {
    const alasan = "Aturan course ini melarang bantuan AI.";
    const html = render({ bolehTutor: false, alasanTutor: alasan });
    const tombol = kontrol(html, 'aria-controls="drawer-tutor"');
    expect(tombol).toContain("disabled");
    expect(tombol).toContain(`aria-label="${alasan}"`);
    // Alasan yang sama juga jadi `title`, jadi ia terbaca pengguna awas.
    expect(tombol).toContain(`title="${alasan}"`);
  });
});

describe("MateriFootBar — bentuk bar", () => {
  it("tidak memakai sayap, dan tidak mengambil lebar bar atas apa adanya", () => {
    // Bar atas bersayap karena ia tepi **atas** halaman; di tepi bawah, sayap
    // akan menggantung tanpa apa pun untuk disambung.
    const kaki = CSS.match(/\.reader-foot-bar \{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(kaki, "aturan .reader-foot-bar tidak ditemukan").toBeDefined();
    expect(kaki).not.toMatch(/::before|::after/);
    // Tidak mendeklarasikan `--wing` sendiri; **memakainya** sebagai
    // `var(--wing-edge)` justru benar — itu warna batas bersama dari shell.
    expect(kaki).not.toMatch(/--wing:/);
  });

  it("selebar isinya, bukan pita kosong selebar kolom", () => {
    // Bar ini isinya tiga kontrol kecil. Pada lebar kolom baca (768px) tombol
    // ujungnya masih terpisah ~660px — bagian putih yang kosong di kiri-kanannya
    // itulah yang membuatnya terbaca sebagai pita, bukan kontrol. `width:
    // max-content` membuat permukaannya berhenti tepat di ujung kontrol.
    const kaki = CSS.match(/\.reader-foot-bar \{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(kaki).toMatch(/width:\s*max-content/);
    // Batasnya tetap ada untuk ponsel: di bawah 641px labelnya disembunyikan,
    // jadi isinya tidak pernah lebih lebar dari viewport — `max-width` menjaga
    // piksel terakhir.
    expect(kaki).toMatch(/max-width:\s*calc\(100% - 2 \* var\(--page-pad\)\)/);
    // Token lebar lama harus benar-benar pergi; kalau tidak, ia jadi angka mati
    // yang membingungkan pembaca berikutnya.
    expect(CSS).not.toMatch(/--reader-foot-max/);
  });

  it("menempel di tepi bawah layar, bukan mengambang", () => {
    // `bottom: 0` — bar menempel di tepi bawah viewport. Sudut bawahnya **tidak**
    // membulat: pada tepi layar sudut itu di luar pandangan, dan membulatkannya
    // mengembalikan kesan mengambang yang justru dihilangkan.
    const kaki = CSS.match(/\.reader-foot-bar \{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(kaki).toMatch(/bottom:\s*0;/);
    expect(kaki).toMatch(/border-radius:\s*1\.25rem 1\.25rem 0 0/);
    expect(kaki).toMatch(/border-bottom:\s*none/);
    // Tidak ada margin bawah sama sekali; itu satu-satunya yang menentukan
    // `jarakBawah: 0` di peramban.
    expect(kaki).not.toMatch(/margin:\s*0 auto 0\.75rem/);
  });

  it("menumpuk di atas konten, bukan lapisan yang memotongnya", () => {
    // Ini permintaan intinya: bar harus **menimpa** konten. Sebelumnya ia
    // saudara flex dari baris baca, jadi ia menyita pita 61px sendiri dan
    // `main` berhenti di atasnya — artikel berhenti di garis sambungan, dan bar
    // duduk di jalurnya sendiri di bawah. `position: absolute` mengeluarkannya
    // dari aliran, sehingga baris baca setinggi shell dan konten menggulir **di
    // belakang** bar.
    const kaki = CSS.match(/\.reader-foot-bar \{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(kaki).toMatch(/position:\s*absolute/);
    // `fixed` akan mengukur ke viewport, sehingga bar yang dipusatkan bisa
    // merambah drawer tutor ter-dock (bisa ditarik sampai 640px) dan menutupi
    // tombol "Selanjutnya". `absolute` mengukur ke pembungkus area baca saja.
    expect(kaki).not.toMatch(/position:\s*fixed/);
    expect(kaki).toMatch(/z-index:\s*20;/);
    // Dan baris baca harus menyisakan ruang di ujung gulir, kalau tidak baris
    // terakhir bisa terjebak **permanen** di bawah bar tanpa cara menggulirnya
    // ke atas. Satu angka (`--reader-foot-h`) dipakai bar dan padding ini.
    expect(kaki).toMatch(/min-height:\s*var\(--reader-foot-h\)/);
    expect(CSS).toMatch(/\.reader-shell main \{\s*padding-bottom:\s*calc\(var\(--reader-foot-h\) \+/);
    const shell = CSS.match(/\.reader-shell \{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(shell).toMatch(/--reader-foot-h:\s*61px/);
  });

  it("memberi jarak antar-tombol, dan tidak lagi memakai grid", () => {
    // Tiga tombol ini masing-masing punya permukaannya sendiri sekarang —
    // `chrome-btn` memberi batas, gradien lembut, dan bayangan. Dengan `gap: 0`
    // sisi-sisinya bersentuhan dan batas dua tombol bertumpuk jadi garis 2px,
    // sehingga ketiganya terbaca sebagai satu balok. Jaraknya yang memisahkan
    // permukaan-permukaan itu.
    //
    // Grid `1fr auto 1fr` yang lama justru ada untuk **menyebar** tombol ke ujung
    // bar — persis kekosongan yang dihindari — dan pada bar `max-content` kolom
    // `1fr`-nya akan membuka celah itu kembali. Karena itu barisnya tetap flex.
    const baris = CSS.match(/\.reader-foot-bar-inner \{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(baris, "aturan .reader-foot-bar-inner tidak ditemukan").toBeDefined();
    expect(baris).toMatch(/display:\s*flex/);
    // Jarak yang nyata, bukan `0`. Nilai ini yang gagal sebelum perubahan.
    // Regexnya menerima `0` maupun `0.5rem` dengan sengaja: kalau hanya menerima
    // bentuk `rem`, `gap: 0` akan dilaporkan "tidak ditemukan" — pesan yang
    // menyesatkan, karena yang salah justru nilainya, bukan ketiadaannya.
    const gap = baris.match(/gap:\s*([\d.]+)(?:rem)?\s*;/)?.[1];
    expect(gap, "gap tidak ditemukan di .reader-foot-bar-inner").toBeDefined();
    expect(Number(gap)).toBeGreaterThan(0);
    expect(baris).not.toMatch(/gap:\s*0;/);
    expect(baris).not.toMatch(/grid-template-columns/);
    // `justify-self` hanya berlaku di grid; kedua aturan itu ikut pergi.
    expect(CSS).not.toMatch(/\.reader-foot-bar-inner > :first-child/);
    expect(CSS).not.toMatch(/\.reader-foot-bar-inner > :last-child/);
  });

  it("berada di dalam pembungkus `relative` area baca, bukan saudara baris flex", () => {
    // Posisi `absolute` di atas hanya benar kalau pembungkusnya ada dan hanya
    // mencakup area baca. Kalau bar dikembalikan menjadi saudara baris flex,
    // `absolute`-nya akan mengukur ke leluhur ber-`position` terdekat yang lain
    // (atau viewport) dan seluruh perilaku overlay ini runtuh.
    const shellTsx = tanpaKomentar(path.join(ROOT, "src/components/features/learning/materi-shell.tsx"));
    expect(shellTsx).toContain("relative min-w-0 flex-1");
    // Bar harus berada **di dalam** pembungkus itu. Potongannya diambil antara
    // pembuka pembungkus dan `<TutorDrawer`, bukan sampai `</div>` pertama:
    // pembungkusnya memuat `<div>` bersarang (`mx-auto … space-y-6`), jadi
    // `split("</div>")` berhenti terlalu awal dan akan selalu melaporkan bar
    // "di luar". Memeriksa "ada setelah `</main>`" saja juga tidak cukup — bar
    // yang dikembalikan ke luar pembungkus tetap lolos uji itu.
    const blok = shellTsx.split("relative min-w-0 flex-1")[1]?.split("<TutorDrawer")[0] ?? "";
    expect(blok).toContain("</main>");
    expect(blok).toContain("MateriFootBar");
    // Drawer berada **di luar** pembungkus — kalau tidak, ia jadi acuan posisi
    // dan bar bisa mengukur/merambah ke areanya.
    expect(blok).not.toContain("TutorDrawer");
  });

  it("memakai token geometri bersama dari shell, bukan mendeklarasikan ulang", () => {
    // `--wing` dulu dideklarasikan di `.reader-bar`, dan properti kustom **tidak
    // diwarisi oleh saudara** — jadi `var(--wing)` di bar ini tidak resolve,
    // `calc()`-nya jadi tidak valid saat computed-value, dan deklarasinya
    // dibuang diam-diam (lebar bar jatuh ke default). Karena itu tokennya di
    // `.reader-shell`, satu induk untuk kedua bar.
    const shell = CSS.match(/\.reader-shell \{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(shell).toMatch(/--wing:\s*30px/);
    expect(shell).toMatch(/--reader-bar-max:\s*1680px/);
    expect(shell).toMatch(/--wing-edge:/);
    // Dan bar atas tidak boleh mendeklarasikannya lagi.
    const atas = CSS.match(/\.reader-bar \{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(atas).not.toMatch(/--wing:/);
    expect(atas).not.toMatch(/--reader-bar-max:/);
    // `--wing-fill` dan `--wing-edge` harus dipakai bar atas dari shell.
    expect(atas).toMatch(/background:\s*var\(--wing-fill\)/);
    expect(atas).toMatch(/border:\s*1px solid var\(--wing-edge\)/);
  });

  it("memakai kelas tombol navbar yang sama, bukan meniru tampilannya", () => {
    // Keluhan yang sebenarnya: tombolnya tidak pernah benar-benar sama dengan
    // tombol navbar meski warnanya sudah disamakan. Sebabnya kelasnya dikarang
    // sendiri — `chrome-btn` membawa tinggi, radius `--radius`, gradien kaca +
    // `backdrop-filter`, bayangan berlapis, dan `transform` hover/active, dan
    // tidak satu pun itu ikut tersalin bersama warnanya.
    //
    // Kontraknya: primer = `chrome-btn chrome-btn-brand` (persis
    // `DashboardButton` di `chrome-parts.tsx`), sekunder = `chrome-btn
    // chrome-btn-white` (pasangan `-brand` di atas permukaan pekat, seperti
    // `kartu-detail-loker.tsx`). Diuji dari sumber komponen, bukan dari CSS,
    // karena yang bisa menyimpang adalah kelas yang dipasang.
    const sumber = tanpaKomentar(BERKAS);
    expect(sumber).toContain('"chrome-btn !h-11 !min-w-11');
    expect(sumber).toContain("chrome-btn-brand");
    expect(sumber).toContain("chrome-btn-white");
    // Ghost adalah kaca tembus cahaya untuk navbar di atas foto; di atas bar
    // putih pekat ia terukur `background: none` dan tombolnya hilang sebagai
    // permukaan. Karena itu ia **tidak** dipakai di sini.
    expect(sumber).not.toContain("chrome-btn-ghost");
    // Kelas lama yang dikarang sendiri tidak boleh kembali.
    expect(sumber).not.toContain("rounded-xl px-3");
    expect(sumber).not.toContain("brand-fill");
    // Dan keduanya harus benar-benar ada di `globals.css`, bukan nama kelas yang
    // tidak pernah didefinisikan (kesalahan yang lolos dari typecheck & lint).
    expect(CSS).toMatch(/^\.chrome-btn \{/m);
    expect(CSS).toMatch(/^\.chrome-btn-brand \{/m);
    expect(CSS).toMatch(/^\.chrome-btn-white \{/m);
    // Lantai lupa yang mudah terjadi: `chrome-btn` tingginya 40px, jadi tanpa
    // `!h-11` tombolnya di bawah lantai 44px DESIGN.md.
    expect(sumber).toContain("!h-11");
    // Hanya **satu** tombol berisi gradien — gradiennya dipegang tombol maju.
    // Kalau AI Mastery ikut memakainya, dua tombol biru bersaing di satu bar dan
    // tidak ada lagi satu aksi yang menonjol, persis pola navbar yang cuma punya
    // satu CTA berisi.
    //
    // Diuji dari **pemakaian**, bukan dari definisi kelasnya: memeriksa
    // `kelasPrimer` hanya membuktikan kelas itu ada, sedangkan yang salah adalah
    // kelas mana yang dipasang ke tombol mana. Menukar `kelasSekunder` menjadi
    // `kelasPrimer` pada tombol AI Mastery tidak terdeteksi oleh uji definisi.
    const blokAI = sumber.split('aria-controls="drawer-tutor"')[1]?.split("</button>")[0] ?? "";
    expect(blokAI, "blok tombol AI Mastery tidak ditemukan").toContain("kelasSekunder");
    expect(blokAI).not.toContain("kelasPrimer");
    // Dan yang memakai `kelasPrimer` adalah tombol maju ("Selanjutnya").
    const blokMaju = sumber.split("aria-label={`Selanjutnya:")[1]?.split("</Link>")[0] ?? "";
    expect(blokMaju).toContain("kelasPrimer");
  });

  it("menjaga tombolnya tetap 44px walau labelnya disembunyikan di layar sempit", () => {
    // Di bawah 641px kata "Sebelumnya"/"Selanjutnya" disembunyikan, jadi
    // tombolnya hanya chevron 16px + `padding`. Tanpa `!min-w-11` lebarnya
    // terukur 40px — di bawah lantai 44px repo ini, dan tombol ini satu-satunya
    // jalan berpindah modul di ponsel.
    const sumber = tanpaKomentar(BERKAS);
    expect(sumber).toContain("!min-w-11");
    expect(sumber).toContain("!h-11");
    // Labelnya yang disembunyikan, bukan tombolnya.
    expect(CSS).toMatch(/\.reader-foot-teks \{\s*display:\s*none;/);
  });
});
