import { z } from 'zod';

export const supportedInvoiceCurrencies = ['EUR', 'USD', 'GBP'] as const;

export type InvoiceCurrency = (typeof supportedInvoiceCurrencies)[number];

const invoiceNumberSchema = z
  .string({ error: 'Rechnungsnummer ist erforderlich.' })
  .trim()
  .min(1, 'Rechnungsnummer ist erforderlich.')
  .max(50, 'Rechnungsnummer darf maximal 50 Zeichen lang sein.');

const invoiceDateSchema = z
  .string({ error: 'Rechnungsdatum ist erforderlich.' })
  .trim()
  .min(1, 'Rechnungsdatum ist erforderlich.')
  .regex(
    /^\d{4}-\d{2}-\d{2}$/,
    'Rechnungsdatum muss im Format JJJJ-MM-TT angegeben werden.'
  )
  .refine(
    (value) => {
      const parsedDate = invoiceDateToUtcDate(value);
      if (!parsedDate) return false;

      const todayUtc = new Date();
      todayUtc.setUTCHours(0, 0, 0, 0);
      return parsedDate.getTime() <= todayUtc.getTime();
    },
    { message: 'Rechnungsdatum darf nicht in der Zukunft liegen.' }
  );

const totalAmountSchema = z.preprocess(
  (value) => {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : Number.NaN;
    }

    if (typeof value === 'string') {
      const normalized = value.trim().replace(',', '.');
      if (!normalized) return Number.NaN;
      return Number(normalized);
    }

    return Number.NaN;
  },
  z
    .number({ error: 'Gesamtbetrag ist erforderlich.' })
    .gt(0, 'Gesamtbetrag muss größer als 0 sein.')
);

const currencySchema = z.enum(supportedInvoiceCurrencies, {
  error: 'Währung muss EUR, USD oder GBP sein.',
});

const vendorNameSchema = z
  .string({ error: 'Lieferantenname ist erforderlich.' })
  .trim()
  .min(2, 'Lieferantenname muss mindestens 2 Zeichen haben.');

const taxIdSchema = z.preprocess(
  (value) => {
    if (value === undefined || value === null) return undefined;
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed.toUpperCase() : undefined;
  },
  z
    .string()
    .regex(/^DE\d{9}$/, 'Steuer-ID muss dem Format DE123456789 entsprechen.')
    .optional()
);

export const invoiceFormSchema = z.object({
  invoiceNumber: invoiceNumberSchema,
  invoiceDate: invoiceDateSchema,
  totalAmount: totalAmountSchema,
  currency: currencySchema,
  vendorName: vendorNameSchema,
  taxId: taxIdSchema,
});

export type InvoiceFormInput = z.input<typeof invoiceFormSchema>;
export type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;
export type InvoiceFieldErrors = Partial<
  Record<keyof InvoiceFormValues, string>
>;

export function invoiceDateToUtcDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

export function mapInvoiceValidationIssues(
  issues: z.ZodIssue[]
): InvoiceFieldErrors {
  const fieldErrors: InvoiceFieldErrors = {};

  for (const issue of issues) {
    const field = issue.path[0];
    if (typeof field !== 'string') continue;

    if (field in fieldErrors) continue;

    if (
      field === 'invoiceNumber' ||
      field === 'invoiceDate' ||
      field === 'totalAmount' ||
      field === 'currency' ||
      field === 'vendorName' ||
      field === 'taxId'
    ) {
      fieldErrors[field] = issue.message;
    }
  }

  return fieldErrors;
}
