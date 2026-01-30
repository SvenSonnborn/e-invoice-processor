import { Button } from '@/src/components/ui/button';
import { ArrowRight, CheckCircle2, Sparkles } from 'lucide-react';
import Link from 'next/link';

const benefits = [
  'No credit card required',
  '5 free invoices per month',
  'Full feature access',
  'Setup in under 2 minutes',
];

export const FinalCTASection = () => {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-brand-600 via-brand-700 to-brand-800 py-20 md:py-28">
      {/* Background pattern */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
        aria-hidden="true"
      />

      {/* Gradient orbs */}
      <div
        className="absolute -left-40 top-0 h-[400px] w-[400px] rounded-full bg-brand-400/30 blur-[100px]"
        aria-hidden="true"
      />
      <div
        className="absolute -bottom-40 -right-40 h-[400px] w-[400px] rounded-full bg-brand-500/30 blur-[100px]"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-[1200px] px-4 md:px-6">
        <div className="mx-auto max-w-3xl text-center">
          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium text-white backdrop-blur-sm">
            <Sparkles className="h-4 w-4" />
            Ready to get started?
          </div>

          {/* Headline */}
          <h2 className="text-3xl font-semibold tracking-tight text-white md:text-4xl lg:text-5xl">
            Start processing e-invoices in minutes
          </h2>

          {/* Subheadline */}
          <p className="mx-auto mt-6 max-w-xl text-lg text-brand-100">
            Join thousands of businesses who have simplified their invoice
            compliance. Get started for free today.
          </p>

          {/* Benefits */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {benefits.map((benefit) => (
              <div
                key={benefit}
                className="flex items-center gap-2 text-sm text-brand-100"
              >
                <CheckCircle2 className="h-4 w-4 text-brand-300" />
                <span>{benefit}</span>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button
              size="lg"
              className="h-14 bg-white px-8 text-base font-semibold text-brand-600 shadow-xl shadow-brand-900/20 hover:bg-brand-50"
              asChild
            >
              <Link href="/signup">
                Create free account
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-14 border-white/30 bg-transparent px-6 text-base text-white hover:bg-white/10"
              asChild
            >
              <Link href="#how-it-works">See how it works</Link>
            </Button>
          </div>

          {/* Trust note */}
          <p className="mt-8 text-sm text-brand-200">
            Trusted by 1,000+ businesses across Germany
          </p>
        </div>
      </div>
    </section>
  );
};
