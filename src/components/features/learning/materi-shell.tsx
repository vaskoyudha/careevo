"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useCourseSession } from "./course-session";
import { MateriRail } from "./materi-rail";
import { MateriFocusBar } from "./materi-focus-bar";
import { TutorDrawer } from "./tutor-drawer";
import { KejadianPanel } from "./kejadian-panel";
import { useSelesaikanModul } from "./selesaikan-modul";
import type { ModulKursus } from "@/lib/courses/kurikulum";
import type { KebijakanCourse } from "@/types/course";

/**
 * Panel "Daftar modul" — pengganti rail di bawah `lg` (spec §3.1).
 *
 * Diekspor supaya bisa diuji **sendiri**: repo ini lingkungan `node` tanpa
 * jsdom, jadi `renderToStaticMarkup` tidak menjalankan efek maupun klik, dan
 * panel yang hanya muncul dari state `useState` di shell tidak pernah bisa
 * di-render oleh test. Memisahkannya membuat dua properti yang justru paling
 * mudah rusak bisa diperiksa dari HTML: penanda `id="panel-modul"` yang
 * dirujuk `aria-controls` tombol, dan kehadiran `lg:hidden` — yang menjaga
 * bahwa panel ini tidak pernah ikut tampil di `lg` ke atas, di samping rail
 * permanen (dua daftar modul sekaligus).
 *
 * Panjang tubuh panel dijaga `min-h-0 overflow-y-auto` supaya ia menggulir
 * sendiri dan tidak menggelembungkan baris flex yang membatasi tinggi shell.
 */
export function PanelModulMobile({
  slug,
  modul,
  modulAktif,
  selesai,
}: {
  slug: string;
  modul: ModulKursus[];
  modulAktif: string;
  selesai: string[];
}) {
  return (
    <div
      id="panel-modul"
      className="min-h-0 w-full shrink-0 overflow-y-auto border-r border-gray-200 bg-white p-3 lg:hidden"
    >
      <MateriRail slug={slug} modul={modul} modulAktif={modulAktif} selesai={selesai} />
    </div>
  );
}

/**
 * Shell reader — bar fokus + rail (panel "Daftar modul" di bawah `lg`) + drawer,
 * membungkus pane modul.
 *
 * Ini **komponen klien** karena satu alasan: ia harus tahu modul mana yang aktif,
 * dan layout yang merendernya tidak menerima `modulId` (`params` di
 * `materi/layout.tsx` hanya memuat `slug`; `[modulId]` adalah segmen anak).
 * Pathname dibaca dengan `usePathname()` — cara yang disarankan docs Next untuk
 * mendapat pathname dari Client Component, karena layout sendiri tidak
 * di-render ulang saat navigasi.
 *
 * Karena shell ini hidup di `layout.tsx`, ia **tidak** di-remount saat berpindah
 * modul: `TutorDrawer` dan `CourseSessionProvider` di atasnya bertahan, sehingga
 * percakapan tutor dan sesi terverifikasi tidak hilang.
 *
 * `KejadianPanel` dirender di sini — panel itu satu-satunya tempat peserta bisa
 * melihat apa yang sudah tercatat selama sesi (spec §2), dan ia menyembunyikan
 * dirinya sendiri saat tidak relevan (`kejadian-panel.tsx:76`).
 */
