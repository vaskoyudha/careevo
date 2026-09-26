import Link from "next/link";
import { getProgramsByRole, ALL_ROLE_SLUGS, getRole } from "@/lib/courses/explore-queries";
import {
  buildListingMetadata,
} from "@/components/features/learning/program-listing";
import { ROLES } from "@/lib/courses/explore-taxonomy";

export const metadata = buildListingMetadata(
  "Karier",
  "Pilih posisi yang kamu incar, lalu lihat program dan skill yang dibutuhkan.",
);

export default function CareerAcademyPage() {
  const roles = ALL_ROLE_SLUGS.map((slug) => ({
    slug,
    label: getRole(slug)?.label ?? slug,
    count: getProgramsByRole(slug).length,
  }));

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <section className="border-b border-[#E3E7EF] bg-[#F5F7FA] pt-20 pb-12 sm:pt-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="mb-2 text-xs font-semibold tracking-widest text-[#0056D2] uppercase">
            Explore roles
          </p>
          <h1 className="text-3xl leading-[1.15] font-extrabold tracking-tight text-[#0D0F12] sm:text-4xl lg:text-[40px]">
            Mulai dari posisi yang kamu incar
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-gray-700">
            Ambil satu posisi, lihat skill yang paling sering diminta, lalu
            latih yang kurang dulu. Bukan daftar kursus, tapi urutan jalan keluar.
          </p>
        </div>
      </section>

      <section className="py-12 sm:py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {roles.map((role) => (
              <Link
                key={role.slug}
                href={`/career-academy/roles/${role.slug}`}
                className="group flex items-center justify-between rounded-xl border border-[#C1CBDB] bg-white p-5 transition-[transform,border-color] duration-150 hover:-translate-y-0.5 hover:border-[#0056D2] active:scale-[0.98]"
              >
                <span className="text-base font-bold text-[#0D0F12] group-hover:text-[#0056D2]">
                  {role.label}
                </span>
                <span className="ml-4 shrink-0 text-xs text-gray-600">
                  {role.count > 0 ? `${role.count} program` : "Segera"}
                </span>
              </Link>
            ))}
          </div>
          <p className="mt-6 text-xs text-gray-500">
            {ROLES.length} posisi tersedia.
          </p>
        </div>
      </section>
    </div>
  );
}
