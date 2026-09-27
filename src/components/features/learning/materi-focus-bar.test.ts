import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CourseSessionProvider } from "./course-session";
import { MateriFocusBar } from "./materi-focus-bar";
import { kebijakanDefault, PESAN_POLICY } from "@/lib/courses/kebijakan";
import type { ModulKursus } from "@/lib/courses/kurikulum";

/** Tiga tingkat: `src/components/features/learning` → akar repo. */
const ROOT = path.resolve(__dirname, "../../../..");
const BERKAS_BAR = path.join(ROOT, "src/components/features/learning/materi-focus-bar.tsx");

/**
 * Sumber tanpa komentar — untuk pemeriksaan **struktur**.
 *
 * Berkas itu sendiri menjelaskan kenapa `CourseSessionIndicator` **tidak** ada
 * di sana, jadi menguji teks mentah akan membuat assertion ini gagal justru
 * karena dokumentasinya benar — dan menghapus komentarnya agar hijau berarti
 * membuang alasan keputusannya. Sama seperti `tanpaKomentar` di
 * `materi-shell.test.ts`.
 */
function tanpaKomentar(berkas: string): string {
  return readFileSync(berkas, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "$1");
}

/**
 * Bar fokus — diuji lewat HTML hasil render.
 *
 * Dua hal yang dikunci:
 * 1. Tombol tutor mengikuti **kebijakan kursus** (`aturan_bantuan`), bukan
 *    checkpoint modul. Test ini sengaja memakai modul ber-checkpoint `kuis` di
 *    kursus `bertutor` dan mengharapkan tombol tetap aktif — supaya tidak ada
 *    yang diam-diam menambahkan gerbang per checkpoint.
 * 2. Tombol `tanpa_ai` tetap **dirender** meski nonaktif, dengan alasan dari
 *    `putuskanAkses` — peserta berhak tahu fitur itu ada dan kenapa mati.
 * 3. Pemicu silabus + progres di kiri bar ada dengan nama aksesibel dan
 *    `aria-expanded` yang sejalan dengan panelnya. Tombol itu satu-satunya jalan
 *    ke peta modul; tanpa nama aksesibel ia diumumkan sebagai tombol tak
 *    bernama, dan tanpa `aria-expanded` yang pernah berubah panelnya ada tapi
 *    statusnya tidak bisa dipercaya. Bitnya satu per modul, dan id basi tidak
 *    boleh menggelembungkan angka — aturan yang sama dengan
 *    `irisModulSelesai` di `listProgresKursus()`.
 * 4. Penyelesaian modul **bukan** tombol. Modul menandai dirinya selesai saat
 *    halaman terakhirnya tercapai (`materi-shell.tsx`), jadi yang tinggal di bar
 *    hanyalah tanda bacanya. Test di bawah mengunci bahwa tidak ada `<button>`
 *    konfirmasi yang tersisa — menghadirkan kembali tombol "Tandai selesai"
 *    berarti mengembalikan langkah konfirmasi yang sengaja dibuang.
 */

const MODUL_AKTIF: ModulKursus = {
  id: "crs-1-m2",
  judul: "Mendalami React",
  ringkasan: "r",
  durasi_min: 10,
  url: "https://contoh.test",
  checkpoint: { batas_waktu_menit: 30, mode: "kuis" },
};

/** Seluruh kurikulum — bit progres dihitung dari sini, bukan dari modul aktif. */
const KURIKULUM: ModulKursus[] = [
  { id: "crs-1-m1", judul: "Orientasi", ringkasan: "r", durasi_min: 10, url: "https://contoh.test" },
  MODUL_AKTIF,
  { id: "crs-1-m3", judul: "Penutup", ringkasan: "r", durasi_min: 10, url: "https://contoh.test" },
];

