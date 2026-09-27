import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { IsiPanelSilabus, ReaderSilabusLeading } from "./reader-silabus";
import type { ModulKursus } from "@/lib/courses/kurikulum";

/**
 * Silabus reader — pemicu + progres di bar, dan panel setinggi layar.
 *
 * Tiga kelas properti yang tidak bisa dijaga di tempat lain:
 *
 * 1. **Panel menutupi bar.** Ia harus `position: fixed` setinggi viewport dan
 *    ber-`z-index` di atas `.reader-bar` (30) maupun dock tutor (`z-40`). Kalau
 *    angka itu turun di bawah 30, panelnya terbuka *di belakang* bar yang
 *    memicunya. `typecheck` dan `vitest` sama-sama buta terhadap `z-index`.
 * 2. **Panel bukan anak bar.** Ia `portal` ke `<body>`; sebagai anak bar,
 *    `z-index`-nya hanya berlaku di dalam stacking context bar dan ia tidak akan
 *    pernah bisa menutupi bar itu.
 * 3. **Satu daftar modul.** Panel memakai `MateriRail`, bukan daftar kedua.
 *    Rail permanen sudah dihapus, jadi tidak boleh ada daftar modul kedua di
 *    layar.
 */

const AKAR = path.resolve(__dirname, "../../../..");
const CSS = readFileSync(path.join(AKAR, "src/app/globals.css"), "utf8");
const BERKAS = path.join(AKAR, "src/components/features/learning/reader-silabus.tsx");

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

function renderLeading(selesai: string[] = [], buka = false) {
  return renderToStaticMarkup(
    createElement(ReaderSilabusLeading, {
      kursusJudul: "Kursus Uji",
      modul: MODUL,
      selesai,
      buka,
      onToggle: () => {},
    }),
  );
}

/**
 * Isi panel dirender **langsung**, bukan lewat `ReaderPanelSilabus`: yang terakhir
 * merender `createPortal(..., document.body)`, dan `document` tidak ada di
 * lingkungan `node` ini — merendernya akan melempar `ReferenceError`, bukan
 * memberi HTML. Isi panelnya justru yang membawa properti yang diuji di sini;
 * portal dan perilaku papan ketiknya dijaga lewat sumber di bawah.
 */
function renderPanel(over: { selesai?: string[]; modulAktif?: string } = {}) {
  return renderToStaticMarkup(
    createElement(IsiPanelSilabus, {
      slug: "kursus-uji",
      kursusJudul: "Kursus Uji",
      kursusPenyedia: "Careevo",
      modul: MODUL,
      modulAktif: over.modulAktif ?? "crs-1-m1",
      selesai: over.selesai ?? [],
      onTutup: () => {},
    }),
  );
}

