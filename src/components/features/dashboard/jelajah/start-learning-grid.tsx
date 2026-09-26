import Link from "next/link";
import { Pencil } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import type { EntriKatalog } from "@/lib/courses/katalog";
import { ringkasEntri } from "./format";

/**
 * Grid "Mulai belajar" dari katalog belajar.
 *
 * Pita warna di atas kartu menandai status akses yang nyata: hijau untuk entri
 * gratis, biru untuk yang termasuk Careevo Plus. Keterangan di bawah judul
 * dirakit dari `provider`, `duration_min`, dan `level` — bukan deskripsi karangan.
 */
export function StartLearningGrid({
  entries,
  topik,
}: {
  entries: EntriKatalog[];
  topik: string[];
}) {
  return (
    <section aria-labelledby="mulai-belajar">
      <h2
        id="mulai-belajar"
        className="text-xl font-semibold tracking-tight text-[#0a2a3a]"
      >
        Mulai belajar
      </h2>

      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p className="flex items-center gap-2 text-[13px] text-[#48606e]">
          Paling populer, ramah pemula
          <Link
            href="/belajar/jalur"
            className="inline-flex items-center gap-1 font-medium text-[#1b6ca8]"
          >
            <Pencil className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" />
            Ubah
          </Link>
        </p>
        {topik.length > 0 ? (
          <p className="flex flex-wrap items-center gap-1.5 text-[13px] text-[#48606e]">
            <span>Topik populer:</span>
            {topik.map((tag, i) => (
              <span key={tag} className="flex items-center gap-1.5">
                {i > 0 ? <span aria-hidden="true">|</span> : null}
                <Link href={`/belajar?q=${encodeURIComponent(tag)}`} className="text-[#1b6ca8]">
                  {tag}
                </Link>
              </span>
            ))}
          </p>
        ) : null}
      </div>

      {entries.length === 0 ? (
        <div className="mt-4">
          <EmptyState title="Katalog masih kosong">
            Kursus yang terbit akan tampil di sini.
          </EmptyState>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {entries.map((entry) => {
            const gratis = entry.is_free;
            return (
              <Link
                key={entry.id}
                href={`/belajar/${entry.slug}`}
                className="group flex h-full flex-col overflow-hidden rounded-[14px] border border-[#cbe6ef] bg-white transition-shadow hover:shadow-md"
              >
                <span
                  className={
                    gratis
                      ? "bg-[#2e8b57] px-3 py-1 text-[11px] font-semibold tracking-wide text-white"
                      : "bg-[#1b6ca8] px-3 py-1 text-[11px] font-semibold tracking-wide text-white"
                  }
                >
                  {gratis ? "Kursus gratis" : "Termasuk Careevo Plus"}
                </span>
                <div className="flex flex-1 flex-col p-3.5">
                  <h3 className="line-clamp-2 text-[15px] leading-snug font-semibold text-[#0a2a3a]">
                    {entry.title}
                  </h3>
                  <p className="mt-1.5 line-clamp-3 text-[12px] text-[#48606e]">
                    {ringkasEntri(entry.provider, entry.duration_min, entry.level)}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
