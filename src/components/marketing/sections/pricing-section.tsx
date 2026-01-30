import { Button } from '@/src/components/ui/button';
import { ArrowRight, Check, CreditCard, HelpCircle, Sparkles, X } from 'lucide-react';
import Link from 'next/link';

type PricingPlan = {
  name: string;
  price: string;
  period: string;
  description: string;
  features: { text: string; included: boolean }[];
  cta: string;
  href: string;
  highlighted?: boolean;
  badge?: string;
};

const plans: PricingPlan[] = [
  {
    name: 'Free',
    price: '0',
    period: 'forever',
    description: 'Perfect for trying out the platform.',
    features: [
      { text: '5 invoices per month', included: true },
      { text: 'ZUGFeRD & XRechnung', included: true },
      { text: 'CSV export', included: true },
      { text: 'Community support', included: true },
      { text: 'Priority processing', included: false },
      { text: 'API access', included: false },
    ],
    cta: 'Get started free',
    href: '/signup',
  },
  {
    name: 'Pro',
    price: '29',
    period: 'month',
    description: 'For freelancers and small businesses.',
    features: [
      { text: '100 invoices per month', included: true },
      { text: 'ZUGFeRD & XRechnung', included: true },
      { text: 'All export formats', included: true },
      { text: 'Priority processing', included: true },
      { text: 'Email support', included: true },
      { text: 'API access', included: false },
    ],
    cta: 'Start 14-day trial',
    href: '/signup?plan=pro',
    highlighted: true,
    badge: 'Most popular',
  },
  {
    name: 'Business',
    price: '99',
    period: 'month',
    description: 'For teams and growing companies.',
    features: [
      { text: 'Unlimited invoices', included: true },
      { text: 'ZUGFeRD & XRechnung', included: true },
      { text: 'All export formats', included: true },
      { text: 'Priority processing', included: true },
      { text: 'Team features', included: true },
      { text: 'Full API access', included: true },
    ],
    cta: 'Contact sales',
    href: '/contact',
  },
];

const faqs = [
  {
    question: 'Can I change plans later?',
    answer: 'Yes, upgrade or downgrade anytime. Changes apply immediately.',
  },
  {
    question: 'What happens if I exceed my limit?',
    answer:
      'We\'ll notify you. You can upgrade or wait until next month to continue.',
  },
  {
    question: 'Is there a contract?',
    answer: 'No contracts. Cancel anytime with one click.',
  },
];

export const PricingSection = () => {
  return (
    <section
      id="pricing"
      className="relative overflow-hidden bg-neutral-50 py-20 md:py-28"
    >
      <div className="mx-auto max-w-[1200px] px-4 md:px-6">
        {/* Header */}
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand-700">
            <CreditCard className="h-4 w-4" />
            Pricing
          </div>
          <h2 className="text-3xl font-semibold tracking-tight text-neutral-900 md:text-4xl lg:text-[2.75rem]">
            Simple,{' '}
            <span className="bg-gradient-to-r from-brand-600 to-brand-500 bg-clip-text text-transparent">
              transparent
            </span>{' '}
            pricing
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-600">
            Start for free. Upgrade when you need more. No hidden fees, no
            surprises.
          </p>
        </div>

        {/* Pricing cards */}
        <div className="mt-16 grid gap-6 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-2xl border p-8 transition-all ${
                plan.highlighted
                  ? 'border-brand-300 bg-white shadow-xl shadow-brand-600/10 ring-1 ring-brand-300'
                  : 'border-neutral-200 bg-white hover:border-neutral-300 hover:shadow-lg'
              }`}
            >
              {/* Badge */}
              {plan.badge && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-1.5 text-sm font-medium text-white shadow-lg">
                    <Sparkles className="h-3.5 w-3.5" />
                    {plan.badge}
                  </span>
                </div>
              )}

              {/* Header */}
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-neutral-900">
                  {plan.name}
                </h3>
                <p className="mt-1 text-sm text-neutral-600">
                  {plan.description}
                </p>
              </div>

              {/* Price */}
              <div className="mb-8">
                <div className="flex items-baseline">
                  <span className="text-4xl font-bold tracking-tight text-neutral-900">
                    €{plan.price}
                  </span>
                  {plan.period && (
                    <span className="ml-1 text-neutral-500">/{plan.period}</span>
                  )}
                </div>
                {plan.name === 'Pro' && (
                  <p className="mt-2 text-sm text-neutral-500">
                    Billed monthly. Cancel anytime.
                  </p>
                )}
              </div>

              {/* Features */}
              <ul className="mb-8 flex-1 space-y-4">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-3">
                    {feature.included ? (
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/10">
                        <Check className="h-3.5 w-3.5 text-success" />
                      </div>
                    ) : (
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-100">
                        <X className="h-3.5 w-3.5 text-neutral-400" />
                      </div>
                    )}
                    <span
                      className={`text-sm ${
                        feature.included
                          ? 'text-neutral-700'
                          : 'text-neutral-400'
                      }`}
                    >
                      {feature.text}
                    </span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Button
                variant={plan.highlighted ? 'default' : 'outline'}
                size="lg"
                className={`w-full ${
                  plan.highlighted
                    ? 'shadow-lg shadow-brand-600/20'
                    : ''
                }`}
                asChild
              >
                <Link href={plan.href}>
                  {plan.cta}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          ))}
        </div>

        {/* FAQs */}
        <div className="mt-20">
          <div className="mx-auto max-w-3xl">
            <div className="mb-8 flex items-center justify-center gap-2 text-neutral-600">
              <HelpCircle className="h-5 w-5" />
              <span className="font-medium">Common questions</span>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {faqs.map((faq) => (
                <div
                  key={faq.question}
                  className="rounded-xl border border-neutral-200 bg-white p-6"
                >
                  <h4 className="font-semibold text-neutral-900">
                    {faq.question}
                  </h4>
                  <p className="mt-2 text-sm text-neutral-600">{faq.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Money back guarantee */}
        <div className="mt-12 text-center">
          <p className="text-sm text-neutral-500">
            All paid plans include a{' '}
            <span className="font-medium text-neutral-700">
              14-day money-back guarantee
            </span>
            . No questions asked.
          </p>
        </div>
      </div>
    </section>
  );
};
