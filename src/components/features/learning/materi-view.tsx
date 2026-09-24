"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Materi, SoalKuis } from "@/types/course";

/**
 * Renderer materi per tipe untuk sisi learner.
 *
 * Dipakai halaman detail kursus dan pratinjau di panel admin, supaya yang
 * dilihat admin saat menyusun materi sama persis dengan yang dilihat peserta.
 *
 * Hanya **lampiran** yang dirender di sini. Prosa ditulis sebagai halaman
 * berformat dan dirender `halaman-view.tsx` — lihat catatan di `TipeMateri`.
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
    case "kuis":
      return <MateriKuis soal={materi.soal} nilaiLulus={materi.nilai_lulus} className={className} />;
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
          "block rounded-xl border border-gray-200 bg-white p-4 text-sm font-medium text-[#0056D2] hover:underline",
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

export function MateriKuis({
  soal,
  nilaiLulus,
  className,
}: {
  soal: SoalKuis[];
  nilaiLulus: number;
  className?: string;
}) {
  const [jawaban, setJawaban] = useState<Record<string, number>>({});
  const [nilai, setNilai] = useState<number | null>(null);

  const terjawab = Object.keys(jawaban).length;

  const nilaiSekarang = () => {
    if (soal.length === 0) return 0;
    const benar = soal.filter((s) => jawaban[s.id] === s.jawaban_benar).length;
    return Math.round((benar / soal.length) * 100);
  };

  return (
    <div className={cn("rounded-xl border border-gray-200 bg-white p-4", className)}>
      <ol className="space-y-4">
        {soal.map((s, index) => (
          <li key={s.id}>
            <p className="text-sm font-semibold text-gray-900">
              {index + 1}. {s.pertanyaan}
            </p>
            <div className="mt-2 space-y-1.5">
              {s.pilihan.map((pilihan, i) => {
                const dipilih = jawaban[s.id] === i;
                // Setelah dinilai, tandai mana yang benar — umpan balik yang
                // membuat kuis berguna, bukan sekadar angka di akhir.
                const benar = nilai !== null && i === s.jawaban_benar;
                const salah = nilai !== null && dipilih && i !== s.jawaban_benar;
                return (
                  <label
                    key={`${s.id}-${i}`}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                      benar
                        ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                        : salah
                          ? "border-red-300 bg-red-50 text-red-800"
                          : "border-gray-200 hover:bg-gray-50",
                    )}
                  >
                    <input
                      type="radio"
                      name={s.id}
                      checked={dipilih}
                      onChange={() => setJawaban((prev) => ({ ...prev, [s.id]: i }))}
                      className="accent-[#0056D2]"
                    />
                    <span className="text-gray-700">{pilihan}</span>
                  </label>
                );
              })}
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setNilai(nilaiSekarang())}
          disabled={terjawab < soal.length}
          className="cursor-pointer rounded-full bg-[#0056D2] px-4 py-2 text-xs font-semibold text-white hover:bg-[#00419e] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Periksa jawaban
        </button>
        <span className="text-xs text-gray-500">
          {terjawab} dari {soal.length} soal terjawab · nilai lulus {nilaiLulus}
        </span>
      </div>

      {nilai !== null ? (
        <p
          role="status"
          className={cn(
            "mt-3 rounded-lg px-3 py-2 text-sm font-medium",
            nilai >= nilaiLulus ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800",
          )}
        >
          Nilaimu {nilai}. {nilai >= nilaiLulus ? "Lulus!" : `Belum lulus — minimal ${nilaiLulus}.`}
        </p>
      ) : null}
    </div>
  );
}
