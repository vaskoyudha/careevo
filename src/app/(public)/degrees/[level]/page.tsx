import { notFound } from "next/navigation";
import { ListingPage, buildListingMetadata } from "@/components/features/learning/program-listing";
import { getProgramsBySearch } from "@/lib/courses/explore-queries";

const VALID = new Set(["bachelors", "masters", "university-certificates"]);

const LABEL: Record<string, string> = {
  bachelors: "Sarjana (S1)",
  masters: "Magister (S2)",
  "university-certificates": "Sertifikat universitas",
};

const NOTE: Record<string, string> = {
  bachelors:
    "Jenjang sarjana belum tersedia di Careevo. Yang paling mendekati adalah sertifikat profesional di bawah ini.",
  masters:
    "Jenjang magister belum tersedia di Careevo. Untuk bidang data dan AI, kumpulkan pengalaman dari sertifikat profesional di bawah ini.",
  "university-certificates":
    "Sertifikat universitas di Careevo berupa sertifikat profesional dari mitra akademik.",
};

interface Props {
  params: Promise<{ level: string }>;
}

export function generateStaticParams() {
  return [...VALID].map((level) => ({ level }));
}

export async function generateMetadata({ params }: Props) {
  const { level } = await params;
  return buildListingMetadata(
    LABEL[level] ?? level,
    "Program yang tersedia untuk jenjang ini di Careevo.",
  );
}

export default async function DegreeLevelPage({ params }: Props) {
  const { level } = await params;
  if (!VALID.has(level)) notFound();

  const programs = getProgramsBySearch("Professional Certificate");

  return (
    <ListingPage
      eyebrow="Earn an online degree"
      title={LABEL[level]}
      description={NOTE[level]}
      programs={programs}
    />
  );
}