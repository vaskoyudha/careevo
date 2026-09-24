"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The black brand panel shared by the auth pages (login / register) and the
 * onboarding screen: the Careevo lockup, a rotating image mosaic with focus
 * corners, a dashed note strip that cycles in step with the mosaic, the
 * "Learn. Verify. Earn." tagline and the note pager.
 *
 * Extracted verbatim from `auth-section-2.tsx` so onboarding can reuse the
 * exact same left column instead of re-implementing it.
 */

const images = [
  {
    src: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=900&q=70",
    alt: "Tim meninjau hasil karya di layar bersama",
  },
  {
    src: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=700&q=70",
    alt: "Sesi belajar dan menulis kode di laptop",
  },
  {
    src: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=700&q=70",
    alt: "Meja kerja peserta dengan catatan dan perangkat",
  },
  {
    src: "https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=900&q=70",
    alt: "Peserta membangun karya secara mandiri",
  },
];

const notes = [
  { tag: "review", text: "Verifikator menilai submission lewat rubrik 5 kriteria" },
  { tag: "belajar", text: "Timeline dan artefak proses direkam otomatis" },
  { tag: "verify", text: "Attestation ditandatangani HMAC, bisa dicek siapa pun" },
  { tag: "sentinel", text: "Loker disaring Sentinel sebelum tampil di daftar" },
];

export function AuthBrandPanel({ className }: { className?: string }) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % images.length);
    }, 2600);

    return () => window.clearInterval(interval);
  }, []);

  const advance = () => setActiveIndex((current) => (current + 1) % images.length);

  return (
    <div
      className={cn(
        "flex justify-center overflow-hidden rounded-md bg-black px-7 py-12 text-white sm:px-10",
        className,
      )}
    >
      <div className="flex w-full max-w-[500px] flex-col items-center">
        <div className="flex items-center gap-3 text-lg text-white">
          <ShieldCheck className="size-6 text-[#2ec4b6]" aria-hidden="true" />
          Careevo
        </div>

        <div className="relative mt-8 grid w-full grid-cols-[1.55fr_1fr] gap-2 rounded-md">
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-20 bg-gradient-to-b from-black to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-24 bg-gradient-to-t from-black to-transparent" />
          <ImageTile
            image={images[0]}
            active={activeIndex === 0}
            priority
            className="row-span-2 h-[250px]"
          />
          <ImageTile image={images[1]} active={activeIndex === 1} className="h-[121px]" />
          <ImageTile image={images[3]} active={activeIndex === 3} className="h-[121px]" />
          <ImageTile
            image={images[2]}
            active={activeIndex === 2}
            className="col-span-2 h-[120px]"
          />
        </div>

        <div className="mt-6 w-full rounded-[10px] border border-dashed border-white/15 px-5 py-4">
          <div className="flex items-end gap-4">
            <p className="m-0 line-clamp-4 flex-1 text-xs leading-4 text-white/45">
              <span className="font-semibold text-white">/{notes[activeIndex].tag}</span>{" "}
              {notes[activeIndex].text}
            </p>
            <button
              type="button"
              onClick={advance}
              aria-label="Catatan berikutnya"
              className="grid size-8 shrink-0 place-items-center rounded-full bg-white/20 text-white transition-colors hover:bg-white/30"
            >
              <ArrowRight className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <p className="mt-7 mb-0 max-w-[280px] text-center text-xl leading-tight text-white">
          Learn. Verify. Earn.
        </p>

        <div className="mt-auto flex gap-2 pt-8 pb-8">
          {notes.map((note, index) => (
            <button
              key={note.tag}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={
                activeIndex === index
                  ? "h-1 w-10 rounded-full bg-white"
                  : "h-1 w-4 rounded-full bg-white/35"
              }
              aria-label={`Tampilkan catatan ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ImageTile({
  image,
  active,
  className,
  priority,
}: {
  image: { src: string; alt: string };
  active: boolean;
  className?: string;
  priority?: boolean;
}) {
  return (
    <div className={cn("relative overflow-visible rounded-md", active ? "z-10" : "z-0", className)}>
      <Image
        src={image.src}
        alt={image.alt}
        fill
        priority={priority}
        sizes="(max-width: 1024px) 45vw, 22vw"
        className={cn(
          "rounded-md object-cover transition-opacity duration-700",
          active ? "opacity-100" : "opacity-40",
        )}
      />
      <FocusCorners active={active} />
    </div>
  );
}

function FocusCorners({ active }: { active: boolean }) {
  const baseClass = cn(
    "pointer-events-none absolute h-4 w-4 border-white/60 transition-all duration-500 ease-out",
    active ? "translate-x-0 translate-y-0 opacity-100" : "opacity-0",
  );

  return (
    <>
      <div
        className={cn(
          baseClass,
          "-top-2 -left-2 border-t border-l",
          !active && "-translate-x-2 -translate-y-2",
        )}
      />
      <div
        className={cn(
          baseClass,
          "-top-2 -right-2 border-t border-r",
          !active && "translate-x-2 -translate-y-2",
        )}
      />
      <div
        className={cn(
          baseClass,
          "-bottom-2 -left-2 border-b border-l",
          !active && "-translate-x-2 translate-y-2",
        )}
      />
      <div
        className={cn(
          baseClass,
          "-right-2 -bottom-2 border-b border-r",
          !active && "translate-x-2 translate-y-2",
        )}
      />
    </>
  );
}
