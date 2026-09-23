"use client";

import { useRef, type ReactNode } from "react";
import { Reveal } from "../primitives";

function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 shrink-0" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </svg>
  );
}

function MicrosoftLogo() {
  return (
    <svg viewBox="0 0 23 23" className="size-4 shrink-0" aria-hidden="true">
      <path fill="#f25022" d="M1 1h10v10H1z" />
      <path fill="#00a4ef" d="M1 12h10v10H1z" />
      <path fill="#7fba00" d="M12 1h10v10H12z" />
      <path fill="#ffb900" d="M12 12h10v10H12z" />
    </svg>
  );
}

function MetaLogo() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 shrink-0" fill="#0081FB" aria-hidden="true">
      <path d="M16.5 6c-1.8 0-3.3 1-4.5 2.5C10.8 7 9.3 6 7.5 6 4.5 6 2 8.5 2 12s2.5 6 5.5 6c2.4 0 4.2-1.3 5-3.1.8 1.8 2.6 3.1 5 3.1 3 0 5.5-2.5 5.5-6s-2.5-6-5.5-6zm-9 9.8c-2.1 0-3.8-1.7-3.8-3.8s1.7-3.8 3.8-3.8c1.9 0 3.3 1.4 4.1 2.8-.8 1.4-2.2 2.8-4.1 2.8zm9 0c-1.9 0-3.3-1.4-4.1-2.8.8-1.4 2.2-2.8 4.1-2.8 2.1 0 3.8 1.7 3.8 3.8s-1.7 3.8-3.8 3.8z" />
    </svg>
  );
}

function IbmLogo() {
  return (
    <svg viewBox="0 0 40 16" className="h-3.5 w-auto shrink-0" fill="#006699" aria-hidden="true">
      <path d="M0 0h6v2H0zm8 0h14v2H8zm16 0h16v2H24zM0 3h6v2H0zm8 0h14v2H8zm16 0h5v2h-5zm11 0h5v2h-5zM0 6h6v2H0zm8 0h4v2H8zm10 0h4v2h-4zm6 0h5v2h-5zm11 0h5v2h-5zM0 9h6v2H0zm8 0h4v2H8zm10 0h4v2h-4zm6 0h16v2H24zm-24 3h6v2H0zm8 0h4v2H8zm10 0h4v2h-4zm6 0h5v2h-5zm11 0h5v2h-5zM0 15h6v2H0zm8 0h14v2H8zm16 0h16v2H24z" />
    </svg>
  );
}

function StanfordLogo() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="#8C1515" aria-hidden="true">
      <path d="M12 2L4 16h6v6h4v-6h6L12 2zm0 3.5L16.2 14H7.8L12 5.5z" />
    </svg>
  );
}

function DukeLogo() {
  return (
    <span className="font-serif text-xs font-black tracking-tight text-[#001A57]">
      Duke
    </span>
  );
}

function MichiganLogo() {
  return (
    <span className="flex size-4.5 items-center justify-center rounded-[2px] bg-[#00274C] text-[10px] font-black text-[#FFCB05]">
      M
    </span>
  );
}

function VanderbiltLogo() {
  return (
    <span className="flex size-4.5 items-center justify-center rounded-[2px] bg-[#D8AB4C] text-[10px] font-black text-black">
      V
    </span>
  );
}

function AdobeLogo() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="#FA0F00" aria-hidden="true">
      <path d="M14.5 3H22v18h-4.2l-3.3-8.8zm-5 0H2v18h4.2l3.3-8.8zm2.5 8l3 8h-2.5l-1.3-3.6h-3.4l2.2-4.4z" />
    </svg>
  );
}

type PartnerItem = {
  name: string;
  icon: ReactNode;
};

const PARTNERS: PartnerItem[] = [
  { name: "Google", icon: <GoogleLogo /> },
  { name: "Duke University", icon: <DukeLogo /> },
  { name: "IBM", icon: <IbmLogo /> },
  { name: "Vanderbilt University", icon: <VanderbiltLogo /> },
  { name: "Microsoft", icon: <MicrosoftLogo /> },
  { name: "University of Michigan", icon: <MichiganLogo /> },
  { name: "Meta", icon: <MetaLogo /> },
  { name: "Stanford", icon: <StanfordLogo /> },
  { name: "Adobe", icon: <AdobeLogo /> },
];

/**
 * "Belajar dari 350+ universitas dan perusahaan terkemuka" — logo row
 * with authentic SVG icons and Previous / Next controls matching Coursera Plus.
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
            Belajar dari 350+ universitas dan perusahaan terkemuka
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
              {PARTNERS.map((p) => (
                <li
                  key={p.name}
                  className="flex shrink-0 items-center gap-2.5 rounded-full border border-gray-200 bg-white px-4 py-2 shadow-xs transition-colors hover:border-gray-300"
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