describe("ReaderSilabusLeading", () => {
  it("menyalakan satu bit per modul yang selesai", () => {
    const html = renderLeading(["crs-1-m1"]);
    expect(html.match(/reader-silabus-bit/g) ?? []).toHaveLength(MODUL.length);
    expect(html.match(/reader-silabus-bit is-terisi/g) ?? []).toHaveLength(1);
  });

  it("membuang id modul basi, tidak menggelembungkan progres", () => {
    // `crs-1-m9` tidak ada di kurikulum saat ini. Kalau ia ikut dihitung, bar
    // mengklaim lebih banyak modul selesai daripada yang bisa dibuka peserta —
    // aturan yang sama dengan `irisModulSelesai` di `listProgresKursus()`.
    const html = renderLeading(["crs-1-m1", "crs-1-m9"]);
    expect(html.match(/reader-silabus-bit is-terisi/g) ?? []).toHaveLength(1);
  });

  it("menyebut progresnya untuk pembaca layar, karena segmennya aria-hidden", () => {
    // Segmennya `aria-hidden`, jadi satu-satunya kalimat yang didengar pembaca
    // layar adalah baris ini; tanpa itu progresnya tidak ada bagi mereka.
    expect(renderLeading(["crs-1-m1"])).toContain(
      "Progres kursus 1 dari 3 modul, 33 persen",
    );
  });

  it("tombolnya membawa nama aksesibel dan aria-expanded", () => {
    const html = renderLeading();
    expect(html).toContain('aria-label="Buka silabus kursus"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-controls="reader-panel-silabus"');
  });

  it("membungkus ikon, judul, dan bit progres jadi satu tombol", () => {
    // Yang diminta: kladnya menyorot sebagai satu komponen saat disentuh dan
    // klik di bagian mana pun membukanya. Sebelumnya tombolnya **saudara** dari
    // judul dan bitnya — `</button>` menutup sebelum keduanya — sehingga hanya
    // chip ikon yang bisa diklik dan hanya chip itu yang bereaksi terhadap
    // hover, padahal ketiganya terlihat seperti satu kontrol.
    //
    // Diuji dari HTML hasil render, bukan dari sumber: yang menentukan perilaku
    // hover/klik adalah **pohon DOM-nya**, dan sebuah komentar atau prop bisa
    // terlihat benar di sumber sementara sarangnya salah.
    const html = renderLeading();
    const tombol = html.match(/<button[^>]*data-silabus-toggle[\s\S]*?<\/button>/)?.[0];
    expect(tombol, "tombol pemicu silabus tidak ditemukan").toBeDefined();
    expect(tombol).toMatch(/reader-silabus-ikon/);
    expect(tombol).toMatch(/reader-silabus-judul/);
    expect(tombol).toMatch(/reader-silabus-bit/);
    // Dan tidak ada sisa bit di luar tombol — kalau salah satunya keluar, hover
    // tombolnya tidak lagi mencakup seluruh klad.
    const bitDiLuar = html.replace(tombol!, "").match(/reader-silabus-bit/g) ?? [];
    expect(bitDiLuar).toHaveLength(0);
  });

  it("menaruh kalimat progres untuk pembaca layar di luar tombolnya", () => {
    // Kalimat inilah satu-satunya sumber progres bagi pembaca layar (segmennya
    // `aria-hidden`). Di **dalam** tombol ia tertelan: `aria-label` menimpa isi
    // elemen sebagai nama aksesibel, jadi progresnya justru hilang dari pembaca
    // layar tepat saat ia dipindahkan ke sana. Karena itu sarangnya dikunci.
    const html = renderLeading(["crs-1-m1"]);
    const tombol = html.match(/<button[^>]*data-silabus-toggle[\s\S]*?<\/button>/)?.[0];
    expect(tombol).not.toMatch(/Progres kursus/);
    expect(html).toMatch(/Progres kursus 1 dari 3 modul, 33 persen/);
  });

  it("mengubah label tombol saat panel terbuka", () => {
    // Labelnya menyebut **tujuan**, bukan keadaan: saat terbuka tombolnya
    // menutup. Label statis "Buka …" pada panel yang sudah terbuka membuat
    // pembaca layar diberi tahu kebalikan dari apa yang terjadi.
    const html = renderLeading([], true);
    expect(html).toContain('aria-label="Tutup silabus kursus"');
    expect(html).toContain('aria-expanded="true"');
  });
});

