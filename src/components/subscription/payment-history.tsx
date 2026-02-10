'use client';

import { Badge } from '@/src/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Separator } from '@/src/components/ui/separator';
import { ExternalLink, Receipt, AlertCircle } from 'lucide-react';

export interface PaymentItem {
  id: string;
  amount: string;
  currency: string;
  status: string;
  description: string | null;
  receiptUrl: string | null;
  paidAt: string | null;
  createdAt: string;
}

interface PaymentHistoryProps {
  payments: PaymentItem[];
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  succeeded: { label: 'Erfolgreich', variant: 'default' },
  failed: { label: 'Fehlgeschlagen', variant: 'destructive' },
  pending: { label: 'Ausstehend', variant: 'secondary' },
};

const formatAmount = (amount: string, currency: string): string => {
  const num = parseFloat(amount);
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: currency,
  }).format(num);
};

const formatDate = (dateStr: string): string => {
  return new Date(dateStr).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
};

export const PaymentHistory = ({ payments }: PaymentHistoryProps) => {
  if (payments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Zahlungsverlauf</CardTitle>
          <CardDescription>Ihre bisherigen Zahlungen</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 rounded-lg bg-muted p-4">
            <Receipt className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Noch keine Zahlungen vorhanden.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Zahlungsverlauf</CardTitle>
        <CardDescription>
          Ihre bisherigen Zahlungen und Belege
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {payments.map((payment, index) => {
            const config = statusConfig[payment.status] ?? statusConfig.pending;

            return (
              <div key={payment.id}>
                {index > 0 && <Separator className="mb-4" />}
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {payment.status === 'failed' ? (
                        <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
                      ) : (
                        <Receipt className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className="truncate text-sm font-medium">
                        {payment.description ?? 'Zahlung'}
                      </span>
                    </div>
                    <p className="mt-1 pl-6 text-xs text-muted-foreground">
                      {payment.paidAt
                        ? formatDate(payment.paidAt)
                        : formatDate(payment.createdAt)}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-sm font-semibold">
                      {formatAmount(payment.amount, payment.currency)}
                    </span>
                    <Badge variant={config.variant}>
                      {config.label}
                    </Badge>
                    {payment.receiptUrl && (
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        className="h-7 w-7 p-0"
                      >
                        <a
                          href={payment.receiptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Beleg öffnen"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default PaymentHistory;
