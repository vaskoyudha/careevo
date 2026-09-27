import { notFound } from "next/navigation";
import {
  getProgramsByRole,
  getRole,
  ALL_ROLE_SLUGS,
} from "@/lib/courses/explore-queries";
import {
  ListingPage,
  buildListingMetadata,
} from "@/components/features/learning/program-listing";

interface Props {
  params: Promise<{ role: string }>;
}

export function generateStaticParams() {
  return ALL_ROLE_SLUGS.map((role) => ({ role }));
}

export async function generateMetadata({ params }: Props) {
  const { role: slug } = await params;
  const role = getRole(slug);
  return buildListingMetadata(
    `Karier ${role?.label ?? slug}`,
    `Program, skill, dan latihan yang dibutuhkan untuk posisi ${role?.label ?? slug}.`,
  );
}

export default async function RolePage({ params }: Props) {
  const { role: slug } = await params;
  const role = getRole(slug);
  if (!role) notFound();

  const programs = getProgramsByRole(slug);

  return (
    <ListingPage
      eyebrow="Explore roles"
      title={role.label}
      description={`Skill yang paling sering diminta untuk posisi ${role.label}, lalu program yang bisa kamu pelajari.`}
      programs={programs}
    />
  );
}
