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
  const delivery = root.Delivery as Record<string, unknown> | undefined;
  if (delivery?.ActualDeliveryDate) {
    data.deliveryDate = extractTextValue(delivery.ActualDeliveryDate);
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
  const partyName = party.PartyName as Record<string, unknown> | undefined;
  const partyLegalEntity = party.PartyLegalEntity as Record<string, unknown> | undefined;
  if (partyName?.Name) {
    result.name = extractTextValue(partyName.Name);
  } else if (partyLegalEntity?.RegistrationName) {
    result.name = extractTextValue(partyLegalEntity.RegistrationName);
  }
  
  // Postal address
  const postalAddress = party.PostalAddress as Record<string, unknown> | undefined;
  if (postalAddress) {
    result.street = extractTextValue(postalAddress.StreetName);
    result.city = extractTextValue(postalAddress.CityName);
    result.postalCode = extractTextValue(postalAddress.PostalZone);
    const country = postalAddress.Country as Record<string, unknown> | undefined;
    if (country?.IdentificationCode) {
      result.country = extractTextValue(country.IdentificationCode);
    }
  }
  
  // Tax registrations
  const partyTaxScheme = party.PartyTaxScheme;
  if (partyTaxScheme) {
    const schemes = Array.isArray(partyTaxScheme) 
      ? partyTaxScheme 
      : [partyTaxScheme];
    
    for (const scheme of schemes) {
      const schemeRecord = scheme as Record<string, unknown>;
      const companyId = extractTextValue(schemeRecord.CompanyID);
      const taxScheme = schemeRecord.TaxScheme as Record<string, unknown> | undefined;
      const schemeId = extractTextValue(taxScheme?.ID);
      
      if (schemeId === "VAT" || companyId?.startsWith("DE")) {
        result.vatId = companyId;
      }
    }
  }
  
  // Party identification
  const partyIdentification = party.PartyIdentification as Record<string, unknown> | undefined;
  if (partyIdentification?.ID) {
    const id = extractTextValue(partyIdentification.ID);
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
  const financialInstitutionBranch = payeeAccount?.FinancialInstitutionBranch as Record<string, unknown> | undefined;
  const financialInstitution = financialInstitutionBranch?.FinancialInstitution as Record<string, unknown> | undefined;
  if (financialInstitution?.ID) {
    result.bic = extractTextValue(financialInstitution.ID);
  }
  
  return Object.keys(result).length > 0 ? result : undefined;
}

/** Line item type */
type UblLineItem = NonNullable<RawInvoiceData["lineItems"]>[number];

/** Parse invoice line */
function parseInvoiceLine(lineData: unknown): UblLineItem | undefined {
  if (!lineData) return undefined;
  
  const line = lineData as Record<string, unknown>;
  const result: UblLineItem = {};
  
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
  const classifiedTaxCategory = item?.ClassifiedTaxCategory as Record<string, unknown> | undefined;
  if (classifiedTaxCategory?.Percent) {
    const percent = extractTextValue(classifiedTaxCategory.Percent);
    if (percent) {
      result.vatRate = parseFloat(percent);
    }
  }
  
  return result;
}
