import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TombolPindai } from "@/components/features/jobs/permukaan-cari-loker";

/**
 * Kontrak: **pemicu scan harus selalu bisa dijangkau, dan harus punya nama.**
 *
 * `jalankanScanAction` (`src/actions/inbox.ts`) punya tepat satu pemanggil di
 * seluruh aplikasi — tombol di `inbox-list.tsx`. Tidak ada cron, tidak ada
 * penjadwal, dan tidak ada scan saat halaman dimuat: kalau tombolnya tidak
 * terender, tidak ada satu pun cara memasukkan lowongan baru, dan inbox berhenti
 * bertambah selamanya.
 *
 * Itu bukan hipotesis. Tombolnya pernah diletakkan **di dalam** cabang
 * empty-state:
 *
 *     {kosong ? (!adaRiwayat && antrean.length === 0 ? <tombol/> : ...) : ...}
 *
 * sehingga ia hanya muncul saat inbox kosong **dan** belum pernah ada riwayat
 * scan. Begitu satu scan berhasil (18 baris di `scan-runs.tsv`, 877 baris di
 * `pipeline.md` di data root dev), `adaRiwayat` menjadi `true`, tombolnya hilang,
 * dan fitur itu mati tanpa satu pun error — `typecheck`, `lint`, `vitest`, dan
 * `build` semuanya hijau, karena yang salah adalah *kapan* sebuah elemen
 * dirender, bukan apakah ia ada.
 *
 * Pemicunya lalu pindah dari header halaman ke dalam kotak pencarian dan
 * menjadi **ikon saja** (`TombolPindai`). Bentuk itu mengubah syaratnya, bukan
 * menghapusnya: satu properti `aksi` yang lupa diisi pada pemanggilan
 * `PanelCariLoker` akan menghilangkan tombolnya lagi, persis seperti bug aslinya
 * — dan kali ini tanpa satu karakter pun teks "Pindai lowongan baru" di layar
 * untuk menandainya. Dua hal yang dikunci:
 *
 * 1. **struktur** — `inbox-list.tsx` menyerahkan `pindai` ke `PanelCariLoker`,
 *    dan pemanggilan itu berada di luar cabang hasil; dan
 * 2. **hasil render** — `TombolPindai` yang benar-benar dirender masih membawa
 *    `aria-label`/`title` yang menyebut aksinya, dan ikonnya berganti saat
 *    berjalan.
 *
 * Nomor 2 diuji dengan `renderToStaticMarkup`, bukan dengan membaca sumbernya:
 * sebuah tombol ikon tanpa nama aksesibel tetap menghasilkan JSX yang benar,
 * dan typecheck/lint tidak melihat `aria-label` yang hilang.
 *
 * Tidak ada jsdom di repo ini (lingkungan test `node`, lihat AGENTS.md), jadi
 * bagian struktur memakai pola `src/app/chrome-offset.test.ts`: baca sumbernya
 * dan kunci bentuknya. Yang diperiksa adalah bentuk kode, bukan data yang
 * kebetulan sedang ada di disk.
 */

const AKAR = fileURLToPath(new URL("../../../../", import.meta.url));
const BERKAS = join(AKAR, "src/components/features/jobs/inbox-list.tsx");

/** Sumber tanpa komentar: komentar di berkas ini menjelaskan bug-nya, jadi
 *  menguji teks mentah akan gagal justru karena dokumentasinya benar. */
function tanpaKomentar(berkas: string): string {
  return readFileSync(berkas, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "$1");
}

const SUMBER = tanpaKomentar(BERKAS);

/**
 * Isi elemen `<PanelCariLoker … />` — dari tag pembukanya sampai `/>` penutup.
 *
 * Yang diuji bukan "apakah komponennya dipanggil" (itu tetap benar kalau
 * `pindai` tidak diteruskan), melainkan **apakah `onPindai` ada di dalamnya** —
 * sebab hanya properti itu yang membuat tombolnya terender. Properti itu juga
 * wajib, jadi `tsc` menangkapnya; yang tidak ditangkap `tsc` adalah pemanggilan
 * yang memasangnya di dalam cabang bersyarat.
 *
 * Penutupnya dicari sebagai baris `/>` yang berdiri sendiri, bukan `/>` pertama:
 * elemen ini penuh anak self-closing (`<KotakPilih … />`), jadi `indexOf("/>")`
 * berhenti terlalu awal dan memotong propertinya dari irisan.
 */
function isiKartuCari(sumber: string): string {
  const mulai = sumber.indexOf("<PanelCariLoker");
  if (mulai === -1) return "";
  const sisa = sumber.slice(mulai);
  const akhir = sisa.search(/\n\s*\/>/);
  return akhir === -1 ? sisa : sisa.slice(0, akhir);
}

/** Sumber tanpa komentar dari komponen tombolnya sendiri. */
const PERMUKAAN = tanpaKomentar(
  join(AKAR, "src/components/features/jobs/permukaan-cari-loker.tsx"),
);

