"use client";

import { useState, useTransition, useRef } from "react";
import Link from "next/link";
import { Lock, Rocket } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ModulKursus } from "@/lib/courses/kurikulum";
import { levelLabel } from "@/lib/onboarding/types";
import { hitungProgres, irisModulSelesai } from "@/lib/courses/kurikulum";
import { checkpointEfektif, checkpointTerverifikasi, wajibSesiTerverifikasi } from "@/lib/learning/akses";
import { daftarKursusAction, tandaiModulAction } from "@/actions/enrollment";
import { selesaikanMateriAction } from "@/actions/learning";
import { MateriView } from "./materi-view";
import { HalamanView } from "./halaman-view";
import {
  CourseSessionGate,
  CourseSessionIndicator,
  CourseSessionPrompt,
  CourseSessionProvider,
  useCourseSession,
} from "./course-session";
import { KejadianPanel } from "./kejadian-panel";
import { KuisView } from "./kuis-view";
import { KursusAiPanel } from "./kursus-ai-panel";
import { KursusSubNav } from "./kursus-subnav";
import { SertifikatPanel } from "./sertifikat-panel";
import type { KebijakanCourse, TipeMateri } from "@/types/course";

const LABEL_TIPE: Record<TipeMateri, string> = {
  video: "Video",
  pdf: "PDF",
};

export interface KursusTerkait {
  slug: string;
  title: string;
  provider: string;
  level: string;
  duration_min: number;
  is_free: boolean;
}

