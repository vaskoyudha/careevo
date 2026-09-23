import type { Metadata } from "next";
import {
  CareevoPlusPromoBanner,
  CareevoPlusSubNav,
} from "@/components/features/marketing/careevo-plus/header";
import { CareevoPlusHero } from "@/components/features/marketing/careevo-plus/hero";
import { CareevoPlusLogos } from "@/components/features/marketing/careevo-plus/logos";
import { CareevoPlusSkills } from "@/components/features/marketing/careevo-plus/skills";
import { CareevoPlusFeatures } from "@/components/features/marketing/careevo-plus/features";
import { CareevoPlusTestimonials } from "@/components/features/marketing/careevo-plus/testimonials";
import { CareevoPlusPlans } from "@/components/features/marketing/careevo-plus/plans";
import { CareevoPlusCta } from "@/components/features/marketing/careevo-plus/cta";
import { CareevoPlusFaq } from "@/components/features/marketing/careevo-plus/faq";
import { CareevoPlusTerms } from "@/components/features/marketing/careevo-plus/terms";

export const metadata: Metadata = {
  title: "Careevo Plus | Hemat 40% — Belajar Fleksibel, Raih Karier Impian",
  description:
    "Akses 10.000+ program dari Microsoft, Google, Meta, Stanford, dan lainnya. Hemat 40% selama 3 bulan dengan Careevo Plus. Batalkan kapan saja.",
};

export default function CareevoPlusPage() {
  return (
    <div className="marketing-type bg-white">
      <CareevoPlusPromoBanner />
      <CareevoPlusSubNav />
      <CareevoPlusHero />
      <CareevoPlusLogos />
      <CareevoPlusSkills />
      <CareevoPlusFeatures />
      <CareevoPlusTestimonials />
      <CareevoPlusPlans />
      <CareevoPlusCta />
      <CareevoPlusFaq />
      <CareevoPlusTerms />
    </div>
  );
}