function render(
  aksesTutor: Parameters<typeof MateriFocusBar>[0]["aksesTutor"],
  pesan?: string | null,
  silabus?: { buka: boolean; selesai?: string[] },
) {
  // `children` dioper lewat properti, bukan argumen ketiga `createElement`:
  // di React 19 types `children` adalah properti wajib `CourseSessionProvider`,
  // dan bentuk tiga-argumen gagal `npm run typecheck` dengan TS2769. Sama
  // seperti helper di Task 3.
  const isi = {
    courseId: "crs-1",
    kebijakan: kebijakanDefault(),
    buktiAwal: "t.a",
    runIdAwal: "r-1",
    children: createElement(MateriFocusBar, {
      slug: "kursus-uji",
      kursusJudul: "Kursus Uji",
      modulSemua: KURIKULUM,
      selesai: silabus?.selesai ?? [],
      sudah: false,
      pending: false,
      drawerBuka: false,
      onToggleDrawer: () => {},
      aksesTutor,
      pesan,
      // Panel silabus: statusnya milik shell, tapi **tombolnya** milik bar — dan
      // `aria-expanded` yang tidak pernah berubah adalah bug yang tepat di sini.
      silabusBuka: silabus?.buka ?? false,
      onToggleSilabus: () => {},
    }),
  };
  return renderToStaticMarkup(createElement(CourseSessionProvider, isi));
}

/**
 * Teks yang benar-benar dirender — tag (dan karenanya seluruh atribut) dibuang.
 *
 * Untuk assertion copy yang harus **terlihat** peserta, bukan sekadar ada di
 * dokumen. Alasannya konkret dan sudah terbukti di berkas ini: saat
 * `aksesTutor.tipe === "ditolak"`, alasan yang sama juga dipasang ke `aria-label`
 * dan `title` tombol tutor (`materi-focus-bar.tsx:87-88`), sehingga
 * `toContain(<alasan>)` di seluruh HTML tetap hijau walau baris kuningnya
 * dihapus — assertion itu tidak menjaga apa yang diklaimnya. Menguji teks saja
 * memisahkan "terbaca di layar" dari "ada di atribut".
 */
function teks(html: string): string {
  return html.replace(/<[^>]*>/g, " ");
}

/**
 * Tag `<button …>` yang memuat penanda tertentu, apa adanya.
 *
 * Dipakai untuk assertion yang tidak boleh dipenuhi tombol lain. Sejak ada dua
 * tombol ber-`aria-expanded` di bar ini (tutor dan "Daftar modul"), `toContain`
 * seluruh-dokumen tidak lagi menjaga tombol mana yang sedang dibicarakan —
 * properti yang diuji adalah properti satu tombol.
 */
function tombol(html: string, penanda: string): string {
  const tag = html.match(new RegExp(`<button [^>]*${penanda}[^>]*>`))?.[0];
  expect(tag, `tombol dengan penanda ${penanda} tidak ditemukan`).toBeDefined();
  return tag!;
}

