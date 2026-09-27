import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";

/**
 * Penjaga tata letak ruang kerja.
 *
 * Repo ini tidak punya jsdom (lihat catatan di `workspace-panel.test.ts`), jadi
 * komponen klien tidak bisa dirender di sini. Yang diuji adalah **sumbernya**:
 * tata letak ruang kerja punya beberapa keputusan yang bentuknya salah tetap
 * menghasilkan halaman yang berfungsi — grid satu kolom, panel IDE
 * setinggi `78vh` di dalam kolom yang sudah dibatasi, panel panduan yang
 * mengambil modulyang tidak punya halaman. Semua itu lolos `tsc` dan `lint`.
 *
 * Yang dikunci di sini:
 *
 * 1. **Rute tinggal di `(focus)`.** Reader dan ruang kerja berbagi bentuk
 *    fokus yang sama; kalau rute ini kembali ke `(app)`, navbar `.chrome`
 *    memakan 66px dari tinggi iframe yang sudah dibatasi viewport.
 * 2. **Kolom panduan memakai `HalamanView`**, renderer blok yang sama dengan
 *    jalur baca. Renderer kedua diam-diam tidak akan mencakup tipe blok baru.
 * 3. **Modul dibaca lewat `modulUntuk`**, resolver tunggal. Halaman yang
 *    memanggil `modulKursus()` langsung menggambar kurikulum yang berbeda dari
 *    reader saat course punya modul tersimpan.
 * 4. **Rantai tinggi `h-full`/`min-h-0` utuh** di shell, supaya `flex-1` di
 *    dalam grid berarti sesuatu dan dokumen yang menggulir adalah kolom
 *    panduan, bukan seluruh halaman.
 *
 * Sejak kerangkanya pindah ke `RuangKerjaChrome` (bar fokus + **sidebar
 * silabus** + bar kaki), sebagian penjaga berpindah bersamanya: `h-dvh` dan
 * `reader-shell` kini tinggal di chrome, sedangkan kolom dan gridnya tetap di
 * lab. Berkas ini membaca **kedua** sumber supaya invariannya tetap satu tempat.
 */

const labMentah = readFileSync(
  new URL("../../components/features/workspace/ruang-kerja-lab.tsx", import.meta.url),
  "utf8",
);

const chromeMentah = readFileSync(
  new URL("../../components/features/workspace/ruang-kerja-chrome.tsx", import.meta.url),
  "utf8",
);

const halamanMentah = readFileSync(
  new URL("../../app/(focus)/belajar/[slug]/ruang-kerja/page.tsx", import.meta.url),
  "utf8",
);

/**
 * Buang komentar sebelum assert.
 *
 * Repo ini menjelaskan *mengapa* di dalam sumber, dan salah satu alasannya
 * justru menyebut nama yang dilarang test ini (`"… bukan renderer kedua"` +
 * `BlokView`). Tanpa langkah ini, test gagal karena komentarnya benar —
 * dan yang lebih buruk, siapa pun yang "memperbaiki"-nya dengan menghapus
 * penjelasannya akan melihat test hijau.
 */
function tanpaKomentar(sumber: string): string {
  return sumber
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((baris) => baris.replace(/\/\/.*$/, ""))
    .join("\n");
}

const lab = tanpaKomentar(labMentah);
const chrome = tanpaKomentar(chromeMentah);
const halaman = tanpaKomentar(halamanMentah);

describe("rute ruang kerja", () => {
  it("tinggal di (focus), bukan (app)", () => {
    // Keberadaan berkas di `(focus)` sudah diuji lewat path di `readFileSync`
    // di atas — ia melempar kalau berkasnya tidak ada. Yang di sini adalah
    // penjaga bahwa **tidak ada lagi** kembarannya di `(app)`, karena dua
    // berkas untuk satu rute tidak akan gagal build: yang menang bergantung pada
    // urutan yang tidak dijamin, dan yang kalah hilang diam-diam.
    const lama = new URL("../../app/(app)/belajar/[slug]/ruang-kerja/page.tsx", import.meta.url);
    expect(existsSync(lama)).toBe(false);
  });

  it("menghapus navbar: tidak memakai LearnerShell", () => {
    // `LearnerShell` membawa `.chrome`, yang `position: sticky` dan memakan
    // tinggi nyata di dalam flow. Untuk halaman yang isinya satu iframe setinggi
    // viewport, 66px itu mahal: `h-dvh` + shell fokus dipakai sebagai gantinya.
    expect(halaman).not.toContain("LearnerShell");
    // Shell fokusnya kini di kerangka, bukan di halaman. Yang dijaga tetap sama:
    // permukaan fokusnya dipakai, bukan navbar mengambang.
    expect(halaman).toContain("RuangKerjaChrome");
    expect(chrome).toContain("reader-shell");
  });

  it("menyediakan sidebar silabus dan bar kaki", () => {
    // Permukaan fokus lain (reader) punya peta kursus dan navigasi modul di
    // baris bawah; ruang kerja harus punya keduanya supaya peserta tidak
    // tersesat di dalam IDE. Sidebar menautkan `?modul=&halaman=`, dan bar kaki
    // menawarkan tetangga modul aktif.
    expect(chrome).toContain("ruang-kerja-silabus");
    expect(chrome).toContain("reader-foot-bar");
    expect(chrome).toMatch(/hrefModul/);
    expect(chrome).toMatch(/hrefHalaman/);
  });
});

