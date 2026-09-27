"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useCourseSession, CourseSessionPrompt } from "./course-session";
import { MateriFocusBar } from "./materi-focus-bar";
import { ReaderPanelSilabus } from "./reader-silabus";
import { MateriFootBar } from "./materi-foot-bar";
import { TutorDrawer } from "./tutor-drawer";
import { KejadianPanel } from "./kejadian-panel";
import { useSelesaikanModul, modulSelesaiMembaca } from "./selesaikan-modul";
import type { ModulKursus } from "@/lib/courses/kurikulum";
import type { KebijakanCourse } from "@/types/course";

/**
 * Shell reader — bar fokus (dengan pemicu silabus + progres) + pane + drawer,
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
 * ## Silabus: satu panel, bukan rail + panel
 *
 * Daftar modul reader sekarang hidup **hanya** di panel silabus setinggi layar
 * (`ReaderPanelSilabus`), dibuka dari tombol paling kiri bar. Dulu ada kolom rail
 * `lg` **dan** panel bawah `lg`; keduanya digantikan satu panel karena dua daftar
 * modul di satu layar adalah penyimpangan yang harus dijaga sinkron tanpa alasan.
 * Panelnya `portal` ke `<body>`, jadi status buka/tutupnya hidup di sini — portal
 * tidak bisa menyimpan state-nya sendiri di dalam bar.
 *
 * `KejadianPanel` dirender di sini — panel itu satu-satunya tempat peserta bisa
 * melihat apa yang sudah tercatat selama sesi (spec §2), dan ia menyembunyikan
 * dirinya sendiri saat tidak relevan (`kejadian-panel.tsx:76`).
 */
