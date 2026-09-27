"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckIcon, Reveal } from "../primitives";
import {
  HARGA,
  rupiah,
  perBulanTahunan,
  hematTahunanPersen,
} from "@/lib/pricing";

type Siklus = "bulanan" | "semester" | "tahunan";

const PLUS_FEATURES = [
  "Akses semua kursus & challenge tanpa batas",
  "Socrates AI penuh untuk bimbingan latihan",
  "Sertifikat HMAC yang bisa diverifikasi publik",
  "Riwayat submission lengkap untuk portofolio",
];

const PRO_FEATURES = [
  "Semua yang ada di Careevo Plus",
  "AI Fit Score terperinci untuk tiap lowongan",
  "Simulasi interview teknis",
  "Penutup skill gap otomatis dari loker incaran",
];

const TEAMS_FEATURES = [
  "Semua yang ada di Careevo Pro",
  "Analitik dan laporan benchmark tim",
  "Pembuat program bertenaga AI",
  "Invoice dan tagihan kuartalan",
];

function hargaSiklus(siklus: Siklus, bulanan: number, semester: number, tahunan: number) {
  if (siklus === "semester") {
    return { utama: rupiah(semester), catatan: "per 6 bulan" };
  }
  if (siklus === "tahunan") {
    return { utama: rupiah(tahunan), catatan: "per tahun" };
  }
  return { utama: rupiah(bulanan), catatan: "per bulan" };
}

/**
 * "Temukan paket yang tepat untuk targetmu" — 3-kolom: Plus (disorot),
 * Pro, dan Teams. Kolom Plus membawa toggle siklus penagihan dan CTA utama.
 */