describe("pemicu scan di inbox loker", () => {
  it("meneruskan `pindai` ke kartu pencarian, bukan ke cabang hasil", () => {
    const kartu = isiKartuCari(SUMBER);
    expect(kartu, "PanelCariLoker tidak ditemukan").not.toBe("");
    expect(kartu).toContain("onPindai={pindai}");
    expect(kartu).toContain("pending={pending}");

    // Kartu cari harus berada SEBELUM cabang hasil: kalau ia dipindah ke dalam
    // cabang mana pun, tombolnya kembali bersyarat.
    const kartuCari = SUMBER.indexOf("<PanelCariLoker");
    const cabangKosong = SUMBER.indexOf("{kosong ?");
    expect(kartuCari).toBeGreaterThan(-1);
    expect(cabangKosong).toBeGreaterThan(-1);
    expect(kartuCari).toBeLessThan(cabangKosong);
  });

  it("mengikat satu aksi scan ke `jalankanScanAction`, dan hanya lewat satu jalur render", () => {
    // Satu aksi, satu jalur. Kalau ada lebih dari satu pemanggilan `pindai` di
    // luar kartu pencarian, pemicunya berlipat — dua tombol untuk satu aksi
    // adalah tombol yang cepat atau lambat berbeda perilaku.
    const pemakaian = SUMBER.match(/onPindai=\{pindai\}/g) ?? [];
    expect(pemakaian).toHaveLength(1);
    expect(isiKartuCari(SUMBER)).toContain("onPindai={pindai}");
  });

  it("tidak menyembunyikan pemicu scan di dalam cabang empty-state", () => {
    // Cabang empty-state tidak boleh lagi memuat aksi pindai; kalau ia kembali
    // ke sana, tombolnya bersyarat lagi dan bug aslinya kembali.
    const cabangKosong = SUMBER.indexOf("{kosong ?");
    const sesudah = SUMBER.slice(cabangKosong);
    expect(sesudah).not.toContain("onPindai={pindai}");
    expect(sesudah).not.toContain("Pindai lowongan baru");
  });

  it("merender tombol ikon yang punya nama aksesibel dan berubah saat berjalan", () => {
    const diam = renderToStaticMarkup(
      createElement(TombolPindai, { pending: false, onPindai: () => {} }),
    );
    // Ikon saja: labelnya hanya hidup di sini. Tanpa salah satunya, tombolnya
    // tidak bisa dijelaskan sama sekali — dan tidak ada teks di layar yang
    // menandainya.
    expect(diam).toContain('aria-label="Pindai lowongan baru"');
    expect(diam).toContain('title="Pindai lowongan baru"');
    expect(diam).toContain('aria-busy="false"');
    expect(diam).toContain("scan-search");
    // Tanpa teks yang terlihat, "ikon saja" tetap ikon saja.
    expect(diam).not.toContain("Pindai lowongan baru</button>");

    const berjalan = renderToStaticMarkup(
      createElement(TombolPindai, { pending: true, onPindai: () => {} }),
    );
    expect(berjalan).toContain('aria-label="Memindai…"');
    expect(berjalan).toContain('title="Memindai…"');
    expect(berjalan).toContain('aria-busy="true"');
    expect(berjalan).toContain("animate-spin");
    expect(berjalan).toContain("disabled");
    expect(berjalan).not.toContain("scan-search");
  });

  it("menaruh tombolnya di dalam baris kotak teks, bukan baris filternya", () => {
    // Letaknya adalah bagian dari permintaannya: pemicu scan duduk tepat di
    // samping kotak pencarian. Diuji lewat bentuk kode karena markup-nya
    // dirakit di dua komponen berbeda (kotak teks + tombol dalam satu `div`).
    const baris = PERMUKAAN.match(/<div className="flex min-w-0 flex-1 gap-2[^"]*">[\s\S]*?<TombolPindai/)?.[0];
    expect(baris, "TombolPindai tidak berada di baris kotak cari").toBeTruthy();
    // dan kotak teksnya benar-benar di baris yang sama.
    expect(baris).toContain('id="cari-lowongan-teks"');
  });

  it("memakai hari lokal untuk label 'baru hari ini', bukan potongan UTC", () => {
    // Kelas bug kedua di halaman yang sama: `toISOString().slice(0, 10)` adalah
    // hari UTC, sedangkan mesin menstempel `first_seen` dengan hari lokal.
    const halaman = tanpaKomentar(
      join(AKAR, "src/app/(app)/loker/inbox/page.tsx"),
    );
    expect(halaman).not.toMatch(/toISOString\(\)\.slice\(0,\s*10\)/);
    expect(halaman).toContain("kunciHariIni");
  });
});

describe("header halaman yang dilepas", () => {
  it("tidak lagi merender eyebrow, H1, subjudul, atau catatan tangan", () => {
    // Yang diminta: konten halaman dibuang, kartu pencarian naik ke atas.
    // Kalau salah satunya kembali, ia kembali juga sebagai ruang yang dipakai
    // sebelum daftar lowongan — tepat yang dihilangkan.
    expect(SUMBER).not.toContain("JOB SEEKER");
    expect(SUMBER).not.toContain("Temukan pekerjaan impianmu");
    expect(SUMBER).not.toContain("Karier yang lebih baik");
    expect(SUMBER).not.toContain("KepalaCariLoker");
  });

  it("tetap menyimpan h1 tak terlihat supaya halaman punya nama", () => {
    // Judulnya dilepas secara visual, bukan dari struktur: tanpa `<h1>`,
    // pembaca layar kehilangan nama halaman — dan chip navbar bukan bagian
    // dari konten.
    expect(SUMBER).toMatch(/<h1 className="sr-only">\s*Lowongan ditemukan\s*<\/h1>/);
  });
});
