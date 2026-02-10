import { redirect } from 'next/navigation';
import { prisma } from '@/src/lib/db/client';
import { getCurrentUser } from '@/src/lib/auth/session';
import { SubscriptionManagement } from '@/src/components/subscription/subscription-management';
import { PaymentHistory } from '@/src/components/subscription/payment-history';
import type { PaymentItem } from '@/src/components/subscription/payment-history';

export default async function SettingsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch subscription and payment data
  const subscription = await prisma.subscription.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      status: true,
      tier: true,
      currentPeriodEnd: true,
      trialEnd: true,
      cancelAtPeriodEnd: true,
      stripeSubscriptionId: true,
    },
  });

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
    <div className="mx-auto max-w-2xl space-y-8 py-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Einstellungen</h1>
        <p className="mt-1 text-muted-foreground">
          Verwalten Sie Ihr Konto und Abonnement
        </p>
      </div>

      <SubscriptionManagement subscription={subscription} />

      <PaymentHistory payments={paymentItems} />
    </div>
  );
}
