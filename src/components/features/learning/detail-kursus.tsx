"use client";

import { useState, useTransition, useRef } from "react";
import Link from "next/link";
import {
  Check,
  CircleCheck,
  Clock,
  FolderKanban,
  ListChecks,
  Lock,
  Rocket,
  SquareTerminal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PitaHeaderDither } from "@/components/ui/pita-header-dither";
import type { ModulKursus } from "@/lib/courses/kurikulum";
import { levelLabel, tipeLabel } from "@/lib/onboarding/types";
import { hitungProgres, irisModulSelesai } from "@/lib/courses/kurikulum";
import { daftarKursusAction } from "@/actions/enrollment";
import {
  CourseSessionIndicator,
  CourseSessionPrompt,
  CourseSessionProvider,
  useCourseSession,
} from "./course-session";
import { KursusAiPanel } from "./kursus-ai-panel";
import { KursusSubNav } from "./kursus-subnav";
import { DitheredHeroBackdrop } from "./dithered-hero-backdrop";
import { SertifikatPanel } from "./sertifikat-panel";
import { TabelPelanggaran } from "./tabel-pelanggaran";
import type { KebijakanCourse } from "@/types/course";
import type { KejadianIntegritas } from "@/lib/learning/session";

/**
 * Sesi terverifikasi yang sudah berjalan, sebagaimana di-seed server.
 *
 * Bentuknya sengaja sama dengan `sesiReaderAwal` (`reader-sesi.ts`): silabus dan
 * reader memakai ukuran yang sama supaya tidak ada versi yang menyimpang saat
 * field baru ditambahkan ke seed.
 */
export interface SesiAwalKursus {
  bukti: string;
  runId: string;
  mulaiAt: string;
  kejadian: KejadianIntegritas[];
}

export interface KursusTerkait {
  slug: string;
  title: string;
  provider: string;
  level: string;
  duration_min: number;
  is_free: boolean;
}

/**
 * Challenge praktik yang ditawarkan di ujung silabus.
 *
 * `level`, `estimate_min`, dan `criteria` adalah **field yang sama** dari
 * `TaskFixture` yang dibaca halaman challenge (`/challenge/[id]`), bukan nilai
 * turunan: kartu di silabus harus menyebut kriteria penilaian yang persis sama
 * dengan yang dinilai di ruang kerjanya, dan menyalin ringkasannya di sini akan
 * membuat dua daftar yang bisa menyimpang. Namanya sengaja mengikuti fixture
 * (`criteria`, bukan `kriteria`) supaya pemetaan di halaman tidak perlu
 * menerjemahkan apa pun.
 */
export interface TugasTerkait {
  id: string;
  title: string;
  brief: string;
  level: string;
  estimate_min: number;
  criteria: string[];
}

/**
 * Status panel Project di halaman course.
 *
 * `terkunci` dihitung **server** (`belajar/[slug]/page.tsx` memeriksa
 * completion terverifikasi), bukan diturunkan dari jumlah modul selesai di
 * klien: 100% modul lewat jalur informal tetap tidak membuka Project. `judul`
 * dan `ringkasan` berasal dari modul checkpoint `proyek` bila ada — di course
 * lama yang belum punya modul proyek, copy default yang tampil.
 */
export interface RingkasanProject {
  terkunci: boolean;
  judul: string;
  ringkasan: string;
}

/**
 * Status kotak sertifikat di halaman course.
 *
 * `terkunci` **sumbernya sama** dengan `RingkasanProject.terkunci` — keduanya
 * diturunkan dari satu panggilan `kelayakanKursusSubmission` di server, bukan
 * dua pembacaan. `token` adalah token publik credential yang sudah terbit,
 * `null` selama belum ada; token itulah satu-satunya alasan kotak boleh
 * menampilkan tautan `/verify/...`.
 */
export interface RingkasanSertifikat {
  terkunci: boolean;
  token: string | null;
}

/**
 * Satu baris tabel catatan integritas, dalam bentuk yang bisa dikirim ke client.
 *
 * Sengaja dideklarasikan ulang di sini dan bukan diimpor dari
 * `@/lib/integritas/service`: berkas itu **server-only** (menarik `@/lib/db/client`
 * → `node:net`), dan `detail-kursus.tsx` adalah client component. Bentuknya dijaga
 * oleh `service.test.ts` — kalau service berubah, TypeScript akan complain di
 * props halaman yang mengirimnya.
 */
export interface BarisPelanggaran {
  jenis: string;
  tingkat: string;
  bobot: number;
  label: string;
  detail: string;
  jumlah: number;
  jumlahAktif: number;
  jumlahDipulihkan: number;
}

export interface DetailKursusData {
  id: string;
  slug: string;
  title: string;
  description: string;
  provider: string;
  type: string;
  level: string;
  tags: string[];
  url: string;
  duration_min: number;
  is_free: boolean;
  price: number;
  rating: number | null;
  enrolled_count: number | null;
}

function rupiah(nilai: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(nilai);
}

/**
 * Tiga langkah dari completion terverifikasi sampai credential terbit.
 *
 * Urutannya bukan copy pemasaran: ia rantai yang sudah dikunci di AGENTS.md —
 * completion terverifikasi membuka Project, karya masuk ke verifikator, badge +
 * atestasi terbit setelah diputuskan. Langkah 1 ditandai selesai **dari
 * `terkunci`**, bukan dihitung ulang di sini: `terkunci` datang dari satu
 * pembacaan `kelayakanKursusSubmission` di server, sama dengan yang menggerbang
 * kotak sertifikat di sidebar, jadi langkah ini tidak bisa mengklaim "selesai"
 * sementara sertifikatnya masih terkunci.
 */
