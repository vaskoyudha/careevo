import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CourseSessionProvider } from "./course-session";
import { MateriFocusBar } from "./materi-focus-bar";
import { kebijakanDefault, PESAN_POLICY } from "@/lib/courses/kebijakan";
import type { ModulKursus } from "@/lib/courses/kurikulum";

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
 * 3. Tombol "Daftar modul" (`lg:hidden`) ada dengan nama aksesibel dan
 *    `aria-expanded` yang sejalan dengan panelnya (spec §3.1). Tombol itu
 *    satu-satunya jalan ke peta modul di ponsel; tanpa nama aksesibel ia
 *    diumumkan sebagai tombol tak bernama, dan tanpa `aria-expanded` yang
 *    pernah berubah panelnya ada tapi statusnya tidak bisa dipercaya.
 */

const MODUL: ModulKursus = {
  id: "crs-1-m2",
  judul: "Mendalami React",
  ringkasan: "r",
  durasi_min: 10,
  url: "https://contoh.test",
  checkpoint: { batas_waktu_menit: 30, mode: "kuis" },
};

function render(
  aksesTutor: Parameters<typeof MateriFocusBar>[0]["aksesTutor"],
  pesan?: string | null,
  modul?: { buka: boolean },
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
      modul: MODUL,
      sudah: false,
      onTandai: () => {},
      pending: false,
      drawerBuka: false,
      onToggleDrawer: () => {},
      aksesTutor,
      pesan,
      // Panel modul: statusnya milik shell, tapi **tombolnya** milik bar — dan
      // `aria-expanded` yang tidak pernah berubah adalah bug yang tepat di sini.
      modulBuka: modul?.buka ?? false,
      onToggleModul: () => {},
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

  it("memberi tautan silabus nama aksesibel yang tidak bergantung breakpoint", () => {
    // Label visualnya (`<span className="hidden sm:inline">`) hilang di bawah
    // `sm` dan ikonnya `aria-hidden`, jadi tanpa `aria-label` tautan ini —
    // satu-satunya jalan keluar dari reader — diumumkan tanpa nama di ponsel.
    // Dikunci dari atribut hasil render, satu-satunya yang bisa dilihat tanpa
    // jsdom (repo tidak punya lingkungan peramban).
    //
    // Tag-nya diambil utuh lalu diperiksa, bukan dicocokkan dengan satu regex
    // berurutan: urutan atribut hasil render bukan kontrak, dan pola
    // `href=… lalu aria-label=…` gagal pada HTML yang benar begitu React
    // menaruh `aria-label` lebih dulu.
    const html = render({ tipe: "bebas" });
    const tautan = html.match(/<a [^>]*href="\/belajar\/kursus-uji"[^>]*>/)?.[0];
    expect(tautan).toBeDefined();
    expect(tautan).toContain('aria-label="Silabus"');
    // Label visualnya tetap ada, tidak digantikan oleh `aria-label`.
    expect(html).toContain('<span class="hidden sm:inline">Silabus</span>');
  });

  it("tombol tutor aktif saat kebijakan mengizinkan", () => {
    const html = render({ tipe: "bebas" });
    // Di-scope ke tombol tutor: sejak tombol "Daftar modul" ada, `aria-expanded`
    // tidak lagi unik di dokumen, dan assertion seluruh-dokumen akan hijau
    // seolah-olah tombol tutor dievaluasi padahal yang cocok tombol modul.
    const tutor = tombol(html, 'aria-controls="drawer-tutor"');
    expect(tutor).toContain('aria-expanded="false"');
    // Dihitung dari **atribut** `disabled=""`, bukan substring "disabled":
    // kelas Tailwind `disabled:opacity-60` pada tombol "Tandai selesai" juga
    // memuat kata itu, sehingga `not.toContain("disabled")` gagal pada kode
    // yang benar dan `toContain("disabled")` lulus tanpa membuktikan apa pun.
    expect(html.match(/disabled=""/g) ?? []).toHaveLength(0);
  });

  it("tombol tutor nonaktif saat `tanpa_ai`, tapi tetap dirender dengan alasannya", () => {
    const html = render({ tipe: "ditolak", pesan: "Aturan course ini melarang bantuan AI." });
    // Diperiksa pada **teks**, bukan seluruh HTML: alasan yang sama juga dipasang
    // ke `aria-label`/`title` tombol tutor, jadi `toContain` atas HTML tetap
    // hijau walau baris kuningnya dihapus — dan baris itulah yang diklaim tes ini.
    expect(html).toContain('aria-label="Aturan course ini melarang bantuan AI."');
    expect(teks(html)).toContain("Aturan course ini melarang bantuan AI.");
    // Tepat satu tombol nonaktif — tombol tutor. "Tandai selesai" tidak
    // (`pending` false), jadi jumlahnya membedakan keduanya.
    expect(html.match(/disabled=""/g) ?? []).toHaveLength(1);
  });

  it("menampilkan tombol tandai selesai saat modul belum selesai", () => {
    expect(render({ tipe: "bebas" })).toContain("Tandai selesai");
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

/**
 * Tombol "Daftar modul" — spec §3.1.
 *
 * Di bawah `lg` rail `w-72` disembunyikan, jadi tombol ini satu-satunya jalan
 * peserta ponsel membuka peta modul. Yang diuji sengaja hanya properti yang
 * memang dimiliki **bar**: nama aksesibel, `aria-expanded` yang mengikuti
 * status, rujukan panelnya, dan `lg:hidden` yang menjaga tombolnya tidak ikut
 * tampil di layar yang sudah punya rail permanen. Penutupan saat navigasi dan
 * `Escape` hidup di shell dan diuji di `materi-shell.test.ts`.
 */
describe("MateriFocusBar — tombol daftar modul", () => {
  it("memberi tombol itu nama aksesibel meski tidak ada teks label", () => {
    const html = render({ tipe: "bebas" });
    const tombolnya = tombol(html, 'class="[^"]*lg:hidden');
    // Nama aksesibelnya wajib eksplisit: ikonnya `aria-hidden` dan tidak ada
    // teks di sebelahnya, jadi tanpa `aria-label` tombol itu diumumkan tanpa
    // nama — satu-satunya jalan ke peta modul di ponsel, tanpa nama.
    expect(tombolnya).toContain('aria-label="Daftar modul"');
    // Hanya muncul di bawah `lg`; di layar lebar ia akan menjadi tombol kedua
    // untuk sesuatu yang sudah terlihat.
    expect(tombolnya).toContain("lg:hidden");
  });

  it("menutup panel — `aria-expanded` false, `aria-controls` tidak menunjuk apa pun", () => {
    // `aria-controls` yang menunjuk id tidak ada melanggar ARIA, dan itulah
    // keadaan default: panelnya sengaja tidak dirender saat tertutup. Karena
    // itu atributnya hanya dipasang saat terbuka.
    const html = render({ tipe: "bebas" }, null, { buka: false });
    const tombolnya = tombol(html, 'class="[^"]*lg:hidden');
    expect(tombolnya).toContain('aria-expanded="false"');
    expect(tombolnya).not.toContain("aria-controls");
  });

  it("membuka panel — `aria-expanded` true dan `aria-controls` menunjuk `panel-modul`", () => {
    // Rujukan ini yang mengikat tombol ke panelnya; id panel itu sendiri
    // dikunci di `materi-shell.test.ts`, tempat `PanelModulMobile` dirender.
    const html = render({ tipe: "bebas" }, null, { buka: true });
    const tombolnya = tombol(html, 'class="[^"]*lg:hidden');
    expect(tombolnya).toContain('aria-expanded="true"');
    expect(tombolnya).toContain('aria-controls="panel-modul"');
  });
});
