/**
 * UBL (Universal Business Language) Parser
 * Used by XRechnung UBL format
 */

import type { RawInvoiceData } from "../types";
import { extractTextValue, extractAmount } from "../xml-utils";

/** Get value from potentially namespaced element */
function getNamespacedValue(obj: Record<string, unknown>, localName: string): unknown {
  // Try direct match first (non-namespaced)
  if (localName in obj) return obj[localName];
  
  // Try common UBL namespace prefixes
  const prefixes = ["cbc:", "cac:", ""];
  for (const prefix of prefixes) {
    const key = `${prefix}${localName}`;
    if (key in obj) return obj[key];
  }
  
  return undefined;
}

/** Extract text from potentially namespaced element */
function extractNamespacedText(obj: Record<string, unknown>, localName: string): string | undefined {
  const value = getNamespacedValue(obj, localName);
  return extractTextValue(value);
}

/** Parse UBL XML to raw invoice data */
export function parseUblXml(parsedXml: unknown): RawInvoiceData {
  const data: RawInvoiceData = {};
  const root = (parsedXml as Record<string, unknown>).Invoice as Record<string, unknown>;
  
  if (!root) {
    throw new Error("Invalid UBL XML: Missing Invoice root element");
  }
  
  // Document metadata - handle both namespaced and non-namespaced
  data.documentNumber = extractNamespacedText(root, "ID");
  data.issueDate = extractNamespacedText(root, "IssueDate");
  data.dueDate = extractNamespacedText(root, "DueDate");
  data.documentType = extractNamespacedText(root, "InvoiceTypeCode");
  data.currency = extractNamespacedText(root, "DocumentCurrencyCode");
  
  // Parse supplier (seller)
  data.seller = parseParty(root.AccountingSupplierParty);
  
  // Parse customer (buyer)
  data.buyer = parseParty(root.AccountingCustomerParty);
  
  // Parse delivery info
  if (root.Delivery?.ActualDeliveryDate) {
    data.deliveryDate = extractTextValue(root.Delivery.ActualDeliveryDate);
  }
  
  // Parse monetary totals
  data.totals = parseMonetaryTotal(root.LegalMonetaryTotal);
  
  // Parse payment info (from PaymentMeans)
  data.payment = parsePaymentMeans(root.PaymentMeans);
  
  // Parse line items
  const invoiceLines = root.InvoiceLine;
  if (invoiceLines) {
    const lines = Array.isArray(invoiceLines) ? invoiceLines : [invoiceLines];
    data.lineItems = lines.map(parseInvoiceLine).filter(Boolean) as RawInvoiceData["lineItems"];
  }
  
  return data;
}

/** Parse party (supplier or customer) */
function parseParty(partyData: unknown): RawInvoiceData["seller"] {
  if (!partyData) return undefined;
  
  const wrapper = partyData as Record<string, unknown>;
  const party = wrapper.Party as Record<string, unknown> | undefined;
  if (!party) return undefined;
  
  const result: RawInvoiceData["seller"] = {};
  
  // Party name
  if (party.PartyName?.Name) {
    result.name = extractTextValue(party.PartyName.Name);
  } else if (party.PartyLegalEntity?.RegistrationName) {
    result.name = extractTextValue(party.PartyLegalEntity.RegistrationName);
  }
  
  // Postal address
  if (party.PostalAddress) {
    const address = party.PostalAddress as Record<string, unknown>;
    result.street = extractTextValue(address.StreetName);
    result.city = extractTextValue(address.CityName);
    result.postalCode = extractTextValue(address.PostalZone);
    if (address.Country?.IdentificationCode) {
      result.country = extractTextValue(address.Country.IdentificationCode);
    }
  }
  
  // Tax registrations
  if (party.PartyTaxScheme) {
    const schemes = Array.isArray(party.PartyTaxScheme) 
      ? party.PartyTaxScheme 
      : [party.PartyTaxScheme];
    
    for (const scheme of schemes) {
      const companyId = extractTextValue((scheme as Record<string, unknown>).CompanyID);
      const taxScheme = (scheme as Record<string, unknown>).TaxScheme as Record<string, unknown> | undefined;
      const schemeId = extractTextValue(taxScheme?.ID);
      
      if (schemeId === "VAT" || companyId?.startsWith("DE")) {
        result.vatId = companyId;
      }
    }
  }
  
  // Party identification
  if (party.PartyIdentification?.ID) {
    const id = extractTextValue(party.PartyIdentification.ID);
    if (id && !result.taxId) {
      result.taxId = id;
    }
  }
  
  return result;
}

