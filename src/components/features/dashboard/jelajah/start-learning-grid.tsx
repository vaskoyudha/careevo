import Link from "next/link";
import { Pencil } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { CatalogCourseCard } from "@/components/ui/catalog-course-card";
import type { EntriKatalog } from "@/lib/courses/katalog";

/**
 * Grid "Mulai belajar" dari katalog belajar.
 *
 * Memakai `CatalogCourseCard` — kartu yang sama dengan katalog `/belajar` —
 * supaya status akses, provider, rating, dan meta level·durasi tampil identik
 * di kedua halaman. Tidak ada deskripsi karangan.
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
        className="text-4xl font-medium -tracking-[1.9px] text-[#0a3d62] sm:text-5xl lg:text-6xl"
      >
        Mulai belajar
      </h2>

      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p className="flex items-center gap-2 text-[13px] text-gray-600">
          Paling populer, ramah pemula
          {/* "Ubah" mengubah minat yang jadi dasar pilihan kursus di sini, jadi
              tujuannya formulir minat — sama seperti "Ubah minat" di dashboard.
              Awalnya menunjuk `/belajar/jalur`, yang tidak pernah menyangkut minat
              sama sekali. */}
          <Link
            href="/onboarding?edit=1"
            className="inline-flex items-center gap-1 font-medium text-[#0056D2]"
          >
            <Pencil className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" />
            Ubah
          </Link>
        </p>
        {topik.length > 0 ? (
          <p className="flex flex-wrap items-center gap-1.5 text-[13px] text-gray-600">
            <span>Topik populer:</span>
            {topik.map((tag, i) => (
              <span key={tag} className="flex items-center gap-1.5">
                {i > 0 ? <span aria-hidden="true">|</span> : null}
                <Link href={`/belajar?q=${encodeURIComponent(tag)}`} className="text-[#0056D2]">
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
          {entries.map((entry) => (
            <CatalogCourseCard key={entry.id} resource={entry} href={`/belajar/${entry.slug}`} />
          ))}
        </div>
      )}
    </section>
  );
}
