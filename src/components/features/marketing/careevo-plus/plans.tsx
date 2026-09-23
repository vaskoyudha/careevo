"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckIcon, Reveal } from "../primitives";

const PLANS = [
  {
    badge: "Course & Program Individual",
    description: "Pelajari satu topik atau keahlian dan raih kredensial",
    price: "IDR 472.000",
    priceNote: "/bulan",
    cta: "Jelajahi course",
    href: "/daftar",
    note: "Kunjungi course untuk membeli",
    features: [
      "Pilih dari ribuan course di AI, bisnis, teknologi, dan lainnya",
      "Dapatkan sertifikat setelah menyelesaikan",
      "Bayar sekali untuk satu course atau langganan spesialisasi",
    ],
  },
] as const;

const CP_FEATURES = [
  "Akses ribuan course di AI, bisnis, teknologi, dan lainnya dengan satu langganan",
  "Dapatkan sertifikat tanpa batas setelah masa uji coba berakhir",
  "Pelajari keterampilan dan alat yang relevan dengan pekerjaan lewat lab dan proyek praktik dari para ahli industri",
];

const TEAMS_FEATURES = [
  "Akses semua yang termasuk dalam Careevo Plus",
  "Analitik dan laporan benchmark khusus",
  "Pembangun program bertenaga AI",
  "Opsi pembayaran fleksibel seperti tagihan kuartalan dan invoice",
];

/**
 * "Find the right plan for your goals" — 3-column plan comparison.
 * The middle Careevo Plus column carries the billing-cycle toggle,
 * "Best value" badge, and the primary CTA.
 */
export function CareevoPlusPlans() {
  const [annual, setAnnual] = useState(false);

  return (
    <section id="paket" className="bg-white py-16 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 lg:px-6">
        <Reveal>
          <h2 className="mx-auto mb-12 max-w-2xl text-center text-3xl font-medium -tracking-[1.9px] text-gray-900 lg:text-5xl">
            Temukan paket yang tepat untuk targetmu
          </h2>
        </Reveal>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Individual */}
          {PLANS.map((plan) => (
            <Reveal key={plan.badge}>
              <div className="flex h-full flex-col rounded-2xl border border-gray-100 bg-white p-6">
                <h3 className="mb-2 text-2xl font-medium text-gray-900">
                  {plan.badge}
                </h3>
                <p className="mb-6 text-base text-gray-500">
                  {plan.description}
                </p>
                <p className="mb-1 text-3xl font-medium text-gray-900">
                  {plan.price}
                  <span className="text-base text-gray-500">
                    {plan.priceNote}
                  </span>
                </p>
                <p className="mb-7 text-sm text-gray-400">{plan.note}</p>
                <Link
                  href={plan.href}
                  className="mb-7 inline-block w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-center text-base font-medium text-gray-800 transition-colors duration-300 ease-in-out hover:bg-gray-100"
                >
                  {plan.cta}
                </Link>
                <p className="mb-4 text-sm font-semibold text-gray-900">
                  Fitur utama:
                </p>
                <ul className="space-y-4">
                  {plan.features.map((feature) => (
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
          ))}

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
                Kuasai berbagai topik atau keahlian dan raih kredensial tanpa
                batas
              </p>

              <p className="mb-3 text-sm font-medium text-gray-700">
                Pilih siklus penagihan
              </p>
              <div className="mb-5 inline-flex rounded-full bg-gray-200 p-1">
                <button
                  type="button"
                  onClick={() => setAnnual(false)}
                  className={`relative z-10 cursor-pointer rounded-full px-3 py-1.5 text-sm font-medium transition-colors duration-300 ease-in-out ${
                    annual ? "text-gray-500" : "text-gray-900"
                  }`}
                >
                  Tagihan Bulanan
                  {!annual ? (
                    <span className="absolute inset-0 -z-10 rounded-full bg-white shadow-sm" />
                  ) : null}
                </button>
                <button
                  type="button"
                  onClick={() => setAnnual(true)}
                  className={`relative z-10 cursor-pointer rounded-full px-3 py-1.5 text-sm font-medium transition-colors duration-300 ease-in-out ${
                    annual ? "text-gray-900" : "text-gray-500"
                  }`}
                >
                  Tagihan Tahunan
                  {annual ? (
                    <span className="absolute inset-0 -z-10 rounded-full bg-white shadow-sm" />
                  ) : null}
                </button>
              </div>

              {!annual ? (
                <>
                  <span className="mb-3 inline-flex w-fit items-center rounded-full bg-green-500/10 px-2 py-1 font-mono text-xs text-green-600">
                    Status: Hemat 40%
                  </span>
                  <p className="mb-1 flex items-end gap-2">
                    <span className="text-lg text-gray-400 line-through">
                      IDR 570.000
                    </span>
                    <span className="text-3xl font-medium text-gray-900">
                      IDR 342.000
                    </span>
                    <span className="text-base text-gray-500">/bulan</span>
                  </p>
                </>
              ) : (
                <p className="mb-1 text-3xl font-medium text-gray-900">
                  IDR 3.893.000
                  <span className="text-base text-gray-500">/tahun</span>
                </p>
              )}

              <p className="mb-7 text-sm text-gray-400">
                Batalkan kapan saja
              </p>
              <Link
                href="/daftar"
                className="grad-btn mb-7 inline-block w-full rounded-lg px-4 py-2.5 text-center text-base font-medium transition duration-300 ease-in-out"
              >
                Hemat sekarang
              </Link>
              <p className="mb-4 text-sm font-semibold text-gray-900">
                Fitur utama:
              </p>
              <ul className="space-y-4">
                {CP_FEATURES.map((feature) => (
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
                Tingkatkan keahlian hingga 125 karyawan
              </p>
              <p className="mb-7 text-sm text-gray-400">
                Per pengguna untuk 12 bulan
              </p>
              <Link
                href="/masuk"
                className="mb-7 inline-block w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-center text-base font-medium text-gray-800 transition-colors duration-300 ease-in-out hover:bg-gray-100"
              >
                Mulai
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
      </div>
    </section>
  );
}
