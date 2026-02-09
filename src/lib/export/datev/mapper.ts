/**
 * DATEV Invoice Mapper
 * Maps Invoice data to DATEV format fields
 */

import type { DatevEntry, DatevInvoice, DatevInvoiceMapping, DatevLineItem } from "./types";
import {
  DATEV_STEUERSCHLUESSEL,
  DEFAULT_ACCOUNT_MAPPING,
} from "./constants";
import { formatDate, formatDateFromISO } from "./validator";

/**
 * Default mapping configuration
 */
export const DEFAULT_INVOICE_MAPPING: DatevInvoiceMapping = {
  kontoEingangsrechnung: DEFAULT_ACCOUNT_MAPPING.EINGANG_KONTO,
  kontoAusgangsrechnung: DEFAULT_ACCOUNT_MAPPING.AUSGANG_KONTO,
  gegenkontoBank: DEFAULT_ACCOUNT_MAPPING.BANK_KONTO,
  steuerschluesselStandard: DATEV_STEUERSCHLUESSEL.VORSTEUER_19,
  steuerschluesselErmäßigt: DATEV_STEUERSCHLUESSEL.VORSTEUER_7,
  steuerschluesselSteuerfrei: DATEV_STEUERSCHLUESSEL.VORSTEUER_0,
};

/**
 * Map tax rate to DATEV tax key
 */
export function mapTaxRateToSteuerschluessel(
  taxRate: number,
  mapping: DatevInvoiceMapping = DEFAULT_INVOICE_MAPPING,
  isIncoming: boolean = true
): string {
  // Determine which tax keys to use based on invoice type
  const standardKey = isIncoming
    ? DATEV_STEUERSCHLUESSEL.VORSTEUER_19
    : DATEV_STEUERSCHLUESSEL.UST_19;
  const reducedKey = isIncoming
    ? DATEV_STEUERSCHLUESSEL.VORSTEUER_7
    : DATEV_STEUERSCHLUESSEL.UST_7;
  const zeroKey = isIncoming
    ? DATEV_STEUERSCHLUESSEL.VORSTEUER_0
    : DATEV_STEUERSCHLUESSEL.UST_0;

  // Map based on rate
  if (taxRate >= 19) {
    return mapping.steuerschluesselStandard || standardKey;
  } else if (taxRate >= 7) {
    return mapping.steuerschluesselErmäßigt || reducedKey;
  } else {
    return mapping.steuerschluesselSteuerfrei || zeroKey;
  }
}

/**
 * Map invoice to DATEV entries
 * Creates one entry per invoice (summary booking)
 */
export function mapInvoiceToDatevEntries(
  invoice: DatevInvoice,
  mapping: DatevInvoiceMapping = DEFAULT_INVOICE_MAPPING
): DatevEntry[] {
  const entries: DatevEntry[] = [];
  const date = invoice.issueDate instanceof Date
    ? formatDate(invoice.issueDate)
    : formatDateFromISO(invoice.issueDate as unknown as string);

  const belegdatum = invoice.dueDate
    ? (invoice.dueDate instanceof Date
        ? formatDate(invoice.dueDate)
        : formatDateFromISO(invoice.dueDate as unknown as string))
    : date;

  const belegnummer = invoice.number || invoice.id.substring(0, 12);
  const partnerName = invoice.isIncoming ? invoice.supplierName : invoice.customerName;

  if (invoice.isIncoming) {
    // Eingangsrechnung (Incoming invoice)
    // Booking 1: Expense -> Liabilities
    entries.push({
      datum: date,
      konto: mapping.kontoEingangsrechnung || DEFAULT_ACCOUNT_MAPPING.EINGANG_KONTO,
      gegenkonto: DEFAULT_ACCOUNT_MAPPING.EINGANG_GEGENKONTO,
      buchungstext: `ER: ${partnerName || "Unbekannt"} - ${belegnummer}`,
      umsatzSoll: invoice.netAmount,
      umsatzHaben: 0,
      steuerschluessel: mapTaxRateToSteuerschluessel(invoice.taxRate || 19, mapping, true),
      steuerbetrag: invoice.taxAmount,
      belegnummer,
      belegdatum,
      kostenstelle: invoice.kostenstelle,
      kostentraeger: invoice.kostentraeger,
      waehrung: invoice.currency || "EUR",
    });

    // Booking 2: Input tax -> Liabilities
    if (invoice.taxAmount > 0) {
      entries.push({
        datum: date,
        konto: "1576", // Vorsteuer 19%
        gegenkonto: mapping.kontoEingangsrechnung || DEFAULT_ACCOUNT_MAPPING.EINGANG_KONTO,
        buchungstext: `VSt: ${partnerName || "Unbekannt"} - ${belegnummer}`,
        umsatzSoll: invoice.taxAmount,
        umsatzHaben: 0,
        belegnummer,
        belegdatum,
        kostenstelle: invoice.kostenstelle,
        kostentraeger: invoice.kostentraeger,
        waehrung: invoice.currency || "EUR",
      });
    }
  } else {
    // Ausgangsrechnung (Outgoing invoice)
    // Booking 1: Receivables -> Revenue
    entries.push({
      datum: date,
      konto: mapping.kontoAusgangsrechnung || DEFAULT_ACCOUNT_MAPPING.AUSGANG_KONTO,
      gegenkonto: DEFAULT_ACCOUNT_MAPPING.AUSGANG_GEGENKONTO,
      buchungstext: `AR: ${partnerName || "Unbekannt"} - ${belegnummer}`,
      umsatzSoll: invoice.netAmount,
      umsatzHaben: 0,
      steuerschluessel: mapTaxRateToSteuerschluessel(invoice.taxRate || 19, mapping, false),
      steuerbetrag: invoice.taxAmount,
      belegnummer,
      belegdatum,
      kostenstelle: invoice.kostenstelle,
      kostentraeger: invoice.kostentraeger,
      waehrung: invoice.currency || "EUR",
    });

    // Booking 2: Receivables -> VAT
    if (invoice.taxAmount > 0) {
      entries.push({
        datum: date,
        konto: mapping.kontoAusgangsrechnung || DEFAULT_ACCOUNT_MAPPING.AUSGANG_KONTO,
        gegenkonto: "1776", // Umsatzsteuer 19%
        buchungstext: `USt: ${partnerName || "Unbekannt"} - ${belegnummer}`,
        umsatzSoll: 0,
        umsatzHaben: invoice.taxAmount,
        belegnummer,
        belegdatum,
        kostenstelle: invoice.kostenstelle,
        kostentraeger: invoice.kostentraeger,
        waehrung: invoice.currency || "EUR",
      });
    }
  }

  return entries;
}

