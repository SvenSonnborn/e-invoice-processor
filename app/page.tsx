import {
  DocsPreviewSection,
  FeaturesSection,
  FinalCTASection,
  HeroSection,
  HowItWorksSection,
  MarketingFooter,
  MarketingHeader,
  PricingSection,
  ProblemSection,
  SolutionSection,
  TrustSection,
} from '@/src/components/marketing';

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <MarketingHeader />
      <main className="flex-1">
        <HeroSection />
        <ProblemSection />
        <SolutionSection />
        <HowItWorksSection />
        <FeaturesSection />
        <DocsPreviewSection />
        <PricingSection />
        <TrustSection />
        <FinalCTASection />
      </main>
      <MarketingFooter />
    </div>
  );
}
