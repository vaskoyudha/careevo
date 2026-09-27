"use client";

import Link from "next/link";
import { Award, Lock, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Status kotak sertifikat di halaman course.
 *
 * - `terbit` — kredensial benar-benar ada di database (token publiknya
 *   terbaca). Ini yang membuat kotak menampilkan tautan `/verify/<token>`.
 * - `terkunci` — course belum punya completion `terverifikasi`.
 * - `siap` — completion terverifikasi sudah ada, tapi karya belum diputuskan
 *   verifikator, jadi belum ada credential.
 */
export type StatusSertifikat = "terbit" | "terkunci" | "siap";

/**
 * Turunkan status kotak dari dua fakta server.
 *
 * `terbit` diperiksa **lebih dulu** dan menang atas `terkunci`: credential yang
 * sudah ada adalah fakta, sedangkan `terkunci` cuma turunan dari completion yang
 * masih bisa berubah. Urutan lain membuat kredensial yang benar-benar terbit
 * tetap tampil terkunci.
 */
export function statusSertifikat(masuk: {
  terkunci: boolean;
  token: string | null;
}): StatusSertifikat {
  if (masuk.token) return "terbit";
  return masuk.terkunci ? "terkunci" : "siap";
}

/** Label status untuk chip dan `aria` — satu sumber, bukan tiap tempat menulis sendiri. */
const LABEL_STATUS: Record<StatusSertifikat, string> = {
  terbit: "Terbit",
  terkunci: "Terkunci",
  siap: "Menunggu karya",
};

/**
 * Kotak sertifikat di kolom kanan halaman course, di atas kotak pendaftaran.
 *
 * Sengaja **dua kondisi sumber** dengan pemisahan jelas:
 *
 * - `terkunci` datang dari **server** (`kelayakanKursusSubmission`), sama
 *   seperti blok Project. 100% modul yang selesai lewat jalur informal tetap
 *   tidak membuka sertifikat.
 * - `progres` datang dari state modul di klien, jadi bar(is)nya bergerak saat
 *   peserta menandai modul — tanpa menunggu reload. Angka ini tetap turunan
 *   `irisModulSelesai` + `hitungProgres`, bukan hitungan terpisah.
 *
 * Teks yang ditampilkan **tidak** menjanjikan "selesai = sertifikat terbit":
 * yang benar adalah completion terverifikasi membuka pengumpulan karya, lalu
 * badge terbit setelah review verifikator. Karena itu ada state `siap` yang
 * hanya mengarahkan ke pengumpulan karya, dan `terbit` yang baru menampilkan
 * tautan verifikasi.
 */
export function SertifikatPanel({
  judul,
  provider,
  slug,
  terdaftar,
  terkunci,
  token,
  progres,
  selesai,
  total,
}: {
  /** Judul course — dipakai di pratinjau sertifikat, persis seperti yang akan ditandatangani. */
  judul: string;
  provider: string;
  slug: string;
  /** Peserta sudah terdaftar? Tanpa ini kotak menampilkan progres 0% yang tidak pernah bergerak. */
  terdaftar: boolean;
  /** Completion terverifikasi belum ada — dihitung server. */
  terkunci: boolean;
  /** Token publik credential yang sudah terbit, atau `null`. */
  token: string | null;
  /** 0–100, sudah dibulatkan dan dijepit. */
  progres: number;
  /** Modul selesai yang id-nya masih valid. */
  selesai: number;
  /** Jumlah modul kurikulum saat ini. */
  total: number;
}) {
  const status = statusSertifikat({ terkunci, token });
  const terkunciTampil = status === "terkunci";

  return (
    <section
      aria-labelledby="judul-sertifikat"
      className="rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.08)]"
    >
      <div className="flex items-start justify-between gap-3">
        <h2
          id="judul-sertifikat"
          className="flex items-center gap-2 text-sm font-bold tracking-tight text-gray-900"
        >
          <Award className="size-4 text-[#0056D2]" aria-hidden="true" />
          Sertifikat course
        </h2>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
            status === "terbit" && "border-emerald-300 bg-emerald-50 text-emerald-700",
            status === "siap" && "border-blue-200 bg-blue-50 text-blue-700",
            terkunciTampil && "border-gray-300 bg-gray-100 text-gray-600",
          )}
        >
          {terkunciTampil ? <Lock className="size-3" aria-hidden="true" /> : null}
          {LABEL_STATUS[status]}
        </span>
      </div>

      {/* Pratinjau sertifikat. `aria-hidden` saat terkunci: yang diburam hanya
          hiasan, dan blur tidak pernah jadi satu-satunya sumber informasi —
          penjelasan nyata ada di teks bawahnya. */}
      <div className="relative mt-3 overflow-hidden rounded-xl border border-gray-200 bg-gradient-to-b from-blue-50 to-white p-3.5">
        <div
          aria-hidden={terkunciTampil}
          className={cn("space-y-1.5", terkunciTampil && "select-none blur-[5px]")}
        >
          <p className="text-[10px] font-semibold tracking-[0.18em] text-blue-700 uppercase">
            Sertifikat penyelesaian
          </p>
          <p className="line-clamp-2 text-sm leading-snug font-bold text-gray-900">{judul}</p>
          <p className="truncate text-[11px] text-gray-600">{provider}</p>
          <p className="flex items-center gap-1.5 pt-1 text-[10px] font-semibold tracking-wide text-emerald-700 uppercase">
            <ShieldCheck className="size-3" aria-hidden="true" />
            Ditandatangani Careevo
          </p>
        </div>
        {terkunciTampil ? (
          <div className="absolute inset-0 grid place-items-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-900/85 px-3 py-1.5 text-xs font-semibold text-white">
              <Lock className="size-3.5" aria-hidden="true" />
              Selesaikan course dulu
            </span>
          </div>
        ) : null}
      </div>

      {terkunciTampil ? (
        <>
          <div className="mt-3 flex items-baseline justify-between gap-2">
            <p className="text-xs font-semibold text-gray-700">Menuju sertifikat</p>
            <p className="text-xs font-bold text-gray-900">{progres}%</p>
          </div>
          <div
            role="progressbar"
            aria-label={`Progres menuju sertifikat ${progres} persen`}
            aria-valuenow={progres}
            aria-valuemin={0}
            aria-valuemax={100}
            className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-200"
          >
            <div
              className="h-full rounded-full bg-[#0056D2]"
              style={{ width: `${progres}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-gray-500">
            {terdaftar
              ? `${selesai} dari ${total} modul selesai`
              : `Daftar dulu untuk mulai · ${total} modul`}
          </p>
        </>
      ) : null}

      <p className="mt-3 text-xs leading-relaxed text-gray-600">
        {status === "terbit"
          ? "Sertifikat sudah terbit dan bisa dibuka siapa pun lewat tautan verifikasi publik."
          : status === "siap"
            ? "Course selesai terverifikasi. Ajukan karya sekarang — sertifikat terbit setelah direview verifikator."
            : terdaftar
              ? `Selesaikan ${total} modul lewat jalur terverifikasi, lalu ajukan karya untuk mendapat sertifikat.`
              : "Daftar dan selesaikan seluruh modul lewat jalur terverifikasi untuk membuka pengumpulan karya."}
      </p>

      {status === "terbit" && token ? (
        <Link
          href={`/verify/${token}`}
          className="mt-3 block rounded-full bg-[#0056D2] px-4 py-2 text-center text-sm font-semibold text-white hover:bg-[#00419e]"
        >
          Lihat sertifikat terverifikasi
        </Link>
      ) : null}
      {status === "siap" ? (
        <Link
          href={`/belajar/${slug}/karya`}
          className="mt-3 block rounded-full border border-[#0056D2] px-4 py-2 text-center text-sm font-semibold text-[#0056D2] hover:bg-blue-50"
        >
          Ajukan karya
        </Link>
      ) : null}
    </section>
  );
}
