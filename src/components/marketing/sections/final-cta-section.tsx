'use client';

import { useState } from 'react';
import { ArrowRight, Sparkles, Users, Zap } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/src/components/ui/dialog';
import { WaitlistForm } from '../waitlist-form';

export const FinalCTASection = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <section className="relative overflow-hidden bg-brand-600 py-20 md:py-28">
      {/* Background pattern */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
        aria-hidden="true"
      />

      {/* Gradient overlay */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-brand-500/50 via-transparent to-brand-700/50"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-[1200px] px-4 md:px-6">
        <div className="mx-auto max-w-3xl text-center">
          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium text-white backdrop-blur-sm">
            <Sparkles className="h-4 w-4" />
            Limited early-bird spots available
          </div>

          {/* Headline */}
          <h2 className="text-3xl font-semibold tracking-tight text-white md:text-4xl lg:text-[2.75rem]">
            Ready to simplify your{' '}
            <span className="text-brand-200">e-invoicing</span>?
          </h2>

          {/* Subheadline */}
          <p className="mx-auto mt-6 max-w-xl text-lg text-brand-100">
            Join our waitlist today and get 50% off forever. Be among the first
            to experience the future of invoice processing.
          </p>

          {/* Stats */}
          <div className="mt-8 flex flex-wrap justify-center gap-8">
            <div className="flex items-center gap-2 text-white">
              <Users className="h-5 w-5 text-brand-200" />
              <span className="font-semibold">50+</span>
              <span className="text-brand-200">waitlist members</span>
            </div>
            <div className="flex items-center gap-2 text-white">
              <Zap className="h-5 w-5 text-brand-200" />
              <span className="font-semibold">50%</span>
              <span className="text-brand-200">early-bird discount</span>
            </div>
          </div>

          {/* CTA */}
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button
              size="lg"
              className="h-12 bg-white px-8 text-base text-brand-600 hover:bg-brand-50"
              onClick={() => setIsDialogOpen(true)}
            >
              Join the Waitlist
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>

          {/* Trust text */}
          <p className="mt-6 text-sm text-brand-200">
            No credit card required. Unsubscribe anytime.
          </p>
        </div>
      </div>

      {/* Waitlist Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">
              Join the Beta Waitlist
            </DialogTitle>
          </DialogHeader>
          <WaitlistForm defaultTier="pro" variant="card" />
        </DialogContent>
      </Dialog>
    </section>
  );
};
