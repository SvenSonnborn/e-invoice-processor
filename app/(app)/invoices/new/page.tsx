'use client';

import { useRouter } from 'next/navigation';
import {
  InvoiceUpload,
  type InvoiceUploadSuccessResponse,
} from '@/src/components/InvoiceUpload';

export default function NewInvoicePage() {
  const router = useRouter();

  const handleUploadSuccess = async (
    response: InvoiceUploadSuccessResponse
  ) => {
    router.push(`/invoices/${response.invoice.id}`);
  };

  return (
    <section className="mx-auto w-full max-w-3xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Neue Rechnung
        </h1>
        <p className="text-sm text-muted-foreground">
          Laden Sie eine PDF hoch, um die automatische Verarbeitung direkt zu
          starten.
        </p>
      </header>

      <InvoiceUpload onUploadSuccess={handleUploadSuccess} />
    </section>
  );
}
