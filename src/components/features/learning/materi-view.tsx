"use client";

import { cn } from "@/lib/utils";
import type { Materi } from "@/types/course";

/**
 * Renderer materi per tipe untuk sisi learner.
 *
 * Dipakai halaman detail kursus dan pratinjau di panel admin, supaya yang
 * dilihat admin saat menyusun materi sama persis dengan yang dilihat peserta.
 *
 * Hanya **lampiran** yang dirender di sini. Prosa ditulis sebagai halaman
 * berformat dan dirender `halaman-view.tsx`; asesmen ditulis sebagai kuis dan
 * dirender `kuis-view.tsx`. Lihat catatan di `TipeMateri`.
 *
 * `switch` di sini sengaja tanpa `default`: menambah varian `Materi` baru akan
 * menjadi error tipe di sini, bukan diam-diam tidak ter-render.
 */

/** Terima tautan tonton biasa dan kembalikan URL embed; null bila tak dikenal. */
export function keEmbedUrl(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }

  const host = u.hostname.replace(/^www\./, "");

  if (host === "youtu.be") {
    const id = u.pathname.slice(1);
    return id ? `https://www.youtube.com/embed/${id}` : null;
  }
  if (host === "youtube.com" || host === "m.youtube.com") {
    const id = u.searchParams.get("v");
    if (id) return `https://www.youtube.com/embed/${id}`;
    // Sudah bentuk /embed/<id>
    const cocok = u.pathname.match(/^\/embed\/([^/]+)/);
    return cocok ? `https://www.youtube.com/embed/${cocok[1]}` : null;
  }
  if (host === "vimeo.com") {
    const id = u.pathname.split("/").filter(Boolean)[0];
    return id ? `https://player.vimeo.com/video/${id}` : null;
  }

  return null;
}

function ukuranBerkas(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function MateriView({
  materi,
  className,
}: {
  materi: Materi;
  className?: string;
}) {
  switch (materi.tipe) {
    case "video":
      return <MateriVideo materi={materi} className={className} />;
    case "pdf":
      return (
        <div className={cn("rounded-xl border border-gray-200 bg-white p-4", className)}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-600">
              Dokumen PDF · {ukuranBerkas(materi.ukuran_bytes)}
            </p>
            <div className="flex gap-2">
              <a
                href={materi.path}
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-[#0056D2] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#00419e]"
              >
                Buka PDF ↗
              </a>
              <a
                href={materi.path}
                download
                className="rounded-full border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                Unduh
              </a>
            </div>
          </div>
          <object
            data={materi.path}
            type="application/pdf"
            className="mt-3 h-72 w-full rounded-lg border border-gray-200"
            aria-label={`Pratinjau PDF ${materi.judul}`}
          />
        </div>
      );
  }
}

function MateriVideo({
  materi,
  className,
}: {
  materi: Extract<Materi, { tipe: "video" }>;
  className?: string;
}) {
  const embed = keEmbedUrl(materi.url);

  if (!embed) {
    // Tautan yang bukan YouTube/Vimeo tetap berguna, tapi tidak bisa di-embed.
    return (
      <a
        href={materi.url}
        target="_blank"
        rel="noreferrer"
        className={cn(
          "block rounded-xl border border-gray-200 bg-white p-4 text-sm font-medium text-[#0056D2]",
          className,
        )}
      >
        Buka video ↗
      </a>
    );
  }

  return (
    <div className={cn("overflow-hidden rounded-xl border border-gray-200 bg-black", className)}>
      <iframe
        src={embed}
        title={materi.judul}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="aspect-video w-full"
      />
    </div>
  );
}
