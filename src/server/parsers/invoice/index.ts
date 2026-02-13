/**
 * OCR Invoice Data Parser
 *
 * Validates and normalizes OCR-extracted invoice data into
 * database-ready fields using Zod schema validation.
 *
 * Input:  OcrInvoiceData (from OCR service or mock responses)
 * Output: Validated & normalized flat fields for markAsValidated()
 *         + structured line items for InvoiceLineItem creation
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Normalize amount strings to numbers.
 * Handles German "1.234,56", standard "2090.00", negative "-112.92",
 * already-numeric values, and undefined/null.
 */
const parseAmount = (val: unknown): number | undefined => {
  if (val === undefined || val === null || val === '') return undefined;
  if (typeof val === 'number') return isFinite(val) ? val : undefined;
  if (typeof val !== 'string') return undefined;

  let cleaned = val.trim();

  // German thousands-separator format: "1.234,56" or "1.234.567,89"
  if (/^-?\d{1,3}(\.\d{3})*(,\d+)?$/.test(cleaned)) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (/^-?\d+(,\d+)$/.test(cleaned)) {
    // Simple comma-decimal: "1234,56"
    cleaned = cleaned.replace(',', '.');
  }

  const num = Number(cleaned);
  return isFinite(num) ? num : undefined;
};

/**
 * Parse date strings to Date objects.
 * Handles ISO "2026-02-09" and German "09.02.2026" formats.
 */
const parseInvoiceDate = (val: unknown): Date | undefined => {
  if (val === undefined || val === null || val === '') return undefined;
  if (val instanceof Date) return isNaN(val.getTime()) ? undefined : val;
  if (typeof val !== 'string') return undefined;

  const trimmed = val.trim();

  // German DD.MM.YYYY
  const germanMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (germanMatch) {
    const [, day, month, year] = germanMatch;
    const date = new Date(
      `${year}-${month!.padStart(2, '0')}-${day!.padStart(2, '0')}T00:00:00.000Z`
    );
    return isNaN(date.getTime()) ? undefined : date;
  }

  // ISO YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const date = new Date(`${trimmed}T00:00:00.000Z`);
    return isNaN(date.getTime()) ? undefined : date;
  }

  return undefined;
};

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const amountSchema = z.preprocess(
  parseAmount,
  z.number({ error: 'Ungültiger Betrag' }).optional()
);

const invoiceDateSchema = z.preprocess(
  parseInvoiceDate,
  z
    .date({ error: 'Ungültiges Datum (erwartet: YYYY-MM-DD oder DD.MM.YYYY)' })
    .optional()
);

const invoiceFormatSchema = z
  .enum(['ZUGFERD', 'XRECHNUNG', 'UNKNOWN'])
  .optional()
  .default('UNKNOWN');

const partySchema = z
  .object({
    name: z.string().optional(),
  })
  .optional();

const totalsSchema = z
  .object({
    currency: z
      .string()
      .length(3, 'Währungscode muss 3 Zeichen lang sein (z.B. EUR)')
      .optional()
      .default('EUR'),
    netAmount: amountSchema,
    taxAmount: amountSchema,
    grossAmount: amountSchema,
  })
  .optional();

const ocrLineItemSchema = z.object({
  description: z.string({ error: 'Beschreibung ist erforderlich' }),
  quantity: z.number({ error: 'Menge muss eine Zahl sein' }),
  unitPrice: z.number({ error: 'Einzelpreis muss eine Zahl sein' }),
  total: z.number({ error: 'Gesamtbetrag muss eine Zahl sein' }),
});

const ocrInvoiceDataSchema = z.object({
  format: invoiceFormatSchema,
  number: z.string().optional(),
  supplier: partySchema,
  customer: partySchema,
  issueDate: invoiceDateSchema,
  dueDate: invoiceDateSchema,
  totals: totalsSchema,
  lineItems: z.array(ocrLineItemSchema).optional().default([]),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ValidatedInvoiceFields {
  number?: string;
  supplierName?: string;
  customerName?: string;
  issueDate?: Date;
  dueDate?: Date;
  netAmount?: number;
  taxAmount?: number;
  grossAmount?: number;
}

export interface ParsedLineItem {
  positionIndex: number;
  description: string;
  quantity: number;
  unitPrice: number;
  grossAmount: number;
}

interface ParseSuccess {
  success: true;
  invoiceFields: ValidatedInvoiceFields;
  lineItems: ParsedLineItem[];
  format: 'ZUGFERD' | 'XRECHNUNG' | 'UNKNOWN';
  currency: string;
}

interface ParseFailure {
  success: false;
  errors: Array<{
    path: string;
    message: string;
  }>;
}

export type ParseOcrInvoiceResult = ParseSuccess | ParseFailure;

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

/**
 * Parse and validate OCR invoice data into database-ready fields.
 *
 * @param data - Raw OCR invoice data (unknown shape, will be validated)
 * @returns Discriminated result: success with flat DB fields, or failure with error details
 */
export const parseOcrInvoiceData = (data: unknown): ParseOcrInvoiceResult => {
  const result = ocrInvoiceDataSchema.safeParse(data);

  if (!result.success) {
    return {
      success: false,
      errors: result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    };
  }

  const parsed = result.data;

  const invoiceFields: ValidatedInvoiceFields = {
    number: parsed.number,
    supplierName: parsed.supplier?.name,
    customerName: parsed.customer?.name,
    issueDate: parsed.issueDate,
    dueDate: parsed.dueDate,
    netAmount: parsed.totals?.netAmount,
    taxAmount: parsed.totals?.taxAmount,
    grossAmount: parsed.totals?.grossAmount,
  };

  const lineItems: ParsedLineItem[] = parsed.lineItems.map((item, index) => ({
    positionIndex: index + 1,
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    grossAmount: item.total,
  }));

  return {
    success: true,
    invoiceFields,
    lineItems,
    format: parsed.format ?? 'UNKNOWN',
    currency: parsed.totals?.currency ?? 'EUR',
  };
};

// Re-export schemas for testing
export { ocrInvoiceDataSchema, ocrLineItemSchema };
