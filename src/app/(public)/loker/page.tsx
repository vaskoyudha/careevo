import type { Metadata } from "next";
import { ambilLokerBersih, ambilLokerTampil } from "@/lib/jobs/cache";
import { VertexKerjaView } from "@/components/features/jobs/vertex-kerja-view";

export const metadata: Metadata = {
  title: "Papan Lowongan Kerja Terverifikasi | Careevo",
  description: "Kurasi loker resmi KarirHub yang diaudit Sentinel AI, filter 100% no-fee, dan fit score transparan.",
};

export default async function LokerPage() {
  const jobs = await ambilLokerTampil();
  const bersih = await ambilLokerBersih();

  return <VertexKerjaView jobs={jobs} cleanJobsCount={bersih.length} />;
}
