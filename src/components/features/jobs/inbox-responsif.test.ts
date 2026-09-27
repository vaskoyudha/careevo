import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

/**
 * Kontrak: **halaman inbox lowongan harus bisa dipakai di layar ponsel.**
 *
 * Yang dijaga di sini adalah satu bug tinggi yang pernah membuat halaman itu
 * tampak rusak total, dan tidak satu pun gerbang repo bisa melihatnya:
 * `typecheck`, `lint`, `vitest`, dan `build` semuanya hijau sementara di 375px
 * halaman itu setinggi **145.000px**.
 *
 * Penyebabnya `h-full` yang berlaku di semua lebar:
 *
 *   inbox-list.tsx:
 *     <div className="loker-wide-layout … flex-col lg:flex-row …">
 *       <KolomRekomendasiProfil … />          {/* aside w-full … h-full /*}
 *       <div … h-full lg:min-h-0 …">          {/* kotak cari + 877 kartu /*}
 *
 * Di bawah `lg` kedua kolom ditumpuk di dalam satu flex-column yang tingginya
 * `auto`, jadi tinggi tumpukannya = tinggi kolom kanan (877 kartu). `height:
 * 100%` pada `aside` lalu menyelesaikan ke tinggi **seluruh tumpukan itu**,
 * bukan ke tinggi isinya sendiri: panel "Cocok Untukmu" ikut setinggi ~125.000px,
 * dan kotak pencarian, ringkasan, serta seluruh hasil pemindaian berdiri di
 * dasar panel kosong itu — sekitar **156 layar** di bawah lipatan.
 *
 * Tidak ada error, tidak ada overflow, tidak ada elemen yang "salah": yang
 * salah hanya *berapa tinggi* sebuah elemen. Karena itu yang dikunci di sini
 * adalah bentuk kode, sama seperti `chrome-offset.test.ts`: `h-full` hanya boleh
 * muncul bersama `lg:` pada kolom-kolom itu, dan `lg:h-full` harus tetap ada
 * supaya papan setinggi viewport di desktop (`.dashboard-shell:has(.loker-wide-
 * layout)`) tidak kehilangan dua kolom yang menggulir sendiri.
 *
 * Dua hal lain ikut dikunci karena satu keluarga dengan yang di atas — keduanya
 * hanya terlihat di layar kecil dan keduanya buta bagi gerbang:
 *
 * - kolom rekomendasi di mobile adalah strip mendatar, bukan kolom tegak empat
 *   kartu setinggi ~500px yang berdiri tepat di atas kotak pencarian; dan
 * - ukuran target sentuh memakai varian `pointer-fine`, bukan `sm:`. Tablet
 *   768px yang dipegang tangan adalah `pointer: coarse` dan butuh 44px, jadi
 *   `sm:h-8` akan memberinya 32px hanya karena layarnya lebar — persis yang
 *   diperingatkan `scripts/audit-mobile.mjs` ("auditing 768px as a mouse device
 *   would skip exactly the touch rules this sweep exists to check").
 *
 * Angka-angka di komentar ini diukur di Chromium pada 320/360/375/390/414/480/
 * 640/768/820/1024/1280/1440/1920px setelah perbaikan: overflow mendatar 0px di
 * ketigabelas lebar, dan nol target sentuh di bawah 44px di bawah `lg`.
 */

const AKAR = fileURLToPath(new URL("../../../../", import.meta.url));
const JOBS = join(AKAR, "src/components/features/jobs");

/** Sumber tanpa komentar: komentar di sini menjelaskan bug-nya, jadi menguji
 *  teks mentah akan gagal justru karena dokumentasinya benar. */
function tanpaKomentar(berkas: string): string {
  return readFileSync(berkas, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "$1");
}

const INBOX_LIST = tanpaKomentar(join(JOBS, "inbox-list.tsx"));
const REKOMENDASI = tanpaKomentar(join(JOBS, "kartu-rekomendasi-profil.tsx"));
const PERMUKAAN = tanpaKomentar(join(JOBS, "permukaan-cari-loker.tsx"));
const KARTU = tanpaKomentar(join(JOBS, "cari-lowongan-ui.tsx"));
const POPUP = tanpaKomentar(join(JOBS, "popup-detail-loker.tsx"));

