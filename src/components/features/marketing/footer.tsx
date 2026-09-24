"use client";

import Link from "next/link";
import { AtSign, Camera, MessageCircle, Send } from "lucide-react";

const PRODUCT = [
  { href: "#top", label: "Beranda" },
  { href: "#fitur", label: "Fitur" },
  { href: "#harga", label: "Harga" },
  { href: "#segmen", label: "Segmen" },
];

const COMPANY = [
  { href: "#faq", label: "Tentang" },
  { href: "/masuk", label: "Kontak" },
  { href: "/masuk", label: "Kebijakan Privasi" },
  { href: "/masuk", label: "Syarat dan Ketentuan" },
];

const SOCIAL = [
  { href: "#", label: "Instagram", icon: Camera },
  { href: "#", label: "X (Twitter)", icon: AtSign },
  { href: "#", label: "Telegram", icon: Send },
  { href: "#", label: "Discord", icon: MessageCircle },
];

export function MarketingFooter() {
  return (
    <footer>
      <div className="mx-auto max-w-7xl px-6">
        <div className="pt-10 lg:pt-18">
          <div className="flex flex-col gap-10 lg:flex-row">
            <div className="lg:w-4/12">
              <div>
                <Link href="/" className="mb-10 flex items-center gap-2 lg:mb-20">
                  <span className="grid size-7 place-items-center rounded-lg bg-linear-to-br from-blue-500 to-blue-400 text-sm font-semibold text-white">
                    C
                  </span>
                  <span className="text-lg font-semibold tracking-tight text-gray-900">
                    Care<span className="text-blue-500">evo</span>
                  </span>
                </Link>
                <p className="text-base text-gray-500 lg:pr-10">
                  Jembatan terverifikasi dari course ke pekerjaan pertama.
                  Proses belajar terekam, hasil ditandatangani, loker diaudit.
                  Kamera hanya aktif selama sesi terverifikasi yang kamu
                  setujui, tanpa deteksi identitas.
                </p>
              </div>
            </div>

            <div className="lg:ml-auto lg:w-6/12">
              <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 sm:gap-10">
                <div>
                  <h3 className="mb-6 text-xl font-medium text-gray-800">
                    Produk
                  </h3>
                  <nav className="space-y-5">
                    {PRODUCT.map((link) => (
                      <a
                        key={link.label}
                        href={link.href}
                        className="block text-base text-gray-700 transition-colors duration-300 ease-in-out hover:text-blue-500"
                      >
                        {link.label}
                      </a>
                    ))}
                  </nav>
                </div>

                <div>
                  <h3 className="mb-6 text-xl font-medium text-gray-800">
                    Perusahaan
                  </h3>
                  <nav className="space-y-5">
                    {COMPANY.map((link) => (
                      <Link
                        key={link.label}
                        href={link.href}
                        className="block text-base text-gray-700 transition-colors duration-300 ease-in-out hover:text-blue-500"
                      >
                        {link.label}
                      </Link>
                    ))}
                  </nav>
                </div>

                <div className="flex lg:justify-end">
                  <div>
                    <h3 className="mb-6 text-xl font-medium text-gray-800">
                      Sosial
                    </h3>
                    <nav className="space-y-5">
                      {SOCIAL.map((item) => {
                        const Icon = item.icon;
                        return (
                          <a
                            key={item.label}
                            href={item.href}
                            className="flex items-center gap-2 text-gray-700 transition-colors duration-300 ease-in-out hover:text-blue-500"
                          >
                            <Icon className="size-5" strokeWidth={1.5} />
                            {item.label}
                          </a>
                        );
                      })}
                    </nav>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-5 pt-10 pb-10 sm:flex-row lg:pt-20">
          <p className="text-base text-gray-500">
            &copy; 2026 Careevo. Hak cipta dilindungi.
          </p>
          <div className="flex items-center gap-3 text-gray-700">
            Kembali ke atas
            <button
              type="button"
              aria-label="Kembali ke atas"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="grad-btn inline-flex size-7 cursor-pointer items-center justify-center rounded-full transition duration-300 ease-in-out"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M10.2053 2.79053C10.2486 2.79053 10.291 2.7952 10.3323 2.80225C10.481 2.82707 10.6238 2.89561 10.7385 3.01025L15.7385 8.00635C16.0315 8.29911 16.0312 8.7739 15.7385 9.06689C15.4457 9.3598 14.971 9.36059 14.678 9.06787L10.9553 5.34619L10.9553 16.8745C10.9553 17.2887 10.6195 17.6245 10.2053 17.6245C9.7912 17.6244 9.45538 17.2886 9.45532 16.8745L9.45532 5.35205L5.73853 9.06787C5.44554 9.36055 4.97074 9.35982 4.67798 9.06689C4.38532 8.77392 4.3851 8.29912 4.67798 8.00635L9.6604 3.02686C9.67433 3.01208 9.68927 2.99847 9.70435 2.98486C9.72164 2.96917 9.73972 2.95471 9.75806 2.94092C9.84661 2.87472 9.94909 2.82606 10.0618 2.8042C10.064 2.80375 10.0663 2.80365 10.0686 2.80322C10.113 2.79504 10.1586 2.79054 10.2053 2.79053Z"
                  fill="white"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
