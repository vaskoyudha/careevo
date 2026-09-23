"use client";

import { useRef } from "react";
import { Reveal } from "../primitives";

const PARTNERS = [
  "Google",
  "Duke University",
  "IBM",
  "Vanderbilt University",
  "Microsoft",
  "University of Michigan",
  "Meta",
  "Stanford",
  "Adobe",
];

/**
 * "Belajar dari 350+ universitas dan perusahaan terkemuka" — logo row
 * with Previous / Next controls, matching the original page.
 */
export function CareevoPlusLogos() {
  const scroller = useRef<HTMLUListElement>(null);

  const scroll = (direction: -1 | 1) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.7, behavior: "smooth" });
  };

  return (
    <section className="bg-white py-10 lg:py-14">
      <div className="mx-auto max-w-7xl px-4 lg:px-6">
        <Reveal>
          <h2 className="mb-8 text-2xl font-medium -tracking-[0.5px] text-gray-900 lg:text-3xl">
            Belajar dari 350+ universitas dan perusahaan terkemuka
          </h2>
        </Reveal>

        <Reveal delay={80}>
          <ul
            ref={scroller}
            className="flex items-center gap-8 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {PARTNERS.map((name) => (
              <li
                key={name}
                className="shrink-0 text-lg font-semibold whitespace-nowrap text-gray-400"
              >
                {name}
              </li>
            ))}
          </ul>

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              aria-label="Sebelumnya"
              onClick={() => scroll(-1)}
              className="inline-flex size-10 cursor-pointer items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 transition-colors duration-300 ease-in-out hover:bg-gray-50"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <button
              type="button"
              aria-label="Berikutnya"
              onClick={() => scroll(1)}
              className="inline-flex size-10 cursor-pointer items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 transition-colors duration-300 ease-in-out hover:bg-gray-50"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
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
