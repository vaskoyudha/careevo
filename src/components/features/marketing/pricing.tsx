"use client";

import { useState } from "react";
import { CheckIcon, CheckMutedIcon, Reveal } from "./primitives";
import { HARGA, rupiah, perBulanTahunan, hematTahunanPersen } from "@/lib/pricing";

type Plan = {
  badge: string;
  note: string;
  monthly: string;
  annual: string;
  annualNote?: string;
  features: { text: string; included: boolean }[];
  cta: string;
  popular?: boolean;
  href: string;
};

const PLANS: Plan[] = [
  {
    badge: "Gratis",
    note: "Buat coba-coba dulu",
    monthly: rupiah(HARGA.gratis),
    annual: rupiah(HARGA.gratis),
    features: [
      { text: "Papan loker terverifikasi tanpa batas", included: true },
      { text: "Socrates AI 3 challenge per bulan", included: true },
      { text: "Rekam jejak kerja tersimpan", included: true },
      { text: "Sertifikat yang bisa dibuka publik", included: true },
      { text: "Analitik lanjutan", included: false },
    ],
    cta: "Mulai gratis",
    href: "/daftar",
  },
  {
    badge: "Careevo Plus",
    note: "Kalau kamu serius nyari kerja",
    monthly: rupiah(HARGA.plusBulanan),
    annual: rupiah(HARGA.plusTahunan),
    annualNote: `${rupiah(HARGA.plusTahunan)}/tahun · hemat ${hematTahunanPersen(HARGA.plusBulanan, HARGA.plusTahunan)}%`,
    features: [
      { text: "Semua kursus & challenge tanpa batas", included: true },
      { text: "Socrates AI penuh + rekomendasi latihan", included: true },
      { text: "Riwayat submission lengkap", included: true },
      { text: "Sertifikat HMAC yang bisa diverifikasi", included: true },
    ],
    cta: "Pilih Plus",
    href: "/careevo-plus#paket",
    popular: true,
  },
  {
    badge: "Careevo Pro",
    note: "Untuk karier yang lebih serius",
    monthly: rupiah(HARGA.proBulanan),
    annual: rupiah(HARGA.proTahunan),
    annualNote: `${rupiah(HARGA.proTahunan)}/tahun · hemat ${hematTahunanPersen(HARGA.proBulanan, HARGA.proTahunan)}%`,
    features: [
      { text: "Semua fitur Careevo Plus", included: true },
      { text: "AI Fit Score terperinci per lowongan", included: true },
      { text: "Simulasi interview teknis", included: true },
      { text: "Penutup skill gap otomatis", included: true },
      { text: "Dukungan prioritas", included: true },
    ],
    cta: "Pilih Pro",
    href: "/careevo-plus#paket",
  },
  {
    badge: "Teams",
    note: "Untuk tim dan perusahaan",
    monthly: `${rupiah(HARGA.teamsPerKursiBulanan)}/kursi`,
    annual: "Hubungi kami",
    features: [
      { text: "Semua fitur Careevo Pro", included: true },
      { text: "Analitik & laporan benchmark tim", included: true },
      { text: "Pembuat program bertenaga AI", included: true },
      { text: "Invoice & tagihan kuartalan", included: true },
      { text: "Onboarding khusus", included: true },
    ],
    cta: "Hubungi kami",
    href: "/business",
  },
];

