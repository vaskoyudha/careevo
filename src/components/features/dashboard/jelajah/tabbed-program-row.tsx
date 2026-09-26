import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import type { ProgramDetails } from "@/lib/courses/catalog-data";
import { ProgramCard } from "./program-card";

/**
 * Kategori program memakai nama Coursera asli; label tab diterjemahkan di sini.
 * Kategori yang belum ada pemetaannya tetap tampil memakai nama aslinya —
 * lebih baik daripada tab hilang.
 */
const LABEL_KATEGORI: Record<string, string> = {
  "Data Science": "Data & AI",
  "Information Technology": "Teknologi",
  "Computer Science": "Komputasi",
  Business: "Bisnis",
};

export function TabbedProgramRow({
  programs,
  lihatSemuaHref,
}: {
  programs: ProgramDetails[];
  lihatSemuaHref: string;
}) {
  // Dikelompokkan di sini, bukan di pemanggil, supaya tab dan isi tab tidak
  // pernah berbeda jumlah karena dua sumber yang dihitung terpisah.
  const perKategori = new Map<string, ProgramDetails[]>();
  for (const program of programs) {
    const isi = perKategori.get(program.category) ?? [];
    isi.push(program);
    perKategori.set(program.category, isi);
  }
  const grup = [...perKategori.entries()].filter(([, isi]) => isi.length > 0);

  // Tab terisi dibuka lebih dulu, bukan tab pertama di enum. Satu kategori
  // bisa cuma punya satu program, dan baris berisi satu kartu di grid tiga
  // kolom terbaca seperti halaman yang gagal dimuat — bukan pilihan desain.
  const pertama = grup.reduce<string>(
    (terbaik, [kategori, isi]) =>
      isi.length > (perKategori.get(terbaik)?.length ?? 0) ? kategori : terbaik,
    grup[0]?.[0] ?? "",
  );

  if (grup.length === 0) {
    return (
      <section aria-labelledby="jelajah-program">
        <h2
          id="jelajah-program"
          className="text-xl font-semibold tracking-tight text-[#0a2a3a]"
        >
          Jelajahi kursus langsung
        </h2>
        <div className="mt-3">
          <EmptyState title="Belum ada program">
            Program dengan pengajar dan tanggal mulai akan muncul di sini.
          </EmptyState>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="jelajah-program">
      <h2
        id="jelajah-program"
        className="text-xl font-semibold tracking-tight text-[#0a2a3a]"
      >
        Jelajahi kursus langsung
      </h2>

      <Tabs defaultValue={pertama} className="mt-2 gap-0">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-[#cbe6ef] pb-2">
          {/* `TabsList` bersifat `inline-flex w-fit` dengan trigger `whitespace-nowrap`,
              jadi empat tab tidak pernah menyusut dan akan mendorong halaman melebihi
              lebar layar. Wrapper ini membuatnya bisa digeser horizontal. */}
          <div className="min-w-0 flex-1 overflow-x-auto">
            <TabsList variant="line">
              {grup.map(([kategori, isi]) => (
                <TabsTrigger key={kategori} value={kategori}>
                  {LABEL_KATEGORI[kategori] ?? kategori}
                  <span className="ml-1 text-[11px] text-[#8aa0ac]">{isi.length}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          <Link
            href={lihatSemuaHref}
            className="mb-1 shrink-0 text-[13px] font-medium text-[#1b6ca8] hover:underline"
          >
            Lihat program populer
          </Link>
        </div>

        {grup.map(([kategori, isi]) => (
          <TabsContent key={kategori} value={kategori} className="mt-4">
            {isi.length === 0 ? (
              <EmptyState title="Kategori ini belum terisi">
                Pilih kategori lain untuk melihat program yang tersedia.
              </EmptyState>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {isi.map((program) => (
                  <ProgramCard key={program.slug} program={program} />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
}
