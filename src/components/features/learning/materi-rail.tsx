"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { RiCheckLine } from "@remixicon/react";
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
 *
 * `ringkas` adalah bentuk **ciut** rail, dan isinya sengaja tetap daftar yang
 * sama: lencana nomor/centang dengan judul di bawahnya, tanpa baris meta. Yang
 * dibuang hanya meta (`90 mnt · 2 halaman · 1 kuis`) — di 104px ia menjadi dua
 * baris teks 10px yang tidak terbaca, sementara lencananya sudah membawa seluruh
 * status yang penting (biru = sedang dibuka, hijau centang = selesai). Modul
 * yang tidak muat judulnya tetap punya `title`, jadi nama penuhnya tidak hilang.
 */
export function MateriRail({
  slug,
  modul,
  modulAktif,
  selesai,
  ringkas = false,
  aksi,
}: {
  slug: string;
  modul: ModulKursus[];
  /** Id modul yang sedang dibuka — satu baris, untuk `aria-current`. */
  modulAktif: string;
  /** Id modul yang sudah selesai; dari server, bukan dihitung di sini. */
  selesai: string[];
  /** Bentuk ciut: hanya lencana + judul, tanpa baris meta. */
  ringkas?: boolean;
  /**
   * Slot di baris judul rail — tombol ciut/bentang milik shell.
   *
   * Ditaruh di sini, bukan sebagai elemen terpisah di atas `<nav>`, karena
   * tempatnya memang **di dalam panel**: ia satu-satunya jalan membuka kembali
   * rail yang sudah ciut, jadi ia tidak boleh ikut menghilang bersama ruang
   * yang dikorbankan.
   *
   * Saat `ringkas`, judul "Daftar modul" disembunyikan (tidak muat) dan barisnya
   * jadi `justify-center`, sehingga yang tersisa hanya tombolnya; `<nav>` tetap
   * ber-`aria-label` "Daftar modul", jadi namanya tidak hilang bagi pembaca
   * layar.
   */
  aksi?: ReactNode;
}) {
  const setSelesai = new Set(selesai);

  return (
    <nav aria-label="Daftar modul" className="flex flex-col gap-1">
      <div
        className={cn(
          "flex items-center gap-1 pb-1",
          ringkas ? "justify-center" : "justify-between px-2",
        )}
      >
        {ringkas ? null : (
          <p className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
            Daftar modul
          </p>
        )}
        {aksi}
      </div>
      <ol className="flex flex-col gap-0.5">
        {modul.map((m, index) => {
          const aktif = m.id === modulAktif;
          const sudah = setSelesai.has(m.id);
          const jumlahHalaman = m.halaman?.length ?? 0;
          const jumlahLampiran = m.materi?.length ?? 0;
          const jumlahKuis = m.kuis?.length ?? 0;
          // Lencana dipakai di kedua bentuk, jadi warnanya dihitung sekali:
          // "sedang dibuka" dan "sudah selesai" tidak boleh berbeda antara rail
          // penuh dan rail ciut.
          const lencana = cn(
            "grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-bold",
            sudah
              ? "bg-emerald-500 text-white"
              : aktif
                ? "bg-[#0056D2] text-white"
                : "bg-gray-100 text-gray-500",
          );
          return (
            <li key={m.id}>
              <Link
                href={`/belajar/${slug}/materi/${m.id}`}
                aria-current={aktif ? "page" : undefined}
                // Di bentuk ciut judulnya terpotong `line-clamp-2`; `title`
                // mengembalikan nama penuhnya saat disinggahi kursor.
                title={ringkas ? `${index + 1}. ${m.judul}` : undefined}
                className={cn(
                  "transition-colors",
                  ringkas
                    ? "flex w-full flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-center"
                    : "flex items-start gap-2.5 rounded-xl px-2.5 py-2 text-sm",
                  aktif ? "bg-blue-50 text-[#0056D2]" : "text-gray-700 hover:bg-gray-50",
                )}
              >
                <span aria-hidden="true" className={ringkas ? lencana : cn(lencana, "mt-0.5")}>
                  {sudah ? <RiCheckLine className="size-3" /> : index + 1}
                </span>
                {ringkas ? (
                  <span
                    className={cn(
                      "line-clamp-2 w-full text-center text-[10px] leading-tight font-medium tracking-tight",
                      aktif && "font-semibold",
                    )}
                  >
                    {m.judul}
                    {/* Di bentuk ciut, satu-satunya penanda "selesai" adalah
                        centang yang `aria-hidden`. Tanpa teks ini pembaca layar
                        kehilangan status yang justru alasan rail ada. */}
                    {sudah ? <span className="sr-only"> · Selesai</span> : null}
                  </span>
                ) : (
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
                )}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