describe("MateriFocusBar", () => {
  it("menautkan kembali ke silabus", () => {
    const html = render({ tipe: "bebas" });
    expect(html).toContain('href="/belajar/kursus-uji"');
  });

  it("memberi blok merek nama aksesibel yang tidak bergantung breakpoint", () => {
    // Blok merek di ujung kiri **adalah** jalan keluar dari reader: tautan
    // "← Silabus" bertuliskan teks sudah dihapus, jadi tidak ada lagi label
    // navigasi yang terbaca di bar. Di bawah `sm` kata "Careevo" disembunyikan
    // CSS dan mark-nya `aria-hidden`, sehingga tanpa `aria-label` tautan ini —
    // satu-satunya jalan kembali ke halaman kursus — diumumkan tanpa nama.
    // Nama itu menyebut **tujuannya**, bukan mereknya: yang perlu didengar
    // pengguna keyboard adalah "kembali ke halaman kursus".
    //
    // Tag-nya diambil utuh lalu diperiksa, bukan dicocokkan dengan satu regex
    // berurutan: urutan atribut hasil render bukan kontrak, dan pola
    // `href=… lalu aria-label=…` gagal pada HTML yang benar begitu React
    // menaruh `aria-label` lebih dulu.
    const html = render({ tipe: "bebas" });
    const tautan = html.match(/<a [^>]*href="\/belajar\/kursus-uji"[^>]*>/)?.[0];
    expect(tautan).toBeDefined();
    expect(tautan).toContain('aria-label="Kembali ke halaman kursus"');
    // Mark-nya dekoratif: nama sudah dibawa `aria-label`, dan `alt` yang terisi
    // akan membuat pembaca layar menyebut merek dua kali.
    expect(tautan).toContain('class="reader-brand"');
    expect(html).toMatch(/reader-brand-mark/);
  });

  it("tidak menyisakan label 'Silabus' bertuliskan teks di bar", () => {
    // Yang diminta dibuang: ikon panah balik **dan** kata "Silabus" di bar ini.
    // Diuji pada teks yang benar-benar terbaca (`teks()` membuang tag), bukan
    // seluruh HTML: nama panel dan `aria-controls` sengaja tetap memuat kata
    // "silabus" di atribut, jadi assertion atas HTML mentah akan hijau justru
    // karena atribut yang memang harus ada. Tombol pemicunya tetap ada — yang
    // hilang hanya tautan berlabel teks.
    const html = render({ tipe: "bebas" });
    expect(teks(html)).not.toContain("Silabus");
    // Pintunya tetap ada: tombol silabus dan tautan keluarnya.
    expect(html).toContain("data-silabus-toggle");
    expect(html).not.toContain("RiArrowLeftLine");
    expect(html).not.toContain('aria-label="Silabus"');
  });

  it("menaruh blok merek di paling kiri, sebelum pemicu silabus", () => {
    // Referensinya adalah blok merek di ujung kiri; urutan DOM itu yang
    // menentukannya, dan tidak ada tes lain yang melihat urutan ini.
    const html = render({ tipe: "bebas" });
    expect(html.indexOf("reader-brand")).toBeLessThan(html.indexOf("data-silabus-toggle"));
    expect(html.indexOf("reader-brand")).toBeGreaterThan(-1);
  });

  it("tombol tutor aktif saat kebijakan mengizinkan", () => {
    const html = render({ tipe: "bebas" });
    // Di-scope ke tombol tutor: sejak tombol "Daftar modul" ada, `aria-expanded`
    // tidak lagi unik di dokumen, dan assertion seluruh-dokumen akan hijau
    // seolah-olah tombol tutor dievaluasi padahal yang cocok tombol modul.
    const tutor = tombol(html, 'aria-controls="drawer-tutor"');
    expect(tutor).toContain('aria-expanded="false"');
    // Dihitung dari **atribut** `disabled=""`, bukan substring "disabled":
    // kelas Tailwind `disabled:opacity-60` pada tombol lain juga memuat kata
    // itu, sehingga `not.toContain("disabled")` gagal pada kode yang benar dan
    // `toContain("disabled")` lulus tanpa membuktikan apa pun.
    expect(html.match(/disabled=""/g) ?? []).toHaveLength(0);
  });

  it("tombol tutor nonaktif saat `tanpa_ai`, tapi tetap dirender dengan alasannya", () => {
    const html = render({ tipe: "ditolak", pesan: "Aturan course ini melarang bantuan AI." });
    // Diperiksa pada **teks**, bukan seluruh HTML: alasan yang sama juga dipasang
    // ke `aria-label`/`title` tombol tutor, jadi `toContain` atas HTML tetap
    // hijau walau baris kuningnya dihapus — dan baris itulah yang diklaim tes ini.
    expect(html).toContain('aria-label="Aturan course ini melarang bantuan AI."');
    expect(teks(html)).toContain("Aturan course ini melarang bantuan AI.");
    // Tepat satu tombol nonaktif — tombol tutor. Sejak tombol konfirmasi
    // penyelesaian dibuang, tutor satu-satunya tombol yang bisa mati di bar.
    expect(html.match(/disabled=""/g) ?? []).toHaveLength(1);
  });

  it("menampilkan tanda baca penyelesaian, bukan tombol konfirmasi", () => {
    // Permintaan yang sebenarnya: jangan minta peserta menegaskan ulang apa yang
    // sudah dilakukannya. Modul ditandai selesai sendiri saat halaman terakhirnya
    // tercapai, jadi tidak boleh ada tombol "Tandai selesai" di sini — menghitung
    // tombol di bar membedakan "tanda baca" dari "aksi".
    const html = teks(render({ tipe: "bebas" }));
    expect(html).not.toContain("Tandai selesai");
    // Modul yang belum selesai tetap menyatakan keadaannya, supaya peserta tahu
    // statusnya tanpa tombol.
    expect(html).toContain("Belum selesai");
  });

  it("tidak merender tombol konfirmasi penyelesaian sama sekali", () => {
    // Diperiksa dari sumber, bukan HTML: yang dijaga adalah **tidak adanya**
    // elemen `<button>` yang memicu `onTandai`. Mengembalikannya berarti
    // mengembalikan langkah konfirmasi yang sengaja dibuang.
    const sumber = tanpaKomentar(BERKAS_BAR);
    expect(sumber).not.toContain("onTandai");
    expect(sumber).not.toContain("Tandai selesai");
  });

  it("tidak merender baris penolakan saat `pesan` kosong", () => {
    // `role="status"` tidak boleh ada sama sekali: baris status kosong membuat
    // pembaca layar mengumumkan sesuatu yang tidak terjadi.
    expect(render({ tipe: "bebas" })).not.toContain('role="status"');
    expect(render({ tipe: "bebas" }, null)).not.toContain('role="status"');
  });

  it("merender penolakan penyelesaian apa adanya, diumumkan `role=\"status\"`", () => {
    // Copy-nya datang dari mesin akses server; memparafrase di klien membuat dua
    // permukaan berbeda ucapan untuk penolakan yang sama. Jadi yang dioper ke
    // bar adalah **pesan asli** server, apa adanya — tidak dipotong, tidak
    // dibungkus kalimat pengantar.
    const pesan = PESAN_POLICY.wajib;
    const html = render({ tipe: "bebas" }, pesan);
    // Tag pembukanya diambil utuh, lalu isinya diperiksa terpisah: ikon
    // `<svg>` berada di antara `<p>` dan teksnya, jadi pola
    // `<p role="status">teks</p>` tidak pernah cocok pada markup yang benar.
    const baris = html.match(/<p role="status"[^>]*>/)?.[0];
    expect(baris).toBeDefined();
    expect(baris).toContain("border-t border-amber-200 bg-amber-50");
    // Panjang penuh, bukan potongan: pesan `wajib` beberapa kalimat, dan versi
    // yang dipecah akan lebih mudah dibaca di bar tetapi tidak lagi verbatim.
    // Diperiksa pada teks, dan dibandingkan dengan `baris` di atas: di sini
    // tidak ada salinan atribut yang bisa memuaskan assertion-nya diam-diam.
    expect(teks(html)).toContain(pesan);
  });

  it("membiarkan baris tutor dan baris penolakan tampil bersamaan", () => {
    // "Tutor tidak boleh dipakai" dan "penyelesaian ditolak server" bukan
    // keadaan yang saling meniadakan, jadi tidak ada presedensi buatan: yang
    // satu tidak boleh diam-diam menghapus yang lain.
    const html = render({ tipe: "ditolak", pesan: "Aturan course ini melarang bantuan AI." }, "Sesi terverifikasi belum ada.");
    // Keduanya diperiksa pada teks: alasan tutor juga hidup di `aria-label`
    // tombol, jadi kehadirannya di HTML tidak membuktikan baris kuningnya ada.
    const isiTeks = teks(html);
    expect(isiTeks).toContain("Aturan course ini melarang bantuan AI.");
    expect(isiTeks).toContain("Sesi terverifikasi belum ada.");
    const jumlahBaris = (html.match(/border-t border-amber-200 bg-amber-50/g) ?? []).length;
    expect(jumlahBaris).toBe(2);
  });
});

