"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Reveal } from "../primitives";

const TABS = [
  {
    label: "Data",
    image:
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1312&h=600&q=80",
  },
  {
    label: "Bisnis",
    image:
      "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1312&h=600&q=80",
  },
  {
    label: "Penjualan & Pemasaran",
    image:
      "https://images.unsplash.com/photo-1533750349088-cd871a92f312?w=1312&h=600&q=80",
  },
  {
    label: "IT",
    image:
      "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1312&h=600&q=80",
  },
  {
    label: "Software Engineering",
    image:
      "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=1312&h=600&q=80",
  },
  {
    label: "AI",
    image:
      "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=1312&h=600&q=80",
  },
];

/**
 * "Gain the skills employers want" — intro copy + CTA, category tabs,
 * then the tabbed image with carousel dots, mirroring the original page.
 */
export function CareevoPlusSkills() {
  const [active, setActive] = useState(0);

  return (
    <section id="keahlian" className="bg-white py-14 lg:py-20">
      <div className="mx-auto max-w-7xl px-4 lg:px-6">
        <div className="mx-auto mb-8 max-w-2xl text-center">
          <Reveal>
            <h2 className="mb-4 text-3xl font-medium -tracking-[1.9px] text-gray-900 lg:text-5xl">
              Raih keahlian yang dicari perusahaan
            </h2>
          </Reveal>
          <Reveal delay={80}>
            <p className="mb-6 text-base text-gray-500">
              Bergabung dengan 91% pelajar yang mencapai hasil karier positif,
              seperti peluang kerja baru, pengetahuan yang bertambah, dan
              performa kerja yang meningkat.¹
            </p>
          </Reveal>
          <Reveal delay={120}>
            <Link
              href="#paket"
              className="grad-btn inline-block h-11 rounded-lg px-6 py-2.5 text-base font-medium transition duration-300 ease-in-out"
            >
              Hemat 40% sekarang
            </Link>
          </Reveal>
        </div>

        <Reveal delay={160}>
          <div className="mb-8 flex flex-wrap justify-center gap-2">
            {TABS.map((tab, index) => (
              <button
                key={tab.label}
                type="button"
                onClick={() => setActive(index)}
                aria-pressed={active === index}
                className={cn(
                  "cursor-pointer rounded-full border px-4 py-2 text-sm font-medium transition-colors duration-300 ease-in-out",
                  active === index
                    ? "border-blue-400 bg-blue-50 text-blue-600"
                    : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </Reveal>

        <Reveal variant="scale" delay={200}>
          <div className="rounded-2xl bg-white p-3 shadow-feature-card">
            <Image
              key={TABS[active].label}
              className="w-full rounded-xl"
              alt={`Ilustrasi jalur belajar untuk kategori ${TABS[active].label}`}
              src={TABS[active].image}
              width={1312}
              height={600}
            />
          </div>
        </Reveal>

        <Reveal delay={240}>
          <div className="mt-6 flex justify-center gap-2">
            {TABS.map((tab, index) => (
              <button
                key={tab.label}
                type="button"
                aria-label={`Tampilkan kategori ${tab.label}`}
                aria-current={active === index}
                onClick={() => setActive(index)}
                className={cn(
                  "h-1.5 cursor-pointer rounded-full transition-all duration-300 ease-in-out",
                  active === index
                    ? "w-6 bg-blue-500"
                    : "w-1.5 bg-gray-300 hover:bg-gray-400",
                )}
              />
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