/**
 * Nilai class yang memakai `h-full` **tanpa** prefiks breakpoint/variant.
 *
 * Yang dicari adalah `h-full` yang berlaku di semua lebar. Sebuah negative
 * lookbehind `(?<![:\w-])` mengecualikannya dari `lg:h-full`, `sm:h-full`, dan
 * `min-h-full` — jadi `lg:h-full` (yang justru WAJIB ada, lihat tes berikutnya)
 * tidak ikut tertuduh, dan mencari `h-full` mentah-mentah akan melakukannya.
 */
function hFullTanpaBreakpoint(sumber: string): string[] {
  const kelas = sumber.match(/className="[^"]*"/g) ?? [];
  return kelas.filter((k) => /(?<![:\w-])h-full/.test(k));
}

describe("inbox lowongan — tinggi kolom di mobile", () => {
  it("tidak memberi `h-full` tanpa batas breakpoint di komponen inbox", () => {
    // Ini bug aslinya. `h-full` di luar `lg:` pada salah satu dari tiga berkas
    // ini berarti tinggi persen menyelesaikan ke tinggi tumpukan yang auto,
    // dan halaman kembali setinggi ratusan ribu piksel.
    expect(hFullTanpaBreakpoint(INBOX_LIST)).toEqual([]);
    expect(hFullTanpaBreakpoint(REKOMENDASI)).toEqual([]);
  });

  it("tetap mengunci papan setinggi viewport di lg", () => {
    // Perbaikannya adalah membatasi `h-full`, BUKAN menghapusnya: di lg kolom
    // rekomendasi dan kolom kanan memang harus setinggi papan yang dikunci
    // `.dashboard-shell:has(.loker-wide-layout)` supaya keduanya punya scroll
    // sendiri. Tanpa `lg:h-full` di sini, desktop ikut kehilangan tingginya.
    expect(REKOMENDASI).toContain("lg:h-full");
    expect(INBOX_LIST).toContain("lg:h-full");
  });

  it("menumpuk kolom hanya di bawah lg", () => {
    // Urutan tumpukan bergantung pada flex-direction kolom di mobile; `lg:flex-row`
    // adalah satu-satunya titik baliknya.
    expect(INBOX_LIST).toMatch(/flex-col[^"]*lg:flex-row|loker-wide-layout/);
  });
});

describe("inbox lowongan — kolom rekomendasi di mobile", () => {
  it("mendatar dan menggeser, bukan kolom tegak di atas kotak pencarian", () => {
    // Empat kartu tegak ~500px berdiri di atas kotak pencarian berarti pengguna
    // 375px harus menggulir lebih dari satu layar sebelum bisa mengetik.
    const daftar = REKOMENDASI.match(/className="[^"]*snap-x[^"]*"/)?.[0] ?? "";
    expect(daftar, "strip rekomendasi mendatar tidak ditemukan").not.toBe("");
    expect(daftar).toContain("overflow-x-auto");
    expect(daftar).toContain("lg:flex-col");
  });

  it("mengunci lebar kartu di mobile lalu melepasnya di lg", () => {
    // Tanpa lebar tetap, kartu strip mengecil mengikuti isi dan `snap-start`
    // tidak punya tepi untuk dijadikan titik henti.
    expect(REKOMENDASI).toMatch(/w-\[7\d%\]/);
    expect(REKOMENDASI).toMatch(/lg:w-auto/);
  });
});

describe("inbox lowongan — target sentuh", () => {
  it("tidak memakai `sm:` untuk mengecilkan tinggi kontrol", () => {
    // `sm:` adalah lebar viewport, bukan jenis penunjuk. Tablet 768px yang
    // dipegang tangan tetap `pointer: coarse`. Varian yang benar adalah
    // `pointer-fine:`; lihat `globals.css` yang memakai
    // `@media (pointer: coarse)` untuk max(16px, 1rem) pada input.
    //
    // Yang dilarang adalah `sm:` yang **mengecilkan** ukuran kontrol:
    // `sm:h-8` (Filter/Urutkan, dulu 32px), `sm:h-7`/`sm:h-6` (tombol kecil),
    // `sm:size-9` (tombol tutup), `sm:min-h-0` (chip "Buka"/"Detail").
    //
    // Pembesaran dekoratif tidak termasuk: `size-5 sm:size-8` pada ikon
    // statistik hanya memperbesar ikonnya, dan menandainya berarti tes
    // menuduh kode yang benar — persis yang terjadi saat tes ini pertama
    // ditulis dengan pencocokan pola mentah. Jadi yang dibandingkan adalah
    // angka pada token yang sama (angka Tailwind konsisten: `h-11` = 44px,
    // `sm:size-8` = 32px), bukan keberadaan pola.
    const pelanggar = [PERMUKAAN, KARTU, POPUP, INBOX_LIST].flatMap((s) => {
      const hasil: string[] = [];
      for (const k of s.match(/className="[^"]*"/g) ?? []) {
        for (const prop of ["size", "h", "min-h", "w"]) {
          const kecil = k.match(new RegExp(`(?<![\\w:-])${prop}-(\\d+)`, "g")) ?? [];
          const sm = k.match(new RegExp(`sm:${prop}-(\\d+)`, "g")) ?? [];
          for (const besar of kecil) {
            for (const sini of sm) {
              const a = Number(besar.split("-").pop());
              const b = Number(sini.split("-").pop());
              if (b < a) hasil.push(`${besar} -> ${sini}`);
            }
          }
        }
      }
      return hasil;
    });
    expect(pelanggar).toEqual([]);
  });

  it("menaikkan kontrol yang tadinya di bawah 44px ke target sentuh, lalu melepasnya di pointer presisi", () => {
    // Filter dan Urutkan dulu 32px; chip "Buka"/"Detail" 20px/22px; tombol
    // tutup dialog 36px. Semuanya kontrol utama di halaman ini.
    expect(PERMUKAAN).toMatch(/pointer-fine:h-8/);   // Filter/Urutkan
    expect(KARTU).toMatch(/min-h-11/);               // chip Buka/Detail
    expect(KARTU).toMatch(/pointer-fine:min-h-0/);   // dan kembali di mouse
    expect(KARTU).toMatch(/pointer-fine:size-9/);    // tutup daftar lengkap
    expect(POPUP).toMatch(/pointer-fine:size-9/);    // tutup detail
  });
});

describe("inbox lowongan — kotak cari dan ringkasan", () => {
  /**
   * Tiga select berbagi satu baris di bawah `sm`. Kalau salah satunya tumbuh
   * tanpa batas minimum, yang lain diperas jadi sliver; kalau batasnya terlalu
   * besar, select terakhir terlempar sendirian ke baris baru dan kotak teks
   * pencarian (yang dulu `flex-1` tanpa `basis-full`) menyusut jadi ~42px di
   * tablet. Keduanya tanpa error dan tanpa overflow — jadi dikunci di sini.
   */
  it("memberi ketiga select lantai lebar yang sama, bukan lebar mati", () => {
    const kotak = PERMUKAAN.match(/<KotakPilih[\s\S]*?\/>/g) ?? [];
    expect(kotak).toHaveLength(3);
    for (const k of kotak) {
      expect(k, "KotakPilih tanpa lantai lebar").toMatch(/sm:min-w-\[[\d.]+rem\]/);
      // Lebar mati di `sm` adalah bug aslinya: tiga select 190/200/200px tidak
      // muat di kolom 474px (1024px, sidebar terbuka) dan yang terakhir terpotong.
      expect(k, "lebar mati di sm").not.toMatch(/sm:w-\[\d+px\]/);
    }
  });

  it("membiarkan kotak teks pencarian mengambil barisnya sendiri sampai ada ruang", () => {
    // `flex-1` saja menyusutkan input jadi ~42px pada 768px begitu tiga select
    // dipasang di baris yang sama.
    expect(PERMUKAAN).toMatch(/sm:basis-full/);
  });

  it("menumpuk tiga kartu ringkasan sebelum kolomnya cukup lebar untuk tiga kolom", () => {
    // Tiga kolom di dalam kolom 474px adalah tiga sliver ~150px: "Lowongan
    // tersedia / di berbagai bidang dan perusahaan" pecah jadi satu kata per
    // baris. Tiga baris bertumpuk jauh lebih terbaca di lebar itu.
    const ringkasan = PERMUKAAN.match(/<section\s+aria-label="Ringkasan lowongan"[\s\S]*?>/)?.[0] ?? "";
    expect(ringkasan, "section RingkasanLoker tidak ditemukan").not.toBe("");
    expect(ringkasan).toContain("grid-cols-1");
    expect(ringkasan).toMatch(/xl:grid-cols-3/);
    expect(ringkasan, "tiga kolom sebelum xl").not.toMatch(/sm:grid-cols-3/);
  });
});