/**
 * Map invoice with line items to DATEV entries
 * Creates one entry per line item for detailed booking
 */
export function mapInvoiceWithLineItemsToDatevEntries(
  invoice: DatevInvoice,
  mapping: DatevInvoiceMapping = DEFAULT_INVOICE_MAPPING
): DatevEntry[] {
  if (!invoice.lineItems || invoice.lineItems.length === 0) {
    return mapInvoiceToDatevEntries(invoice, mapping);
  }

  const entries: DatevEntry[] = [];
  const date = invoice.issueDate instanceof Date
    ? formatDate(invoice.issueDate)
    : formatDateFromISO(invoice.issueDate as unknown as string);

  const belegdatum = invoice.dueDate
    ? (invoice.dueDate instanceof Date
        ? formatDate(invoice.dueDate)
        : formatDateFromISO(invoice.dueDate as unknown as string))
    : date;

  const belegnummer = invoice.number || invoice.id.substring(0, 12);
  const partnerName = invoice.isIncoming ? invoice.supplierName : invoice.customerName;

  // Create entry for each line item
  for (const item of invoice.lineItems) {
    const itemEntries = mapLineItemToDatevEntries(
      item,
      date,
      belegdatum,
      belegnummer,
      partnerName,
      invoice.isIncoming,
      invoice.currency,
      mapping
    );
    entries.push(...itemEntries);
  }

  return entries;
}

/**
 * Map a single line item to DATEV entries
 */
function mapLineItemToDatevEntries(
  item: DatevLineItem,
  date: string,
  belegdatum: string,
  belegnummer: string,
  partnerName: string | undefined,
  isIncoming: boolean,
  currency: string,
  mapping: DatevInvoiceMapping
): DatevEntry[] {
  const entries: DatevEntry[] = [];

  // Truncate description to fit DATEV limits
  const description = item.description
    ? `${item.description.substring(0, 40)}...`
    : "Position";

  // Use item-specific account if provided, otherwise use default
  const itemKonto = item.konto || (
    isIncoming
      ? (mapping.kontoEingangsrechnung || DEFAULT_ACCOUNT_MAPPING.EINGANG_KONTO)
      : (mapping.kontoAusgangsrechnung || DEFAULT_ACCOUNT_MAPPING.AUSGANG_KONTO)
  );

  // Use item-specific cost center/cost object if provided
  const kostenstelle = item.kostenstelle;
  const kostentraeger = item.kostentraeger;

  if (isIncoming) {
    // Eingangsrechnung line item
    entries.push({
      datum: date,
      konto: itemKonto,
      gegenkonto: DEFAULT_ACCOUNT_MAPPING.EINGANG_GEGENKONTO,
      buchungstext: `${description} - ${partnerName || "Unbekannt"}`,
      umsatzSoll: item.netAmount,
      umsatzHaben: 0,
      steuerschluessel: mapTaxRateToSteuerschluessel(item.taxRate, mapping, true),
      belegnummer,
      belegdatum,
      kostenstelle,
      kostentraeger,
      waehrung: currency || "EUR",
    });

    // Add tax entry if applicable
    if (item.taxAmount > 0) {
      entries.push({
        datum: date,
        konto: "1576", // Vorsteuer 19%
        gegenkonto: itemKonto,
        buchungstext: `VSt: ${description}`,
        umsatzSoll: item.taxAmount,
        umsatzHaben: 0,
        belegnummer,
        belegdatum,
        kostenstelle,
        kostentraeger,
        waehrung: currency || "EUR",
      });
    }
  } else {
    // Ausgangsrechnung line item
    entries.push({
      datum: date,
      konto: itemKonto,
      gegenkonto: DEFAULT_ACCOUNT_MAPPING.AUSGANG_GEGENKONTO,
      buchungstext: `${description} - ${partnerName || "Unbekannt"}`,
      umsatzSoll: item.netAmount,
      umsatzHaben: 0,
      steuerschluessel: mapTaxRateToSteuerschluessel(item.taxRate, mapping, false),
      belegnummer,
      belegdatum,
      kostenstelle,
      kostentraeger,
      waehrung: currency || "EUR",
    });
  }

  return entries;
}

/**
 * Get account suggestion based on invoice data
 * Uses simple heuristics to suggest appropriate accounts
 */
export function suggestKonto(invoice: DatevInvoice): string {
  if (invoice.isIncoming) {
    // For incoming invoices, typically expense accounts
    // This could be enhanced with AI/ML classification
    return DEFAULT_ACCOUNT_MAPPING.EINGANG_KONTO;
  } else {
    // For outgoing invoices, typically revenue accounts
    return DEFAULT_ACCOUNT_MAPPING.AUSGANG_KONTO;
  }
}
