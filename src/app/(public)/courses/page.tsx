import Link from "next/link";
import { getProgramsByQuery } from "@/lib/courses/explore-queries";
import {
  ListingPage,
  buildListingMetadata,
} from "@/components/features/learning/program-listing";
import { TRENDING_SKILLS } from "@/lib/courses/explore-taxonomy";

interface Props {
  searchParams: Promise<{ query?: string }>;
}

export async function generateMetadata({ searchParams }: Props) {
  const { query } = await searchParams;
  const q = query?.replace(/%20/g, " ") ?? "";
  return buildListingMetadata(
    q ? `Cari ${q}` : "Cari skill",
    "Temukan program berdasarkan skill yang lagi dipelajari banyak orang.",
  );
}

export default async function CoursesPage({ searchParams }: Props) {
  const { query } = await searchParams;
  const q = query?.replace(/%20/g, " ") ?? "";
  const programs = getProgramsByQuery(query);

  return (
    <ListingPage
      eyebrow="Skill"
      title={q ? `Skill: ${q}` : "Semua skill"}
      description={
        q
          ? `Program yang punya materi ${q}. Kalau hasilmu luas, berarti skill ini masih dipakai di banyak bidang.`
          : "Cari skill, lalu lihat program yang mengajari skill itu."}
      programs={programs}
    >
      <nav className="mt-6 flex flex-wrap gap-2">
        {TRENDING_SKILLS.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className={`rounded-full border px-3 py-2.5 text-xs font-semibold transition-colors ${
              s.label.toLowerCase() === q.toLowerCase()
                ? "border-[#0056D2] bg-[#0056D2] text-white"
                : "border-[#C1CBDB] bg-white text-gray-700 hover:border-[#0056D2] hover:text-[#0056D2]"
            }`}
          >
            {s.label}
          </Link>
        ))}
      </nav>
    </ListingPage>
  );
}
