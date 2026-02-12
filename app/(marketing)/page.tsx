import {
  DocsPreviewSection,
  FeaturesSection,
  FinalCTASection,
  HeroSection,
  HowItWorksSection,
  PricingSection,
  ProblemSection,
  SolutionSection,
  TrustSection,
  WaitlistSection,
} from '@/src/components/marketing';

interface LandingPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function LandingPage({ searchParams }: LandingPageProps) {
  const params = await searchParams;
  const _referralCode = typeof params.ref === 'string' ? params.ref : null;

  return (
    <>
      <HeroSection />
      <ProblemSection />
      <SolutionSection />
      <HowItWorksSection />
      <FeaturesSection />
      <DocsPreviewSection />
      <PricingSection />
      <WaitlistSection />
      <TrustSection />
      <FinalCTASection />
    </>
  );
}
