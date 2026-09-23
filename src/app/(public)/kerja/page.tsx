import type { Metadata } from "next";
import LokerPage, { metadata as lokerMetadata } from "@/app/(public)/loker/page";

export const metadata: Metadata = {
  ...lokerMetadata,
  title: "Papan Kerja Terverifikasi | Careevo",
};

export default LokerPage;