describe("MateriFocusBar — tidak jadi rumah permukaan sesi", () => {
  it("tidak merender indikator sesi maupun ajakan sesi", () => {
    /**
     * Reader hanya boleh punya **satu** permukaan yang menyatakan keadaan sesi.
     * Sebelumnya bar ini membawa `CourseSessionIndicator` ("Sesi terverifikasi
     * aktif") sementara `KejadianPanel` di bawahnya membawa panel catatan —
     * dua judul berbeda untuk satu keadaan, dalam satu layar, ditambah panel
     * ~390px yang tidak bisa ditutup.
     *
     *Ajakan memulai sesi (`CourseSessionPrompt`) dipindahkan ke kolom baca di
     * atas kartu materi. Alasannya bentuk, bukan isi: bar fokus `sticky`, jadi
     * kartu amber setinggi beberapa baris di sana menutupi judul modul selama
     * seluruh halaman digulir — persis saat peserta membacanya. Kedua
     * pemindahan itu dikunci di sini sekaligus, karena alasan yang sama akan
     * dipakai untuk memamerkannya lagi lewat perubahan berikutnya.
     *
     * Diperiksa dari sumber, bukan render: indikator hanya muncul saat
     * `status === "aktif"`, dan ajakan hanya saat kebijakan mewajibkan sesi —
     * memeriksa ketidakhadirannya lewat HTML hanya membuktikan keadaan satu
     * render. Yang dijaga adalah pengawatan impornya.
     */
    const sumber = tanpaKomentar(BERKAS_BAR);
    expect(sumber).not.toContain("CourseSessionIndicator");
    expect(sumber).not.toContain("CourseSessionPrompt");
    // Bar juga tidak boleh menarik `useCourseSession` cuma untuk hal yang sudah
    // pindah: tanpa konteks sesi, satu-satunya hook di bar ini hilang dan
    // import-nya menjadi sisa yang tidak dikunci di tempat lain.
    expect(sumber).not.toContain("useCourseSession");
  });
});

