import Link from "next/link";
import { ArrowRight, Briefcase } from "lucide-react";
import { LABELS, type OnboardingProfile } from "@/lib/onboarding/types";
import { rekomendasiUntukProfil } from "@/lib/onboarding/rekomendasi";
import { CatalogCourseCard } from "@/components/ui/catalog-course-card";

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

      {kursus.length > 0 ? (
        <div className="mb-6">
          <p className="mb-3 text-[11px] font-bold tracking-wider text-[#0056D2] uppercase">
            Kursus
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {kursus.map((entry) => (
              <CatalogCourseCard key={entry.slug} resource={entry} href={`/belajar/${entry.slug}`} />
            ))}
          </div>
        </div>
      ) : null}

      {loker.length > 0 ? (
        <div>
          <p className="mb-1 flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-[#0056D2] uppercase">
            <Briefcase className="size-3.5" />
            Loker
          </p>
          <ul className="m-0 list-none p-0">
            {loker.map((job) => (
              <li
                key={job.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-gray-100 py-3 last:border-b-0"
              >
                <Link
                  href={`/loker/${job.id}`}
                  className="min-w-0 flex-1 text-sm font-bold text-gray-900 hover:text-[#0056D2]"
                >
                  {job.title}
                </Link>
                <span className="flex shrink-0 flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-[#0056D2]">
                    {job.level}
                  </span>
                  {job.salary_range ? (
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-[#0056D2]">
                      {job.salary_range}
                    </span>
                  ) : null}
                </span>
                <span className="w-full text-xs text-gray-500">
                  {job.company} · {job.location}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
