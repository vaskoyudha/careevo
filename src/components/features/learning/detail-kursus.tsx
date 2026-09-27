"use client";

import { useState, useTransition, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
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
import { Button } from "@/components/ui/button";
import type { ModulKursus } from "@/lib/courses/kurikulum";
import { levelLabel, tipeLabel } from "@/lib/onboarding/types";
import { hitungProgres, irisModulSelesai } from "@/lib/courses/kurikulum";
import { daftarKursusAction } from "@/actions/enrollment";
import { wajibSesiTerverifikasi } from "@/lib/learning/akses";
import {
  CourseSessionIndicator,
  CourseSessionProvider,
  useCourseSession,
} from "./course-session";
import { GerbangMulaiCourse } from "./gerbang-mulai-course";
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
  /**
   * Apakah peserta sudah punya karya untuk course ini.
   *
   * Ini yang membedakan **"boleh mulai"** dari **"sudah dikerjakan"** — dua
   * keadaan yang sebelumnya sama-sama ditampilkan hijau, sehingga tonggak yang
   * baru terbuka terbaca seolah projectnya sudah selesai. Nilainya dihitung
   * server dari `listKaryaCourse` (karya yang terikat course ini), bukan dari
   * jumlah modul selesai: mengerjakan project tidak sama dengan menyelesaikan
   * modul.
   *
   * `false` berarti **belum ada karya sama sekali**. Karya berstatus apa pun
   * (`draft` sampai `approved`) menghitungnya sebagai `true`: yang ditanyakan
   * hanyalah "sudah ada isinya atau belum", dan status rincinya milik halaman
   * Project.
   */
  adaKarya: boolean;
  /** Jumlah karya, untuk menyebut "1 karya" vs "3 karya" tanpa query kedua. */
  jumlahKarya: number;
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
        kebijakan={kebijakan}
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
  kebijakan,
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
  /** Kebijakan course — dipakai gerbang "Buka materi" untuk tahu apakah sesi wajib. */
  kebijakan: KebijakanCourse;
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
  /**
   * Modul yang sedang dituju lewat gerbang "Buka materi", atau `null`.
   *
   * Gerbangnya **satu** untuk seluruh daftar modul, bukan satu per baris: hanya
   * satu dialog yang bisa terbuka, dan menyimpan id modulnya di sini membuat
   * tujuan reader-nya jelas tanpa menyalin status "sedang membuka" ke tiap baris.
   */
  const [modulDituju, setModulDituju] = useState<string | null>(null);
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
  const { boleh, bukti } = useCourseSession();
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
              {/* Ajakan memulai sesi **tidak lagi tinggal di sini** sebagai pita.

                  Dulu ia pita amber statis di atas daftar modul — dan satu lagi
                  di kolom baca reader. Dua permukaan meminta hal yang sama, dan
                  yang di reader muncul setelah peserta sudah masuk: sudah
                  terlambat jadi gerbang, cukup awal untuk mengganggu bacaan.

                  Sekarang prasyaratnya dijaga di titik keputusannya: tombol "Buka
                  materi" membuka `GerbangMulaiCourse`, yang menjalankan langkah
                  yang belum beres (daftar, lalu sesi) sebelum mengantar masuk.

                  `CourseSessionIndicator` **tetap** di sini: ia bukan ajakan,
                  melainkan keterangan bahwa sesi sedang berjalan — informasi yang
                  memang milik halaman ini. */}
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
                          <button
                            type="button"
                            onClick={() => setModulDituju(m.id)}
                            className="chrome-btn chrome-btn-brand !h-11 cursor-pointer"
                          >
                            Buka materi
                          </button>
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

              {/*
                Ruang kerja sebagai **tonggak terakhir silabus**, bukan tautan
                tersembunyi.

              Sebelum ini ruang kerja hanya bisa dicapai lewat URL atau lewat
              halaman Project, sehingga dari silabus — tempat peserta melihat
              "apa yang harus saya kerjakan" — ia tidak terlihat sama sekali.
              Fitur yang tidak bisa ditemukan sama saja belum ada.

              Gerbangnya `proyek.terkunci`, **nilai server yang sama** dengan
              panel Project di bawah dan dengan `/api/workspace`: satu
              `kelayakanKursusSubmission`, bukan aturan yang disalin. Karena itu
              peserta yang silabusnya masih menampilkan tonggak terkunci tidak
              bisa menemukan jalan masuk lewat halaman ini.

              Ditaruh **di dalam** `<ol>` sebagai `<li>` terakhir dengan sengaja:
              ia memang langkah kurikulum, jadi penomoran dan jaraknya mengikuti
              modul di atasnya. Kartu terpisah di luar daftar akan terbaca
              sebagai promosi, bukan sebagai langkah yang harus diselesaikan.
            */}
            {/*
              Ruang kerja sebagai **tonggak terakhir silabus** — tiga keadaan.

              Keadaannya **tiga, bukan dua**, dan itu perbaikan dari versi
              pertama: dulu "boleh mulai" dan "sudah selesai" sama-sama hijau,
              sehingga tonggak yang baru terbuka terbaca seolah projectnya sudah
              selesai. Peserta yang belum mengumpulkan apa pun melihat centang
              hijau, dan itu klaim yang tidak benar.

                1. TERKUNCI   — belum ada completion terverifikasi. Abu + gembok.
                2. TERBUKA    — layak, belum ada karya. Netral/biru, "buka".
                3. DIKERJAKAN — sudah ada karya. Hijau, "lihat karya".

              Hijau sekarang **hanya** berarti "sudah ada karya", sama seperti
              hijau di baris modul di atasnya berarti "sudah selesai". Satu
              warna, satu arti — itu yang membuat daftar ini bisa dibaca.

              Gerbangnya `proyek.terkunci`, **nilai server yang sama** dengan
              panel Project di bawah dan dengan `/api/workspace`: satu
              `kelayakanKursusSubmission`, bukan aturan yang disalin. Keadaan
              ketiga datang dari `proyek.adaKarya`, juga dari server.

              Ditaruh **di dalam** `<ol>` sebagai `<li>` terakhir dengan sengaja:
              ia memang langkah kurikulum, jadi jaraknya mengikuti modul di
              atasnya. Kartu terpisah di luar daftar akan terbaca sebagai
              promosi, bukan sebagai langkah yang harus diselesaikan.
            */}
            <li
              className={cn(
                "mt-3 rounded-2xl border bg-white",
                proyek.terkunci
                  ? "border-gray-200"
                  : proyek.adaKarya
                    ? "border-emerald-200"
                    : "border-[rgba(147,197,253,0.55)]",
              )}
            >
              <div className="flex items-start gap-3 p-4">
                <span
                  aria-hidden="true"
                  className={cn(
                    // Tiga nada, tiga arti.
                    //
                    // Terkunci memakai **abu yang benar-benar terbaca**, bukan
                    // `bg-gray-100`: `gray-100` hanya 12 tingkat dari putih
                    // (243,244,246 vs 255,255,255), sehingga lingkaran kecil di
                    // atas kartu putih terbaca sebagai putih — ikonnya hilang,
                    // dan peserta tidak bisa membedakan "belum terbuka" dari
                    // "tidak ada apa-apa di sini". `gray-200` (229,231,235) plus
                    // `ring-1 ring-gray-300` memberi bentuk yang terlihat, pola
                    // yang sama dengan lencana terkunci di panel Project.
                    //
                    // Terbuka memakai `bg-white` + cincin biru, **bukan**
                    // `bg-emerald-500`: itulah yang membedakannya dari
                    // "dikerjakan". Ikonnya tetap terminal, tetapi netral.
                    "mt-0.5 grid size-7 shrink-0 place-items-center rounded-full",
                    proyek.terkunci
                      ? "bg-gray-200 text-gray-500 ring-1 ring-gray-300"
                      : proyek.adaKarya
                        ? "bg-emerald-500 text-white"
                        : "bg-white text-[#0056D2] ring-1 ring-[rgba(147,197,253,0.7)]",
                  )}
                >
                  {proyek.terkunci ? (
                    <Lock className="size-3.5" />
                  ) : proyek.adaKarya ? (
                    <Check className="size-3.5" />
                  ) : (
                    <SquareTerminal className="size-3.5" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-gray-900">Project akhir: ruang kerja</h3>
                  <p className="mt-0.5 text-sm leading-relaxed text-gray-600">
                    {proyek.terkunci
                      ? "Terbuka setelah seluruh modul di atas selesai lewat sesi terverifikasi. Di sini kamu membangun project akhirnya dengan editor dan terminal sungguhan."
                      : proyek.adaKarya
                        ? `Kamu sudah mengerjakan project ini (${proyek.jumlahKarya} karya). Buka kembali ruang kerjanya atau lanjutkan pengumpulannya.`
                        : "Editor kode lengkap untuk membangun project akhir course ini. Berkasmu tersimpan dan tetap ada saat kamu kembali."}
                  </p>
                  <p className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                    <span>editor · terminal · berkas tersimpan</span>
                  </p>
                </div>
                <div className="shrink-0 self-center">
                  {proyek.terkunci ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600">
                      <Lock className="size-3.5" aria-hidden="true" /> Terkunci
                    </span>
                  ) : (
                    // Dua tombol **ditumpuk**, bukan sebaris. Sebaris membuat
                    // keduanya berebut lebar yang sama di kolom sempit, dan
                    // label panjang ("Lanjutkan di ruang kerja") memaksa label
                    // pendek ("Lihat karya") membungkus jadi dua baris — terlihat
                    // rusak. `whitespace-nowrap` menutup sisanya: label tidak
                    // pernah dipotong di tengah kata.
                    <div className="flex shrink-0 flex-col items-stretch gap-2">
                      <Link
                        href={`/belajar/${kursus.slug}/ruang-kerja`}
                        className="chrome-btn chrome-btn-brand !h-11 whitespace-nowrap"
                      >
                        {proyek.adaKarya ? "Lanjutkan di ruang kerja" : "Buka ruang kerja"}
                      </Link>
                      {/* Tombol "Lihat karya" hanya muncul saat karyanya ada.
                          Tautannya ke halaman Project — di sanalah status
                          pengumpulan (draf/terkirim/direview) ditampilkan, dan
                          menyebut statusnya di sini berarti menyalin aturan
                          yang bisa menyimpang dari halaman itu. */}
                      {proyek.adaKarya ? (
                        // Tombol sekunder memakai komponen `Button` dengan
                        // `variant="outline"` — konvensi repo untuk aksi
                        // sekunder di atas kartu putih (lihat
                        // `jobs/evaluasi-panel.tsx`, `admin/courses/course-manager.tsx`).
                        //
                        // Dua percobaan sebelumnya salah dan keduanya terlihat:
                        // `chrome-btn` polos adalah tombol ikon 40x40px, jadi
                        // labelnya meluber jadi gumpalan putih; dan
                        // `chrome-btn-ghost` adalah kaca putih yang dirancang
                        // untuk navbar berwarna, sehingga di atas kartu putih ia
                        // menghilang dan labelnya terbaca sebagai teks biasa.
                        // `outline` memberi garis yang terlihat di permukaan
                        // putih tanpa bersaing dengan tombol utama.
                        //
                        // `asChild` + `<Link>`: tombolnya harus tetap sebuah
                        // tautan (navigasi klien, bisa dibuka di tab baru),
                        // bukan `<button>` yang menjalankan `router.push`.
                        <Button variant="outline" className="h-11 whitespace-nowrap" asChild>
                          <Link href={`/belajar/${kursus.slug}/karya`}>Lihat karya</Link>
                        </Button>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            </li>
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
                    href={`/belajar/${kursus.slug}/materi/${modulBerikutnya.id}`}
                    onClick={(e) => {
                      // Jalur masuk yang sama dengan tombol "Buka materi": kalau
                      // sesi belum dimulai, dialognya yang muncul — supaya
                      // "Lanjutkan belajar" tidak jadi pintu samping yang
                      // melewati gerbang sesi.
                      if (wajibSesiTerverifikasi(kebijakan) && !bukti) {
                        e.preventDefault();
                        setModulDituju(modulBerikutnya.id);
                      }
                    }}
                    className="brand-fill mt-4 block rounded-[var(--radius-md)] border border-[var(--brand-border)] px-4 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:border-[var(--brand-border-hover)]"
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

        {/* Gerbang "mulai belajar": satu dialog untuk seluruh daftar modul.

            Ditaruh di akhir JSX, bukan di dalam `<ol>`: hanya satu dialog yang
            bisa terbuka, dan menaruhnya di tingkat halaman membuatnya tidak ikut
            ter-render ulang per baris modul. `modulDituju` menyimpan modul mana
            yang dituju tombol "Buka materi" terakhir. */}
        <GerbangMulaiCourse
          buka={modulDituju !== null}
          onTutup={() => setModulDituju(null)}
          courseId={kursus.id}
          judulKursus={kursus.title}
          hrefTujuan={`/belajar/${kursus.slug}/materi/${modulDituju ?? ""}`}
          terdaftar={sudahDaftar}
          wajibSesi={wajibSesiTerverifikasi(kebijakan)}
          gratis={kursus.is_free}
        />

        {tugas ? (
          /*
           * Tantangan praktik — satu kontainer, isinya langsung di atas wallpaper.
           *
           * Kartu ini adalah penutup silabus: satu tugas nyata dengan standar
           * penilaiannya.
           *
           * **Arsipnya adalah gambar, bukan gradien.** Sebelum ini header-nya
           * `PitaHeaderDither` — empat lapisan (ground + dot grid + video
           * dithered WebGL + veil) untuk sebuah pita setinggi satu baris judul.
           * Sekarang satu `.webp` statis yang sudah menggambar langit, grid
           * titik, dan kartu kaca itu sendiri, jadi byte-nya jauh lebih kecil,
           * tidak ada canvas yang harus dihentikan saat offscreen, dan tidak ada
           * crop video yang harus ikut disetel ulang kalau kartu ini berubah
           * tinggi. Gambarnya dekoratif murni: `alt=""`, dan tidak ada teks di
           * dalamnya yang perlu dibaca.
           *
           * **GAMBAR MENJADI LATAR SELURUH KARTU, BUKAN SEPTAH PITA.**
           * Dulu ada dua bidang putih yang bertumpuk: pita gambar
           * `aspect-[1774/887]` di atas untuk judul, lalu lembar `bg-white` di
           * bawahnya untuk isi — kartu jadi dua benda, bukan satu.
           *
           * Sekarang `<Image fill object-cover>` adalah anak langsung
           * `<section>`, jadi ia menutupi kotak kartu **sepenuhnya**, dan
           * `<section>` tidak lagi punya `bg-white`. Isinya juga bukan lembar
           * lagi: `div` biasa yang menumpuk di atas gambar dengan
           * `relative z-10`. Dua permukaan putih lenyap bersamaan — `bg-white`
           * di `<section>` **dan** `-mt-4 rounded-t-2xl bg-white` di lembar
           * isinya.
           *
           * **`rounded-t-2xl` + `-mt-4` ikut hilang** bukan karena warnanya,
           * melainkan karena perangkat itu — lengkung yang menyingkap arsip di
           * belakangnya — hanya bermakna kalau ada arsip yang bisa disingkapi.
           * Kalau seluruh kartu sudah wallpaper, tidak ada tepi yang tersisa
           * untuk disingkapi.
           *
           * **`overflow-hidden` + `rounded-2xl` tetap ada** di `<section>`:
           * itulah yang memotong `object-cover` supaya wallpaper mengikuti radius
           * kartu dan tidak bocor ke sudut luar.
           *
           * **Tidak ada wash, tidak ada scrim.** Yang menahan keterbacaan
           * sekarang adalah file gambarnya sendiri: rata-rata luminance 239 dan
           * 71% pikselnya sudah near-white (saturasi 10%). Itu juga alasan
           * kenapa `text-white` tidak akan pernah benar di sini — putih di atas
           * ~#eef6fe hanya ~1.1:1.
           *
           * Yang tetap berpanel: blok `bg-blue-50` "Yang Dinilai". Itu bukan
           * kartu putih — ia panel yang mengelompokkan standar penilaian, dan
           * `text-gray-600` 11px di atas `bg-blue-50` hanya ~4.4:1. Menghapus
           *nya mengubah kontras, bukan dekorasi.
           */
          <section
            aria-labelledby="judul-praktik"
            className="relative overflow-hidden rounded-2xl border border-[rgba(147,197,253,0.45)] shadow-[0_1px_2px_rgba(10,61,98,0.04),0_10px_24px_-16px_rgba(10,61,98,0.18)]"
          >
            <Image
              src="/images/belajar/challenge-praktik-hero.webp"
              alt=""
              fill
              unoptimized
              sizes="(min-width: 1024px) 1024px, 100vw"
              className="object-cover"
            />

            {/* Judul menempel di ATAS kartu, bukan di tengah.

              Level dan estimasi tidak ada di sini: keduanya hilang di bawah
              `sm` kalau ditaruh di baris judul, dan informasi yang hanya muncul
              di lebar tertentu adalah informasi yang hilang separuh waktu.
              Keduanya pindah ke baris meta di badan kartu.

              Penempatan atasnya bukan selera. Kiri-atas adalah bidang paling
              terang dan paling rata di arsip ini, jadi di sanalah `#0a3d62`
              punya kontras terbesar. `items-center` akan menaruh judul melayang
              di tengah gambar, terpisah dari tepi yang dipegangnya. */}
            <div className="relative z-10 flex items-start gap-2.5 px-5 pt-5 lg:px-8 lg:pt-6">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/85 text-[#0a3d62] shadow-[0_1px_2px_rgba(10,61,98,0.08)] ring-1 ring-white/70">
                <SquareTerminal aria-hidden className="size-4" />
              </span>
              <h2
                id="judul-praktik"
                className="truncate text-[14.5px] font-bold tracking-tight text-[#0a3d62]"
              >
                Challenge praktik
              </h2>
            </div>

            <div className="relative z-10 px-5 pt-8 pb-6 lg:px-8 lg:pb-7">
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

                  {/* Standar penilaian: satu blok, bukan empat baris lepas.
                      `text-gray-600` untuk eyebrow, bukan `text-gray-500`:
                      di atas `bg-blue-50` yang sedikit lebih gelap dari putih,
                      `#6b7280` turun ke ~4.4:1 dan gagal AA untuk teks 11px. */}
                  <div className="mt-5 rounded-xl bg-blue-50 p-4 ring-1 ring-blue-100">
                    <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.14em] text-gray-600 uppercase">
                      <ListChecks aria-hidden className="size-3.5 text-[#0056D2]" />
                      Yang dinilai
                    </p>
                    <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
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
