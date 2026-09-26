import { getCertificationPrep } from "@/lib/courses/explore-queries";
import {
  ListingPage,
  buildListingMetadata,
} from "@/components/features/learning/program-listing";

export const metadata = buildListingMetadata(
  "Persiapan ujian sertifikasi",
  "Program yang materinya paling dekat dengan silabi ujian sertifikasi kerja.",
);

export default function CertificationPrepPage() {
  const programs = getCertificationPrep();
  return (
    <ListingPage
      eyebrow="Prepare for a certification exam"
      title="Persiapan ujian sertifikasi"
      description="Kalau targetmu sertifikat profesional, mulailah dari program yang materinya paling dekat dengan silabi ujian."
      programs={programs}
    />
  );
}
