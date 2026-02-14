'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/src/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card';

const PROCESSING_STATES = new Set(['UPLOADED', 'CREATED']);
const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 90000;

interface InvoiceProcessingWaitProps {
  invoiceId: string;
  initialStatus: string;
}

function isProcessingStatus(status: string): boolean {
  return PROCESSING_STATES.has(status);
}

export function InvoiceProcessingWait({
  invoiceId,
  initialStatus,
}: InvoiceProcessingWaitProps) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const startedAt = Date.now();

    const poll = async () => {
      if (cancelled) return;

      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        setTimedOut(true);
        return;
      }

      try {
        const response = await fetch(`/api/invoices/${invoiceId}`, {
          method: 'GET',
          cache: 'no-store',
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as {
          success?: boolean;
          invoice?: { status?: string };
        };
        const nextStatus = payload.invoice?.status;
        if (!nextStatus) {
          return;
        }

        setStatus(nextStatus);
        if (!isProcessingStatus(nextStatus)) {
          router.refresh();
        }
      } catch {
        // Ignore transient polling errors and keep polling.
      }
    };

    void poll();
    const intervalId = window.setInterval(() => {
      void poll();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [invoiceId, router]);

  return (
    <Card className="border border-border shadow-sm">
      <CardHeader>
        <CardTitle>OCR-Verarbeitung läuft</CardTitle>
        <CardDescription>
          Die Rechnungsdaten werden aktuell aus dem PDF extrahiert. Das
          Review-Formular wird automatisch geladen, sobald die Verarbeitung
          abgeschlossen ist.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Aktueller Status: <span className="font-medium">{status}</span>
        </p>
        {timedOut && (
          <p className="text-sm text-amber-700">
            Die Verarbeitung dauert länger als erwartet. Bitte erneut prüfen.
          </p>
        )}
        <Button
          type="button"
          variant="outline"
          onClick={() => router.refresh()}
        >
          Erneut prüfen
        </Button>
      </CardContent>
    </Card>
  );
}
