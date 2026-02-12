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
import { Badge } from '@/src/components/ui/badge';
import { Separator } from '@/src/components/ui/separator';
import {
  Loader2,
  CreditCard,
  Calendar,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { STRIPE_CONFIG } from '@/src/lib/stripe/config';
import type { PlanId } from '@/src/lib/stripe/config';
import type {
  SubscriptionStatus,
  SubscriptionTier,
} from '@/src/generated/prisma/client';

interface SubscriptionManagementProps {
  subscription: {
    id: string;
    status: SubscriptionStatus;
    tier: SubscriptionTier;
    currentPeriodEnd: Date | null;
    trialEnd: Date | null;
    cancelAtPeriodEnd: boolean;
    stripeSubscriptionId: string | null;
  } | null;
}

const statusConfig: Record<
  SubscriptionStatus,
  {
    label: string;
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
  }
> = {
  INCOMPLETE: { label: 'Unvollständig', variant: 'secondary' },
  INCOMPLETE_EXPIRED: { label: 'Abgelaufen', variant: 'destructive' },
  TRIALING: { label: 'Testphase', variant: 'default' },
  ACTIVE: { label: 'Aktiv', variant: 'default' },
  PAST_DUE: { label: 'Zahlung überfällig', variant: 'destructive' },
  CANCELED: { label: 'Gekündigt', variant: 'outline' },
  UNPAID: { label: 'Unbezahlt', variant: 'destructive' },
  PAUSED: { label: 'Pausiert', variant: 'secondary' },
};

const tierConfig: Record<
  SubscriptionTier,
  { name: string; description: string }
> = {
  FREE: {
    name: 'Free',
    description: 'Kostenloser Plan mit eingeschränkten Funktionen',
  },
  PRO: {
    name: 'Pro',
    description: 'Für wachsende Unternehmen',
  },
  BUSINESS: {
    name: 'Business',
    description: 'Für Unternehmen mit hohem Volumen',
  },
};

export function SubscriptionManagement({
  subscription,
}: SubscriptionManagementProps) {
  const [loadingPortal, setLoadingPortal] = useState(false);

  const handleManageSubscription = async () => {
    setLoadingPortal(true);

    try {
      const response = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create portal session');
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Portal error:', error);
      alert(
        'Fehler beim Öffnen des Kundenportals. Bitte versuchen Sie es später erneut.'
      );
    } finally {
      setLoadingPortal(false);
    }
  };

  const tier = subscription?.tier || 'FREE';
  const status = subscription?.status || 'INCOMPLETE';
  const isActive = ['TRIALING', 'ACTIVE'].includes(status);
  const isTrialing = status === 'TRIALING';

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Aktuelles Abonnement</CardTitle>
          <CardDescription>
            Verwalten Sie Ihr aktuelles Abonnement und Ihre
            Zahlungsinformationen
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-2xl font-bold">{tierConfig[tier].name}</h3>
              <p className="text-muted-foreground">
                {tierConfig[tier].description}
              </p>
            </div>
            <Badge variant={statusConfig[status].variant}>
              {statusConfig[status].label}
            </Badge>
          </div>

          <Separator />

          {tier !== 'FREE' && subscription && (
            <div className="space-y-4">
              {isTrialing && subscription.trialEnd && (
                <div className="flex items-center gap-3 rounded-lg bg-primary/10 p-4">
                  <Calendar className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">Testphase aktiv</p>
                    <p className="text-sm text-muted-foreground">
                      Ihre Testphase endet am{' '}
                      {new Date(subscription.trialEnd).toLocaleDateString(
                        'de-DE',
                        {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric',
                        }
                      )}
                    </p>
                  </div>
                </div>
              )}

              {subscription.currentPeriodEnd && !isTrialing && (
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Nächste Zahlung</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(
                        subscription.currentPeriodEnd
                      ).toLocaleDateString('de-DE', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
              )}

              {subscription.cancelAtPeriodEnd && (
                <div className="flex items-center gap-3 rounded-lg bg-destructive/10 p-4">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  <div>
                    <p className="font-medium text-destructive">
                      Abonnement gekündigt
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Ihr Abonnement endet am{' '}
                      {subscription.currentPeriodEnd &&
                        new Date(
                          subscription.currentPeriodEnd
                        ).toLocaleDateString('de-DE', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric',
                        })}
                    </p>
                  </div>
                </div>
              )}

              {status === 'PAST_DUE' && (
                <div className="flex items-center gap-3 rounded-lg bg-destructive/10 p-4">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  <div>
                    <p className="font-medium text-destructive">
                      Zahlung überfällig
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Bitte aktualisieren Sie Ihre Zahlungsinformationen im
                      Kundenportal.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {tier === 'FREE' && (
            <div className="flex items-center gap-3 rounded-lg bg-muted p-4">
              <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Kostenloser Plan</p>
                <p className="text-sm text-muted-foreground">
                  Sie sind auf dem kostenlosen Plan. Upgraden Sie für mehr
                  Funktionen.
                </p>
              </div>
            </div>
          )}

          <Separator />

          {isActive ? (
            <Button
              onClick={handleManageSubscription}
              disabled={loadingPortal}
              className="w-full"
              variant="outline"
            >
              {loadingPortal ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Bitte warten...
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Abonnement verwalten
                  <ExternalLink className="ml-2 h-3 w-3" />
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={() => (window.location.href = '/pricing')}
              className="w-full"
            >
              Jetzt upgraden
            </Button>
          )}
        </CardContent>
      </Card>

      {tier !== 'FREE' && (
        <Card>
          <CardHeader>
            <CardTitle>Ihre Vorteile</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {STRIPE_CONFIG.PLANS[tier as PlanId]?.features.map(
                (feature, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <span>{feature}</span>
                  </li>
                )
              )}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default SubscriptionManagement;
