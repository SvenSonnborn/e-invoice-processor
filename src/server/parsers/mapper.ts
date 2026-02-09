/**
 * Maps raw invoice data to the Invoice model
 */

import type { Invoice, InvoiceFormat } from "@/src/types";
import type { RawInvoiceData } from "./types";

/**
 * Map raw invoice data to Invoice model
 * @param rawData - Raw data extracted from XML
 * @param format - The invoice format
 * @returns Invoice object
 */
export function mapToInvoice(rawData: RawInvoiceData, format: InvoiceFormat): Invoice {
  return {
    id: generateInvoiceId(),
    format,
    number: rawData.documentNumber,
    supplier: rawData.seller ? {
      name: rawData.seller.name,
    } : undefined,
    customer: rawData.buyer ? {
      name: rawData.buyer.name,
    } : undefined,
    issueDate: rawData.issueDate,
    dueDate: rawData.dueDate,
    totals: rawData.totals ? {
      currency: rawData.currency || "EUR",
      netAmount: rawData.totals.netAmount?.toFixed(2),
      taxAmount: rawData.totals.taxAmount?.toFixed(2),
      grossAmount: rawData.totals.grossAmount?.toFixed(2),
    } : undefined,
  };
}

/**
 * Generate a unique invoice ID
 * @returns UUID string
 */
function generateInvoiceId(): string {
  return crypto.randomUUID();
}

/**
 * Map raw data with extended fields (for future use)
 * @param rawData - Raw data extracted from XML
 * @param format - The invoice format
 * @returns Extended invoice object with all fields
 */
export function mapToExtendedInvoice(rawData: RawInvoiceData, format: InvoiceFormat) {
  return {
    // Base Invoice fields
    id: generateInvoiceId(),
    format,
    number: rawData.documentNumber,
    
    // Supplier (seller) details
    supplier: rawData.seller ? {
      name: rawData.seller.name,
      street: rawData.seller.street,
      city: rawData.seller.city,
      postalCode: rawData.seller.postalCode,
      country: rawData.seller.country,
      vatId: rawData.seller.vatId,
      taxId: rawData.seller.taxId,
    } : undefined,
    
    // Customer (buyer) details
    customer: rawData.buyer ? {
      name: rawData.buyer.name,
      street: rawData.buyer.street,
      city: rawData.buyer.city,
      postalCode: rawData.buyer.postalCode,
      country: rawData.buyer.country,
      vatId: rawData.buyer.vatId,
      taxId: rawData.buyer.taxId,
    } : undefined,
    
    // Dates
    issueDate: rawData.issueDate,
    dueDate: rawData.dueDate,
    deliveryDate: rawData.deliveryDate,
    
    // Currency and totals
    currency: rawData.currency,
    totals: rawData.totals ? {
      currency: rawData.currency || "EUR",
      netAmount: rawData.totals.netAmount?.toFixed(2),
      taxAmount: rawData.totals.taxAmount?.toFixed(2),
      grossAmount: rawData.totals.grossAmount?.toFixed(2),
    } : undefined,
    
    // Extended totals
    extendedTotals: rawData.totals ? {
      netAmount: rawData.totals.netAmount,
      taxAmount: rawData.totals.taxAmount,
      grossAmount: rawData.totals.grossAmount,
      vatBreakdown: rawData.totals.vatBreakdown?.map(vat => ({
        rate: vat.rate,
        baseAmount: vat.baseAmount?.toFixed(2),
        taxAmount: vat.taxAmount?.toFixed(2),
      })),
    } : undefined,
    
    // Line items
    lineItems: rawData.lineItems?.map(item => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice?.toFixed(2),
      lineTotal: item.lineTotal?.toFixed(2),
      vatRate: item.vatRate,
    })),
    
    // Payment info
    payment: rawData.payment ? {
      iban: rawData.payment.iban,
      bic: rawData.payment.bic,
      terms: rawData.payment.terms,
    } : undefined,
  };
}
