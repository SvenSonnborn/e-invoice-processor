/**
 * DATEV Formatter
 */

import type {
  DatevEntry,
  DatevExportConfig,
  DatevExportResult,
  DatevInvoice,
  DatevInvoiceMapping,
} from './types';
import {
  generateCSVWithBOM,
  generateExtendedCSV,
  generateFilename,
  generateStructuredFilename,
} from './csv-generator';
import {
  mapInvoiceToDatevEntries,
  mapInvoiceWithLineItemsToDatevEntries,
  DEFAULT_INVOICE_MAPPING,
} from './mapper';
import { validateDatevEntry } from './validator';
import { validateGoBDCompliance, type InvoiceData } from '@/src/lib/gobd';

export interface DatevExportOptions {
  format?: 'standard' | 'extended';
  detailed?: boolean;
  config: DatevExportConfig;
  mapping?: DatevInvoiceMapping;
  filename?: string;
  useStructuredFilename?: boolean;
}

export const DEFAULT_EXPORT_OPTIONS: Partial<DatevExportOptions> = {
  format: 'standard',
  detailed: false,
  useStructuredFilename: false,
};

export function formatInvoicesForDatev(
  invoices: DatevInvoice[],
  options: Partial<DatevExportOptions> = {}
): DatevExportResult {
  const opts: DatevExportOptions = {
    ...DEFAULT_EXPORT_OPTIONS,
    ...options,
    config: options.config || { encoding: 'UTF-8' },
  };

  const mapping = opts.mapping || DEFAULT_INVOICE_MAPPING;

  try {
    // GoBD Compliance Validation
    const gobdErrors: Array<{ field: string; message: string }> = [];

    for (let i = 0; i < invoices.length; i++) {
      const invoice = invoices[i];
      const invoiceData: InvoiceData = {
        id: invoice.id || `invoice-${i}`,
        number: invoice.number,
        issueDate: invoice.issueDate,
        currency: invoice.currency,
        netAmount: invoice.netAmount,
        taxAmount: invoice.taxAmount,
        grossAmount: invoice.grossAmount,
        supplierName: invoice.supplierName,
        customerName: invoice.customerName,
        lineItems: invoice.lineItems?.map((item, idx) => ({
          positionIndex: idx + 1,
          description: item.description,
          taxRate: item.taxRate,
          netAmount: item.netAmount,
          taxAmount: item.taxAmount,
          grossAmount: item.grossAmount,
        })),
      };

      const gobdResult = validateGoBDCompliance(invoiceData, {
        strictMode: true,
      });

      if (!gobdResult.isCompliant) {
        for (const violation of gobdResult.violations) {
          gobdErrors.push({
            field: `invoice[${i}].${violation.field}`,
            message: `GoBD: ${violation.message} (${violation.code})`,
          });
        }
      }
    }

    if (gobdErrors.length > 0) {
      return {
        success: false,
        csv: '',
        filename: '',
        entryCount: 0,
        totalAmount: 0,
        errors: gobdErrors,
      };
    }

    // Map invoices to DATEV entries
    const entries: DatevEntry[] = [];

    for (const invoice of invoices) {
      const invoiceEntries = opts.detailed
        ? mapInvoiceWithLineItemsToDatevEntries(invoice, mapping)
        : mapInvoiceToDatevEntries(invoice, mapping);
      entries.push(...invoiceEntries);
    }

    const validationErrors = validateAllEntries(entries);
    if (validationErrors.length > 0) {
      return {
        success: false,
        csv: '',
        filename: '',
        entryCount: 0,
        totalAmount: 0,
        errors: validationErrors,
      };
    }

    const csv =
      opts.format === 'extended'
        ? generateExtendedCSV(entries, opts.config)
        : generateCSVWithBOM(entries, opts.config);

    const filename =
      opts.filename ||
      (opts.useStructuredFilename
        ? generateStructuredFilename(
            opts.config.beraterNummer,
            opts.config.mandantenNummer,
            opts.config.datumVon,
            opts.config.datumBis
          )
        : generateFilename());

    const totalAmount = entries.reduce((sum, entry) => {
      return sum + entry.umsatzSoll + entry.umsatzHaben;
    }, 0);

    return {
      success: true,
      csv,
      filename,
      entryCount: entries.length,
      totalAmount,
    };
  } catch (error) {
    return {
      success: false,
      csv: '',
      filename: '',
      entryCount: 0,
      totalAmount: 0,
      errors: [
        {
          field: 'general',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      ],
    };
  }
}

/**
 * Format a single invoice for DATEV export
 */
export function formatInvoiceForDatev(
  invoice: DatevInvoice,
  options: Partial<DatevExportOptions> = {}
): DatevExportResult {
  return formatInvoicesForDatev([invoice], options);
}

/**
 * Export invoices to CSV buffer (for file download)
 */
export function exportInvoicesToBuffer(
  invoices: DatevInvoice[],
  options: Partial<DatevExportOptions> = {}
): { buffer: Buffer; filename: string; success: boolean; errors?: string[] } {
  const result = formatInvoicesForDatev(invoices, options);

  if (!result.success) {
    return {
      buffer: Buffer.from(''),
      filename: '',
      success: false,
      errors: result.errors?.map((e) => `${e.field}: ${e.message}`),
    };
  }

  const buffer = Buffer.from(result.csv, 'utf-8');

  return {
    buffer,
    filename: result.filename,
    success: true,
  };
}

function validateAllEntries(entries: DatevEntry[]) {
  const errors = [];
  for (let i = 0; i < entries.length; i++) {
    const entryErrors = validateDatevEntry(entries[i]);
    for (const error of entryErrors) {
      errors.push({ ...error, field: `entry[${i}].${error.field}` });
    }
  }
  return errors;
}

export function previewExport(
  invoices: DatevInvoice[],
  options: Partial<DatevExportOptions> = {}
) {
  const opts: DatevExportOptions = {
    ...DEFAULT_EXPORT_OPTIONS,
    ...options,
    config: options.config || { encoding: 'UTF-8' },
  };

  const mapping = opts.mapping || DEFAULT_INVOICE_MAPPING;

  const entries: DatevEntry[] = [];
  let minDate: Date | null = null;
  let maxDate: Date | null = null;

  for (const invoice of invoices) {
    const invoiceEntries = opts.detailed
      ? mapInvoiceWithLineItemsToDatevEntries(invoice, mapping)
      : mapInvoiceToDatevEntries(invoice, mapping);
    entries.push(...invoiceEntries);

    const issueDate =
      invoice.issueDate instanceof Date
        ? invoice.issueDate
        : new Date(invoice.issueDate);

    if (!isNaN(issueDate.getTime())) {
      if (!minDate || issueDate < minDate) minDate = issueDate;
      if (!maxDate || issueDate > maxDate) maxDate = issueDate;
    }
  }

  const totalAmount = entries.reduce((sum, entry) => {
    return sum + entry.umsatzSoll + entry.umsatzHaben;
  }, 0);

  return {
    entryCount: entries.length,
    totalAmount,
    dateRange:
      minDate && maxDate
        ? {
            from: minDate.toISOString().split('T')[0],
            to: maxDate.toISOString().split('T')[0],
          }
        : null,
    invoiceCount: invoices.length,
  };
}

export function getExportSummary(
  invoices: DatevInvoice[],
  options: Partial<DatevExportOptions> = {}
) {
  let totalNet = 0;
  let totalTax = 0;
  let totalGross = 0;
  let incomingCount = 0;
  let outgoingCount = 0;

  for (const invoice of invoices) {
    totalNet += invoice.netAmount;
    totalTax += invoice.taxAmount;
    totalGross += invoice.grossAmount;

    if (invoice.isIncoming) {
      incomingCount++;
    } else {
      outgoingCount++;
    }
  }

  const preview = previewExport(invoices, options);

  return {
    invoiceCount: invoices.length,
    entryCount: preview.entryCount,
    totalNetAmount: totalNet,
    totalTaxAmount: totalTax,
    totalGrossAmount: totalGross,
    incomingCount,
    outgoingCount,
  };
}
