import Link from "next/link";
import { getAllPrograms } from "@/lib/courses/explore-queries";
import { buildListingMetadata } from "@/components/features/learning/program-listing";

export const metadata = buildListingMetadata(
  "Jenjang pendidikan",
  "Program pendidikan formal yang leviernya berbeda dari kursus singkat.",
);

/** Careevo belum punya program degree, jadi halaman ini jujur soal statusnya. */
const LEVELS = [
  {
    slug: "bachelors",
    label: "Sarjana (S1)",
    note: "Belum ada program sarjana di Careevo. Yang paling mendekati: program sertifikat profesional yang bisa dip.transfer ke semester berikutnya.",
  },
  {
    slug: "masters",
    label: "Magister (S2)",
    note: "Belum ada program magister. Untuk bidang data dan AI, jalur yang paling masuk akal sekarang: sertifikat profesional dari mitra kampus, lalu kumpulkan untuk transfer kredit.",
  },
  {
    slug: "university-certificates",
    label: "Sertifikat universitas",
    note: "Program sertifikat profesional dari universitas dan mitra refresher-nya.",
  },
];

export default function DegreesPage() {
  const programs = getAllPrograms();
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <section className="border-b border-[#E3E7EF] bg-[#F5F7FA] pt-20 pb-10 sm:pt-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="mb-2 text-xs font-semibold tracking-widest text-[#0056D2] uppercase">
            Earn an online degree
          </p>
          <h1 className="text-3xl leading-[1.15] font-extrabold tracking-tight text-[#0D0F12] sm:text-4xl lg:text-[40px]">
            Jenjang pendidikan
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-gray-700">
            Careevo sekarang fokus ke persiapan kerja dan sertifikat
            profesional, bukan gelar. Halaman ini menjelaskan mana yang sudah ada
            dan mana yang belum.
          </p>
        </div>
      </section>

      <section className="py-12 sm:py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {LEVELS.map((lv) => (
              <div
                key={lv.slug}
                className="rounded-2xl border border-[#C1CBDB] bg-white p-6"
              >
                <h2 className="text-lg font-bold text-[#0D0F12]">{lv.label}</h2>
                <p className="mt-2 text-sm leading-relaxed text-gray-700">
                  {lv.note}
                </p>
                <Link
                  href="/search?productType=Professional+Certificate"
                  className="mt-5 inline-block text-sm font-semibold text-[#0056D2] underline underline-offset-2 hover:text-[#0047A8]"
                >
                  Lihat sertifikat profesional
                </Link>
              </div>
            ))}
          </div>

          <div className="mt-12">
            <h2 className="mb-4 text-xl font-bold tracking-tight text-gray-900">
              Yang tersedia sekarang
            </h2>
            <ul className="divide-y divide-[#E3E7EF] rounded-2xl border border-[#C1CBDB] bg-white">
              {programs.map((p) => (
                <li key={p.slug}>
                  <Link
                    href={
                      p.type === "Professional Certificate"
                        ? `/professional-certificates/${p.slug}`
                        : `/specializations/${p.slug}`
                    }
                    className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 transition-colors hover:bg-[#F5F7FA]"
                  >
                    <span className="text-sm font-semibold text-[#0D0F12]">
                      {p.title}
                    </span>
                    <span className="text-xs text-gray-600">
                      {p.provider} · {p.durationWeeks} minggu
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
