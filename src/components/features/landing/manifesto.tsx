"use client";

import { useEffect, useRef } from "react";

const WORDS = [
  "Kompetensi",
  "tidak",
  "cukup",
  "diklaim;",
  "ia",
  "harus",
  "meninggalkan",
  "jejak",
  "yang",
  "bisa",
  "diverifikasi.",
  "Careevo",
  "merekam",
  "proses,",
  "menandatangani",
  "hasil,",
  "dan",
  "membuka",
  "audit",
  "kepada",
  "siapa",
  "saja,",
  "tanpa",
  "biometrik,",
  "tanpa",
  "server",
  "tunggal,",
  "tanpa",
  "kepercayaan",
  "buta.",
];

export function Manifesto() {
  const rootRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const words = Array.from(root.querySelectorAll<HTMLElement>(".w"));
    if (!words.length) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) {
      words.forEach((word) => word.classList.add("is-on"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target as HTMLElement;
          const idx = words.indexOf(el);
          const delay = Math.min(idx * 45, 1400);
          window.setTimeout(() => el.classList.add("is-on"), delay);
          observer.unobserve(el);
        });
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.1 },
    );

    words.forEach((word) => observer.observe(word));

    return () => observer.disconnect();
  }, []);

  return (
    <section className="ax-section ax-manifesto" id="tentang" aria-labelledby="manifesto-title">
      <div className="ax-inner">
        <p className="ax-label">Manifesto</p>
        <p className="ax-manifesto-text" id="manifesto-title" ref={rootRef}>
          {WORDS.map((word, index) => (
            <span className="w" key={`${word}-${index}`}>
              {word}{" "}
            </span>
          ))}
        </p>
      </div>
    </section>
  );
}
