/**
 * DATEV Formatter
 */

import type { DatevEntry, DatevExportConfig, DatevExportResult, DatevInvoice, DatevInvoiceMapping } from "./types";
import { generateCSVWithBOM, generateFilename } from "./csv-generator";
import { mapInvoiceToDatevEntries, DEFAULT_INVOICE_MAPPING } from "./mapper";
import { validateDatevEntry } from "./validator";

export interface DatevExportOptions {
  format: "standard" | "extended";
  detailed: boolean;
  config: DatevExportConfig;
  mapping?: DatevInvoiceMapping;
  filename?: string;
}

export const DEFAULT_EXPORT_OPTIONS: Partial<DatevExportOptions> = {
  format: "standard",
  detailed: false,
};

export function formatInvoicesForDatev(
  invoices: DatevInvoice[],
  options: Partial<DatevExportOptions> = {}
): DatevExportResult {
  const opts: DatevExportOptions = {
    ...DEFAULT_EXPORT_OPTIONS,
    ...options,
    config: options.config || { encoding: "UTF-8" },
  };

  const mapping = opts.mapping || DEFAULT_INVOICE_MAPPING;

  try {
    let entries: DatevEntry[] = [];

    for (const invoice of invoices) {
      const invoiceEntries = mapInvoiceToDatevEntries(invoice, mapping);
      entries.push(...invoiceEntries);
    }

    const validationErrors = validateAllEntries(entries);
    if (validationErrors.length > 0) {
      return {
        success: false,
        csv: "",
        filename: "",
        entryCount: 0,
        totalAmount: 0,
        errors: validationErrors,
      };
    }

    const csv = generateCSVWithBOM(entries);
    const filename = opts.filename || generateFilename();

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
      csv: "",
      filename: "",
      entryCount: 0,
      totalAmount: 0,
      errors: [{
        field: "general",
        message: error instanceof Error ? error.message : "Unknown error",
      }],
    };
  }
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

export function previewExport(invoices: DatevInvoice[]) {
  let entries: DatevEntry[] = [];
  let minDate: Date | null = null;
  let maxDate: Date | null = null;

  for (const invoice of invoices) {
    const invoiceEntries = mapInvoiceToDatevEntries(invoice);
    entries.push(...invoiceEntries);

    const issueDate = invoice.issueDate instanceof Date
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
    dateRange: minDate && maxDate
      ? { from: minDate.toISOString().split("T")[0], to: maxDate.toISOString().split("T")[0] }
      : null,
    invoiceCount: invoices.length,
  };
}

export function getExportSummary(invoices: DatevInvoice[]) {
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

  const preview = previewExport(invoices);

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