/**
 * Pemicu silabus di kiri bar.
 *
 * Yang diuji hanya properti yang memang dimiliki **bar**: nama aksesibel,
 * `aria-expanded` yang mengikuti status, rujukan panelnya, bit progres satu per
 * modul, dan penyaringan id basi. Perilaku panelnya sendiri (portal, jebakan
 * fokus, penutupan saat navigasi) hidup di shell dan diuji di
 * `materi-shell.test.ts` serta `reader-silabus.test.ts`.
 */
describe("MateriFocusBar — pemicu silabus", () => {
  it("memberi tombol itu nama aksesibel", () => {
    const html = render({ tipe: "bebas" });
    const tombolnya = tombol(html, "data-silabus-toggle");
    // Nama aksesibelnya wajib eksplisit: ikonnya `aria-hidden`, dan di bawah
    // 769px label kursusnya disembunyikan CSS — tanpa `aria-label` tombol itu
    // diumumkan tanpa nama, padahal ia satu-satunya jalan ke peta modul.
    expect(tombolnya).toContain('aria-label="Buka silabus kursus"');
    expect(tombolnya).toContain('aria-controls="reader-panel-silabus"');
  });

  it("menutup panel — `aria-expanded` false", () => {
    const html = render({ tipe: "bebas" }, null, { buka: false });
    const tombolnya = tombol(html, "data-silabus-toggle");
    expect(tombolnya).toContain('aria-expanded="false"');
  });

  it("membuka panel — `aria-expanded` true dan label menyebut tujuan", () => {
    const html = render({ tipe: "bebas" }, null, { buka: true });
    const tombolnya = tombol(html, "data-silabus-toggle");
    expect(tombolnya).toContain('aria-expanded="true"');
    expect(tombolnya).toContain('aria-label="Tutup silabus kursus"');
  });

  it("menyalakan satu bit per modul, dan menyaring id basi", () => {
    // `crs-1-m9` tidak ada di kurikulum saat ini. Kalau ia ikut dihitung, bar
    // mengklaim lebih banyak modul selesai daripada yang bisa dibuka peserta —
    // aturan yang sama dengan `irisModulSelesai` di `listProgresKursus()`.
    const html = render({ tipe: "bebas" }, null, { buka: false, selesai: ["crs-1-m1", "crs-1-m9"] });
    expect(html.match(/reader-silabus-bit/g) ?? []).toHaveLength(KURIKULUM.length);
    expect(html.match(/reader-silabus-bit is-terisi/g) ?? []).toHaveLength(1);
  });

  it("menyebut progresnya untuk pembaca layar, karena segmennya aria-hidden", () => {
    const html = render({ tipe: "bebas" }, null, { buka: false, selesai: ["crs-1-m1"] });
    expect(html).toContain("Progres kursus 1 dari 3 modul, 33 persen");
  });
});
