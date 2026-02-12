'use client';

import { Button } from '@/src/components/ui/button';
import {
  ArrowRight,
  Check,
  HelpCircle,
  Sparkles,
  X,
  Zap,
  Users,
  Clock,
} from 'lucide-react';
import { WaitlistForm } from '../waitlist-form';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/src/components/ui/dialog';

type PricingPlan = {
  name: string;
  regularPrice: number;
  earlyBirdPrice: number;
  period: string;
  description: string;
  features: { text: string; included: boolean }[];
  cta: string;
  href: string;
  highlighted?: boolean;
  badge?: string;
  popular?: boolean;
};

const plans: PricingPlan[] = [
  {
    name: 'Pro',
    regularPrice: 29,
    earlyBirdPrice: 14.5,
    period: 'month',
    description: 'Perfect for freelancers and small businesses.',
    features: [
      { text: '100 invoices per month', included: true },
      { text: 'ZUGFeRD & XRechnung support', included: true },
      { text: 'CSV & DATEV export', included: true },
      { text: 'Priority processing', included: true },
      { text: 'API access', included: false },
      { text: 'Team features', included: false },
    ],
    cta: 'Get Early Access',
    href: '#waitlist',
  },
  {
    name: 'Business',
    regularPrice: 99,
    earlyBirdPrice: 49.5,
    period: 'month',
    description: 'For growing businesses with higher volume.',
    features: [
      { text: 'Unlimited invoices', included: true },
      { text: 'ZUGFeRD & XRechnung support', included: true },
      { text: 'All export formats', included: true },
      { text: 'Priority processing', included: true },
      { text: 'API access', included: true },
      { text: 'Team collaboration', included: true },
    ],
    cta: 'Get Early Access',
    href: '#waitlist',
    highlighted: true,
    popular: true,
    badge: 'Most Popular',
  },
];

const faqs = [
  {
    question: 'When will the beta launch?',
    answer:
      "We're targeting Q2 2025 for the public beta. Waitlist members will get access first.",
  },
  {
    question: 'How long does the early-bird discount last?',
    answer:
      'The 50% discount is locked in forever as long as you maintain your subscription.',
  },
  {
    question: 'Can I switch plans later?',
    answer:
      'Yes, you can upgrade or downgrade anytime. Your discount applies to any plan.',
  },
  {
    question: 'What happens after the beta?',
    answer:
      "You'll keep your early-bird pricing. We'll never increase your rate without your consent.",
  },
];

const stats = [
  { icon: Users, value: '50+', label: 'Waitlist members' },
  { icon: Clock, value: 'Q2 2025', label: 'Beta launch' },
  { icon: Zap, value: '50%', label: 'Early-bird discount' },
];

export const PricingSection = () => {
  const [selectedPlan, setSelectedPlan] = useState<'pro' | 'business'>('pro');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handlePlanSelect = (plan: 'pro' | 'business') => {
    setSelectedPlan(plan);
    setIsDialogOpen(true);
  };

  return (
    <section
      id="pricing"
      className="relative overflow-hidden bg-neutral-50 py-20 md:py-28"
    >
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-40 top-0 h-[500px] w-[500px] rounded-full bg-brand-200/20 blur-[100px]" />
        <div className="absolute -right-40 bottom-0 h-[400px] w-[400px] rounded-full bg-brand-100/30 blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-[1200px] px-4 md:px-6">
        {/* Header */}
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand-700">
            <Sparkles className="h-4 w-4" />
            Early-Bird Pricing
          </div>
          <h2 className="text-3xl font-semibold tracking-tight text-neutral-900 md:text-4xl lg:text-[2.75rem]">
            Lock in{' '}
            <span className="bg-gradient-to-r from-brand-600 to-brand-500 bg-clip-text text-transparent">
              50% off
            </span>{' '}
            forever
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-600">
            Join our waitlist today and get lifetime access at early-bird
            pricing. Regular prices apply after launch.
          </p>
        </div>

        {/* Stats */}
        <div className="mt-12 flex flex-wrap justify-center gap-8 md:gap-16">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="flex items-center justify-center gap-2">
                <stat.icon className="h-5 w-5 text-brand-600" />
                <span className="text-2xl font-bold text-neutral-900 md:text-3xl">
                  {stat.value}
                </span>
              </div>
              <p className="mt-1 text-sm text-neutral-500">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Pricing cards */}
        <div className="mt-16 grid gap-6 lg:grid-cols-2 lg:max-w-4xl lg:mx-auto">
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

              {/* Early bird badge */}
              <div className="absolute top-4 right-4">
                <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
                  <Zap className="h-3 w-3" />
                  50% OFF
                </span>
              </div>

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
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl font-bold tracking-tight text-neutral-900">
                    €{plan.earlyBirdPrice.toFixed(2)}
                  </span>
                  <span className="text-lg text-neutral-400 line-through">
                    €{plan.regularPrice.toFixed(2)}
                  </span>
                </div>
                <span className="text-neutral-500">/{plan.period}</span>
                <p className="mt-2 text-sm text-success font-medium">
                  Early-bird price — forever!
                </p>
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
                  plan.highlighted ? 'shadow-lg shadow-brand-600/20' : ''
                }`}
                onClick={() =>
                  handlePlanSelect(
                    plan.name.toLowerCase() as 'pro' | 'business'
                  )
                }
              >
                {plan.cta}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        {/* Urgency message */}
        <div className="mt-8 text-center">
          <p className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-4 py-2 text-sm text-amber-700">
            <Clock className="h-4 w-4" />
            Limited spots available — Only 50 early-bird slots per plan
          </p>
        </div>

        {/* FAQs */}
        <div className="mt-20">
          <div className="mx-auto max-w-3xl">
            <div className="mb-8 flex items-center justify-center gap-2 text-neutral-600">
              <HelpCircle className="h-5 w-5" />
              <span className="font-medium">Frequently asked questions</span>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
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
            All plans include a{' '}
            <span className="font-medium text-neutral-700">
              30-day money-back guarantee
            </span>
            . No questions asked.
          </p>
        </div>
      </div>

      {/* Waitlist Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">Join the Waitlist</DialogTitle>
          </DialogHeader>
          <WaitlistForm defaultTier={selectedPlan} variant="card" />
        </DialogContent>
      </Dialog>
    </section>
  );
};
