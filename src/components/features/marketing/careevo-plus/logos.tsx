"use client";

import { useRef, type ReactNode } from "react";
import {
  BarChart3,
  Boxes,
  BrainCircuit,
  Code2,
  Database,
  Gamepad2,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import { Reveal } from "../primitives";

/**
 * The tracks Careevo actually teaches. This replaced a row of third-party
 * university/company logos (Google, IBM, Meta, Stanford, …) that implied
 * partnerships Careevo does not have. Icons are our own; the label says
 * "jalur belajar", not "universitas dan perusahaan".
 */
type JalurItem = {
  name: string;
  icon: ReactNode;
};

const JALUR: JalurItem[] = [
  { name: "Data & Analitik", icon: <BarChart3 className="size-4 shrink-0" aria-hidden="true" /> },
  { name: "Web Development", icon: <Code2 className="size-4 shrink-0" aria-hidden="true" /> },
  { name: "Keamanan Siber", icon: <ShieldCheck className="size-4 shrink-0" aria-hidden="true" /> },
  { name: "AI & Prompting", icon: <BrainCircuit className="size-4 shrink-0" aria-hidden="true" /> },
  { name: "Game Development", icon: <Gamepad2 className="size-4 shrink-0" aria-hidden="true" /> },
  { name: "Backend & API", icon: <Database className="size-4 shrink-0" aria-hidden="true" /> },
  { name: "DevOps & Testing", icon: <Terminal className="size-4 shrink-0" aria-hidden="true" /> },
  { name: "Arsitektur Perangkat Lunak", icon: <Boxes className="size-4 shrink-0" aria-hidden="true" /> },
];

/**
 * "Belajar lewat jalur yang memang kami ajarkan" — a scroller of Careevo's own
 * learning tracks with Previous / Next controls.
 */
export function CareevoPlusLogos() {
  const scroller = useRef<HTMLUListElement>(null);

  const scroll = (direction: -1 | 1) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.7, behavior: "smooth" });
  };

  return (
    <section className="bg-white py-10 lg:py-12">
      <div className="mx-auto max-w-7xl px-4 lg:px-6">
        <Reveal>
          <h2 className="mb-6 text-xl font-semibold -tracking-[0.4px] text-gray-900 lg:text-2xl">
            Belajar lewat jalur yang memang kami ajarkan
          </h2>
        </Reveal>

        <Reveal delay={80}>
          <div className="relative">
            {/* Previous */}
            <button
              type="button"
              aria-label="Sebelumnya"
              onClick={() => scroll(-1)}
              className="absolute -left-3 top-1/2 z-10 flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-md transition-colors hover:bg-gray-50 hover:text-gray-900"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>

            <ul
              ref={scroller}
              className="flex items-center gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {JALUR.map((p) => (
                <li
                  key={p.name}
                  className="flex shrink-0 items-center gap-2.5 rounded-full border border-gray-200 bg-white px-4 py-2 text-gray-600 shadow-xs transition-colors hover:border-gray-300"
                >
                  <span className="flex size-5 items-center justify-center">
                    {p.icon}
                  </span>
                  <span className="whitespace-nowrap text-sm font-medium text-gray-700">
                    {p.name}
                  </span>
                </li>
              ))}
            </ul>

            {/* Next */}
            <button
              type="button"
              aria-label="Berikutnya"
              onClick={() => scroll(1)}
              className="absolute -right-3 top-1/2 z-10 flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-md transition-colors hover:bg-gray-50 hover:text-gray-900"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
