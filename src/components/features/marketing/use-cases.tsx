"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Reveal } from "./primitives";

const CASES = [
  {
    title: "Pencari kerja & developer",
    description:
      "Latihan yang ngikutin posisi yang kamu incar, latihan interview, dan loker yang cocok sama isi CV kamu sekarang.",
    image:
      "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&q=80",
  },
  {
    title: "Verifikator & mentor",
    description:
      "Lihat alur kerja peserta, uji logikanya, dan nilai pakai rubrik yang sama supaya penilaianmu fair.",
    image:
      "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1200&q=80",
  },
  {
    title: "Tim rekrutmen",
    description:
      "Dapatkan kandidat yang attach rekam jejak kerja dan cara berpikirnya, bukan cuma CV yang bagus di atas kertas.",
    image:
      "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=1200&q=80",
  },
];

export function MarketingUseCases() {
  const [active, setActive] = useState(0);

  return (
    <section id="segmen" className="py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 lg:px-6">
        <div className="flex flex-col gap-12 lg:flex-row">
          <Reveal className="lg:w-5/12">
            <h2 className="mb-4 text-5xl font-medium -tracking-[1.9px] text-gray-900 lg:text-6xl">
              Tiga jenis orang yang kepake
            </h2>
            <p className="text-base text-gray-500">
              Yang lagi nyari kerja, yang memeriksa, sama yang merekrut.
              Masing-masing dapat tampilan yang beda, tapi semuanya pakai rekam
              jejak yang sama.
            </p>
            <ul className="mt-11 space-y-5">
              {CASES.map((item, index) => (
                <li
                  key={item.title}
                  className={cn(
                    "cursor-pointer border-l-4 px-5 py-2.5 transition",
                    active === index ? "border-[#388AF3]" : "border-gray-100",
                  )}
                  onClick={() => setActive(index)}
                >
                  <h3 className="mb-2 text-lg font-medium text-gray-900">
                    {item.title}
                  </h3>
                  <p className="text-base text-gray-500">{item.description}</p>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal className="lg:w-6/12" delay={80}>
            <div className="rounded-2xl bg-white p-3 shadow-feature-card">
              {CASES.map((item, index) => (
                <Image
                  key={item.title}
                  className={cn(
                    "w-full rounded-xl transition-opacity duration-300",
                    active === index ? "opacity-100" : "hidden opacity-0",
                  )}
                  alt={item.title}
                  src={item.image}
                  width={1200}
                  height={800}
                />
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