export function MarketingPricing() {
  const [annual, setAnnual] = useState(false);

  return (
    <section id="harga" className="bg-white py-28">
      <div className="mx-auto max-w-7xl px-4 lg:px-6">
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <Reveal>
            <h2 className="mb-4 text-6xl font-medium -tracking-[1.9px] text-gray-900">
              Sederhana dan fleksibel
            </h2>
          </Reveal>
          <Reveal delay={80}>
            <p className="mb-9 text-base text-gray-500">
              Mulai dari nol, naik kelas kalau butuh. Nggak ada yang
              dipaksa dulu.
            </p>
          </Reveal>
          <Reveal delay={140}>
            <div className="relative inline-flex rounded-full bg-gray-200 p-1">
              <button
                type="button"
                onClick={() => setAnnual(false)}
                className={`relative z-10 cursor-pointer rounded-full px-3 py-2 text-sm font-medium transition-colors duration-300 ease-in-out ${
                  annual ? "text-gray-500" : "text-gray-900"
                }`}
              >
                Bulanan
                {!annual ? (
                  <span className="absolute inset-0 -z-10 rounded-full bg-white shadow-sm" />
                ) : null}
              </button>
              <button
                type="button"
                onClick={() => setAnnual(true)}
                className={`relative z-10 cursor-pointer rounded-full px-3 py-2 text-sm font-medium transition-colors duration-300 ease-in-out ${
                  annual ? "text-gray-900" : "text-gray-500"
                }`}
              >
                Tahunan{" "}
                <span className="rounded-full bg-green-500/10 px-2 py-1 font-mono text-sm text-green-600">
                  2 bulan gratis
                </span>
                {annual ? (
                  <span className="absolute inset-0 -z-10 rounded-full bg-white shadow-sm" />
                ) : null}
              </button>
            </div>
          </Reveal>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {PLANS.map((plan, index) => (
            <Reveal key={plan.badge} delay={index * 60}>
              <div
                className={`h-full rounded-2xl border border-gray-100 bg-white p-5 ${
                  plan.popular ? "relative ring-2 ring-blue-400" : ""
                }`}
              >
                {plan.popular ? (
                  <span className="absolute top-5 right-5 inline-flex h-6 items-center rounded-full bg-linear-to-br from-blue-50 to-white px-2 py-1 text-xs font-medium text-blue-500 shadow-inner shadow-blue-200/50">
                    Populer
                  </span>
                ) : null}

                <span className="mb-3 inline-flex h-6 items-center rounded-full bg-gray-100 px-2 py-1 text-sm font-medium text-gray-800">
                  {plan.badge}
                </span>
                <p className="mb-8 font-mono text-sm text-gray-900">{plan.note}</p>
                <h3 className="mb-1 flex items-end text-5xl font-medium">
                  {annual ? plan.annual : plan.monthly}
                  {plan.monthly.startsWith("Rp") ? (
                    <span className="text-base text-gray-500">/bulan</span>
                  ) : null}
                </h3>
                <p className="mb-7 min-h-5 font-mono text-xs text-gray-400">
                  {annual ? plan.annualNote : null}
                </p>

                <ul className="space-y-4 border-t border-dashed border-gray-200 py-7">
                  {plan.features.map((feature) => (
                    <li
                      key={feature.text}
                      className={`flex items-center gap-2.5 text-sm ${
                        feature.included ? "text-gray-700" : "text-gray-400"
                      }`}
                    >
                      {feature.included ? <CheckIcon /> : <CheckMutedIcon />}
                      {feature.text}
                    </li>
                  ))}
                </ul>

                <a
                  href={plan.href}
                  className={`inline-block w-full rounded-lg border px-4 py-2.5 text-center text-base font-medium transition-colors duration-300 ease-in-out ${
                    plan.popular
                      ? "grad-btn"
                      : "border-gray-200 bg-gray-50 text-gray-800 hover:bg-gray-100"
                  }`}
                >
                  {plan.cta}
                </a>
              </div>
            </Reveal>
          ))}
        </div>

        <p className="mx-auto mt-10 max-w-2xl text-center text-xs leading-relaxed text-gray-400">
          Harga per bulan bila ditagih tahunan: Plus{" "}
          {perBulanTahunan(HARGA.plusTahunan)} · Pro{" "}
          {perBulanTahunan(HARGA.proTahunan)}. Semua harga dalam Rupiah dan
          belum termasuk PPN. Batalkan kapan saja.
        </p>
      </div>
    </section>
  );
}
