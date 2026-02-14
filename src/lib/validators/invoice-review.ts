import { z } from 'zod';
import {
  isValidIbanBasic,
  normalizeIban,
  normalizeVatId,
  parseIsoDateToUtc,
  validateInvoiceBusinessRules,
} from './invoice-review-helpers';

export const invoiceProfileValues = [
  'EN16931',
  'ZUGFERD',
  'XRECHNUNG_B2G',
] as const;

const paymentMeansValues = [
  'bankTransfer',
  'card',
  'directDebit',
  'cash',
  'other',
] as const;

const vatRateValues = [0, 7, 19] as const;

const trimString = (value: unknown): unknown =>
  typeof value === 'string' ? value.trim() : value;

const trimStringOrUndefined = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const parseNumber = (value: unknown): unknown => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  if (typeof value !== 'string') return value;
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return NaN;
  return Number(normalized);
};

const isoDateSchema = z
  .string({ error: 'Datum ist erforderlich.' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Datum muss im Format YYYY-MM-DD sein.')
  .refine((value) => parseIsoDateToUtc(value) !== null, 'Ungültiges Datum.');

const moneySchema = z.preprocess(
  parseNumber,
  z
    .number({ error: 'Betrag ist erforderlich.' })
    .finite('Betrag muss eine gültige Zahl sein.')
);

const nonNegativeMoneySchema = moneySchema.refine(
  (value) => value >= 0,
  'Betrag darf nicht negativ sein.'
);

const positiveNumberSchema = z.preprocess(
  parseNumber,
  z
    .number({ error: 'Wert ist erforderlich.' })
    .finite('Wert muss eine gültige Zahl sein.')
    .gt(0, 'Wert muss größer als 0 sein.')
);

const requiredTextSchema = z.preprocess(
  trimString,
  z.string({ error: 'Feld ist erforderlich.' }).min(1, 'Feld ist erforderlich.')
);

const optionalTextSchema = z.preprocess(
  trimStringOrUndefined,
  z.string().optional()
);

const countryCodeSchema = z.preprocess(
  trimString,
  z
    .string({ error: 'Ländercode ist erforderlich.' })
    .regex(/^[a-zA-Z]{2}$/, 'Ländercode muss aus 2 Buchstaben bestehen.')
);

function isPostalCodeValidForCountry(
  postCode: string,
  countryCode: string
): boolean {
  const normalizedCountry = countryCode.toUpperCase();
  const normalizedPostCode = postCode.trim();

  if (normalizedCountry === 'DE') {
    return /^\d{5}$/.test(normalizedPostCode);
  }

  // International fallback: alphanumerisch, Leerzeichen/Bindestrich erlaubt.
  return /^[A-Za-z0-9][A-Za-z0-9\s-]{1,11}$/.test(normalizedPostCode);
}

const currencySchema = z.preprocess(
  trimString,
  z
    .string({ error: 'Währung ist erforderlich.' })
    .regex(/^[a-zA-Z]{3}$/, 'Währung muss ein ISO-3 Code sein (z. B. EUR).')
);

const ibanSchema = z.preprocess(
  trimStringOrUndefined,
  z
    .string()
    .refine((value) => isValidIbanBasic(value), 'Ungültige IBAN.')
    .optional()
);

const vatRateSchema = z.union([
  z.literal(vatRateValues[0]),
  z.literal(vatRateValues[1]),
  z.literal(vatRateValues[2]),
]);

const invoiceReviewSchemaCore = z.object({
  header: z.object({
    profile: z.enum(invoiceProfileValues).default('EN16931'),
    invoiceNumber: requiredTextSchema,
    issueDate: isoDateSchema,
    currency: currencySchema,
    dueDate: z.preprocess(trimStringOrUndefined, isoDateSchema.optional()),
    buyerReference: optionalTextSchema,
  }),
  seller: z
    .object({
      name: requiredTextSchema,
      street: requiredTextSchema,
      postCode: requiredTextSchema,
      city: requiredTextSchema,
      countryCode: countryCodeSchema,
      vatId: optionalTextSchema,
      taxNumber: optionalTextSchema,
    })
    .superRefine((value, ctx) => {
      if (!value.vatId && !value.taxNumber) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['vatId'],
          message: 'USt-IdNr. oder Steuernummer ist erforderlich.',
        });
      }

      if (value.vatId) {
        const normalizedVatId = normalizeVatId(value.vatId);
        if (!/^[A-Z]{2}[A-Z0-9]{2,12}$/.test(normalizedVatId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['vatId'],
            message:
              'USt-IdNr. muss im Format mit Länderpräfix vorliegen (z. B. DE123456789).',
          });
        }
      }

      if (!isPostalCodeValidForCountry(value.postCode, value.countryCode)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['postCode'],
          message:
            value.countryCode.toUpperCase() === 'DE'
              ? 'PLZ muss für Deutschland aus genau 5 Ziffern bestehen.'
              : 'Postleitzahl ist für das ausgewählte Land ungültig.',
        });
      }
    }),
  buyer: z
    .object({
      name: requiredTextSchema,
      street: requiredTextSchema,
      postCode: requiredTextSchema,
      city: requiredTextSchema,
      countryCode: countryCodeSchema,
    })
    .superRefine((value, ctx) => {
      if (!isPostalCodeValidForCountry(value.postCode, value.countryCode)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['postCode'],
          message:
            value.countryCode.toUpperCase() === 'DE'
              ? 'PLZ muss für Deutschland aus genau 5 Ziffern bestehen.'
              : 'Postleitzahl ist für das ausgewählte Land ungültig.',
        });
      }
    }),
  payment: z.object({
    means: z.enum(paymentMeansValues, {
      error: 'Ungültige Zahlungsart.',
    }),
    iban: ibanSchema,
    termsText: optionalTextSchema,
  }),
  lines: z
    .array(
      z.object({
        description: requiredTextSchema,
        quantity: positiveNumberSchema,
        unit: requiredTextSchema,
        unitPrice: nonNegativeMoneySchema,
        netAmount: nonNegativeMoneySchema,
        vatRate: vatRateSchema,
        vatCategory: requiredTextSchema,
      })
    )
    .min(1, 'Mindestens eine Position ist erforderlich.'),
  totals: z.object({
    netAmount: nonNegativeMoneySchema,
    vatAmount: nonNegativeMoneySchema,
    grossAmount: nonNegativeMoneySchema,
  }),
  taxBreakdown: z
    .array(
      z.object({
        rate: vatRateSchema,
        taxableAmount: nonNegativeMoneySchema,
        taxAmount: nonNegativeMoneySchema,
      })
    )
    .min(1, 'Mindestens ein Steueraufschlüsselungseintrag ist erforderlich.'),
});

