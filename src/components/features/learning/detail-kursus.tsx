"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ModulKursus } from "@/lib/courses/kurikulum";
import { hitungProgres, irisModulSelesai } from "@/lib/courses/kurikulum";
import { daftarKursusAction, tandaiModulAction } from "@/actions/enrollment";
import { MateriView } from "./materi-view";
import { HalamanView } from "./halaman-view";
import {
  CourseSessionGate,
  CourseSessionIndicator,
  CourseSessionProvider,
  useCourseSession,
} from "./course-session";
import type { KebijakanCourse, TipeMateri } from "@/types/course";

const LABEL_TIPE: Record<TipeMateri, string> = {
  video: "Video",
  pdf: "PDF",
  kuis: "Kuis",
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
}: {
  kursus: DetailKursusData;
  modul: ModulKursus[];
  terdaftar: boolean;
  selesaiAwal: string[];
  terkait: KursusTerkait[];
  tugas: TugasTerkait | null;
  kebijakan: KebijakanCourse;
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
}: {
  kursus: DetailKursusData;
  modul: ModulKursus[];
  terdaftar: boolean;
  selesaiAwal: string[];
  terkait: KursusTerkait[];
  tugas: TugasTerkait | null;
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
  const { boleh } = useCourseSession();
  const keputusanLampiran = boleh("materi");
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

  const daftar = () =>
    startTransition(async () => {
      const hasil = await daftarKursusAction(kursus.id);
      setPesan(hasil.message ?? hasil.error ?? null);
      setButuhPlus(hasil.butuhPlus === true);
      if (hasil.ok) setSudahDaftar(true);
    });

  const tandai = (modulId: string, sudah: boolean) =>
    startTransition(async () => {
      setModulSibuk(modulId);
      setSelesai((daftar) =>
        sudah ? daftar.filter((id) => id !== modulId) : [...daftar, modulId],
      );
      const hasil = await tandaiModulAction(kursus.id, modulId);
      setModulSibuk(null);
      if (!hasil.ok) {
        setSelesai((daftar) =>
          sudah ? [...daftar, modulId] : daftar.filter((id) => id !== modulId),
        );
        setPesan(hasil.error ?? null);
      }
    });

  return (
    <div className="min-w-0 overflow-x-clip bg-white">
      <div className="bg-[#f5f7fa]">
        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <nav aria-label="Breadcrumb" className="text-sm text-gray-500">
            <Link href="/belajar" className="hover:text-[#0056D2] hover:underline">
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
              ["Level", kursus.level === "dasar" ? "Pemula" : kursus.level === "menengah" ? "Menengah" : "Lanjutan"],
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
          <section id="kurikulum" aria-labelledby="judul-kurikulum" className="min-w-0 scroll-mt-24">
            <h2 id="judul-kurikulum" className="mb-1 text-xl font-bold tracking-tight text-gray-900">
              Kurikulum
            </h2>
            <p className="mb-4 text-sm text-gray-600">
              {modul.length} modul · {kursus.duration_min} menit total
              {jumlahHalaman > 0 ? ` · ${jumlahHalaman} halaman` : ""}
              {terdaftar ? "" : " · daftar untuk menyimpan progres"}
            </p>
            <div className="mb-4">
              <CourseSessionIndicator />
            </div>
            <ol className="space-y-3">
              {modul.map((m, index) => {
                const sudah = selesai.includes(m.id);
                const daftarMateri = m.materi ?? [];
                const daftarHalaman = [...(m.halaman ?? [])].sort((a, b) => a.urutan - b.urutan);
                const punyaIsi = daftarMateri.length > 0 || daftarHalaman.length > 0;
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
                              className="cursor-pointer font-medium text-[#0056D2] hover:underline"
                            >
                              {terbuka ? "Tutup materi" : "Buka materi"}
                            </button>
                          ) : (
                            <a
                              href={m.url}
                              target="_blank"
                              rel="noreferrer"
                              className="font-medium text-[#0056D2] hover:underline"
                            >
                              Buka materi ↗
                            </a>
                          )}
                        </p>
                      </div>
                      {sudahDaftar ? (
                        <button
                          type="button"
                          onClick={() => tandai(m.id, sudah)}
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

          <aside aria-label="Pendaftaran" className="lg:sticky lg:top-24 lg:self-start">
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
                className="mt-3 block text-center text-sm font-medium text-[#0056D2] hover:underline"
              >
                Buka materi eksternal ↗
              </a>
            </div>
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
                    {item.level === "dasar" ? "Pemula" : item.level === "menengah" ? "Menengah" : "Lanjutan"} ·{" "}
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
