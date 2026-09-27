"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { BookOpen, GraduationCap, Loader2 } from "lucide-react";
import {
  rekomendasiKursusInboxAction,
  type RekomendasiInboxState,
} from "@/actions/loker-inbox-persiapan";

/**
 * PersiapanLoker — kursus yang menyiapkan untuk satu lowongan hasil pindai.
 *
 * Sifatnya: **dibuka satu per satu, atas permintaan.** 214 baris dengan deskripsi
 * yang harus diambil satu per satu bukan sesuatu yang boleh di-fetch saat render;
 * panel ini tetap diam sampai diminta.
 *
 * Yang ditampilkan panel ini, tanpa kecuali:
 *
 *  - **Dari mana sinyalnya** (`catatan`). Judul peran saja dan deskripsi penuh
 *    memberi daftar yang berbeda, dan menyamarkannya membuat dua rekomendasi
 *    dengan keyakinan berbeda tampak sama.
 *  - **Kursus yang tidak ada** sebagai keadaan yang normal, bukan kesalahan.
 *    143 dari 214 baris memang tidak punya kursus yang cukup relevan — katalog
 *    hanya 20 entri — dan itu fakta soal katalog, bukan bukti lowongannya tidak
 *    menuntut apa pun.
 */
export function PersiapanLoker({
  url,
  role,
  company,
}: {
  url: string;
  role: string;
  company: string;
}) {
  const [state, setState] = useState<RekomendasiInboxState | null>(null);
  const [buka, setBuka] = useState(false);
  const [pending, mulai] = useTransition();

  function toggle() {
    // Hanya diambil sekali: katalog dan cache tidak berubah di antara dua
    // klik pada baris yang sama, jadi permintaan kedua hanya menambah latency.
    if (buka) {
      setBuka(false);
      return;
    }
    setBuka(true);
    if (state || pending) return;
    mulai(async () => setState(await rekomendasiKursusInboxAction(url)));
  }

  if (!buka) {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-expanded={false}
        className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--card)] px-2.5 py-1 text-[10px] font-semibold text-[var(--primary)] transition-colors hover:border-[var(--primary)]/40"
      >
        <GraduationCap className="size-3" aria-hidden />
        Persiapan
      </button>
    );
  }

  return (
    <div className="mt-2 border-t border-[var(--border)]/35 px-3.5 py-2.5">
      {pending ? (
        <p className="flex items-center gap-1.5 text-[11px] text-[var(--muted-foreground)]">
          <Loader2 className="size-3 animate-spin" aria-hidden />
          Mencari kursus…
        </p>
      ) : !state ? null : !state.ok ? (
        <p className="text-[11px] text-[var(--destructive)]">{state.pesan}</p>
      ) : state.kursus.length === 0 ? (
        <p className="text-[11px] leading-relaxed text-[var(--muted-foreground)]">
          Belum ada kursus yang cocok untuk lowongan ini. Katalog belajar masih
          kecil, jadi ini belum tentu berarti lowongannya tidak menuntut apa pun
          — lebih sering berarti katalog yang belum lengkap.
        </p>
      ) : (
        <>
          <ul className="space-y-1.5">
            {state.kursus.map(({ entry }) => (
              <li key={entry.id}>
                <Link
                  href={`/belajar/${entry.slug}`}
                  className="group flex items-start gap-2 rounded-lg px-1.5 py-1 transition-colors hover:bg-[color-mix(in_srgb,var(--foreground)_4%,transparent)]"
                >
                  <BookOpen
                    className="mt-0.5 size-3.5 shrink-0 text-[var(--primary)]"
                    aria-hidden
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-[12px] font-semibold text-[var(--foreground)] group-hover:text-[var(--primary)]">
                      {entry.title}
                    </span>
                    {entry.tags.length > 0 ? (
                      <span className="block truncate text-[10.5px] text-[var(--muted-foreground)]">
                        {entry.tags.join(" · ")}
                      </span>
                    ) : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[10.5px] leading-relaxed text-[var(--muted-foreground)]/80">
            {state.catatan} Untuk {role} di {company}.
          </p>
        </>
      )}
    </div>
  );
}
