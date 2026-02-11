'use client';

import { Button } from '@/src/components/ui/button';
import {
  ArrowRight,
  CheckCircle2,
  Download,
  FileCheck,
  FileText,
  Sparkles,
  Upload,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/src/components/ui/dialog';
import { WaitlistForm } from '../waitlist-form';

const trustBadges = [
  'ZUGFeRD compliant',
  'XRechnung ready',
  'EN 16931 certified',
];

const benefits = [
  'No credit card required',
  '50% off forever',
  'Cancel anytime',
];

export const HeroSection = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-brand-50/50 via-white to-white">
      {/* Background pattern */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
        aria-hidden="true"
      />

      {/* Gradient orbs */}
      <div
        className="absolute -left-40 top-0 h-[500px] w-[500px] rounded-full bg-brand-200/30 blur-[100px]"
        aria-hidden="true"
      />
      <div
        className="absolute -right-40 top-40 h-[400px] w-[400px] rounded-full bg-brand-100/40 blur-[100px]"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-[1200px] px-4 py-20 md:px-6 md:py-28 lg:py-32">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left: Content */}
          <div className="flex flex-col space-y-8">
            {/* Beta badge */}
            <div className="animate-fade-in">
              <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand-700">
                <Sparkles className="h-4 w-4" />
                Beta launching Q2 2025
              </span>
            </div>

            {/* Headline */}
            <h1 className="animate-fade-in text-4xl font-semibold leading-[1.15] tracking-tight text-neutral-900 md:text-5xl lg:text-[3.25rem]">
              Turn invoices into{' '}
              <span className="bg-gradient-to-r from-brand-600 to-brand-500 bg-clip-text text-transparent">
                compliant e-invoices
              </span>{' '}
              — automatically
            </h1>

            {/* Subheadline */}
            <p className="animate-fade-in max-w-xl text-lg leading-relaxed text-neutral-600 md:text-xl">
              Upload PDFs or scans, convert them to ZUGFeRD or XRechnung, and
              export clean, structured data. Join the waitlist for{' '}
              <span className="font-semibold text-brand-600">50% off forever</span>.
            </p>

            {/* CTAs */}
            <div className="animate-fade-in flex flex-col gap-4 sm:flex-row sm:items-center">
              <Button
                size="lg"
                className="h-12 px-8 text-base shadow-lg shadow-brand-600/20"
                onClick={() => setIsDialogOpen(true)}
              >
                <Zap className="mr-2 h-4 w-4" />
                Join Waitlist — 50% Off
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button variant="outline" size="lg" className="h-12 px-6" asChild>
                <Link href="#how-it-works">See how it works</Link>
              </Button>
            </div>

            {/* Benefits */}
            <div className="animate-fade-in flex flex-wrap items-center gap-4 pt-2">
              {benefits.map((benefit) => (
                <div
                  key={benefit}
                  className="flex items-center gap-1.5 text-sm text-neutral-600"
                >
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span>{benefit}</span>
                </div>
              ))}
            </div>

            {/* Trust badges */}
            <div className="animate-fade-in flex flex-wrap items-center gap-4 pt-4 border-t border-neutral-200">
              {trustBadges.map((badge) => (
                <div
                  key={badge}
                  className="flex items-center gap-1.5 text-sm text-neutral-500"
                >
                  <CheckCircle2 className="h-4 w-4 text-brand-500" />
                  <span>{badge}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Visual */}
          <div
            className="relative flex items-center justify-center lg:justify-end"
            aria-hidden="true"
          >
            {/* Main card */}
            <div className="animate-fade-in relative w-full max-w-md">
              {/* Glow effect behind card */}
              <div className="absolute -inset-4 rounded-2xl bg-gradient-to-r from-brand-400/20 via-brand-500/10 to-brand-400/20 blur-2xl" />

              <div className="relative rounded-xl border border-neutral-200/80 bg-white p-6 shadow-xl shadow-neutral-900/5">
                {/* Header */}
                <div className="mb-6 flex items-center gap-3 border-b border-neutral-100 pb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50">
                    <FileText className="h-5 w-5 text-brand-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">
                      Invoice Processing
                    </p>
                    <p className="text-xs text-neutral-500">
                      invoice_2024_001.pdf
                    </p>
                  </div>
                </div>

                {/* Steps */}
                <div className="space-y-3">
                  {/* Step 1 */}
                  <div className="flex items-center gap-3 rounded-lg bg-success-bg/50 p-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-success/10">
                      <Upload className="h-4 w-4 text-success" />
                    </div>
                    <div className="flex-1">
                      <span className="text-sm font-medium text-neutral-900">
                        Upload complete
                      </span>
                    </div>
                    <CheckCircle2 className="h-5 w-5 text-success" />
                  </div>

                  {/* Step 2 */}
                  <div className="flex items-center gap-3 rounded-lg bg-success-bg/50 p-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-success/10">
                      <FileCheck className="h-4 w-4 text-success" />
                    </div>
                    <div className="flex-1">
                      <span className="text-sm font-medium text-neutral-900">
                        Data extracted
                      </span>
                    </div>
                    <CheckCircle2 className="h-5 w-5 text-success" />
                  </div>

                  {/* Step 3 - Active */}
                  <div className="flex items-center gap-3 rounded-lg border-2 border-brand-200 bg-brand-50/50 p-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600">
                      <Download className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <span className="text-sm font-medium text-brand-700">
                        E-invoice ready
                      </span>
                    </div>
                    <span className="rounded-full bg-brand-600 px-2.5 py-0.5 text-xs font-medium text-white">
                      Download
                    </span>
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-6 flex items-center justify-between border-t border-neutral-100 pt-4">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-success" />
                    <span className="text-xs text-neutral-600">
                      ZUGFeRD 2.1.1 format
                    </span>
                  </div>
                  <span className="text-xs font-medium text-brand-600">
                    100% compliant
                  </span>
                </div>
              </div>

              {/* Early bird badge */}
              <div className="absolute -right-4 -top-4 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 px-4 py-2 text-white shadow-lg">
                <div className="text-xs font-medium">Early Bird</div>
                <div className="text-lg font-bold">50% OFF</div>
              </div>
            </div>

            {/* Floating badges */}
            <div className="animate-fade-in absolute -left-4 top-8 hidden rounded-lg border border-neutral-200 bg-white px-3 py-2 shadow-lg lg:block">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-success" />
                <span className="text-xs font-medium text-neutral-700">
                  Validated
                </span>
              </div>
            </div>

            <div className="animate-fade-in absolute -right-4 bottom-16 hidden rounded-lg border border-neutral-200 bg-white px-3 py-2 shadow-lg lg:block">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-brand-600" />
                <span className="text-xs font-medium text-neutral-700">
                  XRechnung
                </span>
              </div>
            </div>
          </div>
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
