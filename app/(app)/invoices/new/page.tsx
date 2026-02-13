import { InvoiceUpload } from '@/src/components/InvoiceUpload';

export default function NewInvoicePage() {
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

      <InvoiceUpload />
    </section>
  );
}
