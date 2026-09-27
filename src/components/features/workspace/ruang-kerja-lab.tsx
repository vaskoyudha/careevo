"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { HalamanView } from "@/components/features/learning/halaman-view";
import { PembagiLab, useBagiLab } from "@/components/features/learning/pembagi-lab";
import { halamanDipilih, modulDipilih } from "@/lib/courses/halaman";
import { WorkspacePanel, type SeedWorkspace } from "./workspace-panel";
import type { ModulKursus } from "@/lib/courses/kurikulum";
import type { Halaman } from "@/types/course";

/**
 * Ruang kerja — **dua kolom: panduan di kiri, IDE di kanan**.
 *
 * ## Bentuknya bukan karangan: ia mengikuti `KodeLab`
 *
 * Halaman ber-lab kode di dalam reader (`kode-lab.tsx`) sudah menyelesaikan
 * masalah yang sama — "baca bahannya di kiri, mengedit di kanan" — dan sudah
 * menyelesaikannya dengan tiga bagian: `HalamanView` di kiri, `KodeView` di
 * kanan, `PembagiLab` di antaranya. Komponen ini memakai kerangka yang sama dan
 * hanya mengganti **isi kolom kanan**: workbench code-server, bukan editor
 * latihan. Yang berubah bentuknya nol. `--lab-bagi`, `.lab-kolom-kiri`,
 * `.lab-kolom-kanan`, dan `PembagiLab` semuanya dibaca apa adanya, jadi
 * pembagian kolom yang bisa diseret peserta di sini adalah kode yang sama
 * dengan lab modul — bukan salinan yang bisa melenceng tanpa error.
 *
 * ## Kenapa kolom kiri memakai `HalamanView`, bukan renderer kedua
 *
 * Blok halaman sudah punya satu renderer (`BlokView` di `halaman-view.tsx`),
 * dan ia yang memutuskan bentuk heading, paragraf, daftar, kutipan, kode, dan
 * gambar. Menulis renderer singkat "untuk panel kiri" terlihat hemat karena
 * komponennya pendek, tetapi ia membuat dua definisi "seperti apa satu blok
 * halaman": begitu ada tipe blok baru, renderer kedua diam-diam merender
 * `null` sementara yang utama benar, dan tidak ada error yang menangkapnya.
 * Kolom kiri karena itu memanggil `HalamanView` — renderer yang sama dengan
 * jalur baca biasa — hanya dengan dua sakelar yang memang perlu: blok
 * latihannya disembunyikan (editor ada di kolom kanan; menampilkannya di sini
 * berarti dua editor untuk satu latihan) dan pager-nya dimatikan (pindah
 * halaman di panel ini lewat URL `?modul=&halaman=`, bukan lewat tombol
 * reader).
 *
 * ## Panduan dirender **dari data course**, bukan dari mockup
 *
 * Modul mana yang jadi panduan diambil dari kurikulum course ini lewat
 * `modulUntuk` di server, dan halaman aktif dari `?modul=&halaman=` — model
 * yang sama dengan reader (`MateriShell` memakai `?halaman=` dengan cara yang
 * sama). Tidak ada teks brief yang ditulis di komponen ini: kalau kursus tidak
 * punya materi, kolom kiri bilang "belum ada panduan", bukan memunculkan soal
 * contoh yang bukan milik course itu.
 */