describe("kolom panduan ruang kerja", () => {
  it("memakai HalamanView, bukan renderer blok kedua", () => {
    // `BlokView` sudah jadi satu renderer di `halaman-view.tsx`. Menulis
    // renderer sendiri di panel kiri terlihat hemat, tapi ia membuat dua
    // definisi "seperti apa satu blok halaman", dan tipe blok baru akan
    // dirender `null` di satu sisi tanpa error apa pun.
    expect(lab).toContain("<HalamanView");
    // `BlokView` tidak diekspor; mengimpornya berarti ada definisi baru.
    expect(lab).not.toContain("BlokView");
  });

  it("menyembunyikan blok latihan dan pager di kolom kiri", () => {
    // Editor ada di kolom kanan (ruang kerja), jadi blok latihannya tidak boleh
    // muncul dua kali; dan perpindahan halaman di sini lewat URL, bukan lewat
    // tombol reader.
    expect(lab).toContain("sembunyikanKodeDijalankan");
    expect(lab).toContain("sembunyikanPager");
  });

  it("memakai resolver halaman tunggal", () => {
    // `halamanDipilih` memegang aturan "id basi → halaman pertama". Membaca
    // `?halaman=` mentah membuat judul satu halaman tampil bersama isi halaman
    // lain.
    expect(lab).toContain("halamanDipilih");
  });

  it("memakai resolver modul tunggal", () => {
    // Aturan "modul tanpa halaman tidak pernah dipilih diam-diam" hidup di
    // `modulDipilih`. Sidebar (`RuangKerjaChrome`) memakai resolver yang sama,
    // jadi keduanya tidak bisa menyorot/merender modul yang berbeda.
    expect(lab).toContain("modulDipilih");
    expect(chrome).toContain("modulDipilih");
  });

  it("baca pilihan halaman dari URL, bukan state", () => {
    // `?modul=&halaman=` adalah satu-satunya sumber, jadi ditandai halaman
    // aktif dan URL tidak bisa berbeda pendapat setelah `router.push`.
    expect(lab).toContain('searchParams.get("modul")');
    expect(lab).toContain('searchParams.get("halaman")');
  });
});

describe("grid dan tinggi", () => {
  it("memakai kelas lab yang sama dengan lab modul", () => {
    // `--lab-bagi`, `.lab-kolom-kiri`, `.lab-kolom-kanan`, dan `PembagiLab`
    // dibaca apa adanya supaya pembagian kolom yang bisa diseret peserta adalah
    // kode yang sama dengan lab modul — bukan salinan yang bisa melenceng.
    expect(lab).toContain("--lab-bagi");
    expect(lab).toContain("lab-kolom-kiri");
    expect(lab).toContain("lab-kolom-kanan");
    expect(lab).toContain("data-pembagi-lab");
    expect(lab).toContain("<PembagiLab");
  });

  it("membatasi tinggi shell dan kolomnya", () => {
    // `min-h-dvh` membuat `overflow-y-auto` hampa dan yang menggulir dokumen —
    // lalu iframe ikut terangkat. Rantai `min-h-0` wajib utuh di dalam grid.
    expect(chrome).toContain("h-dvh");
    expect(chrome).toContain("overflow-hidden");
    expect(lab).toContain("lg:h-full");
    expect(lab).toContain("lg:min-h-0");
    expect(lab).toContain("min-h-0");
  });

  it("menggulir kolom panduan, bukan seluruh halaman", () => {
    // IDE di kanan tidak boleh ikut terangkat ke atas saat peserta membaca
    // requirements yang panjang.
    expect(lab).toMatch(/lab-kolom-kiri[^\n]*\n?[^\n]*lg:overflow-y-auto/);
  });

  it("menghoum WorkspacePanel dengan mode isi", () => {
    // Tanpa `isi`, iframe memakai `h-[78vh]` yang menebak tinggi viewport —
    // di dalam kolom yang sudah dibatasi, tebakan itu melebar melewati dasar
    // kolom dan memaksa dokumen menggulir lagi.
    expect(lab).toContain("<WorkspacePanel");
    expect(lab).toMatch(/<WorkspacePanel[^>]*\bisi\b/);
  });
});

describe("data yang dirender", () => {
  it("kurikulum dibaca lewat resolver tunggal", () => {
    expect(halaman).toContain("modulUntuk");
    // Aturan repo: jangan pernah memanggil `modulKursus()` langsung dari
    // halaman atau aksi.
    expect(halaman).not.toContain("modulKursus(");
  });

  it("gerbangnya tetap kelayakanKursusSubmission", () => {
    // Tiga tempat memakai satu fungsi: panel Project di `/belajar/[slug]`,
    // `/api/workspace`, dan halaman ini. Menyalin aturannya membuat peserta
    // bisa menemukan jalan masuk lewat URL langsung.
    expect(halaman).toContain("kelayakanKursusSubmission");
    expect(halaman).not.toContain("verdictKelayakan");
  });

  it("tidak memanggil manajer untuk peserta yang tidak layak", () => {
    // Satu panggilan ke manajer yang dijamin tidak berguna, pada jalur yang
    // justru paling sering: peserta yang belum selesai course.
    expect(halaman).toMatch(/layak\s*\?\s*await prosesManajer\.status/);
  });

  it("menampilkan jumlah karya di kartu Project", () => {
    expect(halaman).toContain("listKaryaCourse");
    expect(lab).toContain("jumlahKarya");
    expect(chrome).toContain("jumlahKarya");
  });
});