export const invoiceReviewSchema = invoiceReviewSchemaCore.superRefine(
  (value, ctx) => {
    const issueDate = parseIsoDateToUtc(value.header.issueDate);
    const dueDate = value.header.dueDate
      ? parseIsoDateToUtc(value.header.dueDate)
      : null;

    if (issueDate && dueDate && dueDate.getTime() < issueDate.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['header', 'dueDate'],
        message: 'Fälligkeitsdatum darf nicht vor dem Rechnungsdatum liegen.',
      });
    }

    if (
      value.header.profile === 'XRECHNUNG_B2G' &&
      !value.header.buyerReference
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['header', 'buyerReference'],
        message:
          'Für XRECHNUNG_B2G ist eine Buyer Reference (Leitweg-ID) erforderlich.',
      });
    }

    if (!value.header.dueDate && !value.payment.termsText) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['payment', 'termsText'],
        message: 'Bitte Fälligkeitsdatum oder Zahlungsbedingungen hinterlegen.',
      });
    }

    if (value.payment.means === 'bankTransfer' && !value.payment.iban) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['payment', 'iban'],
        message: 'Für Überweisung ist eine IBAN erforderlich.',
      });
    }

    const businessIssues = validateInvoiceBusinessRules({
      header: {
        issueDate: value.header.issueDate,
        dueDate: value.header.dueDate,
      },
      lines: value.lines.map((line) => ({ netAmount: line.netAmount })),
      totals: value.totals,
      taxBreakdown: value.taxBreakdown,
    });

    for (const issue of businessIssues) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: issue.path,
        message: issue.message,
      });
    }
  }
);

export type InvoiceReviewFormInput = z.input<typeof invoiceReviewSchema>;
export type InvoiceReviewFormValues = z.infer<typeof invoiceReviewSchema>;

export function normalizeInvoiceReviewPayload(
  value: InvoiceReviewFormValues
): InvoiceReviewFormValues {
  return {
    header: {
      profile: value.header.profile,
      invoiceNumber: value.header.invoiceNumber.trim(),
      issueDate: value.header.issueDate,
      currency: value.header.currency.toUpperCase(),
      dueDate: value.header.dueDate,
      buyerReference: value.header.buyerReference?.trim(),
    },
    seller: {
      name: value.seller.name.trim(),
      street: value.seller.street.trim(),
      postCode: value.seller.postCode.trim(),
      city: value.seller.city.trim(),
      countryCode: value.seller.countryCode.toUpperCase(),
      vatId: value.seller.vatId
        ? normalizeVatId(value.seller.vatId)
        : undefined,
      taxNumber: value.seller.taxNumber?.trim(),
    },
    buyer: {
      name: value.buyer.name.trim(),
      street: value.buyer.street.trim(),
      postCode: value.buyer.postCode.trim(),
      city: value.buyer.city.trim(),
      countryCode: value.buyer.countryCode.toUpperCase(),
    },
    payment: {
      means: value.payment.means,
      iban: value.payment.iban ? normalizeIban(value.payment.iban) : undefined,
      termsText: value.payment.termsText?.trim(),
    },
    lines: value.lines.map((line) => ({
      description: line.description.trim(),
      quantity: line.quantity,
      unit: line.unit.trim(),
      unitPrice: line.unitPrice,
      netAmount: line.netAmount,
      vatRate: line.vatRate,
      vatCategory: line.vatCategory.trim(),
    })),
    totals: {
      netAmount: value.totals.netAmount,
      vatAmount: value.totals.vatAmount,
      grossAmount: value.totals.grossAmount,
    },
    taxBreakdown: value.taxBreakdown.map((item) => ({
      rate: item.rate,
      taxableAmount: item.taxableAmount,
      taxAmount: item.taxAmount,
    })),
  };
}

export function mapInvoiceReviewValidationIssues(
  issues: z.ZodIssue[]
): Record<string, string> {
  const fieldErrors: Record<string, string> = {};

  for (const issue of issues) {
    const path = issue.path.join('.');
    if (!path || fieldErrors[path]) continue;
    fieldErrors[path] = issue.message;
  }

  return fieldErrors;
}
