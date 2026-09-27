import Link from "next/link";
import { getProgramsByCategory, ALL_CATEGORY_SLUGS } from "@/lib/courses/explore-queries";
import {
  ListingPage,
  buildListingMetadata,
} from "@/components/features/learning/program-listing";
import { CATEGORIES } from "@/lib/courses/explore-taxonomy";

export const metadata = buildListingMetadata(
  "Jelajahi kategori",
  "Semua bidang yang tersedia di Careevo, dari data science sampai keamanan siber.",
);

export default function BrowseIndexPage() {
  const categories = ALL_CATEGORY_SLUGS.map((slug) => {
    const item = CATEGORIES.find((c) => c.href.includes(`/browse/${slug}`));
    return {
      slug,
      label: item?.label ?? slug,
      count: getProgramsByCategory(slug).length,
    };
  });

  const all = categories.reduce((n, c) => n + c.count, 0);

  return (
    <ListingPage
      eyebrow="Explore categories"
      title="Jelajahi per bidang"
      description="Pilih bidang yang mau kamu masuki. Daftar program di bawah dihitung dari katalog yang benar-benar ada, bukan placeholder."
      programs={[]}
    >
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {categories.map((cat) => (
          <Link
            key={cat.slug}
            href={`/browse/${cat.slug}`}
            className="flex flex-col justify-between rounded-xl border border-[#C1CBDB] bg-white p-4 transition-[transform,border-color] duration-150 hover:-translate-y-0.5 hover:border-[#0056D2] active:scale-[0.98]"
          >
            <span className="text-sm font-bold text-[#0D0F12]">{cat.label}</span>
            <span className="mt-3 text-xs text-gray-600">
              {cat.count > 0
                ? `${cat.count} program`
                : "Belum ada program"}
            </span>
          </Link>
        ))}
      </div>
      <p className="mt-4 text-xs text-gray-500">
        {all} program terdaftar di {categories.length} bidang.
      </p>
    </ListingPage>
  );
}