export function MateriShell({
  slug,
  kursusJudul,
  kursusPenyedia,
  kursusId,
  kebijakan,
  modul,
  selesai,
  tutorSrc,
  children,
}: {
  slug: string;
  kursusJudul: string;
  /** Penyedia kursus — diulang di kepala panel silabus. */
  kursusPenyedia: string;
  kursusId: string;
  kebijakan: KebijakanCourse;
  modul: ModulKursus[];
  selesai: string[];
  /** URL rute embed tutor, sudah dihitung server. */
  tutorSrc: string;
  children: ReactNode;
}) {
  const { boleh, bukti } = useCourseSession();
  const [drawerBuka, setDrawerBuka] = useState(false);

  /**
   * Panel silabus setinggi layar sedang terbuka.
   *
   * Statusnya hidup di shell (bukan di dalam bar) karena panelnya `portal` ke
   * `<body>` dan dirender di sini, di luar bar; bar hanya memegang tombolnya dan
   * melaporkan keadaan itu lewat `aria-expanded`.
   */
  const [silabusBuka, setSilabusBuka] = useState(false);
  const tombolSilabusRef = useRef<HTMLButtonElement>(null);
  const silabusSebelumnya = useRef(false);

  /**
   * Pathname dibaca lebih dulu, sebelum cabang "kurikulum kosong" di bawah:
   * `usePathname()` adalah hook, dan memanggilnya setelah `return` dini melanggar
   * aturan hook React — kegagalan yang sudah pernah ditulis alasannya di
   * `useSelesaikanModul` di bawah, dan berlaku sama untuk hook ini. Nilainya
   * dipakai untuk menutup panel saat pindah modul; tidak ada yang rusak saat
   * kurikulum kosong.
   */
  const pathname = usePathname();
  const searchParams = useSearchParams();

  /**
   * Halaman yang sedang dibaca, dibaca dari URL — bukan dari state.
   *
   * Halaman adalah bagian dari alamat (`?halaman=<id>`, bentuk yang sama dengan
   * yang ditulis pager di `halaman-view.tsx`), jadi tidak ada salinan state di
   * klien yang bisa menyimpang dari URL. Yang penting: panel silabus memakai id
   * yang sama untuk menyorot baris sub-item, sehingga penanda "kamu di sini"
   * tidak bisa menunjuk halaman lain daripada yang dirender pane.
   *
   * `null` berarti "tidak ada parameter". Panel yang menerjemahkannya menjadi
   * halaman pertama — ia yang tahu modul mana yang aktif, jadi ia yang punya
   * modul untuk bertanya; shell tidak.
   */
  const halamanAktif = searchParams.get("halaman");

  /**
   * Panel silabus tertutup saat berpindah **halaman**, bukan saat berpindah modul.
   *
   * Berpindah halaman berarti "saya mau membaca yang ini": panelnya menutupi
   * seluruh layar, jadi ia harus menyingkir atau halaman yang baru dipilih tidak
   * terlihat. Itu juga alasan panelnya tidak boleh dibiarkan terbuka setelah
   * tautan halaman ditekan.
   *
   * Berpindah **modul** justru sebaliknya sejak panel punya tampilan per-modul:
   * memilih modul dari daftar "Semua modul" adalah langkah menelusuri, dan panel
   * yang menutup di situ melewati langkah yang paling berguna — memperlihatkan
   * bab modul yang baru dipilih. Jadi penutupan atas perpindahan modul **dihapus**
   * di sini, dan `materi-rail.tsx` yang memutuskan kapan peserta benar-benar
   * minta keluar (tautan halaman, "Buka materi", CTA kaki panel — semuanya
   * memanggil `onNavigasi`/`onTutup` sendiri).
   *
   * Karena itu pemicunya bukan `tujuan` saja: yang ditutup adalah perpindahan
   * yang **pathname-nya sama** tetapi `?halaman`-nya berubah. `pathname` saja
   * tidak cukup (pindah halaman dalam satu modul tidak mengubahnya), dan
   * `?halaman` saja juga tidak (pindah modul menghapus query itu, sehingga
   * terlihat seperti perpindahan halaman).
   *
   * Reset-nya dilakukan **saat render**, bukan di dalam effect — pola "sesuaikan
   * state saat prop berubah" yang didokumentasikan React. Memanggil `setState`
   * sinkron di dalam effect memicu render berantai dan ditolak lint
   * (`react-hooks/set-state-in-effect`); di sini cukup bandingkan dengan nilai
   * render sebelumnya.
   */
  const tujuan = `${pathname}?${halamanAktif ?? ""}`;
  const [tujuanSebelumnya, setTujuanSebelumnya] = useState(tujuan);
  if (tujuanSebelumnya !== tujuan) {
    const pathnameSama = tujuanSebelumnya.split("?")[0] === pathname;
    setTujuanSebelumnya(tujuan);
    if (pathnameSama && silabusBuka) setSilabusBuka(false);
  }

  /**
   * Fokus kembali ke tombol silabus setelah panel tertutup.
   *
   * Hanya menutup panel belum cukup: saat panel dibongkar, fokus yang tadinya ada
   * di dalam panel jatuh ke `document.body`, dan pembaca layar kehilangan
   * tempatnya. Effect ini mendeteksi transisi terbuka → tertutup (bukan kondisi
   * `!silabusBuka` semata, yang juga terjadi saat mount) lalu mengembalikan fokus
   * ke tombol yang membuka panel. Ia tidak memanggil `setState`, jadi tidak
   * menyalahi aturan lint di atas.
   */
  useEffect(() => {
    const baruTertutup = silabusSebelumnya.current && !silabusBuka;
    silabusSebelumnya.current = silabusBuka;
    if (baruTertutup) tombolSilabusRef.current?.focus();
  }, [silabusBuka]);

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
   * tidak ada modul, sebab `jalankan` hanya terpanggil dari effect di bawah yang
   * dijaga `modulAktif`.
   */
  const { jalankan, pending, pesan } = useSelesaikanModul({
    courseId: kursusId,
    modulId: modulAktif?.id ?? "",
    kebijakan,
    checkpoint: modulAktif?.checkpoint,
  });

  const sudahSelesai = modulAktif ? selesai.includes(modulAktif.id) : false;

  /**
   * Kunci pemicu terakhir yang sudah ditembakkan.
   *
   * `pending` saja **tidak cukup** menjaga dari penembakan ganda: pada jalur
   * informal, `tandaiModulAction` adalah **toggle**, dan `useTransition` bisa
   * melaporkan `pending` kembali `false` sebelum `router.refresh()` mengalirkan
   * `selesai` yang baru. Di celah itu effect berjalan lagi dan menembak kedua
   * kali — modul yang baru saja ditandai selesai jadi **batal** lagi. Ref ini
   * menutup celah itu: satu kunci hanya ditembak sekali.
   *
   * Kuncinya memuat **ada/tidaknya `bukti`**, bukan hanya id halaman: pada
   * course `wajib` tanpa sesi, penembakan pertama ditolak server; begitu peserta
   * memulai sesi (`bukti` terisi) sementara masih di halaman terakhir, kuncinya
   * berubah dan penyelesaian dicoba lagi — tanpa ini, penolakan pertama
   * mengunci modul itu selamanya.
   */
  const pemicuTerakhir = useRef<string | null>(null);

  /**
   * Penyelesaian modul **otomatis** saat halaman terakhirnya tercapai.
   *
   * Inilah pengganti tombol "Tandai selesai": begitu peserta tiba di halaman
   * terakhir modul bacaan, modulnya ditandai selesai sendiri — tanpa konfirmasi,
   * karena "sudah selesai membaca" adalah kesimpulan dari posisi baca, bukan
   * pilihan yang harus ditegaskan ulang. Keputusan **apakah** penyelesaiannya sah
   * tetap milik `useSelesaikanModul`/server; effect ini hanya memicu pada
   * halaman terakhir, dan server yang menolak (mis. course `wajib` tanpa sesi)
   * mengembalikan `pesan` yang dirender bar fokus.
   *
   * Kenapa effect, bukan render: `jalankan` menulis (memanggil server action).
   * Memanggilnya saat render akan menembakkan satu request per render, dan React
   * boleh me-render berkali-kali. Effect berjalan sekali per perubahan
   * ketergantungan.
   *
   * Kenapa `!sudahSelesai` jadi syarat: begitu server menandai selesai,
   * `router.refresh()` mengalirkan `selesai` baru ke shell, `sudahSelesai` jadi
   * `true`, dan effect berhenti memicu. `pending` ikut dijaga supaya transisi
   * yang sedang berjalan tidak ditembak dua kali; sisa celahnya ditutup
   * `pemicuTerakhir` (lihat catatannya).
   */
  useEffect(() => {
    if (!modulAktif) return;
    if (sudahSelesai || pending) return;
    if (
      !modulSelesaiMembaca({
        checkpoint: modulAktif.checkpoint,
        modul: modulAktif,
        halamanId: halamanAktif,
      })
    ) {
      return;
    }
    const kunci = `${modulAktif.id}:${halamanAktif ?? ""}:${bukti ? "sesi" : "tanpa-sesi"}`;
    if (pemicuTerakhir.current === kunci) return;
    pemicuTerakhir.current = kunci;
    jalankan(false);
  }, [modulAktif, halamanAktif, kebijakan, sudahSelesai, pending, bukti, jalankan]);

  // Kalau kurikulum kosong, tidak ada modul yang bisa ditampilkan. Ini bukan
  // keadaan yang seharusnya terjadi pada kursus yang bisa dibuka, tetapi
  // mengembalikan `null` lebih jujur daripada merender bar tanpa modul.
  if (!modulAktif) return <>{children}</>;

  const sudah = sudahSelesai;

  return (
    /**
     * Shell **terbatas tinggi** (`h-dvh overflow-hidden`), bukan `min-h-dvh`.
     *
     * Dengan `min-h-dvh` tidak ada yang membatasi baris flex di bawah bar fokus:
     * saat modul lebih tinggi dari viewport, baris itu tumbuh setinggi isi, dan
     * `overflow-y-auto` pada `main` menjadi hampa — yang menggulir justru
     * dokumen. Akibatnya `TutorDrawer` yang ter-dock di `xl` (saudara flex di
     * baris yang sama) juga setinggi modul, akar `h-dvh` aplikasi AI Mastery di
     * dalam iframe menjadi setinggi itu, dan daftar pesannya tidak pernah
     * menggulir: composer tutor berakhir ribuan piksel di bawah, tidak terjangkau
     * selama membaca bagian atas modul. Di bawah `xl` drawer adalah lembar
     * `fixed`, jadi masalah ini khusus `xl` ke atas.
     *
     * `h-dvh overflow-hidden` membuat **baris** yang memiliki gulirnya, bukan
     * dokumen — pola yang sudah dipakai reader ter-dock repo ini
     * (`book-reader.tsx:31`). Rantai `min-h-0` di bawah wajib utuh: tanpa itu
     * kolom-kolom flex menolak menyusut di bawah tinggi isinya.
     */
    <div className="reader-shell flex h-dvh flex-col overflow-hidden">
      <MateriFocusBar
        slug={slug}
        kursusJudul={kursusJudul}
        modulSemua={modul}
        selesai={selesai}
        sudah={sudah}
        pending={pending}
        drawerBuka={drawerBuka}
        onToggleDrawer={() => setDrawerBuka((v) => !v)}
        aksesTutor={keputusanTutor}
        pesan={pesan}
        silabusBuka={silabusBuka}
        onToggleSilabus={() => setSilabusBuka((v) => !v)}
        tombolSilabusRef={tombolSilabusRef}
      />

      {/* Strip sesi (status + catatan yang bisa dibuka).

         Jorongnya (`mx-3 mt-3 sm:mx-5`) ada di `KejadianPanel` itu
          sendiri, bukan di pembungkus di sini. Pembungkus selalu dirender —
          sedangkan `KejadianPanel` mengembalikan `null` saat sesi tidak berjalan
          dan belum ada celah — jadi `pt-3`-nya tetap menyisakan pita 12px di
          atas baris baca pada course `opsional`. Di `xl` pita itu juga yang
          mendorong tepi atas drawer tutor 12px lebih rendah dari bar fokus,
          padahal drawer itu sekarang menempel ke baris baca. */}
      <KejadianPanel />

      {/* Baris baca. `relative` bukan hanya untuk bar kaki: di `xl` ia juga
          containing block drawer tutor, sehingga `top: 0` pada drawer berarti
          "tepat di bawah bar fokus" dan `bottom: 0` berarti "tepat di dasar
          tampilan" — bukan 16px di dalam viewport, yang pernah menutupi tombol
          "Selesai" milik bar itu sendiri. */}
      <div className="relative flex min-h-0 flex-1">
        {/* Pembungkus `relative` untuk area baca saja, sehingga bar kaki
            diposisikan `absolute` terhadap **wilayah baca** dan tidak pernah
            ikut bergeser ke dalam area drawer. Bar kaki juga tidak boleh bergerak
            untuk accommodate drawer: di `xl` ia naik ke `z-index: 45` di atas
            drawer, bukan menyingkir ke samping. */}
        <div className="relative min-w-0 flex-1">
          <main className="h-full min-w-0 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-3xl space-y-6">
              {/* Ajakan memulai sesi, tepat di atas kartu materi.
                  Dulu ia tinggal di bar fokus yang `sticky`, dan di situ kartu
                  amber setinggi beberapa baris menutupi judul modul selama
                  seluruh halaman digulir — persis saat peserta membacanya.
                  `CourseSessionPrompt` sudah menyembunyikan dirinya saat sesi
                  berjalan, jadi ia tidak pernah menumpuk dengan `KejadianPanel`
                  di atas: keduanya tidak tampil bersamaan.

                  Jaraknya dari `space-y-6` pembungkus ini, **bukan** `mb` pada
                  elemennya sendiri: course `opsional` membuat komponen ini
                  mengembalikan `null`, dan `mb` yang menempel padanya akan
                  menyisakan rongga kosong di atas kartu pertama. `space-y-6`
                  hanya memberi jarak ke saudara yang benar-benar dirender. */}
              <CourseSessionPrompt />
              {children}
            </div>
          </main>

          {/* Bar kaki hidup di dalam area baca supaya `absolute`-nya mengacu ke
              sini, dan `main` di atasnya (yang menggulir) memberi tinggi. */}
          <MateriFootBar
            slug={slug}
            modulSemua={modul}
            modulAktif={modulAktif.id}
            drawerBuka={drawerBuka}
            onToggleDrawer={() => setDrawerBuka((v) => !v)}
            bolehTutor={keputusanTutor.tipe === "bebas"}
            alasanTutor={keputusanTutor.tipe === "ditolak" ? keputusanTutor.pesan : undefined}
          />
        </div>

        <TutorDrawer
          src={tutorSrc}
          buka={drawerBuka}
          onTutup={() => setDrawerBuka(false)}
          boleh={keputusanTutor.tipe === "bebas"}
        />
      </div>

      {/* Panel silabus: daftar modul reader, satu-satunya sekarang. Portal ke
          `<body>`, jadi ia hidup di luar pohon bar dan tidak ikut tata letak
          baris flex di atas. */}
      <ReaderPanelSilabus
        slug={slug}
        kursusJudul={kursusJudul}
        kursusPenyedia={kursusPenyedia}
        modul={modul}
        modulAktif={modulAktif.id}
        halamanAktif={halamanAktif ?? undefined}
        selesai={selesai}
        buka={silabusBuka}
        onTutup={() => setSilabusBuka(false)}
        tombolRef={tombolSilabusRef}
      />
    </div>
  );
}
