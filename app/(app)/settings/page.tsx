import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { prisma } from '@/src/lib/db/client';
import { getCurrentUser } from '@/src/lib/auth/session';
import { SubscriptionManagement } from '@/src/components/subscription/subscription-management';
import { PaymentHistory } from '@/src/components/subscription/payment-history';
import type { PaymentItem } from '@/src/components/subscription/payment-history';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card';
import { User, Mail, Building2 } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Einstellungen | E-Invoice Hub',
  description: 'Verwalten Sie Ihre Kontoeinstellungen und Ihr Abonnement',
};

export default async function SettingsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch user data with subscriptions and memberships
  const userData = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      subscriptions: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      memberships: {
        include: {
          organization: true,
        },
      },
    },
  });

  const subscription = userData?.subscriptions[0]
    ? {
        id: userData.subscriptions[0].id,
        status: userData.subscriptions[0].status,
        tier: userData.subscriptions[0].tier,
        currentPeriodEnd: userData.subscriptions[0].currentPeriodEnd,
        trialEnd: userData.subscriptions[0].trialEnd,
        cancelAtPeriodEnd: userData.subscriptions[0].cancelAtPeriodEnd,
        stripeSubscriptionId: userData.subscriptions[0].stripeSubscriptionId,
      }
    : null;

  const payments = await prisma.payment.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true,
      amount: true,
      currency: true,
      status: true,
      description: true,
      receiptUrl: true,
      paidAt: true,
      createdAt: true,
    },
  });

  const paymentItems: PaymentItem[] = payments.map((p) => ({
    id: p.id,
    amount: p.amount.toString(),
    currency: p.currency,
    status: p.status,
    description: p.description,
    receiptUrl: p.receiptUrl,
    paidAt: p.paidAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
  }));

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Einstellungen</h1>
        <p className="text-muted-foreground">
          Verwalten Sie Ihre Kontoeinstellungen und Ihr Abonnement
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Profile & Organizations Section */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profil</CardTitle>
              <CardDescription>Ihre persönlichen Informationen</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-medium">
                    {userData?.name || 'Kein Name angegeben'}
                  </p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    {user.email}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Organizations Section */}
          <Card>
            <CardHeader>
              <CardTitle>Organisationen</CardTitle>
              <CardDescription>
                Ihre Mitgliedschaften in Organisationen
              </CardDescription>
            </CardHeader>
            <CardContent>
              {userData?.memberships && userData.memberships.length > 0 ? (
                <div className="space-y-4">
                  {userData.memberships.map((membership) => (
                    <div
                      key={membership.id}
                      className="flex items-center justify-between rounded-lg border p-4"
                    >
                      <div className="flex items-center gap-3">
                        <Building2 className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">
                            {membership.organization.name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Rolle: {membership.role}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">
                  Sie sind noch keiner Organisation beigetreten.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Payment History */}
          <PaymentHistory payments={paymentItems} />
        </div>

        {/* Subscription Section */}
        <div>
          <SubscriptionManagement subscription={subscription} />
        </div>
      </div>
    </div>
  );
}
