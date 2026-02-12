'use client';

import { Users, Clock, Sparkles } from 'lucide-react';
import { WaitlistForm } from '../waitlist-form-client';

export const WaitlistSection = () => {
  return (
    <section
      id="waitlist"
      className="relative overflow-hidden bg-white py-20 md:py-28"
    >
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-40 top-1/2 h-[500px] w-[500px] -translate-y-1/2 rounded-full bg-brand-100/30 blur-[100px]" />
        <div className="absolute -right-40 top-1/2 h-[400px] w-[400px] -translate-y-1/2 rounded-full bg-brand-50/50 blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-[1200px] px-4 md:px-6">
        <div className="grid items-start gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left: Info */}
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand-700">
              <Sparkles className="h-4 w-4" />
              Limited Time Offer
            </div>

            <h2 className="text-3xl font-semibold tracking-tight text-neutral-900 md:text-4xl">
              Join the waitlist and save{' '}
              <span className="bg-gradient-to-r from-brand-600 to-brand-500 bg-clip-text text-transparent">
                50% forever
              </span>
            </h2>

            <p className="mt-6 text-lg text-neutral-600">
              Be among the first to experience the future of e-invoice
              processing. As a waitlist member, you&apos;ll get exclusive
              benefits:
            </p>

            <ul className="mt-8 space-y-4">
              {[
                'Early access to the beta (Q2 2025)',
                '50% discount locked in forever',
                'Priority customer support',
                'Influence product roadmap',
                'Exclusive onboarding session',
              ].map((benefit) => (
                <li key={benefit} className="flex items-center gap-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-success/10">
                    <svg
                      className="h-4 w-4 text-success"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <span className="text-neutral-700">{benefit}</span>
                </li>
              ))}
            </ul>

            {/* Stats */}
            <div className="mt-10 flex gap-8">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50">
                  <Users className="h-6 w-6 text-brand-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-neutral-900">50+</div>
                  <div className="text-sm text-neutral-500">Members</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50">
                  <Clock className="h-6 w-6 text-brand-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-neutral-900">
                    Q2 2025
                  </div>
                  <div className="text-sm text-neutral-500">Beta Launch</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Form */}
          <div className="lg:sticky lg:top-8">
            <div className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-lg shadow-neutral-900/5">
              <WaitlistForm defaultTier="pro" variant="card" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
