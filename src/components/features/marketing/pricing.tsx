"use client";

import { useState } from "react";
import { CheckIcon, CheckMutedIcon, Reveal } from "./primitives";

type Plan = {
  badge: string;
  note: string;
  monthly: string;
  annual: string;
  features: { text: string; included: boolean }[];
  cta: string;
  popular?: boolean;
  href: string;
};

const PLANS: Plan[] = [
  {
    badge: "Gratis",
    note: "Untuk mulai belajar",
    monthly: "$0",
    annual: "$0",
    features: [
      { text: "Akses dashboard", included: true },
      { text: "3 challenge per bulan", included: true },
      { text: "Badge terverifikasi HMAC", included: true },
      { text: "Dukungan komunitas", included: true },
      { text: "Analitik lanjutan", included: false },
    ],
    cta: "Mulai gratis",
    href: "/daftar",
  },
  {
    badge: "Peserta",
    note: "Untuk karier yang serius",
    monthly: "$19",
    annual: "$15",
    features: [
      { text: "Challenge tanpa batas", included: true },
      { text: "Navigator prioritas", included: true },
      { text: "Halaman verifikasi publik", included: true },
      { text: "Riwayat submission penuh", included: true },
      { text: "Dukungan standar", included: true },
    ],
    cta: "Pilih paket",
    href: "/daftar",
  },
  {
    badge: "Pro",
    note: "Untuk tim dan bootcamp",
    monthly: "$49",
    annual: "$39",
    features: [
      { text: "Semua fitur Peserta", included: true },
      { text: "Kelas privat", included: true },
      { text: "Review verifikator prioritas", included: true },
      { text: "Analitik cohort", included: true },
      { text: "Dukungan prioritas", included: true },
    ],
    cta: "Pilih paket",
    href: "/daftar",
    popular: true,
  },
  {
    badge: "Kampus",
    note: "Untuk institusi pendidikan",
    monthly: "Custom",
    annual: "Custom",
    features: [
      { text: "Semua fitur Pro", included: true },
      { text: "SSO kampus", included: true },
      { text: "Integrasi LMS", included: true },
      { text: "Laporan akreditasi", included: true },
      { text: "Onboarding khusus", included: true },
    ],
    cta: "Hubungi kami",
    href: "/masuk",
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
              Mulai gratis, naik kelas saat butuh, dan skalakan tanpa hambatan.
              Pilih paket yang paling pas untukmu hari ini.
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
                  -20%
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
                <h3 className="mb-7 flex items-end text-6xl font-medium">
                  {annual ? plan.annual : plan.monthly}
                  {plan.monthly.startsWith("$") ? (
                    <span className="text-base text-gray-500">/bulan</span>
                  ) : null}
                </h3>

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
      </div>
    </section>
  );
}
