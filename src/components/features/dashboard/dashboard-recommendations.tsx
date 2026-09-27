import Link from "next/link";
import { ArrowRight, Banknote, Briefcase, Building2, GraduationCap, MapPin } from "lucide-react";
import { LABELS, levelLabel, type OnboardingProfile } from "@/lib/onboarding/types";
import { rekomendasiUntukProfil } from "@/lib/onboarding/rekomendasi";
import { CatalogCourseCard } from "@/components/ui/catalog-course-card";
import { StatusBadge } from "@/components/ui/status-badge";

/**
 * Personalized recommendation strip for the dashboard.
 *
 * Kursus tampil sebagai kartu katalog (kartu yang sama dengan `/belajar` dan
 * `/jelajah`); loker tetap baris ringkas supaya ranking dan meta gaji tetap
 * terbaca sekilas. Server component — data is scoped to the signed profile.
 */
export async function DashboardRecommendations({
  profile,
}: {
  profile: OnboardingProfile;
}) {
  const { kursus, loker } = await rekomendasiUntukProfil(profile);

  const interestLabels = profile.interests.map((i) => LABELS.interest[i]).join(", ");

  return (
    <section
      className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs"
      aria-labelledby="personal-title"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div>
          <h2 className="text-base font-bold text-gray-900" id="personal-title">
            Dipilih untukmu
          </h2>
          <p className="mt-0.5 text-[13px] text-gray-500">
            Berdasarkan minat: {interestLabels} · target {profile.weeklyHours} jam/minggu
          </p>
        </div>
        <Link
          href="/onboarding?edit=1"
          className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-[#0056D2] whitespace-nowrap"
        >
          Ubah minat
          <ArrowRight className="size-3.5" />
        </Link>
      </div>

      {kursus.length === 0 && loker.length === 0 ? (
        <p className="text-xs text-gray-500">
          Belum ada rekomendasi yang cocok. Coba tambah minat di Pengaturan.
        </p>
      ) : null}

      {kursus.length > 0 && loker.length === 0 ? (
        <p className="text-xs text-gray-500">
          Belum ada lowongan yang cocok untuk minatmu saat ini. Coba ubah minat, atau jelajahi semua lowongan di{" "}
          <Link href="/loker" className="font-medium text-[#0056D2] hover:underline">
            halaman loker
          </Link>
          .
        </p>
      ) : null}

      {kursus.length > 0 ? (
        <div className="mb-6">
          <h3
            id="kursus-mu"
            className="mb-3 text-[11px] font-bold tracking-wider text-[#0056D2] uppercase"
          >
            Kursus
          </h3>
          <div
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            role="group"
            aria-labelledby="kursus-mu"
          >
            {kursus.map((entry) => (
              <CatalogCourseCard key={entry.slug} resource={entry} href={`/belajar/${entry.slug}`} />
            ))}
          </div>
        </div>
      ) : null}

      {loker.length > 0 ? (
        <div>
          <h3
            id="loker-mu"
            className="mb-2 flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-[#0056D2] uppercase"
          >
            <Briefcase className="size-3.5" aria-hidden="true" />
            Loker
            <span className="ml-1 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-[#0056D2]">
              {loker.length}
            </span>
            <Link
              href="/loker"
              className="ml-auto text-[11px] font-medium text-[#0056D2] normal-case hover:underline"
            >
              Lihat semua
            </Link>
          </h3>
          <ul className="list-app m-0 list-none p-0" aria-labelledby="loker-mu">
            {loker.map((job) => (
              <li key={job.id} className="list-app-row group relative">
                <Link
                  href={`/loker/${job.id}`}
                  className="row-title min-w-0 font-semibold text-gray-900 transition-colors duration-200 after:absolute after:inset-0 after:z-10 group-hover:text-[#0056D2]"
                  aria-label={`${job.title} — ${job.company}, ${job.location}, ${levelLabel(job.level)}${job.salary_range ? `, gaji ${job.salary_range}` : ""}`}
                >
                  {job.title}
                </Link>
                <span className="row-aside">
                  {job.salary_range ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                      <Banknote className="size-3 text-emerald-600" aria-hidden="true" />
                      {job.salary_range}
                    </span>
                  ) : (
                    <span className="text-[11px] text-gray-400">Gaji belum dicantumkan</span>
                  )}
                  <StatusBadge status={job.sentinel_status} />
                </span>
                <span className="row-meta flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="inline-flex items-center gap-1.5">
                    <Building2 className="size-3.5 text-gray-400" aria-hidden="true" />
                    {job.company}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="size-3.5 text-gray-400" aria-hidden="true" />
                    {job.location}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <GraduationCap className="size-3.5 text-gray-400" aria-hidden="true" />
                    {levelLabel(job.level)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