function langkahProject(terkunci: boolean) {
  return [
    { judul: "Tuntaskan modul", catatan: "Lewat sesi terverifikasi", selesai: !terkunci },
    { judul: "Kumpulkan karya", catatan: "Form project di course ini", selesai: false },
    { judul: "Review verifikator", catatan: "Badge dan atestasi terbit", selesai: false },
  ];
}

/**
 * Bungkus ruang belajar dengan provider sesi.
 *
 * `kebijakan` diteruskan dari server: provider memakainya untuk memutuskan akses
 * kegiatan (`putuskanAkses`). Nilai datang lewat prop, bukan dibaca di klien,
 * supaya mesin keputusan klien dan server memakai kebijakan yang sama.
 */
export function DetailKursus({
  kursus,
  modul,
  terdaftar,
  selesaiAwal,
  terkait,
  tugas,
  kebijakan,
  aiCourseId,
  proyek,
  sertifikat,
  catatanIntegritas,
  sesiAwal,
}: {
  kursus: DetailKursusData;
  modul: ModulKursus[];
  terdaftar: boolean;
  selesaiAwal: string[];
  terkait: KursusTerkait[];
  tugas: TugasTerkait | null;
  kebijakan: KebijakanCourse;
  /**
   * Id course di AI Mastery, sudah di-resolve server. Sama dengan `kursus.id`
   * bila bridging tidak tersedia — lihat `tutor-ai-kursus.ts`.
   */
  aiCourseId?: string;
  /** Status Project (locked/siap) — dihitung server dari completion terverifikasi. */
  proyek: RingkasanProject;
  /** Status kotak sertifikat — sumbernya satu pembacaan server yang sama dengan `proyek`. */
  sertifikat: RingkasanSertifikat;
  /**
   * Catatan integritas peserta pada course ini, atau `null` bila peserta belum
   * terdaftar. `null` bukan "kosong": course yang belum diikuti tidak punya
   * catatan untuk ditampilkan, dan menampilkannya sebagai tabel 0 akan terlihat
   * seperti "sudah diperiksa dan bersih".
   */
  catatanIntegritas?: BarisPelanggaran[] | null;
  /**
   * Sesi terverifikasi yang masih berjalan, di-seed **server** (bentuknya sama
   * dengan `sesiReaderAwal`).
   *
   * Tanpa ini, provider di silabus selalu mulai dari keadaan "tidak ada sesi":
   * peserta yang memulai sesi di halaman kursus lalu memuat ulang, atau yang
   * kembali dari reader (sesi berjalan di sana), melihat ajakan "Mulai sesi"
   * lagi — padahal `learning_runs` punya run aktif untuk course ini. Itu
   * memaksa satu klik "Mulai" tambahan hanya untuk masuk kembali ke reader, dan
   * itulah keluhan "kenapa diminta verifikasi dua kali".
   *
   * `null` berarti memang tidak ada sesi berjalan, bukan gagal baca.
   */
  sesiAwal?: SesiAwalKursus | null;
}) {
  return (
    <CourseSessionProvider
      courseId={kursus.id}
      kebijakan={kebijakan}
      buktiAwal={sesiAwal?.bukti ?? null}
      runIdAwal={sesiAwal?.runId ?? null}
      kejadianAwal={sesiAwal?.kejadian ?? []}
    >
      <RuangBelajar
        kursus={kursus}
        modul={modul}
        terdaftar={terdaftar}
        selesaiAwal={selesaiAwal}
        terkait={terkait}
        tugas={tugas}
        aiCourseId={aiCourseId ?? kursus.id}
        proyek={proyek}
        sertifikat={sertifikat}
        catatanIntegritas={catatanIntegritas ?? null}
      />
    </CourseSessionProvider>
  );
}

/**
 * Isi ruang belajar: kurikulum, panel pendaftaran, dan bagian terkait.
 *
 * Dipisah dari `DetailKursus` karena butuh `useCourseSession()`: provider harus
 * berada di atas komponen yang membaca konteksnya, jadi pembacaannya harus
 * berada di anak provider, bukan di komponen yang merender provider.
 */
