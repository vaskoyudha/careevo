"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Reveal } from "./primitives";

const FAQS = [
  {
    q: "Apa itu Careevo dan untuk siapa?",
    a: "Careevo adalah jembatan terverifikasi dari course ke pekerjaan pertama. Dibuat untuk peserta, verifikator, dan tim rekrutmen yang ingin bukti kompetensi, bukan sekadar klaim.",
  },
  {
    q: "Bagaimana verifikasi HMAC-SHA256 bekerja?",
    a: "Setiap hasil submission ditandatangani dengan HMAC-SHA256. Siapa pun bisa membuka tautan verifikasi untuk memastikan data tidak diubah setelah diterbitkan.",
  },
  {
    q: "Apakah data saya aman tanpa biometrik?",
    a: "Ya. Careevo nir-biometrik dan Zero-PII: tanpa webcam, tanpa rekam ketukan, dan tanpa email yang dipublikasikan. Identitas di halaman publik hanya memakai username.",
  },
  {
    q: "Bisakah dipakai untuk kampus atau bootcamp?",
    a: "Bisa. Paket Kampus menambahkan SSO, integrasi LMS, laporan akreditasi, dan onboarding khusus untuk institusi.",
  },
  {
    q: "Bagaimana loker diaudit oleh agen?",
    a: "Sentinel memeriksa usia domain, pola biaya, dan regex transfer pribadi. Loker yang mencurigakan dikarantina sebelum tampil di daftar.",
  },
];

const AVATARS = [
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&q=80&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&q=80&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&q=80&fit=crop&crop=faces",
];

export function MarketingFaq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="py-10 lg:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex flex-col justify-between gap-10 lg:flex-row">
          <Reveal className="lg:w-5/12">
            <h2 className="mb-10 text-5xl font-medium -tracking-[1.9px] text-gray-900 lg:mb-20 lg:text-6xl">
              Pertanyaan yang sering diajukan
            </h2>
            <div className="rounded-2xl border border-gray-100 bg-white p-5 sm:max-w-xs">
              <div className="mb-2 flex -space-x-3 items-center">
                {AVATARS.map((src) => (
                  <Image
                    key={src}
                    src={src}
                    alt=""
                    width={36}
                    height={36}
                    unoptimized
                    className="size-9 rounded-full ring-2 ring-white"
                  />
                ))}
              </div>
              <p className="mb-6 text-gray-700">
                Masih ada pertanyaan? Tim kami siap membantu.
              </p>
              <a
                href="/masuk"
                className="grad-btn inline-block rounded-lg px-4 py-2.5 text-base font-medium transition duration-300 ease-in-out"
              >
                Hubungi kami
              </a>
            </div>
          </Reveal>

          <Reveal className="lg:w-6/12" delay={80}>
            <div>
              {FAQS.map((item, index) => {
                const isOpen = open === index;
                return (
                  <div key={item.q} className="border-b border-gray-200 py-6">
                    <div
                      className="flex cursor-pointer items-center justify-between"
                      onClick={() => setOpen(isOpen ? null : index)}
                    >
                      <h3 className="text-xl font-medium -tracking-[0.18px] text-gray-900">
                        {item.q}
                      </h3>
                      <button
                        type="button"
                        aria-label={isOpen ? "Tutup" : "Buka"}
                        aria-expanded={isOpen}
                        className="ml-4 shrink-0 cursor-pointer text-gray-950"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="14"
                          height="14"
                          viewBox="0 0 14 14"
                          fill="none"
                          className={cn(
                            "transition-transform duration-300",
                            isOpen && "rotate-45",
                          )}
                          aria-hidden="true"
                        >
                          <path
                            fillRule="evenodd"
                            clipRule="evenodd"
                            d="M6.75024 13.501C6.33613 13.501 6.0004 13.1651 6.00024 12.751V7.50024H0.75C0.335786 7.50024 0 7.16445 0 6.75024C0 6.33603 0.335786 6.00024 0.75 6.00024H6.00024V0.75C6.00024 0.335786 6.33603 0 6.75024 0C7.16445 0 7.50024 0.335786 7.50024 0.75V6.00024H12.751C13.1651 6.0004 13.501 6.33613 13.501 6.75024C13.501 7.16435 13.1651 7.50008 12.751 7.50024H7.50024V12.751C7.50008 13.1651 7.16435 13.501 6.75024 13.501Z"
                            fill="#374151"
                          />
                        </svg>
                      </button>
                    </div>
                    {isOpen ? (
                      <p className="mt-4 text-base text-gray-500">{item.a}</p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