export function MateriShell({
  slug,
  kursusJudul,
  kursusId,
  kebijakan,
  modul,
  selesai,
  tutorSrc,
  children,
}: {
  slug: string;
  kursusJudul: string;
  kursusId: string;
  kebijakan: KebijakanCourse;
  modul: ModulKursus[];
  selesai: string[];
  /** URL rute embed tutor, sudah dihitung server. */
  tutorSrc: string;
  children: ReactNode;
}) {
  const { boleh } = useCourseSession();
  const [drawerBuka, setDrawerBuka] = useState(false);

  /**
   * Panel "Daftar modul" untuk layar sempit — tertutup secara default.
   *
   * Spec §3.1: "Di bawah `lg` rail runtuh menjadi panel 'Daftar modul' yang bisa
   * dibuka." Tanpa state ini tidak ada peta modul sama sekali di ponsel, dan
   * justru di sana peta itu paling dibutuhkan — melompat antar modul tanpa
   * kembali ke silabus.
   *
   * Statusnya hidup di shell (bukan di dalam bar) karena panelnya sendiri
   * dirender di sini, di kolom flex di bawah bar; bar hanya memegang tombolnya,
   * seperti ia memegang tombol drawer.
   */
  const [modulBuka, setModulBuka] = useState(false);
  const tombolModulRef = useRef<HTMLButtonElement>(null);
  const bukaSebelumnya = useRef(false);

  /**
   * Pathname dibaca lebih dulu, sebelum cabang "kurikulum kosong" di bawah:
   * `usePathname()` adalah hook, dan memanggilnya setelah `return` dini melanggar
   * aturan hook React — kegagalan yang sudah pernah ditulis alasannya di
   * `useSelesaikanModul` di bawah, dan berlaku sama untuk hook ini. Nilainya
   * dipakai untuk menutup panel saat pindah modul; tidak ada yang rusak saat
   * kurikulum kosong.
   */
  const pathname = usePathname();

  /**
   * Panel "Daftar modul" tertutup saat pindah modul.
   *
   * Alasan state ini tidak bisa dibiarkan: panel menggantikan rail di bawah `lg`
   * — ia muncul di kolom yang sama dengan daftar modul desktop. Kalau ia tetap
   * terbuka setelah tautan modul ditekan, peserta mendarat di modul baru dengan
   * panel yang masih menutupi pane-nya, dan di ponsel itu berarti modul yang
   * baru saja dipilih **tidak terlihat**. Shell hidup di `layout.tsx` dan
   * **tidak di-remount** saat berpindah modul (justru itu jaminan utamanya), jadi
   * state ini juga tidak di-reset sendiri.
   *
   * Reset-nya dilakukan **saat render**, bukan di dalam effect — pola "sesuaikan
   * state saat prop berubah" yang didokumentasikan React. Memanggil `setState`
   * sinkron di dalam effect memicu render berantai dan ditolak lint
   * (`react-hooks/set-state-in-effect`); di sini cukup bandingkan `pathname`
   * dengan nilai render sebelumnya, dan turunkan `modulBuka` ke `false` hanya
   * bila ia sedang terbuka. Navigasi lewat keyboard, `router.push`, atau tombol
   * kembali peramban sama-sama menutupnya, tanpa bergantung pada rail memberi
   * tahu shell.
   */
  const [pathnameSebelumnya, setPathnameSebelumnya] = useState(pathname);
  if (pathnameSebelumnya !== pathname) {
    setPathnameSebelumnya(pathname);
    if (modulBuka) setModulBuka(false);
  }

  /**
   * Fokus kembali ke tombol panel setelah panel tertutup.
   *
   * Hanya menutup panel belum cukup: saat panel dibongkar, fokus yang tadinya
   * ada di dalam panel jatuh ke `document.body`, dan pembaca layar kehilangan
   * tempatnya. Effect ini mendeteksi transisi terbuka → tertutup (bukan kondisi
   * `!modulBuka` semata, yang juga terjadi saat mount) lalu mengembalikan fokus
   * ke tombol yang membuka panel. Ia tidak memanggil `setState`, jadi tidak
   * menyalahi aturan lint di atas.
   */
  useEffect(() => {
    const baruTertutup = bukaSebelumnya.current && !modulBuka;
    bukaSebelumnya.current = modulBuka;
    if (baruTertutup) tombolModulRef.current?.focus();
  }, [modulBuka]);

  useEffect(() => {
    if (!modulBuka) return;
    const padaTombol = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setModulBuka(false);
        tombolModulRef.current?.focus();
      }
    };
    document.addEventListener("keydown", padaTombol);
    return () => document.removeEventListener("keydown", padaTombol);
  }, [modulBuka]);

  /**
   * Modul aktif, dari segmen terakhir pathname.
   *
   * `/belajar/<slug>/materi/<modulId>` → `<modulId>`. `decodeURIComponent` karena
   * id modul tersimpan boleh memuat karakter yang di-encode di URL.
   *
   * Decode-nya **dibungkus `try`**, bukan dipanggil langsung di render: segmen
   * yang rusak (`%`, `%zz`, potongan multi-byte) membuat `decodeURIComponent`
   * melempar `URIError`, dan galat saat render menggusur seluruh reader — bukan
   * hanya satu judul. Navigasi keras ke URL begitu memang sudah ditolak router
   * lebih dulu (400), jadi yang dijaga di sini adalah jalur yang tidak lewat
   * router: navigasi lunak (`router.push`) dan transisi di dalam iframe. Kalau
   * decode gagal, segmen dipakai **mentah** — tidak cocok dengan modul mana pun,
   * lalu jatuh ke `modul[0]` di bawah; perilaku "id basi" yang sudah ada, bukan
   * jalur gagal yang baru.
   *
   * Kalau segmennya tidak cocok dengan modul mana pun (id basi), shell jatuh ke
   * modul pertama hanya untuk membuat bar tetap punya judul; `page.tsx` yang
   * memutuskan `notFound()` untuk id yang benar-benar tidak ada.
   */
  const segmenTerakhir = pathname.split("/").filter(Boolean).at(-1) ?? "";
  let idSegmen = segmenTerakhir;
  try {
    idSegmen = decodeURIComponent(segmenTerakhir);
  } catch {
    // Segmen rusak: pakai mentah. Yang penting reader tetap render.
  }
  const modulAktif = modul.find((m) => m.id === idSegmen) ?? modul[0];

  /**
   * Keputusan akses dihitung **saat render**, bukan disimpan di state.
   *
   * Keputusannya bergantung pada bukti sesi yang bisa berubah kapan saja (sesi
   * dimulai/diakhiri). Menyalinnya ke state membuat gerbang bisa tertinggal
   * menutup lampiran yang sudah sah — alasan yang sama yang sudah ditulis di
   * `detail-kursus.tsx:231`.
   */
  const keputusanTutor = boleh("bantuan_akademik");

  /**
   * Hook penyelesaian dipanggil **tanpa syarat**, sebelum cabang "kurikulum
   * kosong" di bawah.
   *
   * Aturan hook React melarang pemanggilan setelah `return` dini: kalau ia
   * diletakkan setelah cabang itu, jumlah hook yang berjalan berubah antara
   * render dengan modul dan render tanpa modul, dan React melempar
   * "rendered fewer hooks than expected". Karena itu argumennya dibuat tahan
   * `undefined` (`modulAktif?.id ?? ""`); nilainya tidak pernah dipakai saat
   * tidak ada modul, sebab `jalankan` hanya terpanggil dari tombol bar yang
   * tidak dirender di cabang itu.
   */
  const { jalankan, pending, pesan } = useSelesaikanModul({
    courseId: kursusId,
    modulId: modulAktif?.id ?? "",
    kebijakan,
    checkpoint: modulAktif?.checkpoint,
  });

  // Kalau kurikulum kosong, tidak ada modul yang bisa ditampilkan. Ini bukan
  // keadaan yang seharusnya terjadi pada kursus yang bisa dibuka, tetapi
  // mengembalikan `null` lebih jujur daripada merender bar tanpa modul.
  if (!modulAktif) return <>{children}</>;

  const sudah = selesai.includes(modulAktif.id);

  return (
    /**
     * Shell **terbatas tinggi** (`h-dvh overflow-hidden`), bukan `min-h-dvh`.
     *
     * Dengan `min-h-dvh` tidak ada yang membatasi baris flex di bawah bar fokus:
     * saat modul lebih tinggi dari viewport, baris itu tumbuh setinggi isi, rail
     * dan `main` ikut setinggi modul, dan `overflow-y-auto` keduanya menjadi
     * hampa — yang menggulir justru dokumen. Akibatnya `TutorDrawer` yang
     * ter-dock di `xl` (saudara flex di baris yang sama) juga setinggi modul,
     * akar `h-dvh` aplikasi AI Mastery di dalam iframe menjadi setinggi itu, dan
     * daftar pesannya tidak pernah menggulir: composer tutor berakhir ribuan
     * piksel di bawah, tidak terjangkau selama membaca bagian atas modul.
     * Di bawah `xl` drawer adalah lembar `fixed`, jadi masalah ini khusus `xl`
     * ke atas.
     *
     * `h-dvh overflow-hidden` membuat **baris** yang memiliki gulirnya, bukan
     * dokumen — pola yang sudah dipakai reader ter-dock repo ini
     * (`book-reader.tsx:31`). Rantai `min-h-0` di bawah wajib utuh: tanpa itu
     * kolom-kolom flex menolak menyusut di bawah tinggi isinya.
     */
    <div className="flex h-dvh flex-col overflow-hidden bg-white">
      <MateriFocusBar
        slug={slug}
        kursusJudul={kursusJudul}
        modul={modulAktif}
        sudah={sudah}
        onTandai={() => jalankan(sudah)}
        pending={pending}
        drawerBuka={drawerBuka}
        onToggleDrawer={() => setDrawerBuka((v) => !v)}
        aksesTutor={keputusanTutor}
        pesan={pesan}
        modulBuka={modulBuka}
        onToggleModul={() => setModulBuka((v) => !v)}
        tombolModulRef={tombolModulRef}
      />

      {/* Panel kejadian: penjelasan + pelaporan selama sesi berjalan. Menyembunyikan
          dirinya sendiri saat status bukan `aktif` dan tanpa celah. */}
      <div className="px-3 pt-3 sm:px-5">
        <KejadianPanel />
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Rail tersembunyi di bawah `lg`: pada layar sempit ia akan memakan
            separuh lebar dan menyisakan kolom baca yang tidak terbaca. Yang
            menggantikannya di sana adalah panel "Daftar modul" di bawah, dengan
            `MateriRail` yang **sama** — bukan daftar kedua yang bisa menyimpang. */}
        <div className="hidden w-72 shrink-0 overflow-y-auto border-r border-gray-200 p-3 lg:block">
          <MateriRail slug={slug} modul={modul} modulAktif={modulAktif.id} selesai={selesai} />
        </div>

        {/**
         * Panel "Daftar modul" (spec §3.1) — pengganti rail di bawah `lg`.
         *
         * Murni `lg:hidden` + dirender hanya saat terbuka (`modulBuka && …`), jadi
         * di `lg` ke atas markup ini tidak ada sama sekali dan kolom desktop
         * tidak berubah satu byte pun. Karena itu ia **bukan** portal dan bukan
         * dialog bermodal: ia cuma disclosure yang mengalir bersama kolom rail
         * dan pane, sehingga tidak perlu memerangkap fokus, tidak perlu menutup
         * gulir dokumen, dan tidak menambah kode yang harus dijaga sinkron dengan
         * portal.
         *
         * Konsekuensi yang diterima: pane di bawahnya **tetap bisa disentuh**
         * saat panel terbuka. Itu disengaja — dan justru alasan `Escape` dan
         * penutupan saat navigasi ada. Sebuah overlay bermodal untuk daftar
         * navigasi juga akan menghalangi peserta melihat modul yang baru saja
         * dipilihnya sebelum panel ditutup.
         */}
        {modulBuka ? (
          <PanelModulMobile slug={slug} modul={modul} modulAktif={modulAktif.id} selesai={selesai} />
        ) : null}

        <main className="min-w-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-3xl">{children}</div>
        </main>

        <TutorDrawer
          src={tutorSrc}
          buka={drawerBuka}
          onTutup={() => setDrawerBuka(false)}
          boleh={keputusanTutor.tipe === "bebas"}
        />
      </div>
    </div>
  );
}
