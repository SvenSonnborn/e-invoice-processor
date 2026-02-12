'use client';

import { useState } from 'react';
import { Button } from '@/src/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card';
import { Check, Loader2, Sparkles } from 'lucide-react';
import { STRIPE_CONFIG, formatPrice } from '@/src/lib/stripe/config';
import type { Plan, PlanId } from '@/src/lib/stripe/config';

interface PricingProps {
  currentPlan?: PlanId;
  isAuthenticated?: boolean;
}

export function Pricing({
  currentPlan,
  isAuthenticated = false,
}: PricingProps) {
  const [loading, setLoading] = useState<PlanId | null>(null);

  const handleSubscribe = async (planId: PlanId) => {
    if (!isAuthenticated) {
      window.location.href = `/signup?plan=${planId.toLowerCase()}`;
      return;
    }

    setLoading(planId);

    try {
      const plan = STRIPE_CONFIG.PLANS[planId];
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId: plan.priceId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert(
        'Fehler beim Erstellen der Checkout-Session. Bitte versuchen Sie es später erneut.'
      );
    } finally {
      setLoading(null);
    }
  };

  const plans: { id: PlanId; plan: Plan }[] = [
    { id: 'PRO', plan: STRIPE_CONFIG.PLANS.PRO },
    { id: 'BUSINESS', plan: STRIPE_CONFIG.PLANS.BUSINESS },
  ];

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:gap-8">
      {plans.map(({ id, plan }) => {
        const isCurrentPlan = currentPlan === id;
        const isLoading = loading === id;

        return (
          <Card
            key={id}
            className={`relative flex flex-col ${
              id === 'BUSINESS'
                ? 'border-brand-300 shadow-xl shadow-brand-600/10 ring-1 ring-brand-300'
                : ''
            }`}
          >
            {id === 'BUSINESS' && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-1.5 text-sm font-medium text-white shadow-lg">
                  <Sparkles className="h-3.5 w-3.5" />
                  Beliebt
                </span>
              </div>
            )}

            <CardHeader>
              <CardTitle className="text-2xl">{plan.name}</CardTitle>
              <CardDescription>{plan.description}</CardDescription>
            </CardHeader>

            <CardContent className="flex-1">
              <div className="mb-6">
                <div className="flex items-baseline">
                  <span className="text-4xl font-bold tracking-tight">
                    {formatPrice(plan.price)}
                  </span>
                  <span className="ml-1 text-muted-foreground">/Monat</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {STRIPE_CONFIG.TRIAL_PERIOD_DAYS} Tage kostenlos testen
                </p>
              </div>

              <ul className="mb-8 space-y-3">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/10">
                      <Check className="h-3.5 w-3.5 text-success" />
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <Button
                onClick={() => handleSubscribe(id)}
                disabled={isCurrentPlan || isLoading}
                className="w-full"
                variant={id === 'BUSINESS' ? 'default' : 'outline'}
                size="lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Bitte warten...
                  </>
                ) : isCurrentPlan ? (
                  'Aktueller Plan'
                ) : (
                  `Jetzt ${plan.name} wählen`
                )}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default Pricing;