export interface TugasTerkait {
  id: string;
  title: string;
  brief: string;
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
}) {
  return (
    <CourseSessionProvider courseId={kursus.id} kebijakan={kebijakan}>
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
}) {
  const [selesai, setSelesai] = useState<string[]>(() =>
    irisModulSelesai(selesaiAwal, modul),
  );
  const [sudahDaftar, setSudahDaftar] = useState(terdaftar);
  const [pesan, setPesan] = useState<string | null>(null);
  const [butuhPlus, setButuhPlus] = useState(false);
  const [pending, startTransition] = useTransition();
  const [modulSibuk, setModulSibuk] = useState<string | null>(null);
  /**
   * Satu modul terbuka pada satu waktu. Hanya modul tersimpan yang punya
   * materi; modul turunan tetap menampilkan tautan eksternal seperti dulu.
   */
  const [modulTerbuka, setModulTerbuka] = useState<string | null>(null);
  /**
   * Keputusan akses kegiatan "materi" (lampiran), dihitung **saat render**.
   *
   * Sengaja tidak disimpan di state: keputusannya bergantung pada bukti sesi
   * yang bisa berubah kapan saja (sesi dimulai/diakhiri). Menyalinnya ke state
   * berarti gerbang bisa tertinggal menutup lampiran yang sudah sah dan
   * sebaliknya — dan menyinkronkannya lewat effect malah menambah render
   * berantai. `boleh` sendiri dimemo oleh provider.
   */
  const { boleh, kebijakan, bukti } = useCourseSession();
  const keputusanLampiran = boleh("materi");
  /**
   * Keputusan untuk kuis — mesin yang sama, jenis kegiatan berbeda.
   *
   * Kuis adalah asesmen, jadi ia ikut digerbangi seperti lampiran. Tanpa ini
   * peserta bisa mengerjakan asesmen course `wajib` tanpa satu pun sesi
   * berjalan, padahal cakupan anti-curang mencakup materi, kuis, dan proyek.
   * Prosa (`halaman`) sengaja tetap bebas — membaca bukan penyelesaian.
   */
  const keputusanKuis = boleh("kuis");
  /**
   * Keputusan untuk tombol "Tanya tutor AI".
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
  const keputusanBantuan = boleh("bantuan_akademik");
  /**
   * Apakah course ini mewajibkan penyelesaian lewat sesi terverifikasi.
   *
   * Hanya sifat **kebijakan**, bukan ketersediaan bukti saat ini: `bukti` sengaja
   * tidak dibaca di sini. Kalau klien memilih jalur berdasarkan ada/tidaknya
   * bukti, jalur terverifikasi justru hanya terpilih saat bukti **tidak** ada —
   * peserta yang sudah memulai sesi dibelokkan ke penandaan informal (gerbang
   * server dilewati), dan peserta tanpa bukti dikirim ke action terverifikasi
   * dengan bukti kosong yang selalu ditolaknya, sehingga modulnya mustahil
   * diselesaikan. Karena itu klien tidak menyaring sama sekali: ia hanya
   * *merutekan* ke action yang memverifikasi, dan server yang memutuskan —
   * dengan bukti, permintaan berhasil; tanpa bukti, server menjawab
   * `PESAN_POLICY.wajib` sebagai pesan gerbang yang jelas.
   *
   * Dipakai bersama `selesaikanMateriAction` supaya definisi "wajib" hanya ada
   * satu; di sini ia dipasangkan dengan `checkpointEfektif(modul).mode` untuk
   * memilih jalur per modul.
   */
  const wajibSesiMateri = wajibSesiTerverifikasi(kebijakan);
  /**
   * Halaman yang sedang dibaca di dalam modul yang terbuka.
   *
   * Disimpan sebagai state, bukan diturunkan dari URL: pager halaman berada di
   * dalam daftar modul, dan menaikkan query ke URL akan memuat ulang seluruh
   * halaman hanya untuk berpindah halaman materi.
   */
  const [halamanTerpilih, setHalamanTerpilih] = useState<string | null>(null);
  const selesaiValid = irisModulSelesai(selesai, modul);
  const progres = hitungProgres(selesaiValid.length, modul.length);
  const jumlahHalaman = modul.reduce((total, m) => total + (m.halaman?.length ?? 0), 0);
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
   * Tandai/batalkan satu modul selesai.
   *
   * Dua jalur sengaja, dipilih **saat klik** (bukan disimpan di state, supaya
   * perubahan sesi tidak membuat state basi memilih jalur yang salah):
   *
   * - Moderasi `wajib` + checkpoint `materi` → `selesaikanMateriAction`, satu-
   *   satunya jalur yang memverifikasi bukti sesi di server. Klien **tidak**
   *   memeriksa ada/tidaknya bukti sebelum memilih jalur: kalau ia menyaring,
   *   peserta yang belum memenuhi syarat justru lolos lewat jalur informal
   *   (gerbang Task 7 jadi hiasan) dan peserta yang sudah memenuhi syarat
   *   ditolak. Hasilnya ditentukan server: bukti sah → modul selesai; tanpa
   *   bukti → server menolak dengan pesan gerbangnya sendiri (`PESAN_POLICY.wajib`)
   *   dan modul tetap belum selesai. Di jalur ini tidak ada penulisan
   *   optimistis — hanya `hasil.ok` yang menambah centang.
   * - Sisanya — checkpoint `kuis`/`proyek`, kursus `opsional`, atau pembatalan
   *   (`sudah === true`) → jalur informal `tandaiModulAction`, supaya modul
   *   kuis tetap tersimpan sebagai progres informal dan kursus non-verifikasi
   *   tidak berubah perilakunya. Pembatalan tidak punya jalur terverifikasi:
   *   action itu hanya menandai selesai, jadi mengoreksi tanda harus tetap
   *   mungkin lewat jalur informal.
   *
   * Jadi jalur informal hanya untuk `opsional`, checkpoint `kuis`/`proyek`, dan
   * pembatalan; setiap penyelesaian `materi` di course `wajib` diperiksa server.
   */
  const tandai = (modul: ModulKursus, sudah: boolean) =>
    startTransition(async () => {
      // Kedua suku murni soal kebijakan/checkpoint; tidak ada pemeriksaan bukti
      // di klien. Konsekuensinya jalur informal hanya untuk `opsional`,
      // checkpoint non-`materi`, dan pembatalan — persis kontrak di atas.
      const wajibTerverifikasi = wajibSesiMateri && checkpointTerverifikasi(checkpointEfektif(modul));
      // Modul yang belum tuntas tidak bisa "dibatalkan" lewat jalur
      // terverifikasi: action itu hanya menandai selesai. Pembatalan tetap
      // informal supaya peserta masih bisa mengoreksi tandanya.
      if (!wajibTerverifikasi || sudah) {
        setModulSibuk(modul.id);
        setSelesai((daftar) =>
          sudah ? daftar.filter((id) => id !== modul.id) : [...daftar, modul.id],
        );
        const hasil = await tandaiModulAction(kursus.id, modul.id);
        setModulSibuk(null);
        if (!hasil.ok) {
          setSelesai((daftar) =>
            sudah ? [...daftar, modul.id] : daftar.filter((id) => id !== modul.id),
          );
          setPesan(hasil.error ?? null);
        }
        return;
      }

      // Jalur terverifikasi: bukti sesi dari provider diteruskan apa adanya.
      // Bukti kosong bukan alasan mengganti jalur — server yang menolak, dan
      // pesannya dipakai apa adanya; klien bukan penjaga otoritatif.
      const hasil = await selesaikanMateriAction({
        courseId: kursus.id,
        modulId: modul.id,
        bukti: bukti ?? "",
      });
      if (hasil.ok) {
        setSelesai((daftar) => [...daftar, modul.id]);
        setPesan(null);
      } else {
        setPesan(hasil.error ?? null);
      }
    });

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
        trigger={headerRef}
      />
      <div ref={headerRef} className="bg-[#f5f7fa]">
        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <nav aria-label="Breadcrumb" className="text-sm text-gray-500">
            <Link href="/belajar" className="hover:text-[#0056D2]">
              Belajar
            </Link>
            <span aria-hidden="true"> / </span>
            <span className="font-medium text-gray-900">{kursus.title}</span>
          </nav>
          <p className="mt-4 flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <span
              aria-hidden="true"
              className="inline-flex size-5 items-center justify-center rounded-sm bg-[#0056D2] text-[10px] font-bold text-white"
            >
              {kursus.provider.charAt(0)}
            </span>
            {kursus.provider}
            <span aria-hidden="true">·</span>
            <span className="capitalize">{kursus.type}</span>
          </p>
          <h1 id="judul-kursus" className="mt-2 max-w-3xl text-3xl font-bold tracking-tight text-gray-900">
            {kursus.title}
          </h1>
          <p className="mt-3 max-w-2xl leading-relaxed text-gray-600">{kursus.description}</p>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {kursus.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-[#0056D2]"
              >
                {tag}
              </span>
            ))}
          </div>
          <dl className="mt-5 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Level", levelLabel(kursus.level)],
              ["Durasi", `${kursus.duration_min} mnt`],
              ["Modul", `${modul.length} modul`],
              ...(kursus.rating !== null ? [["Rating", `★ ${kursus.rating.toFixed(2)}`] as [string, string]] : []),
            ].map(([istilah, nilai]) => (
              <div key={istilah} className="rounded-xl border border-gray-200 bg-white px-3 py-2.5">
                <dt className="text-[11px] font-medium tracking-wide text-gray-500 uppercase">{istilah}</dt>
                <dd className="mt-0.5 text-sm font-semibold text-gray-900">{nilai}</dd>
              </div>
            ))}
          </dl>
          {pesan ? (
            <p role="status" className="mt-4 max-w-2xl rounded-xl bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-800">
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
                  sesi, termasuk di kursus yang modulnya tidak punya lampiran
                  (di sanalah `CourseSessionGate` tidak pernah ikut terender). */}
              <CourseSessionPrompt />
              <CourseSessionIndicator />
              {/* Panel kejadian tepat di bawah indikator: indikator menjawab
                  "sesi saya berjalan?", panel menjawab "apa yang tercatat?".
                  Panel menyembunyikan dirinya sendiri saat tidak relevan
                  (`status !== "aktif"` dan tanpa celah). */}
              <div className="mt-3">
                <KejadianPanel />
              </div>
            </div>
            <ol className="space-y-3">
              {modul.map((m, index) => {
                const sudah = selesai.includes(m.id);
                const daftarMateri = m.materi ?? [];
                const daftarHalaman = [...(m.halaman ?? [])].sort((a, b) => a.urutan - b.urutan);
                const daftarKuis = m.kuis ?? [];
                const punyaIsi =
                  daftarMateri.length > 0 || daftarHalaman.length > 0 || daftarKuis.length > 0;
                const terbuka = modulTerbuka === m.id;
                // Halaman yang sedang ditampilkan di dalam modul ini. Berbeda
                // dari `modulTerbuka`, ini berpindah tanpa menutup modul supaya
                // pembaca tidak kehilangan tempatnya saat menekan "Berikutnya".
                const halamanAktif =
                  daftarHalaman.find((h) => h.id === halamanTerpilih) ?? daftarHalaman[0] ?? null;
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
                          {punyaIsi ? (
                            <button
                              type="button"
                              onClick={() => {
                                // Modul selalu boleh dibuka: halaman berformatnya
                                // bebas dibaca. Yang digerbang hanya lampiran,
                                // dan itu diputuskan `keputusanLampiran` di
                                // bagian render — supaya sesi yang baru dimulai
                                // langsung membuka lampiran tanpa state basi.
                                setModulTerbuka(terbuka ? null : m.id);
                              }}
                              aria-expanded={terbuka}
                              className="cursor-pointer font-medium text-[#0056D2]"
                            >
                              {terbuka ? "Tutup materi" : "Buka materi"}
                            </button>
                          ) : (
                            <a
                              href={m.url}
                              target="_blank"
                              rel="noreferrer"
                              className="font-medium text-[#0056D2]"
                            >
                              Buka materi ↗
                            </a>
                          )}
                        </p>
                      </div>
                      {sudahDaftar ? (
                        <button
                          type="button"
                          onClick={() => tandai(m, sudah)}
                          disabled={pending || modulSibuk === m.id}
                          aria-pressed={sudah}
                          className={cn(
                            "shrink-0 cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold disabled:opacity-60",
                            sudah
                              ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                              : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50",
                          )}
                        >
                          {sudah ? "Selesai" : "Tandai selesai"}
                        </button>
                      ) : null}
                    </div>

                    {terbuka && punyaIsi ? (
                      <div className="space-y-4 border-t border-gray-100 px-4 py-4">
                        {halamanAktif ? (
                          <HalamanView
                            modul={m}
                            halaman={halamanAktif}
                            onPindahHalaman={setHalamanTerpilih}
                          />
                        ) : null}

                        {daftarKuis.length > 0 ? (
                          <div className="space-y-3">
                            <p className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                              Kuis
                            </p>
                            {/* Gerbang yang sama dengan lampiran: soal tidak
                                dirender sebelum sesi terverifikasi tersedia.
                                Pesan diambil apa adanya dari `putuskanAkses`
                                supaya copy tidak menyimpang dari mesin akses. */}
                            {keputusanKuis.tipe === "bebas" ? (
                              daftarKuis.map((kuis) => (
                                <KuisView
                                  key={kuis.id}
                                  kuis={kuis}
                                  konteks={{ courseId: kursus.id, modulId: m.id }}
                                />
                              ))
                            ) : (
                              <CourseSessionGate pesan={keputusanKuis.pesan} />
                            )}
                          </div>
                        ) : null}

                        {daftarMateri.length > 0 ? (
                          <div className="space-y-3">
                            <p className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                              Lampiran
                            </p>
                            {keputusanLampiran.tipe === "bebas" ? (
                              daftarMateri.map((materi) => (
                                <div key={materi.id}>
                                  <p className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-gray-700">
                                    <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-[#0056D2] uppercase">
                                      {LABEL_TIPE[materi.tipe]}
                                    </span>
                                    {materi.judul}
                                  </p>
                                  <MateriView materi={materi} />
                                </div>
                              ))
                            ) : (
                              <CourseSessionGate pesan={keputusanLampiran.pesan} />
                            )}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
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
                  <a
                    href="#kurikulum"
                    className="mt-4 block rounded-full bg-gray-900 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-gray-700"
                  >
                    {progres === 100 ? "Ulas kembali modul" : "Lanjutkan belajar"}
                  </a>
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
          <section aria-labelledby="judul-praktik" className="rounded-2xl bg-gradient-to-br from-blue-800 to-blue-500 px-6 py-8 text-white lg:px-10">
            <h2 id="judul-praktik" className="text-xl font-bold tracking-tight text-white">
              Uji pemahaman lewat challenge praktik
            </h2>
            <p className="mt-1 max-w-xl text-sm text-white/85">{tugas.brief}</p>
            <Link
              href={`/challenge/${tugas.id}`}
              className="mt-4 inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
            >
              Kerjakan: {tugas.title}
            </Link>
          </section>
        ) : null}

        <section
          aria-labelledby="judul-proyek"
          className={cn(
            "rounded-2xl border px-6 py-8 lg:px-10",
            proyek.terkunci ? "border-gray-200 bg-white" : "border-emerald-200 bg-emerald-50/60",
          )}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 max-w-2xl">
              <p
                className={cn(
                  "text-xs font-semibold tracking-wider uppercase",
                  proyek.terkunci ? "text-gray-500" : "text-emerald-700",
                )}
              >
                Project course
              </p>
              <h2 id="judul-proyek" className="mt-1 text-xl font-bold tracking-tight text-gray-900">
                {proyek.judul}
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-gray-600">{proyek.ringkasan}</p>
            </div>
            {proyek.terkunci ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600">
                <Lock className="size-3.5" aria-hidden="true" /> Terkunci
              </span>
            ) : (
              <Link
                href={`/belajar/${kursus.slug}/karya`}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#0056D2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#00419e]"
              >
                <Rocket className="size-4" aria-hidden="true" /> Kerjakan project
              </Link>
            )}
          </div>
          {proyek.terkunci ? (
            <p className="mt-3 text-sm text-gray-500">
              {terdaftar
                ? "Selesaikan semua modul lewat sesi terverifikasi untuk membuka pengumpulan karya."
                : "Daftar dan selesaikan semua modul lewat sesi terverifikasi untuk membuka pengumpulan karya."}
            </p>
          ) : null}
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