export function RuangKerjaLab({
  courseId,
  judul,
  ringkasan,
  modul,
  seed,
  tautanKarya,
  jumlahKarya,
}: {
  courseId: string;
  judul: string;
  ringkasan: string;
  modul: ModulKursus[];
  seed: SeedWorkspace;
  /** Halaman Project course — tempat karya benar-benar dikumpulkan. */
  tautanKarya: string;
  /** Jumlah karya yang sudah ada; `0` membuat panel Project tampil "Belum ada karya". */
  jumlahKarya: number;
}) {
  /**
   * Modul + halaman aktif, dibaca dari URL.
   *
   * `useSearchParams()` dipanggil **tanpa syarat**, sebelum seluruh `return`
   * di bawah: aturan hook React melarang pemanggilan setelah `return` dini,
   * dan jumlah hook harus sama antara render dengan modul dan tanpa modul
   * (pola yang sama dengan `MateriShell`).
   */
  const searchParams = useSearchParams();
  const idModul = searchParams.get("modul") ?? undefined;
  const idHalaman = searchParams.get("halaman") ?? undefined;

  /**
   * Modul aktif, lewat resolver tunggal `modulDipilih()`.
   *
   * Dipakai, bukan `idModul` mentah: aturan "modul tanpa halaman tidak pernah
   * dipilih diam-diam" hidup di resolver itu, dan `RuangKerjaChrome` (sidebar
   * + bar kaki) memakai resolver yang sama. Dua pembaca aturan terpisah membuat
   * sidebar menyorot satu modul sambil kolom panduan merender modul lain.
   */
  const modulAktif = modulDipilih(modul, idModul);

  /**
   * Halaman aktif, lewat resolver tunggal `halamanDipilih()`.
   *
   * Dipakai, bukan `idHalaman` mentah: aturan "id basi → halaman pertama" ada
   * di dalam resolver itu, dan `HalamanView` juga memakainya untuk menentukan
   * halaman mana yang benar-benar dirender. Dua pembaca aturan terpisah
   * membuat `?halaman=` basi menampilkan judul satu halaman sambil merender
   * halaman lain.
   */
  const halamanAktif: Halaman | null = modulAktif
    ? halamanDipilih(modulAktif, idHalaman)
    : null;

  /**
   * Pembagian kolom disimpan per **course**, bukan per halaman.
   *
   * `useBagiLab` menyimpan fraksi di `localStorage` dengan kunci yang
   * diberikan. Kuncinya id course, bukan id halaman: peserta yang berpindah
   * halaman panduan tidak menemukan pembaginya melompat kembali setiap kali
   * halaman lain dipilih, dan ruang kerja satu course memang satu workspace
   * yang sama — bukan lima.
   */
  const { kunci: kunciBagi, bagi, setBagi } = useBagiLab(`ruang-kerja-${courseId}`);

  return (
    /**
     * `lab-lab` + `--lab-bagi`: grid yang `PembagiLab` baca untuk menulis
     * fraksi kolomnya. Nilainya ditulis inline karena ditentukan peserta saat
     * berjalan — sama seperti `KodeLab`, bukan angka yang ditulis di CSS.
     *
     * `h-full`/`min-h-0` di sepanjang rantai **wajib**: tanpa `min-h-0`, kolom
     * flex menolak menyusut di bawah tinggi isinya dan `flex-1` tidak berarti
     * apa-apa — persis kegagalan yang dicatat di `materi-shell.tsx` untuk
     * reader.
     */
    <div
      data-pembagi-lab
      style={{ ["--lab-bagi" as string]: `${bagi}fr 6px ${1 - bagi}fr` }}
      className="lab-lab grid min-h-0 flex-1 grid-cols-1 items-stretch gap-y-5 lg:h-full"
    >
      {/* Kolom panduan. `lg:h-full lg:overflow-y-auto` supaya ia menggulir di
          dalam kolomnya sendiri: IDE di kanan tidak boleh ikut terangkat ke
          atas saat peserta membaca requirements yang panjang.

          Seluruh isinya hidup di **satu container** — satu kartu putih yang
          membentang sampai dasar kolom — bukan beberapa kartu terpisah di atas
          kanvas. Sebelumnya kepala (judul + ringkasan), daftar panduan, isi
          halaman, dan kartu Project masing-masing punya permukaannya sendiri,
          sehingga kolomnya terbaca sebagai tumpukan kotak, bukan sebagai satu
          panel. Sekarang satu tepi membungkus semuanya, dan bagian-bagiannya
          dipisahkan garis tipis — bahasa visual yang sama dengan sidebar. */}
      <div className="lab-kolom-kiri min-w-0 lg:h-full lg:overflow-y-auto lg:pr-1">
        <div className="flex min-h-full flex-col rounded-2xl border border-gray-200 bg-white">
          <header className="border-b border-gray-100 px-5 py-5">
            <h2 className="text-lg font-bold tracking-tight text-gray-900">{judul}</h2>
            {ringkasan ? (
              <p className="mt-2 text-sm leading-relaxed text-gray-600">{ringkasan}</p>
            ) : null}
          </header>

          {/* `flex-1` supaya kartunya mengisi sisa tinggi kolom; `article` di
              dalamnya sudah punya padding dari `.lab-kolom-kiri article`. */}
          {modulAktif && halamanAktif ? (
            <article className="flex-1">
              <HalamanView
                modul={modulAktif}
                halaman={halamanAktif}
                sembunyikanKodeDijalankan
                sembunyikanPager
              />
            </article>
          ) : (
            <p className="flex-1 px-5 py-6 text-sm leading-relaxed text-gray-600">
              Kursus ini belum punya materi panduan. Silakan tulis kodemu dan kirim lewat
              Project.
            </p>
          )}

          {/* Kartu Project jadi kaki container, bukan kartu lepas: yang dibaca
              peserta di sini adalah "ke mana setelah ini", dan itu bagian dari
              panel yang sama, bukan ajakan yang mengambang di bawahnya. */}
          <Link
            href={tautanKarya}
            className="flex items-center justify-between gap-3 border-t border-gray-100 px-5 py-4 transition-colors hover:bg-[#0056D2]/[0.03]"
          >
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-gray-900">Project course</span>
              <span className="block text-[13px] text-gray-600">
                {jumlahKarya > 0
                  ? `${jumlahKarya} karya terkumpul — buka untuk melihat atau menambah.`
                  : "Kumpulkan karyamu di sini setelah selesai menulis kode."}
              </span>
            </span>
            <span aria-hidden="true" className="shrink-0 text-gray-400">
              →
            </span>
          </Link>
        </div>
      </div>

      <PembagiLab kunci={kunciBagi} bagi={bagi} onBagi={setBagi} />

      {/* Kolom IDE. Bedanya dari lab modul: **tidak** `lg:sticky`. Yang menempel
          di sini adalah workbench setinggi viewport, dan itu justru menggeser
          bar fokus saat panduan digulir — di lab modul yang menempel adalah
          editor kecil yang tidak setinggi layar. Tinggi kolom diambil dari
          rantai `h-full`/`min-h-0`, bukan dari rumus `100dvh`. */}
      <div className="lab-kolom-kanan flex min-w-0 flex-col lg:h-full lg:min-h-0">
        <WorkspacePanel courseId={courseId} seed={seed} isi />
      </div>
    </div>
  );
}