describe("ReaderPanelSilabus", () => {
  it("tidak bisa dijangkau Tab saat tertutup", () => {
    // Jaminannya "panel tersembunyi tidak bisa di-Tab dan scrimnya tidak
    // menangkap klik", bukan "elemennya tidak ada di DOM".
    //
    // Dulu mekanismenya memang ketiadaan elemen (`if (!buka) return null`), dan
    // tes ini mengunci baris itu. Animasi keluar mengubahnya: panel yang dilepas
    // pada frame yang sama saat `buka` menjadi `false` tidak punya elemen untuk
    // dianimasikan, jadi panelnya sekarang **tetap ter-mount** selama fase
    // menutup (~200ms) lalu dilepas. Yang menggantikan jaminannya adalah `inert`,
    // yang mengeluarkan subtree dari urutan Tab **sekaligus** pohon
    // aksesibilitas — `aria-hidden` saja tidak cukup, karena ia tidak
    // menyentuh urutan Tab.
    //
    // Diperiksa dari sumber, bukan render: yang menentukan adalah pengawatan prop
    // di `ReaderPanelSilabus`, dan `document` tidak ada di lingkungan test ini.
    const sumber = tanpaKomentar(BERKAS);
    expect(sumber).toContain("if (!tampil) return null;");
    // Keduanya harus ber-`inert`: panelnya (supaya daftar modulnya tidak
    // di-Tab) **dan** scrimnya (supaya ia tidak menangkap klik selama keluar).
    // Assertion atas satu saja tidak menjaga yang lain — versi pertama tes ini
    // hanya memeriksa scrim, sehingga menghapus `inert` dari panelnya tetap
    // hijau.
    expect(sumber).toMatch(/inert=\{nonaktif\}/);
    expect(sumber).toMatch(/inert=\{!buka && sedangMenutup\}/);
    // `aria-hidden` saja tidak boleh diandalkan: ia mengeluarkan subtree dari
    // pohon aksesibilitas tetapi **tidak** dari urutan Tab, jadi Tab tetap masuk
    // ke daftar modul yang sedang meluncur keluar.
    expect(sumber).not.toMatch(/aria-hidden=\{nonaktif\}/);
    // `tampil` harus mencakup fase menutup, kalau tidak panelnya hilang sebelum
    // sempat dianimasikan keluar.
    expect(sumber).toMatch(/const tampil = buka \|\| sedangMenutup;/);
  });

  it("melepas panelnya hanya setelah animasi keluarnya selesai", () => {
    // Fase menutup berakhir lewat `animationend`, dan handler-nya wajib menyaring
    // event milik anak: `animationend` **bubble**, jadi animasi apa pun di dalam
    // panel akan sampai ke `<aside>` dan — tanpa saringan — melepas panelnya
    // jauh sebelum animasi keluarnya selesai.
    const sumber = tanpaKomentar(BERKAS);
    expect(sumber).toMatch(/e\.target === e\.currentTarget/);
    // Ada jaring pengaman kalau `animationend` tidak pernah datang (animasi
    // dihentikan induk, `animation-name` ditimpa, peramban yang tidak
    // menjalankannya). Tanpa itu penandanya tertinggal `true` selamanya.
    expect(sumber).toMatch(/setTimeout\(\(\) => setSedangMenutup\(false\), 400\)/);
  });

  it("menutupi bar dan dock tutor saat terbuka", () => {
    // `.reader-bar` = 30, scrim drawer tutor = `z-30`, dock = `z-40`,
    // `.skip-link` = 100.
    const panel = CSS.match(/\.reader-panel \{[\s\S]*?\n\}/)?.[0] ?? "";
    const z = Number(panel.match(/z-index:\s*(\d+)/)?.[1]);
    expect(z).toBeGreaterThan(40);
    expect(z).toBeLessThan(100);
    expect(panel).toMatch(/position:\s*fixed/);
    // Tingginya tetap diukur dengan `dvh`, bukan `vh`: peramban seluler menyusutkan
    // visual viewport saat chrome-nya sendiri mengecil, dan panel `vh` menyimpan
    // kakinya di bawah UI peramban. Yang berubah hanya pengurangan gutter-nya.
    expect(panel).toMatch(/height:\s*calc\(100dvh - /);
  });

  it("di-dock ke kiri, dengan jarak di tepi atas dan bawah", () => {
    // Yang diminta: jarak di **atas dan bawah** saja, bukan di kiri. Panelnya
    // dulu `inset: 0 auto 0 0` setinggi `100dvh`, jadi ia menempel di tiga tepi
    // sekaligus — dan padding di dalam panel tidak bisa memperbaiki tepi luar
    // yang dipaku ke 0; itu sebabnya percobaan pertama tidak mengubah apa pun
    // yang terlihat. Yang diperbaiki adalah inset luarnya.
    const panel = CSS.match(/\.reader-panel \{[\s\S]*?\n\}/)?.[0] ?? "";
    const insetY = panel.match(/--reader-panel-inset-y:\s*([\d.]+rem)/)?.[1];
    expect(insetY, "inset vertikal panel tidak ditemukan").toBeDefined();
    // `inset: <atas> auto auto <kiri>` — atas memakai inset-nya, kiri **0**.
    expect(panel).toMatch(
      /inset:\s*var\(--reader-panel-inset-y\)\s+auto\s+auto\s+0;/,
    );
    // Tepi atas dan bawah tidak boleh menempel; `inset: 0 …` dan `100dvh` polos
    // adalah bentuk lamanya.
    expect(panel).not.toMatch(/inset:\s*0/);
    expect(panel).toMatch(/height:\s*calc\(100dvh - 2 \* var\(--reader-panel-inset-y\)\)/);
    expect(panel).not.toMatch(/height:\s*100dvh/);
  });

  it("tetap siku di tepi kiri karena tepinya menempel di layar", () => {
    // Hanya dua sudut kanan yang membulat: pasangan kiri duduk tepat di tepi
    // layar, jadi membulatkannya terbaca seperti kesalahan. Aturan yang sama
    // dengan `.mobile-nav-drawer`. (Sempat jadi `1.25rem` saat tepi kirinya ikut
    // diberi jarak; percobaan itu dibalik bersama inset-nya.)
    const panel = CSS.match(/\.reader-panel \{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(panel).toMatch(/border-radius:\s*0\s+1\.25rem\s+1\.25rem\s+0;/);
  });

  it("meluncur sejauh lebarnya sendiri saat keluar", () => {
    // `translateX(-100%)` sudah cukup **hanya karena** tepi kiri panelnya di 0:
    // menggesernya sejauh lebarnya sendiri menempatkan tepi kanannya tepat di 0.
    // Kalau tepi kirinya suatu saat diberi jarak lagi, ini harus menjadi
    // `calc(-100% - <jarak>)` atau animasi keluarnya menyisakan potongan panel —
    // bug yang sudah pernah terukur 16px, bukan teori.
    const masuk = CSS.match(/@keyframes reader-panel-masuk \{[\s\S]*?\n\}/)?.[0] ?? "";
    const keluar = CSS.match(/@keyframes reader-panel-keluar \{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(masuk).toMatch(/from \{\s*transform:\s*translateX\(-100%\);\s*\}/);
    expect(masuk).toMatch(/to \{\s*transform:\s*translateX\(0\);\s*\}/);
    // Masuk dan keluar harus cerminan persis: itulah yang membuatnya bisa
    // diambil alih di tengah animasi saat peserta membuka kembali.
    expect(keluar).toMatch(/from \{\s*transform:\s*translateX\(0\);\s*\}/);
    expect(keluar).toMatch(/to \{\s*transform:\s*translateX\(-100%\);\s*\}/);
  });

  it("memberi napas di tepi atas dan bawah isinya", () => {
    // Padding **dalam** panel: jarak judul dari tepi atas panelnya dan CTA dari
    // tepi bawahnya. Ia dulu satu-satunya ruang napas karena panelnya menempel
    // di tepi layar; sekarang panelnya mengambang, jadi ini jarak dari tepi
    // panel (bukan tepi layar) — dan tetap perlu, karena daftar modul tidak boleh
    // berdesakan dengan kepala dan kakinya.
    //
    // Dikunci dari CSS karena `typecheck`/`vitest` buta terhadap piksel: satu
    // penyuntingan `padding` yang salah tidak menggagalkan apa pun di tempat lain.
    const kepala = CSS.match(/\.reader-panel-head \{[\s\S]*?\n\}/)?.[0] ?? "";
    const kaki = CSS.match(/\.reader-panel-foot \{[\s\S]*?\n\}/)?.[0] ?? "";
    // `padding: <atas> <kiri-kanan> <bawah>` — sisi atas kepala dan sisi bawah
    // kaki inilah yang menjaga napasnya.
    expect(kepala).toMatch(/padding:\s*1\.5rem\s+[\d.]+rem\s+[\d.]+rem/);
    expect(kaki).toMatch(/padding:\s*[\d.]+rem\s+[\d.]+rem\s+1\.5rem/);
    // Keduanya harus tetap punya padding horizontal yang sama, kalau tidak judul
    // dan tombolnya berhenti sejajar dengan daftar modulnya.
    const horizontalKepala = kepala.match(/padding:\s*[\d.]+rem\s+([\d.]+rem)/)?.[1];
    const horizontalKaki = kaki.match(/padding:\s*[\d.]+rem\s+([\d.]+rem)/)?.[1];
    expect(horizontalKepala).toBe(horizontalKaki);
  });

  it("scrimnya di bawah panelnya sendiri", () => {
    const scrim = CSS.match(/\.reader-panel-scrim \{[\s\S]*?\n\}/)?.[0] ?? "";
    const zScrim = Number(scrim.match(/z-index:\s*(\d+)/)?.[1]);
    const zPanel = Number(
      (CSS.match(/\.reader-panel \{[\s\S]*?\n\}/)?.[0] ?? "").match(/z-index:\s*(\d+)/)?.[1],
    );
    expect(zScrim).toBeLessThan(zPanel);
  });

  it("di-portal ke <body>, bukan anak bar fokus", () => {
    const sumber = tanpaKomentar(BERKAS);
    // Assertion-nya harus pada **target portal-nya**, bukan sekadar kehadiran
    // string `document.body`: berkas ini juga menyentuh `document.body.style`
    // untuk mengunci scroll, jadi `toContain("document.body")` tetap hijau
    // walaupun target portalnya dihapus — dan itu bukan penjaga, hanya
    // kebetulan.
    expect(sumber).toMatch(/return createPortal\([\s\S]*?\n\s*document\.body,\n\s*\);/);
  });

  it("memakai satu daftar modul — `MateriRail`, bukan salinan kedua", () => {
    expect(tanpaKomentar(BERKAS)).toContain("<MateriRail");
  });

  it("memuat seluruh kurikulum dan menandai modul yang sedang dibuka", () => {
    const html = renderPanel({ modulAktif: "crs-1-m2" });
    // Semua modul, dengan tautan reader-nya, dari komponen rail yang sama.
    expect(html).toContain('nav aria-label="Daftar modul"');
    expect(html).toContain('href="/belajar/kursus-uji/materi/crs-1-m1"');
    expect(html).toContain('href="/belajar/kursus-uji/materi/crs-1-m3"');
    // `aria-current="page"` hanya pada satu baris — yang aktif.
    expect(html.match(/aria-current="page"/g) ?? []).toHaveLength(1);
    expect(html).toMatch(/<a [^>]*aria-current="page"[^>]*href="\/belajar\/kursus-uji\/materi\/crs-1-m2"/);
  });

  it("mengulang judul, penyedia, dan progres supaya konteksnya tidak hilang", () => {
    // Panelnya menutupi bar, jadi tanpa pengulangan ini peserta kehilangan
    // konteks begitu ia terbuka.
    const html = renderPanel({ selesai: ["crs-1-m1"] });
    expect(html).toContain("Kursus Uji");
    expect(html).toContain("Careevo");
    expect(html).toContain("1 dari 3 modul · 33%");
    // Bit versi besar, bukan versi bar: panel dibaca dari jarak layar penuh.
    expect(html).toMatch(/reader-silabus-segmen is-besar/);
  });

  it("menawarkan CTA ke modul berikutnya yang belum selesai", () => {
    // Setelah m1 selesai, yang berikutnya adalah m2 — bukan modul pertama lagi.
    const html = renderPanel({ selesai: ["crs-1-m1"] });
    expect(html).toContain('href="/belajar/kursus-uji/materi/crs-1-m2"');
    expect(html).toContain("Lanjutkan belajar");
  });

  it("menawarkan ulasan saat semua modul selesai", () => {
    const html = renderPanel({ selesai: MODUL.map((m) => m.id) });
    expect(html).toContain("Ulas modul");
    expect(html).toContain("3 dari 3 modul · 100%");
  });

  it("menaruh judul kursus di kiri dan tombol tutupnya rata kanan", () => {
    // Susunannya adalah janji visual, dan `typecheck`/`vitest` tidak melihat
    // piksel: kalau urutan DOM-nya kembali dibalik, tombolnya merapat ke tepi
    // kiri — sudut tempat pintu *masuk* biasanya berada, bukan tempat pintu
    // keluar. Pembaca layar pun mendengar judulnya dulu, baru tombolnya.
    const html = renderPanel();
    const iJudul = html.indexOf("reader-panel-judul");
    const iTombol = html.indexOf("reader-panel-toggle");
    expect(iJudul).toBeGreaterThan(-1);
    expect(iTombol).toBeGreaterThan(iJudul);
    // Keduanya satu baris kepala, bukan dua blok bertumpuk.
    expect(html).toMatch(
      /reader-panel-head-row[\s\S]*?reader-panel-judul[\s\S]*?reader-panel-toggle/,
    );
    // Yang memakukan tombolnya ke tepi kanan adalah `space-between` pada baris;
    // tanpa itu keduanya hanya berdesakan di kiri.
    const baris = CSS.match(/\.reader-panel-head-row \{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(baris).toMatch(/justify-content:\s*space-between/);
    // `margin: 0` di judul bukan kerapian — lembar dasar memberi setiap `<p>`
    // `margin: 0 0 1rem`, dan sebagai flex child margin itu ikut ke dalam kotak
    // baris: barisnya terukur 58px, bukan 42px, dan `align-items: center`
    // memusatkan tombol pada kotak yang lebih tinggi itu sehingga X-nya turun
    // ~8px dari garis mata judul. Diuji dari CSS karena inilah yang menjaga
    // keduanya satu garis.
    const judul = CSS.match(/\.reader-panel-judul \{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(judul).toMatch(/margin:\s*0;/);
  });

  it("membuang baris label SILABUS dari kepala panel", () => {
    // Namanya sudah dibawa `aria-label` di `<aside>` ("Silabus Kursus Uji"), jadi
    // baris "SILABUS" hanya mengulangnya. Yang menjaga ini kelasnya, bukan
    // teksnya: judul kursus bisa kebetulan memuat kata "Silabus".
    expect(renderPanel()).not.toContain("reader-panel-label");
    expect(CSS).not.toMatch(/\.reader-panel-label\s*\{/);
  });

  it("tombol tutupnya ikon polos — tanpa kartu", () => {
    // Permintaannya eksplisit: ikonnya saja, tanpa kartu. Tiga properti yang
    // membentuk "kartu" itu ada di sini, dan masing-masing bisa dikembalikan
    // tanpa mengubah apa pun yang lain — jadi ketiganya dikunci.
    const tombol = CSS.match(/\.reader-panel-toggle \{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(tombol).toMatch(/background:\s*transparent/);
    expect(tombol).toMatch(/border:\s*0/);
    // `border: 1px solid var(--border)` adalah bentuk lamanya; pastikan tidak
    // ada border berlebar di aturan ini.
    expect(tombol).not.toMatch(/border:\s*[1-9]/);
    // 44px: tap target, bukan 40px yang lama.
    expect(tombol).toMatch(/width:\s*44px/);
    expect(tombol).toMatch(/height:\s*44px/);
    // Warnanya yang membawa keadaan sekarang, karena tidak ada lagi isian yang
    // berubah saat hover — transisi `background-color` akan mengembalikan kartu.
    expect(tombol).toMatch(/transition:\s*color/);
    expect(tombol).not.toMatch(/background-color/);
  });

  it("memakai X yang tebal dan besar, bukan ikon garis tipis", () => {
    // "Lebih tebal" dan "lebih besar" adalah dua janji terpisah, dan keduanya
    // ada di angka yang bisa dicabut tanpa mengubah apa pun yang lain. Ikon
    // remixicon yang lama adalah `path` berisi dengan bobot tetap — tidak ada
    // yang bisa ditebalkan; `strokeWidth` di bawah hanya berarti pada ikon
    // berbasis garis seperti lucide `X`. 20px/1.6 adalah bentuk lamanya.
    const sumber = tanpaKomentar(BERKAS);
    expect(sumber).toContain('from "lucide-react"');
    expect(sumber).not.toContain("RiCloseLine");
    expect(sumber).toMatch(/<X size=\{26\} strokeWidth=\{3\.25\}/);
    expect(sumber).toMatch(/absoluteStrokeWidth/);
  });

  it("CTA-nya memakai ramp biru yang sama dengan tombol Daftar", () => {
    // DESIGN.md: tombol primary yang terisi memakai `--brand-grad`, dan hex-nya
    // tidak boleh ditulis ulang per permukaan. CTA ini sempat jadi satu-satunya
    // tombol terisi di aplikasi yang memakai `--primary` datar.
    const cta = CSS.match(/\.reader-panel-cta \{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(cta).toMatch(/background:\s*var\(--brand-grad\)/);
    expect(cta).toMatch(/border:\s*1px solid var\(--brand-border\)/);
    expect(cta).toMatch(/box-shadow:\s*var\(--brand-shadow\)/);
    // Tidak ada hex mentah: ramp-nya hanya boleh lewat token.
    expect(cta).not.toMatch(/#[0-9a-fA-F]{6}/);
    const hover = CSS.match(/\.reader-panel-cta:hover \{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(hover).toMatch(/var\(--brand-grad-hover\)/);
    // Bentuk lamanya (`--primary` datar) tidak boleh kembali di CTA ini.
    expect(cta).not.toMatch(/background:\s*var\(--primary\)/);
  });

  it("memberi nama aksesibel pada dialog dan tombol tutupnya", () => {
    // `aria-modal` + `aria-label`: tanpa nama, dialognya diumumkan sebagai
    // "dialog" tanpa keterangan apa pun. Ikon tombol tutupnya `aria-hidden`.
    const html = renderPanel();
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-label="Silabus Kursus Uji"');
    expect(html).toContain('aria-label="Tutup silabus kursus"');
    // Scrim juga bisa menutup, dan namanya menyebut aksi yang sama. Ia hidup di
    // pembungkus portal, bukan di isi panel — jadi diperiksa dari sumber.
    expect(tanpaKomentar(BERKAS)).toMatch(
      /className="reader-panel-scrim"[\s\S]*?aria-label="Tutup silabus kursus"/,
    );
  });
});