export function CareevoPlusPlans() {
  const [siklus, setSiklus] = useState<Siklus>("bulanan");

  const plus = hargaSiklus(siklus, HARGA.plusBulanan, HARGA.plusSemester, HARGA.plusTahunan);
  const pro = hargaSiklus(siklus, HARGA.proBulanan, HARGA.proSemester, HARGA.proTahunan);

  return (
    <section id="paket" className="bg-white py-16 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 lg:px-6">
        <Reveal>
          <h2 className="mx-auto mb-12 max-w-2xl text-center text-3xl font-medium -tracking-[1.9px] text-gray-900 lg:text-5xl">
            Temukan paket yang tepat untuk targetmu
          </h2>
        </Reveal>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Careevo Plus — highlighted */}
          <Reveal delay={80}>
            <div className="relative flex h-full flex-col rounded-2xl border border-gray-100 bg-white p-6 ring-2 ring-blue-400">
              <span className="absolute top-6 right-6 inline-flex h-6 items-center rounded-full bg-linear-to-br from-blue-50 to-white px-2 py-1 text-xs font-medium text-blue-500 shadow-inner shadow-blue-200/50">
                Nilai terbaik
              </span>
              <h3 className="mb-2 text-2xl font-medium text-gray-900">
                Careevo Plus
              </h3>
              <p className="mb-6 text-base text-gray-500">
                Kuasai berbagai keahlian dan raih kredensial tanpa batas
              </p>

              <p className="mb-3 text-sm font-medium text-gray-700">
                Pilih siklus penagihan
              </p>
              <div className="mb-5 inline-flex rounded-full bg-gray-200 p-1">
                {(
                  [
                    ["bulanan", "Bulanan"],
                    ["semester", "6 Bulan"],
                    ["tahunan", "Tahunan"],
                  ] as const
                ).map(([nilai, label]) => (
                  <button
                    key={nilai}
                    type="button"
                    onClick={() => setSiklus(nilai)}
                    className={`relative z-10 cursor-pointer rounded-full px-3 py-1.5 text-sm font-medium transition-colors duration-300 ease-in-out ${
                      siklus === nilai ? "text-gray-900" : "text-gray-500"
                    }`}
                  >
                    {label}
                    {siklus === nilai ? (
                      <span className="absolute inset-0 -z-10 rounded-full bg-white shadow-sm" />
                    ) : null}
                  </button>
                ))}
              </div>

              {siklus === "tahunan" ? (
                <span className="mb-3 inline-flex w-fit items-center rounded-full bg-green-500/10 px-2 py-1 font-mono text-xs text-green-600">
                  Hemat {hematTahunanPersen(HARGA.plusBulanan, HARGA.plusTahunan)}% · 2 bulan gratis
                </span>
              ) : siklus === "semester" ? (
                <span className="mb-3 inline-flex w-fit items-center rounded-full bg-blue-500/10 px-2 py-1 font-mono text-xs text-blue-600">
                  Setara {perBulanTahunan(HARGA.plusSemester)}/bulan
                </span>
              ) : null}

              <p className="mb-1 flex items-end gap-2">
                <span className="text-3xl font-medium text-gray-900">
                  {plus.utama}
                </span>
                <span className="text-base text-gray-500">{plus.catatan}</span>
              </p>

              <p className="mb-7 text-sm text-gray-400">
                Batalkan kapan saja
              </p>
              <Link
                href="/daftar"
                className="grad-btn mb-7 inline-block w-full rounded-lg px-4 py-2.5 text-center text-base font-medium transition duration-300 ease-in-out"
              >
                Mulai sekarang
              </Link>
              <p className="mb-4 text-sm font-semibold text-gray-900">
                Fitur utama:
              </p>
              <ul className="space-y-4">
                {PLUS_FEATURES.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2.5 text-sm text-gray-700"
                  >
                    <CheckIcon className="mt-0.5" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          {/* Pro */}
          <Reveal>
            <div className="flex h-full flex-col rounded-2xl border border-gray-100 bg-white p-6">
              <h3 className="mb-2 text-2xl font-medium text-gray-900">
                Careevo Pro
              </h3>
              <p className="mb-6 text-base text-gray-500">
                Untuk karier yang lebih serius, dari latihan sampai interview
              </p>
              <p className="mb-3 text-sm font-medium text-gray-700">
                Siklus penagihan mengikuti pilihan di Plus
              </p>
              <p className="mb-1 flex items-end gap-2">
                <span className="text-3xl font-medium text-gray-900">
                  {pro.utama}
                </span>
                <span className="text-base text-gray-500">{pro.catatan}</span>
              </p>
              <p className="mb-7 text-sm text-gray-400">
                Batalkan kapan saja
              </p>
              <Link
                href="/daftar"
                className="mb-7 inline-block w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-center text-base font-medium text-gray-800 transition-colors duration-300 ease-in-out hover:bg-gray-100"
              >
                Pilih Pro
              </Link>
              <p className="mb-4 text-sm font-semibold text-gray-900">
                Fitur utama:
              </p>
              <ul className="space-y-4">
                {PRO_FEATURES.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2.5 text-sm text-gray-700"
                  >
                    <CheckIcon className="mt-0.5" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          {/* Teams */}
          <Reveal delay={160}>
            <div className="flex h-full flex-col rounded-2xl border border-gray-100 bg-white p-6">
              <h3 className="mb-2 text-2xl font-medium text-gray-900">
                Careevo for Teams
              </h3>
              <p className="mb-6 text-base text-gray-500">
                Tingkatkan keahlian seluruh tim, minimum 5 kursi
              </p>
              <p className="mb-1 flex items-end gap-2">
                <span className="text-3xl font-medium text-gray-900">
                  {rupiah(HARGA.teamsPerKursiBulanan)}
                </span>
                <span className="text-base text-gray-500">/kursi/bulan</span>
              </p>
              <p className="mb-7 text-sm text-gray-400">
                Ditagih tahunan · diskon volume tersedia
              </p>
              <Link
                href="/business"
                className="mb-7 inline-block w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-center text-base font-medium text-gray-800 transition-colors duration-300 ease-in-out hover:bg-gray-100"
              >
                Minta penawaran
              </Link>
              <p className="mb-4 text-sm font-semibold text-gray-900">
                Fitur utama:
              </p>
              <ul className="space-y-4">
                {TEAMS_FEATURES.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2.5 text-sm text-gray-700"
                  >
                    <CheckIcon className="mt-0.5" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>

        <p className="mx-auto mt-10 max-w-2xl text-center text-xs leading-relaxed text-gray-400">
          Semua harga dalam Rupiah dan belum termasuk PPN. Tahunan setara{" "}
          {perBulanTahunan(HARGA.plusTahunan)}/bulan untuk Plus. Beli satu
          kursus premium juga bisa, mulai {rupiah(HARGA.kursusTunggal)}.
        </p>
      </div>
    </section>
  );
}