function RuangBelajar({
  kursus,
  modul,
  terdaftar,
  selesaiAwal,
  terkait,
  tugas,
  aiCourseId,
  proyek,
  sertifikat,
  catatanIntegritas,
}: {
  kursus: DetailKursusData;
  modul: ModulKursus[];
  terdaftar: boolean;
  selesaiAwal: string[];
  terkait: KursusTerkait[];
  tugas: TugasTerkait | null;
  aiCourseId: string;
  proyek: RingkasanProject;
  sertifikat: RingkasanSertifikat;
  catatanIntegritas: BarisPelanggaran[] | null;
}) {
  /**
   * Progres baca dari server. **Bukan state**: penyelesaian modul sudah tidak
   * lagi ditandai dari halaman ini. Satu-satunya tempat peserta menekan "Tandai
   * selesai" adalah bar fokus reader (`materi-shell.tsx`), tempat modulnya benar-
   * benar dibaca dan sesi terverifikasi berjalan. Karena itu tidak ada
   * `setSelesai` di sini — daftar ini hanya dibaca untuk menghitung progres,
   * mencentang nomor modul, dan memilih sasaran "Lanjutkan".
   */
  const selesaiValid = irisModulSelesai(selesaiAwal, modul);
  const [sudahDaftar, setSudahDaftar] = useState(terdaftar);
  const [pesan, setPesan] = useState<string | null>(null);
  const [butuhPlus, setButuhPlus] = useState(false);
  const [pending, startTransition] = useTransition();
  /**
   * Keputusan akses untuk tombol "Tanya tutor AI".
   *
   * Halaman ini sekarang **silabus**: ia hanya menjawab "apa yang harus saya
   * pelajari, dan di mana?" — jadi satu-satunya keputusan akses yang tersisa di
   * sini adalah untuk panel tutor. Keputusan kegiatan (`boleh("materi")`,
   * `boleh("kuis")`) pindah ke reader bersama gerbangnya
   * (`materi-pane.tsx`), tempat soal dan lampiran benar-benar dirender.
   *
   * `bantuan_akademik` adalah satu-satunya jenis kegiatan yang membaca
   * `aturan_bantuan` — inilah jalur yang membuat aturan `tanpa_ai` ditegakkan di
   * UI, dan `CourseSessionIndicator` yang menampilkan label aturan itu
   * sebelumnya tidak punya consumers. Tanpa pemanggilan ini, kebijakan
   * `tanpa_ai` hanya dicetak ke layar tanpa pernah membatasi apa pun.
   *
   * Perhatikan bahwa `putuskanAkses` untuk jenis ini **tidak** membaca
   * `adaBuktiSesi`: tutor AI adalah bantuan belajar, bukan penyelesaian, jadi
   * sesi terverifikasi tidak menjadi syaratnya.
   */
  const { boleh } = useCourseSession();
  const keputusanBantuan = boleh("bantuan_akademik");
  const progres = hitungProgres(selesaiValid.length, modul.length);
  const jumlahHalaman = modul.reduce((total, m) => total + (m.halaman?.length ?? 0), 0);
  /**
   * Sasaran "Lanjutkan" — modul pertama yang belum selesai.
   *
   * `?? modul[0]` menutup dua kasus: semua modul sudah selesai (maka "Ulas
   * modul" mengulang dari awal) dan daftar modul yang kosong (maka `#kurikulum`
   * tetap jadi jangkar terakhir yang masuk akal — silabusnya sendiri).
   */
  const modulBerikutnya = modul.find((m) => !selesaiValid.includes(m.id)) ?? modul[0];
  const hrefLanjut = modulBerikutnya
    ? `/belajar/${kursus.slug}/materi/${modulBerikutnya.id}`
    : "#kurikulum";
  /**
   * Daftar langkah Project dan indeks langkah yang sedang aktif.
   *
   * Langkah aktif adalah langkah **pertama yang belum selesai** — jadi saat
   * Project terkunci ia menunjuk langkah 1 (`Tuntaskan modul`), dan saat Project
   * terbuka ia pindah ke langkah 2 (`Kumpulkan karya`), tepat di bawah tombol
   * "Kerjakan project". Dihitung sekali di sini, bukan di dalam JSX, supaya
   * penanda `selesai` dan penanda "sedang di sini" tidak bisa saling
   * bertentangan.
   */
  const langkahProyek = langkahProject(proyek.terkunci);
  const indeksLangkahAktif = langkahProyek.findIndex((langkah) => !langkah.selesai);
  /**
   * Blok header course, jadi trigger sub-header lengket.
   *
   * Ref, bukan state: `ScrollSubNav` membacanya dari listener scroll, jadi yang
   * dibutuhkan hanya elemennya. Menyimpan posisi scroll di state akan
   * me-render ulang seluruh daftar modul pada setiap gerakan scroll.
   */
  const headerRef = useRef<HTMLDivElement>(null);

  const daftar = () =>
    startTransition(async () => {
      const hasil = await daftarKursusAction(kursus.id);
      setPesan(hasil.message ?? hasil.error ?? null);
      setButuhPlus(hasil.butuhPlus === true);
      if (hasil.ok) setSudahDaftar(true);
    });

  /**
   * Tombol "Tandai selesai" **tidak ada di sini** — dan sekarang tidak ada di
   * mana pun.
   *
   * Halaman ini silabus: daftar modul yang mengantar ke reader. Yang menandai
   * modul selesai adalah reader itu sendiri (`materi-shell.tsx`), begitu halaman
   * terakhir modulnya tercapai dan `useSelesaikanModul` memilih jalurnya —
   * tempat modulnya benar-benar dibaca dan sesi terverifikasi berjalan.
   * Sebelumnya halaman ini memegang salinan pelaksanaannya sendiri
   * (`pilihJalurPenyelesaian` + `selesaikanMateriAction` + `tandaiModulAction`);
   * salinan itu dibuang bersama tombolnya, jadi aturan jalur penyelesaian kini
   * hidup di satu permukaan saja.
   */

  return (
    <div className="min-w-0 overflow-x-clip bg-white">
      <KursusSubNav
        judul={kursus.title}
        penyedia={kursus.provider}
        terdaftar={sudahDaftar}
        progres={progres}
        selesai={selesaiValid.length}
        total={modul.length}
        gratis={kursus.is_free}
        pending={pending}
        onDaftar={daftar}
        hrefLanjut={hrefLanjut}
        trigger={headerRef}
      />
      <div
        ref={headerRef}
        className="relative z-10 w-full overflow-hidden pt-32 pb-12 sm:pt-32 sm:pb-14 lg:pt-36 lg:pb-16"
      >
        {/*
         * Latar header: **dither**, bukan garis.

         * Laplace sebelumnya memakai `repeating-linear-gradient` 315° — itu
         * garis 1px tiap 12px, jadi yang terbaca sebagai "garis", bukan
         * stipple. Efek bit itu namespaced: `DitheredHeroBackdrop`
         * (shader Bayer 16x16 + posterise) sudah dipakai `/belajar`,
         * `/careevo-plus`, dan kartu promo, dan DESIGN.md menyebut
         * "selective dithered imagery" sebagai arah visual repo ini.
         *
         * Ground di bawah canvas bukan warna datar:ia membawa dot grid 3px
         * sebagai stipple CSS. Canvas WebGL menutupi ground itu saat aktif,
         * dan kalau WebGL tidak ada komponen mengembalikan canvas transparan
         * (lihat komentar di `dithered-hero-backdrop.tsx`) — tanpa dot grid
         * header akan jatuh ke polos dan efeknya hilang total.
         */}
        <div className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-hidden select-none">
          {/* Ground: gradien biru langit + dot grid sebagai fallback dither */}
          <div className="absolute inset-0 z-0 bg-[linear-gradient(170deg,#8FC0F2_0%,#7DD3FC_20%,#BAE6FD_46%,#DDEEFE_76%,#F2F9FF_100%)]" />
          <div className="absolute inset-0 z-0 bg-[size:3px_3px] [background-image:radial-gradient(rgba(10,61,98,0.16)_1px,transparent_1px)]" />

          {/* Dither: Bayer ordered-dither + posterise, grid dikunci ke piksel canvas */}
          <DitheredHeroBackdrop
            videoSrc="/videos/hero-sterly.mp4"
            levels={4}
            ditherScale={2}
            zoom={1}
            focusY={0.45}
          />

          {/* Halo lembut supaya teks tinta tetap terbaca di atas stipple */}
          <div className="absolute inset-0 z-10 bg-[radial-gradient(ellipse_78%_62%_at_50%_38%,rgba(255,255,255,0.78)_0%,rgba(255,255,255,0.34)_52%,transparent_84%)]" />

          {/* Transisi bawah ke badan halaman putih */}
          <div className="absolute inset-x-0 bottom-0 z-10 h-20 sm:h-28 bg-gradient-to-t from-white via-white/75 to-transparent" />
        </div>

        <div className="relative z-10 mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <nav aria-label="Breadcrumb" className="text-xs sm:text-sm text-neutral-600 font-medium">
            <Link href="/belajar" className="hover:text-[#0056D2] transition-colors">
              Belajar
            </Link>
            <span aria-hidden="true" className="text-neutral-400"> / </span>
            <span className="font-semibold text-neutral-950">{kursus.title}</span>
          </nav>
          <p className="mt-3.5 flex flex-wrap items-center gap-2 text-xs text-neutral-700 font-medium">
            <span
              aria-hidden="true"
              className="inline-flex size-5 items-center justify-center rounded-sm bg-[#0056D2] text-[10px] font-bold text-white shadow-xs"
            >
              {kursus.provider.charAt(0)}
            </span>
            <span>{kursus.provider}</span>
            <span aria-hidden="true" className="text-neutral-400">·</span>
            <span>{tipeLabel(kursus.type)}</span>
          </p>
          <h1 id="judul-kursus" className="mt-2.5 max-w-3xl text-3xl font-bold tracking-tight text-neutral-950 sm:text-4xl">
            {kursus.title}
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-neutral-700">{kursus.description}</p>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {kursus.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex rounded-full border border-sky-200/90 bg-white/80 backdrop-blur-xs px-3 py-1 text-xs font-semibold text-[#0056D2] shadow-2xs"
              >
                {tag}
              </span>
            ))}
          </div>
          <dl className="mt-6 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Level", levelLabel(kursus.level)],
              ["Durasi", `${kursus.duration_min} mnt`],
              ["Modul", `${modul.length} modul`],
              ...(kursus.rating !== null ? [["Rating", `★ ${kursus.rating.toFixed(2)}`] as [string, string]] : []),
            ].map(([istilah, nilai]) => (
              <div
                key={istilah}
                className="rounded-xl border border-white/90 bg-white/90 backdrop-blur-md px-4 py-3 shadow-[0_2px_12px_-4px_rgba(14,165,233,0.12),0_1px_2px_rgba(0,0,0,0.04)] transition-all hover:shadow-xs"
              >
                <dt className="text-[11px] font-medium tracking-wide text-neutral-500 uppercase">{istilah}</dt>
                <dd className="mt-0.5 text-sm font-semibold text-neutral-950">{nilai}</dd>
              </div>
            ))}
          </dl>
          {pesan ? (
            <p role="status" className="mt-4 max-w-2xl rounded-xl border border-blue-200 bg-blue-50/90 px-4 py-2.5 text-sm font-medium text-blue-800 shadow-2xs">
              {pesan}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl space-y-10 px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* `subnav-scroll-mt`, bukan `scroll-mt-24`: target ini sekarang bisa
              mendarat di belakang navbar mengambang *dan* sub-header lengket,
              yang offset-nya dipublikasikan `ScrollSubNav`. */}
          <section id="kurikulum" aria-labelledby="judul-kurikulum" className="subnav-scroll-mt min-w-0">
            <h2 id="judul-kurikulum" className="mb-1 text-xl font-bold tracking-tight text-gray-900">
              Kurikulum
            </h2>
            <p className="mb-4 text-sm text-gray-600">
              {modul.length} modul · {kursus.duration_min} menit total
              {jumlahHalaman > 0 ? ` · ${jumlahHalaman} halaman` : ""}
              {terdaftar ? "" : " · daftar untuk menyimpan progres"}
            </p>
            <div className="mb-4">
              {/* Ajakan mendahului indikator. Keduanya tidak pernah tampil
                  bersamaan — prompt hilang begitu sesi `aktif` — jadi peserta
                  di course `wajib` selalu punya satu titik masuk untuk memulai
                  sesi sebelum masuk ke reader. Inilah satu-satunya sisa
                  kewajiban sesi di silabus: begitu peserta menekan sebuah modul,
                  gerbangnya hidup di reader (`materi-pane.tsx`), bukan di sini.

                  `KejadianPanel` dulu dirender tepat di bawah indikator, tetapi
                  panel itu menjawab "apa yang tercatat selama sesi?" — pertanyaan
                  yang hanya berguna di dalam sesi, dan sesinya kini berjalan di
                  reader. Ia pindah ke sana bersama sesinya (`materi-shell.tsx`),
                  bukan dihapus. */}
              <CourseSessionPrompt />
              <CourseSessionIndicator />
            </div>
            <ol className="space-y-3">
              {modul.map((m, index) => {
                const sudah = selesaiValid.includes(m.id);
                const daftarMateri = m.materi ?? [];
                const daftarHalaman = [...(m.halaman ?? [])].sort((a, b) => a.urutan - b.urutan);
                const daftarKuis = m.kuis ?? [];
                const punyaIsi =
                  daftarMateri.length > 0 || daftarHalaman.length > 0 || daftarKuis.length > 0;
                return (
                  <li
                    key={m.id}
                    className={cn(
                      "rounded-2xl border bg-white",
                      sudah ? "border-emerald-200" : "border-gray-200",
                    )}
                  >
                    <div className="flex items-start gap-3 p-4">
                      <span
                        aria-hidden="true"
                        className={cn(
                          "mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold",
                          sudah ? "bg-emerald-500 text-white" : "bg-gray-100 text-gray-500",
                        )}
                      >
                        {sudah ? "✓" : index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold text-gray-900">{m.judul}</h3>
                        <p className="mt-0.5 text-sm leading-relaxed text-gray-600">{m.ringkasan}</p>
                        <p className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                          <span>{m.durasi_min} mnt</span>
                          {daftarHalaman.length > 0 ? (
                            <span>
                              {daftarHalaman.length} halaman
                              {daftarMateri.length > 0
                                ? ` · ${daftarMateri.length} lampiran`
                                : ""}
                              {daftarKuis.length > 0 ? ` · ${daftarKuis.length} kuis` : ""}
                            </span>
                          ) : null}
                        </p>
                      </div>
                      {/* Satu aksi, paling kanan: masuk ke modulnya. Tombolnya
                          memakai kelas navbar yang sama (`chrome-btn
                          chrome-btn-brand`) seperti `DashboardButton`, tombol
                          `Daftar`, dan tombol maju di bar kaki reader — bukan
                          salinan warnanya, sehingga tinggi, radius, bayangan,
                          dan `transform` hover/active-nya identik dengan CTA
                          navbar. Dulu ini tautan teks kecil di dalam baris meta;
                          di sana ia terbaca sebagai keterangan, bukan sebagai
                          pintu masuk modul.

                          `!h-11` menaikkan tinggi 40px bawaan `chrome-btn` ke
                          lantai sentuh 44px DESIGN.md. Padding dan `font-size`
                          **tidak** dipaksa: `chrome-btn-brand` membawa
                          `13.5px` dan padding optisnya sendiri (`0 1.35rem 0
                          1rem`), dan memaksanya ke angka karangan justru
                          mengembalikan ketidakcocokan dengan navbar yang sedang
                          dihindari.

                          `punyaIsi` memilih **tujuan**-nya, bukan gayanya: modul
                          berisi halaman/kuis/lampiran masuk ke reader
                          (`/belajar/<slug>/materi/<id>`), sedangkan modul yang
                          hanya punya tautan luar membuka sumbernya di tab baru —
                          karena itu panah ↗ tetap ada di varian itu.

                          Tombol "Tandai selesai" **tidak** di sini: modul
                          ditandai selesai oleh reader begitu halaman terakhirnya
                          tercapai, tempat modulnya benar-benar dibaca dan sesi
                          terverifikasi berjalan. Silabus hanya mengantar. */}
                      <div className="shrink-0 self-center">
                        {punyaIsi ? (
                          <Link
                            href={`/belajar/${kursus.slug}/materi/${m.id}`}
                            className="chrome-btn chrome-btn-brand !h-11"
                          >
                            Buka materi
                          </Link>
                        ) : (
                          <a
                            href={m.url}
                            target="_blank"
                            rel="noreferrer"
                            className="chrome-btn chrome-btn-brand !h-11"
                          >
                            Buka materi ↗
                          </a>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>

          {/* `subnav-sticky-top`, bukan `lg:top-24`: kolom ini ikut diam di
              viewport, jadi harus berhenti di bawah sub-header lengket —
              `top-24` (96px) berada di dalam bar (78–131px) dan kartunya
              tertutup. */}
          <aside
            aria-label="Sertifikat dan pendaftaran"
            className="subnav-sticky-top flex flex-col gap-4 lg:sticky lg:self-start"
          >
            {/* Kotak sertifikat sengaja berada di atas kotak pendaftaran:
                yang dijanjikan peserta ("selesai ini dapat sertifikat") adalah
                alasan mereka mendaftar, jadi tidak boleh kalah oleh harga. */}
            <SertifikatPanel
              judul={kursus.title}
              provider={kursus.provider}
              slug={kursus.slug}
              terdaftar={sudahDaftar}
              terkunci={sertifikat.terkunci}
              token={sertifikat.token}
              progres={progres}
              selesai={selesaiValid.length}
              total={modul.length}
            />

            {/* Tabel catatan integritas hanya untuk peserta yang sudah
                terdaftar. Untuk course yang belum diikuti, tabel kosong akan
                terbaca sebagai "sudah diperiksa dan bersih" — klaim yang
                memang belum pernah dibuat, karena tidak ada run yang pernah
                dijalankan. */}
            {catatanIntegritas ? (
              <TabelPelanggaran baris={catatanIntegritas} />
            ) : null}

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.08)]">
              {sudahDaftar ? (
                <>
                  <p className="text-xs font-semibold tracking-wider text-emerald-700 uppercase">
                    Terdaftar · {progres}%
                  </p>
                  <div
                    role="progressbar"
                    aria-label={`Progres kursus ${progres} persen`}
                    aria-valuenow={progres}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    className="mt-2 h-2.5 overflow-hidden rounded-full bg-gray-200"
                  >
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progres}%` }} />
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    {selesaiValid.length} dari {modul.length} modul selesai
                  </p>
                  {/* Sudut `--radius-md` (14px), bukan pil. Ini kontrol produk di
                      dalam kartu — bukan CTA marketing — dan DESIGN.md line 66
                      memisahkan keduanya ("rounded pill for focused marketing
                      actions, 14px radius for product controls"). Bentuk yang sama
                      dipakai CTA panel silabus reader (`.reader-panel-cta`), jadi
                      tombol "Lanjutkan" tidak lagi terbaca sebagai keluarga lain
                      dari tombol navbar yang bersebelahan dengannya. */}
                  <Link
                    href={hrefLanjut}
                    className="mt-4 block rounded-[var(--radius-md)] bg-gray-900 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-gray-700"
                  >
                    {progres === 100 ? "Ulas kembali modul" : "Lanjutkan belajar"}
                  </Link>
                </>
              ) : kursus.is_free ? (
                <>
                  <p className="text-2xl font-bold text-gray-900">Gratis</p>
                  <p className="mt-1 text-sm text-gray-600">
                    Akses seluruh {modul.length} modul dan tandai progresmu.
                  </p>
                  <button
                    type="button"
                    onClick={daftar}
                    disabled={pending}
                    className="mt-4 w-full cursor-pointer rounded-full bg-[#0056D2] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#00419e] disabled:opacity-60"
                  >
                    {pending ? "Mendaftar…" : "Daftar gratis"}
                  </button>
                </>
              ) : (
                <>
                  <p className="text-2xl font-bold text-gray-900">{rupiah(kursus.price)}</p>
                  <p className="mt-1 text-sm text-gray-600">
                    Kursus premium ini termasuk dalam paket Careevo Plus.
                  </p>
                  {butuhPlus || pesan ? (
                    <p role="status" className="mt-2 text-sm text-amber-700">
                      {pesan ?? "Kursus berbayar memerlukan Careevo Plus."}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    onClick={daftar}
                    disabled={pending}
                    className="mt-4 w-full cursor-pointer rounded-full border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Cek akses
                  </button>
                  <Link
                    href="/careevo-plus#paket"
                    className="mt-2 block rounded-full bg-[#0056D2] px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-[#00419e]"
                  >
                    Lihat paket Plus
                  </Link>
                </>
              )}
              <a
                href={kursus.url}
                target="_blank"
                rel="noreferrer"
                className="mt-3 block text-center text-sm font-medium text-[#0056D2]"
              >
                Buka materi eksternal ↗
              </a>
            </div>

            {sudahDaftar ? (
              <KursusAiPanel
                courseId={aiCourseId}
                judul={kursus.title}
                penyedia={kursus.provider}
                jumlahModul={modul.length}
                akses={keputusanBantuan}
              />
            ) : null}
          </aside>
        </div>

        {tugas ? (
          /*
           * Tantangan praktik — pita dither + dua kolom.
           *
           * Sebelumnya: satu panel biru datar (`from-blue-800 to-blue-500`)
           * dengan tiga baris teks dan pil putih. Tiga hal salah sekaligus, dan
           * ketiganya sudah pernah dicatat di repo ini:
           *
           *  1. **Ramp birunya di tangan.** Setiap permukaan biru lain di repo
           *     mengambil gradiennya dari satu sumber (resep kartu dashboard,
           *     `PitaHeaderDither`, `--brand-grad`); panel ini menulis
           *     `from-blue-800 to-blue-500` sendiri, jadi birunya bebas
           *     menyimpang. Sekarang media-nya `PitaHeaderDither` — resep yang
           *     sama dengan header `/belajar` dan panel "Cocok Untukmu".
           *  2. **Tinta putih di atas field terang.** Media dither itu terang;
           *     putih di atasnya ~1.1:1. Karena itu isinya tinta gelap
           *     (`#0a3d62`), bukan `text-white`.
           *  3. **Nol informasi tentang tugasnya.** Judul challenge saja tidak
           *     memberi tahu apa yang akan dinilai. `criteria` dari fixture yang
           *     sama dengan ruang kerja challenge sekarang tampil di sini, jadi
           *     peserta tahu standar penilaiannya sebelum menekan tombol.
           *
           * Isi duduk di **lembar putih yang MENUMPUK pitanya** (`relative z-10
           * -mt-4 rounded-t-2xl bg-white`) — perangkat yang sama dengan kartu
           * katalog (`-mt-8`) dan panel rekomendasi loker (`-mt-4`), hanya
           * dengan tinggi pita 72px yang sama dengan panel itu. Keempat
           * kelasnya satu paket: `-mt-4` sebesar radius 16px, jadi seluruh
           * lengkungnya menyingkap pita di belakangnya; tanpa negatif margin,
           * `bg-white`, atau `z-10` bentuknya diam-diam kembali jadi kotak
           * putih persegi.
           */
          <section
            aria-labelledby="judul-praktik"
            className="overflow-hidden rounded-2xl border border-[rgba(147,197,253,0.45)] bg-white shadow-[0_1px_2px_rgba(10,61,98,0.04),0_10px_24px_-16px_rgba(10,61,98,0.18)]"
          >
            <PitaHeaderDither className="h-[72px]">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/70 text-[#0a3d62] ring-1 ring-[#0a3d62]/15">
                  <SquareTerminal aria-hidden className="size-4" />
                </span>
                <h2
                  id="judul-praktik"
                  className="truncate text-[14.5px] font-bold tracking-tight text-[#0a3d62]"
                >
                  Challenge praktik
                </h2>
              </div>

              {/* Judul pita saja. Level dan estimasi **tidak** di sini: keduanya
                  akan hilang di bawah `sm` kalau ditempatkan di pita 72px, dan
                  informasi yang muncul hanya di lebar tertentu adalah
                  informasi yang hilang separuh waktu. Keduanya pindah ke baris
                  meta di badan kartu, jadi lebar layar tidak pernah menentukan
                  apa yang bisa dibaca. */}
            </PitaHeaderDither>

            <div className="relative z-10 -mt-4 rounded-t-2xl bg-white px-5 pt-6 pb-6 lg:px-8 lg:pb-7">
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-8">
                <div className="min-w-0">
                  <p className="text-lg font-bold tracking-tight text-gray-900">
                    Uji pemahaman lewat satu tugas nyata
                  </p>

                  {/* Level dan estimasi adalah field fixture yang sama dengan
                      yang ditampilkan di `/challenge/[id]`, bukan angka
                      karangan. Keduanya di sini, bukan di pita, supaya terbaca
                      di semua lebar. */}
                  <p className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-[11px] font-semibold text-[#0056D2] ring-1 ring-blue-100">
                      {levelLabel(tugas.level)}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-1 text-[11px] font-semibold text-gray-700 ring-1 ring-gray-200">
                      <Clock aria-hidden className="size-3" />
                      {tugas.estimate_min} mnt
                    </span>
                  </p>

                  <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-gray-600">
                    {tugas.brief}
                  </p>

                  <p className="mt-5 flex items-center gap-2 text-[11px] font-semibold tracking-[0.14em] text-gray-500 uppercase">
                    <ListChecks aria-hidden className="size-3.5 text-[#0056D2]" />
                    Yang dinilai
                  </p>
                  <ul className="mt-2.5 grid gap-2 sm:grid-cols-2">
                    {tugas.criteria.map((kriteria) => (
                      <li
                        key={kriteria}
                        className="flex items-start gap-2 text-sm leading-snug text-gray-700"
                      >
                        <CircleCheck
                          aria-hidden
                          className="mt-0.5 size-4 shrink-0 text-emerald-600"
                        />
                        <span>{kriteria}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Satu aksi utama, di kanan dan sejajar dasar kolom teks.
                    `chrome-btn chrome-btn-brand` — kelas navbar yang nyata,
                    sama seperti tombol "Buka materi" di daftar modul di atas,
                    bukan salinan warnanya. Padding optisnya (`0 1.35rem 0 1rem`)
                    sengaja **tidak** ditimpa: DESIGN.md mencatatnya sebagai
                    bawaan kelas itu, dan `max-width: 560px` di `globals.css`
                    sudah meruntuhkannya jadi simetris di layar kecil. */}
                <div className="shrink-0">
                  <Link
                    href={`/challenge/${tugas.id}`}
                    className="chrome-btn chrome-btn-brand !h-11"
                  >
                    Kerjakan: {tugas.title}
                  </Link>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <section
          aria-labelledby="judul-proyek"
          className={cn(
            "rounded-2xl border bg-white shadow-[0_1px_2px_rgba(10,61,98,0.04),0_10px_24px_-16px_rgba(10,61,98,0.18)]",
            proyek.terkunci ? "border-[rgba(147,197,253,0.45)]" : "border-emerald-200",
          )}
        >
          <div className="px-5 py-6 lg:px-8 lg:py-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3.5">
                {/* Lencana ikon, bukan sekadar teks eyebrow. Keadaan kunci
                    dibawa oleh dua hal sekaligus — ikonnya dan warnanya —
                    supaya "terkunci" terbaca dari bentuk sebelum kalimatnya
                    dibaca. */}
                <span
                  aria-hidden="true"
                  className={cn(
                    "grid size-10 shrink-0 place-items-center rounded-xl ring-1",
                    proyek.terkunci
                      ? "bg-gray-50 text-gray-500 ring-gray-200"
                      : "bg-emerald-50 text-emerald-700 ring-emerald-200",
                  )}
                >
                  {proyek.terkunci ? <Lock className="size-4.5" /> : <FolderKanban className="size-4.5" />}
                </span>
                <div className="min-w-0">
                  <p
                    className={cn(
                      "text-[11px] font-semibold tracking-[0.14em] uppercase",
                      proyek.terkunci ? "text-gray-500" : "text-emerald-700",
                    )}
                  >
                    Project course
                  </p>
                  <h2
                    id="judul-proyek"
                    className="mt-1 text-xl font-bold tracking-tight text-gray-900"
                  >
                    {proyek.judul}
                  </h2>
                </div>
              </div>

              {proyek.terkunci ? (
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600">
                  <Lock className="size-3.5" aria-hidden="true" /> Terkunci
                </span>
              ) : (
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                  <CircleCheck className="size-3.5" aria-hidden="true" /> Siap dikerjakan
                </span>
              )}
            </div>

            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-600">
              {proyek.ringkasan}
            </p>

            {/* Alur sampai sertifikat — bukan hiasan, melainkan urutan nyata
                dari AGENTS.md: completion terverifikasi membuka Project, karya
                masuk ke verifikator, badge + atestasi terbit setelah diputuskan.
                Langkah pertama ditandai selesai **justru karena** `terkunci`
                bernilai salah: panel ini tidak menghitung ulang apa pun, ia
                membaca satu nilai server yang sama dengan kotak sertifikat di
                sidebar. */}
            <div
              className={cn(
                "mt-5 rounded-xl border px-4 py-4",
                proyek.terkunci ? "border-gray-200 bg-gray-50/70" : "border-emerald-100 bg-emerald-50/50",
              )}
            >
              <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.14em] text-gray-500 uppercase">
                <Rocket className="size-3.5 text-[#0056D2]" aria-hidden="true" />
                Alur sampai sertifikat
              </p>
              <ol className="mt-3 grid gap-3 sm:grid-cols-3 sm:gap-4">
                {langkahProyek.map((langkah, index) => (
                  <li key={langkah.judul} className="flex items-start gap-2.5">
                    <span
                      aria-hidden="true"
                      className={cn(
                        "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold",
                        langkah.selesai
                          ? "bg-emerald-500 text-white"
                          : index === indeksLangkahAktif
                            ? "bg-white text-[#0056D2] ring-2 ring-[#0056D2]/30"
                            : "bg-gray-100 text-gray-400 ring-1 ring-gray-200",
                      )}
                    >
                      {langkah.selesai ? <Check className="size-3.5" /> : index + 1}
                    </span>
                    <span className="min-w-0">
                      <span
                        className={cn(
                          "block text-sm font-semibold",
                          langkah.selesai || index === indeksLangkahAktif
                            ? "text-gray-900"
                            : "text-gray-500",
                        )}
                      >
                        {langkah.judul}
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-gray-500">
                        {langkah.catatan}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            {proyek.terkunci ? (
              <p className="mt-4 text-sm leading-relaxed text-gray-500">
                {terdaftar
                  ? "Selesaikan semua modul lewat jalur terverifikasi untuk membuka pengumpulan karya. Progres informal tidak membuka Project."
                  : "Daftar dan selesaikan semua modul lewat jalur terverifikasi untuk membuka pengumpulan karya."}
              </p>
            ) : (
              <div className="mt-4">
                <Link
                  href={`/belajar/${kursus.slug}/karya`}
                  className="chrome-btn chrome-btn-brand !h-11 gap-2"
                >
                  <Rocket className="size-4" aria-hidden="true" /> Kerjakan project
                </Link>
              </div>
            )}
          </div>
        </section>

        {terkait.length > 0 ? (
          <section aria-labelledby="judul-terkait">
            <h2 id="judul-terkait" className="mb-1 text-xl font-bold tracking-tight text-gray-900">
              Kursus terkait
            </h2>
            <p className="mb-4 text-sm text-gray-600">
              Karena kamu melihat kursus ini.
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {terkait.map((item) => (
                <Link
                  key={item.slug}
                  href={`/belajar/${item.slug}`}
                  className="rounded-xl border border-gray-200 bg-white p-4 transition-shadow hover:shadow-[0_2px_12px_rgba(0,0,0,0.08)]"
                >
                  <p className="flex items-center gap-2 text-xs text-gray-500">
                    <span
                      aria-hidden="true"
                      className="inline-flex size-5 items-center justify-center rounded-sm bg-[#0056D2] text-[10px] font-bold text-white"
                    >
                      {item.provider.charAt(0)}
                    </span>
                    <span className="truncate">{item.provider}</span>
                  </p>
                  <h3 className="mt-1.5 line-clamp-2 min-h-10 text-sm font-semibold text-gray-900">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-xs text-gray-500">
                    {levelLabel(item.level)} ·{" "}
                    {item.duration_min} mnt · {item.is_free ? "Gratis" : "Plus"}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
