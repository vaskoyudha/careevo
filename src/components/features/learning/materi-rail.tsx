"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ModulKursus } from "@/lib/courses/kurikulum";

/**
 * Daftar seluruh modul kursus — "outline yang menetap" milik reader.
 *
 * Ini yang membedakan reader dari akordeon lama: saat membaca, peta kemajuan
 * tetap terlihat, dan berpindah modul tidak perlu kembali ke silabus. Karena itu
 * rail memuat **semua** modul, bukan hanya yang sedang dibuka.
 *
 * Modul turunan (tanpa `halaman`/`materi`/`kuis`) tetap tampil sebagai baris
 * tanpa sub-item; ia bukan modul rusak, hanya modul yang isinya tautan
 * eksternal (`url`).
 */
export function MateriRail({
  slug,
  modul,
  modulAktif,
  selesai,
}: {
  slug: string;
  modul: ModulKursus[];
  /** Id modul yang sedang dibuka — satu baris, untuk `aria-current`. */
  modulAktif: string;
  /** Id modul yang sudah selesai; dari server, bukan dihitung di sini. */
  selesai: string[];
}) {
  const setSelesai = new Set(selesai);

  return (
    <nav aria-label="Daftar modul" className="flex flex-col gap-1">
      <p className="px-2 pb-1 text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
        Daftar modul
      </p>
      <ol className="flex flex-col gap-0.5">
        {modul.map((m, index) => {
          const aktif = m.id === modulAktif;
          const sudah = setSelesai.has(m.id);
          const jumlahHalaman = m.halaman?.length ?? 0;
          const jumlahLampiran = m.materi?.length ?? 0;
          const jumlahKuis = m.kuis?.length ?? 0;
          return (
            <li key={m.id}>
              <Link
                href={`/belajar/${slug}/materi/${m.id}`}
                aria-current={aktif ? "page" : undefined}
                className={cn(
                  "flex items-start gap-2.5 rounded-xl px-2.5 py-2 text-sm transition-colors",
                  aktif ? "bg-blue-50 text-[#0056D2]" : "text-gray-700 hover:bg-gray-50",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-bold",
                    sudah
                      ? "bg-emerald-500 text-white"
                      : aktif
                        ? "bg-[#0056D2] text-white"
                        : "bg-gray-100 text-gray-500",
                  )}
                >
                  {sudah ? <Check className="size-3" strokeWidth={3} /> : index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block leading-snug", aktif && "font-semibold")}>
                    {m.judul}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-gray-500">
                    {m.durasi_min} mnt
                    {jumlahHalaman > 0 ? ` · ${jumlahHalaman} halaman` : ""}
                    {jumlahLampiran > 0 ? ` · ${jumlahLampiran} lampiran` : ""}
                    {jumlahKuis > 0 ? ` · ${jumlahKuis} kuis` : ""}
                    {sudah ? " · Selesai" : ""}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
