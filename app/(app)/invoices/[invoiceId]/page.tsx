import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getMyOrganizationIdOrThrow } from '@/src/lib/auth/session';
import { Button } from '@/src/components/ui/button';
import { prisma } from '@/src/lib/db/client';
import { coerceGrossAmountToNumber } from '@/src/lib/dashboard/invoices';
import { InvoiceProcessingWait } from '@/src/components/invoices/invoice-processing-wait';
import { InvoiceReviewForm } from '@/src/components/invoices/invoice-review-form';

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  if (
    value &&
    typeof value === 'object' &&
    'toNumber' in value &&
    typeof (value as { toNumber?: unknown }).toNumber === 'function'
  ) {
    try {
      const parsed = (value as { toNumber: () => number }).toNumber();
      return Number.isFinite(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  }

  return undefined;
}

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { invoiceId } = await params;
  const { organizationId } = await getMyOrganizationIdOrThrow();

  const invoice = await prisma.invoice.findFirst({
    where: {
      id: invoiceId,
      organizationId,
    },
    select: {
      id: true,
      number: true,
      issueDate: true,
      dueDate: true,
      customerName: true,
      netAmount: true,
      taxAmount: true,
      grossAmount: true,
      currency: true,
      supplierName: true,
      taxId: true,
      rawJson: true,
      status: true,
    },
  });

  if (!invoice) {
    notFound();
  }

  if (invoice.status === 'UPLOADED' || invoice.status === 'CREATED') {
    return (
      <section className="mx-auto w-full max-w-3xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Rechnung wird verarbeitet
          </h1>
          <p className="text-sm text-muted-foreground">
            Status: <span className="font-medium">{invoice.status}</span>
          </p>
        </header>

        <InvoiceProcessingWait
          invoiceId={invoice.id}
          initialStatus={invoice.status}
        />
      </section>
    );
  }

  const rawJson = asRecord(invoice.rawJson);
  const reviewData = asRecord(rawJson?.reviewData);
  const ocrData = asRecord(rawJson?.invoiceData);
  const ocrTotals = asRecord(ocrData?.totals);
  const reviewHeader = asRecord(reviewData?.header);
  const reviewSeller = asRecord(reviewData?.seller);
  const reviewBuyer = asRecord(reviewData?.buyer);
  const reviewPayment = asRecord(reviewData?.payment);
  const reviewTotals = asRecord(reviewData?.totals);

  const confidenceCandidate = rawJson?.fieldConfidence;
  const fieldConfidence =
    confidenceCandidate && typeof confidenceCandidate === 'object'
      ? (confidenceCandidate as Record<string, number>)
      : undefined;

  const lineCandidates = Array.isArray(reviewData?.lines)
    ? (reviewData?.lines as Array<Record<string, unknown>>)
    : Array.isArray(ocrData?.lineItems)
      ? (ocrData?.lineItems as Array<Record<string, unknown>>)
      : [];

  const taxBreakdownCandidates = Array.isArray(reviewData?.taxBreakdown)
    ? (reviewData?.taxBreakdown as Array<Record<string, unknown>>)
    : [];

  const fallbackNet =
    asNumber(invoice.netAmount) ?? asNumber(ocrTotals?.netAmount) ?? 0;
  const fallbackVat =
    asNumber(invoice.taxAmount) ?? asNumber(ocrTotals?.taxAmount) ?? 0;
  const fallbackGross =
    (invoice.grossAmount === null
      ? undefined
      : coerceGrossAmountToNumber(invoice.grossAmount)) ??
    asNumber(ocrTotals?.grossAmount) ??
    0;
  const exportHref = `/exports?invoiceId=${encodeURIComponent(invoice.id)}&openExport=1`;

  return (
    <section className="mx-auto w-full max-w-5xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Rechnung prüfen
          </h1>
          <p className="text-sm text-muted-foreground">
            Status: <span className="font-medium">{invoice.status}</span>
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={exportHref}>Exportieren</Link>
        </Button>
      </header>

      <InvoiceReviewForm
        submitUrl={`/api/invoices/${invoice.id}`}
        successRedirectTo="/dashboard"
        fieldConfidence={fieldConfidence}
        initialData={{
          header: {
            profile:
              (asString(reviewHeader?.profile) as
                | 'EN16931'
                | 'ZUGFERD'
                | 'XRECHNUNG_B2G'
                | undefined) ?? 'EN16931',
            invoiceNumber:
              invoice.number ??
              asString(reviewHeader?.invoiceNumber) ??
              asString(ocrData?.number) ??
              '',
            issueDate:
              (invoice.issueDate
                ? invoice.issueDate.toISOString().slice(0, 10)
                : undefined) ??
              asString(reviewHeader?.issueDate) ??
              asString(ocrData?.issueDate) ??
              new Date().toISOString().slice(0, 10),
            currency:
              invoice.currency ??
              asString(reviewHeader?.currency) ??
              asString(ocrTotals?.currency) ??
              'EUR',
            dueDate:
              (invoice.dueDate
                ? invoice.dueDate.toISOString().slice(0, 10)
                : undefined) ??
              asString(reviewHeader?.dueDate) ??
              asString(ocrData?.dueDate),
            buyerReference:
              asString(reviewHeader?.buyerReference) ??
              asString(ocrData?.buyerReference),
          },
          seller: {
            name:
              invoice.supplierName ??
              asString(reviewSeller?.name) ??
              asString(asRecord(ocrData?.supplier)?.name) ??
              '',
            street: asString(reviewSeller?.street) ?? '',
            postCode: asString(reviewSeller?.postCode) ?? '',
            city: asString(reviewSeller?.city) ?? '',
            countryCode: asString(reviewSeller?.countryCode) ?? 'DE',
            vatId: invoice.taxId ?? asString(reviewSeller?.vatId),
            taxNumber: asString(reviewSeller?.taxNumber),
          },
          buyer: {
            name:
              invoice.customerName ??
              asString(reviewBuyer?.name) ??
              asString(asRecord(ocrData?.customer)?.name) ??
              '',
            street: asString(reviewBuyer?.street) ?? '',
            postCode: asString(reviewBuyer?.postCode) ?? '',
            city: asString(reviewBuyer?.city) ?? '',
            countryCode: asString(reviewBuyer?.countryCode) ?? 'DE',
          },
          payment: {
            means:
              (asString(reviewPayment?.means) as
                | 'bankTransfer'
                | 'card'
                | 'directDebit'
                | 'cash'
                | 'other'
                | undefined) ?? 'bankTransfer',
            iban: asString(reviewPayment?.iban),
            termsText: asString(reviewPayment?.termsText),
          },
          lines:
            lineCandidates.length > 0
              ? lineCandidates.map((line) => ({
                  description: asString(line.description) ?? '',
                  quantity: asNumber(line.quantity) ?? 1,
                  unit: asString(line.unit) ?? 'Stk',
                  unitPrice: asNumber(line.unitPrice) ?? 0,
                  netAmount:
                    asNumber(line.netAmount) ??
                    asNumber(line.total) ??
                    asNumber(line.grossAmount) ??
                    0,
                  vatRate: (asNumber(line.vatRate) ??
                    asNumber(line.taxRate) ??
                    19) as 0 | 7 | 19,
                  vatCategory: asString(line.vatCategory) ?? 'S',
                }))
              : undefined,
          totals: {
            netAmount: asNumber(reviewTotals?.netAmount) ?? fallbackNet,
            vatAmount: asNumber(reviewTotals?.vatAmount) ?? fallbackVat,
            grossAmount: asNumber(reviewTotals?.grossAmount) ?? fallbackGross,
          },
          taxBreakdown:
            taxBreakdownCandidates.length > 0
              ? taxBreakdownCandidates.map((item) => ({
                  rate: (asNumber(item.rate) ?? 19) as 0 | 7 | 19,
                  taxableAmount: asNumber(item.taxableAmount) ?? 0,
                  taxAmount: asNumber(item.taxAmount) ?? 0,
                }))
              : undefined,
        }}
      />
    </section>
  );
}
