'use client';

import { useState } from 'react';
import { z } from 'zod';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import {
  CheckCircle2,
  Loader2,
  Mail,
  ArrowRight,
  Copy,
  Check,
} from 'lucide-react';

const waitlistSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  company: z.string().optional(),
  tier: z.enum(['pro', 'business'], {
    error: 'Please select a plan',
  }),
});

type WaitlistFormData = z.infer<typeof waitlistSchema>;

export interface WaitlistFormProps {
  variant?: 'inline' | 'card' | 'hero';
  defaultTier?: 'pro' | 'business';
  referralCode?: string | null;
}

export function WaitlistForm({
  variant = 'card',
  defaultTier = 'pro',
  referralCode,
}: WaitlistFormProps) {
  const [formData, setFormData] = useState<WaitlistFormData>({
    name: '',
    email: '',
    company: '',
    tier: defaultTier,
  });
  const [errors, setErrors] = useState<
    Partial<Record<keyof WaitlistFormData, string>>
  >({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [result, setResult] = useState<{
    referralCode: string;
    referralLink: string;
    position: number;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const validate = (): boolean => {
    try {
      waitlistSchema.parse(formData);
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Partial<Record<keyof WaitlistFormData, string>> = {};
        error.issues.forEach((err) => {
          const path = err.path[0] as keyof WaitlistFormData;
          newErrors[path] = err.message;
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/waitlist/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          referredBy: referralCode,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setIsSuccess(true);
        setResult(data);
      } else {
        setErrors({
          email: data.error || 'Something went wrong. Please try again.',
        });
      }
    } catch {
      setErrors({
        email: 'Network error. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: keyof WaitlistFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const copyReferralLink = () => {
    if (result?.referralLink) {
      navigator.clipboard.writeText(result.referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isSuccess && result) {
    return (
      <div className="rounded-2xl border border-success/20 bg-success-bg/50 p-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
          <CheckCircle2 className="h-8 w-8 text-success" />
        </div>
        <h3 className="text-xl font-semibold text-neutral-900">
          You&apos;re on the list!
        </h3>
        <p className="mt-2 text-neutral-600">
          Thank you for joining our waitlist. We&apos;ll notify you as soon as
          we launch!
        </p>
        <div className="mt-6 rounded-xl bg-white p-4 text-left">
          <p className="text-sm font-medium text-neutral-900">
            Your position:{' '}
            <span className="text-brand-600">#{result.position}</span>
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            Share your referral link to move up the list!
          </p>
          <div className="mt-3 flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={result.referralLink}
              className="flex-1 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-600"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={copyReferralLink}
              className="shrink-0"
            >
              {copied ? (
                <Check className="h-4 w-4 text-success" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
        <p className="mt-4 text-xs text-neutral-500">
          Check your email for a confirmation message.
        </p>
      </div>
    );
  }

  const inputClasses = variant === 'hero' ? 'h-14 text-base' : 'h-11';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {variant === 'hero' && (
        <div className="mb-6 text-center">
          <h3 className="text-lg font-semibold text-neutral-900">
            Join the Beta Waitlist
          </h3>
          <p className="text-sm text-neutral-600">
            Get early access and 50% off forever
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="name" className="text-sm font-medium">
          Full Name
        </Label>
        <Input
          id="name"
          type="text"
          placeholder="John Doe"
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          className={inputClasses}
          disabled={isSubmitting}
        />
        {errors.name && <p className="text-xs text-error">{errors.name}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email" className="text-sm font-medium">
          Email Address
        </Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <Input
            id="email"
            type="email"
            placeholder="you@company.com"
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            className={`${inputClasses} pl-10`}
            disabled={isSubmitting}
          />
        </div>
        {errors.email && <p className="text-xs text-error">{errors.email}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="company" className="text-sm font-medium">
          Company{' '}
          <span className="font-normal text-neutral-400">(optional)</span>
        </Label>
        <Input
          id="company"
          type="text"
          placeholder="Acme Inc."
          value={formData.company}
          onChange={(e) => handleChange('company', e.target.value)}
          className={inputClasses}
          disabled={isSubmitting}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Plan Interest</Label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleChange('tier', 'pro')}
            className={`rounded-xl border p-4 text-left transition-all ${
              formData.tier === 'pro'
                ? 'border-brand-300 bg-brand-50 ring-1 ring-brand-300'
                : 'border-neutral-200 bg-white hover:border-neutral-300'
            }`}
          >
            <div className="font-medium text-neutral-900">Pro</div>
            <div className="text-sm text-neutral-500">14.50€/mo</div>
            <div className="mt-1 text-xs text-success">50% off</div>
          </button>
          <button
            type="button"
            onClick={() => handleChange('tier', 'business')}
            className={`rounded-xl border p-4 text-left transition-all ${
              formData.tier === 'business'
                ? 'border-brand-300 bg-brand-50 ring-1 ring-brand-300'
                : 'border-neutral-200 bg-white hover:border-neutral-300'
            }`}
          >
            <div className="font-medium text-neutral-900">Business</div>
            <div className="text-sm text-neutral-500">49.50€/mo</div>
            <div className="mt-1 text-xs text-success">50% off</div>
          </button>
        </div>
        {errors.tier && <p className="text-xs text-error">{errors.tier}</p>}
      </div>

      <Button
        type="submit"
        size={variant === 'hero' ? 'lg' : 'default'}
        className="w-full"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Joining...
          </>
        ) : (
          <>
            Join Waitlist
            <ArrowRight className="ml-2 h-4 w-4" />
          </>
        )}
      </Button>

      <p className="text-center text-xs text-neutral-500">
        No spam. Unsubscribe anytime.
      </p>
    </form>
  );
}
