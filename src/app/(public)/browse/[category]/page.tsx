import {
  getProgramsByCategory,
  ALL_CATEGORY_SLUGS,
} from "@/lib/courses/explore-queries";
import { notFound } from "next/navigation";
import {
  ListingPage,
  buildListingMetadata,
} from "@/components/features/learning/program-listing";
import { CATEGORIES } from "@/lib/courses/explore-taxonomy";
import Link from "next/link";

interface Props {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ topic?: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { category } = await params;
  const label =
    CATEGORIES.find((c) => c.href.includes(`/browse/${category}`))?.label ??
    category;
  return buildListingMetadata(
    `Program ${label}`,
    `Kumpulan program dan spesialisasi di bidang ${label} di Careevo.`,
  );
}

export function generateStaticParams() {
  return ALL_CATEGORY_SLUGS.map((category) => ({ category }));
}

export default async function BrowseCategoryPage({ params, searchParams }: Props) {
  const { category } = await params;
  const { topic } = await searchParams;
  // Slug di luar daftar -> 404, jangan tampilkan katalog seluruhnya.
  if (!ALL_CATEGORY_SLUGS.includes(category)) notFound();
  const programs = getProgramsByCategory(category, topic);
  const label =
    CATEGORIES.find((c) => c.href.includes(`/browse/${category}`))?.label ??
    category;

  return (
    <ListingPage
      eyebrow="Kategori"
      title={topic ? `${label}: ${topic.replace(/-/g, " ")}` : label}
      description={`Program, spesialisasi, dan sertifikat profesional di bidang ${label}. Pilih yang paling dekat dengan posisi yang kamu incar.`}
      programs={programs}
    >
      <nav className="mt-6 flex flex-wrap gap-2">
        {ALL_CATEGORY_SLUGS.map((slug) => {
          const item = CATEGORIES.find((c) => c.href.includes(`/browse/${slug}`));
          const active = slug === category && !topic;
          return (
            <Link
              key={slug}
              href={item?.href ?? `/browse/${slug}`}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                active
                  ? "border-[#0056D2] bg-[#0056D2] text-white"
                  : "border-[#C1CBDB] bg-white text-gray-700 hover:border-[#0056D2] hover:text-[#0056D2]"
              }`}
            >
              {item?.label ?? slug}
            </Link>
          );
        })}
      </nav>
    </ListingPage>
  );
}
