import { HeroFinancial } from "@/components/ui/hero-financial";
import { MarketingAgents } from "@/components/features/marketing/guild-agents";
import { MarketingLogos } from "@/components/features/marketing/logos";
import { MarketingFeatures } from "@/components/features/marketing/features";
import { MarketingUseCases } from "@/components/features/marketing/use-cases";
import { MarketingIntegrations } from "@/components/features/marketing/integrations";
import { MarketingTestimonials } from "@/components/features/marketing/testimonials";
import { MarketingPricing } from "@/components/features/marketing/pricing";
import { MarketingFaq } from "@/components/features/marketing/faq";
import { MarketingCta } from "@/components/features/marketing/cta";

export default function Home() {
  return (
    <>
      <HeroFinancial />
      <MarketingAgents />
      <div className="marketing-type">
        <MarketingLogos />
        <MarketingFeatures />
        <MarketingUseCases />
        <MarketingIntegrations />
        <MarketingTestimonials />
        <MarketingPricing />
        <MarketingFaq />
        <MarketingCta />
      </div>
    </>
  );
}
