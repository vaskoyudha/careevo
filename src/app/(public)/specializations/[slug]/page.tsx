import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProgramBySlug } from "@/lib/courses/catalog-data";
import { ProgramDetailView } from "@/components/features/learning/program-detail-view";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const program = getProgramBySlug(slug);
  return {
    title: `${program.title} | Careevo`,
    description: program.subtitle,
  };
}

export default async function SpecializationPage({ params }: Props) {
  const { slug } = await params;
  const program = getProgramBySlug(slug);

  if (!program) {
    notFound();
  }

  return <ProgramDetailView program={program} />;
}
