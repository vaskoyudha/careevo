import { getProgramsBySearch } from "@/lib/courses/explore-queries";
import {
  ListingPage,
  buildListingMetadata,
} from "@/components/features/learning/program-listing";
import { CERTIFICATES } from "@/lib/courses/explore-taxonomy";

interface Props {
  searchParams: Promise<{ productType?: string; topic?: string }>;
}

export async function generateMetadata({ searchParams }: Props) {
  const { productType, topic } = await searchParams;
  const parts = [topic, productType].filter(Boolean);
  const title = parts.length ? parts.join(" · ") : "Cari program";
  return buildListingMetadata(
    title,
    "Filter program di Careevo berdasarkan jenis sertifikat dan bidang.",
  );
}

export default async function SearchPage({ searchParams }: Props) {
  const { productType, topic } = await searchParams;
  const programs = getProgramsBySearch(productType, topic);

  const decodedTopic = topic ? topic.replace(/%20/g, " ") : undefined;
  const decodedType = productType ? productType.replace(/%20/g, " ") : undefined;

  const title = decodedTopic
    ? `${decodedType === "Professional Certificate" ? "Sertifikat Profesional" : decodedType} — ${decodedTopic}`
    : decodedType === "Professional Certificate"
      ? "Sertifikat Profesional"
      : "Cari program";

  return (
    <ListingPage
      eyebrow="Pencarian"
      title={title}
      description="Program yang cocok dengan filter di atas. Semua yang tampil benar-benar ada di katalog."
      programs={programs}
    >
      <nav className="mt-6 flex flex-wrap gap-2">
        {CERTIFICATES.map((c) => (
          <a
            key={c.label}
            href={c.href}
            className="rounded-full border border-[#C1CBDB] bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:border-[#0056D2] hover:text-[#0056D2]"
          >
            {c.label}
          </a>
        ))}
      </nav>
    </ListingPage>
  );
}