/** Parse monetary total */
function parseMonetaryTotal(totalData: unknown): RawInvoiceData["totals"] {
  if (!totalData) return undefined;
  
  const total = totalData as Record<string, unknown>;
  const result: RawInvoiceData["totals"] = {};
  
  // Line extension amount (sum of line totals)
  const lineExt = extractAmount(total.LineExtensionAmount);
  if (lineExt) result.netAmount = lineExt.amount;
  
  // Tax exclusive amount
  const taxExclusive = extractAmount(total.TaxExclusiveAmount);
  if (taxExclusive) result.netAmount = result.netAmount ?? taxExclusive.amount;
  
  // Tax inclusive amount
  const taxInclusive = extractAmount(total.TaxInclusiveAmount);
  if (taxInclusive) result.grossAmount = taxInclusive.amount;
  
  // Payable amount
  const payable = extractAmount(total.PayableAmount);
  if (payable) {
    result.grossAmount = result.grossAmount ?? payable.amount;
  }
  
  // Calculate tax amount if not directly provided
  if (result.grossAmount && result.netAmount) {
    result.taxAmount = parseFloat((result.grossAmount - result.netAmount).toFixed(2));
  }
  
  return result;
}

/** Parse payment means */
function parsePaymentMeans(meansData: unknown): RawInvoiceData["payment"] {
  if (!meansData) return undefined;
  
  const means = Array.isArray(meansData) ? meansData[0] : meansData;
  const payment = means as Record<string, unknown>;
  const result: RawInvoiceData["payment"] = {};
  
  // Payment ID/Note
  if (payment.PaymentID) {
    result.terms = extractTextValue(payment.PaymentID);
  }
  if (payment.InstructionNote) {
    result.terms = result.terms 
      ? `${result.terms} - ${extractTextValue(payment.InstructionNote)}`
      : extractTextValue(payment.InstructionNote);
  }
  
  // Payee financial account (IBAN)
  const payeeAccount = payment.PayeeFinancialAccount as Record<string, unknown> | undefined;
  if (payeeAccount?.ID) {
    const accountId = extractTextValue(payeeAccount.ID);
    // Check if it's an IBAN (starts with country code like DE, AT, etc.)
    if (accountId && /^[A-Z]{2}/.test(accountId)) {
      result.iban = accountId;
    }
  }
  
  // Financial institution (BIC)
  if (payeeAccount?.FinancialInstitutionBranch?.FinancialInstitution?.ID) {
    result.bic = extractTextValue(payeeAccount.FinancialInstitutionBranch.FinancialInstitution.ID);
  }
  
  return Object.keys(result).length > 0 ? result : undefined;
}

/** Parse invoice line */
function parseInvoiceLine(lineData: unknown): RawInvoiceData["lineItems"][number] | undefined {
  if (!lineData) return undefined;
  
  const line = lineData as Record<string, unknown>;
  const result: RawInvoiceData["lineItems"][number] = {};
  
  // Line ID
  result.id = extractTextValue(line.ID);
  
  // Quantity
  if (line.InvoicedQuantity) {
    const qty = line.InvoicedQuantity as Record<string, unknown>;
    const qtyValue = extractTextValue(qty);
    if (qtyValue) {
      result.quantity = parseFloat(qtyValue);
    }
    result.unit = qty["@_unitCode"] as string | undefined;
  }
  
  // Line extension amount (line total)
  const lineExt = extractAmount(line.LineExtensionAmount);
  if (lineExt) {
    result.lineTotal = lineExt.amount;
  }
  
  // Item details
  const item = line.Item as Record<string, unknown> | undefined;
  if (item) {
    result.description = extractTextValue(item.Name) || extractTextValue(item.Description);
  }
  
  // Price
  const price = line.Price as Record<string, unknown> | undefined;
  if (price?.PriceAmount) {
    const priceAmt = extractAmount(price.PriceAmount);
    if (priceAmt) {
      result.unitPrice = priceAmt.amount;
    }
  }
  
  // Tax info (from Item.ClassifiedTaxCategory)
  if (item?.ClassifiedTaxCategory?.Percent) {
    const percent = extractTextValue(item.ClassifiedTaxCategory.Percent);
    if (percent) {
      result.vatRate = parseFloat(percent);
    }
  }
  
  return result;
}
