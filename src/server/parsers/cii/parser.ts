/**
 * CII (Cross Industry Invoice) Parser
 * Used by ZUGFeRD and XRechnung CII formats
 */

import type { RawInvoiceData } from "../types";
import { extractTextValue, extractAmount, extractCiiDate } from "../xml-utils";

/** Parse CII XML to raw invoice data */
export function parseCiiXml(parsedXml: unknown): RawInvoiceData {
  const data: RawInvoiceData = {};
  const root = (parsedXml as Record<string, unknown>).CrossIndustryInvoice as Record<string, unknown>;
  
  if (!root) {
    throw new Error("Invalid CII XML: Missing CrossIndustryInvoice root element");
  }
  
  // Parse ExchangedDocument (document metadata)
  const exchangedDoc = root.ExchangedDocument as Record<string, unknown> | undefined;
  if (exchangedDoc) {
    data.documentNumber = extractTextValue(exchangedDoc.ID);
    data.documentType = extractTextValue(exchangedDoc.TypeCode);
    data.issueDate = extractCiiDate(exchangedDoc.IssueDateTime);
  }
  
  // Parse SupplyChainTradeTransaction
  const transaction = root.SupplyChainTradeTransaction as Record<string, unknown> | undefined;
  if (!transaction) {
    return data;
  }
  
  // Parse trade agreement (seller/buyer)
  const agreement = transaction.ApplicableHeaderTradeAgreement as Record<string, unknown> | undefined;
  if (agreement) {
    data.seller = parseTradeParty(agreement.SellerTradeParty);
    data.buyer = parseTradeParty(agreement.BuyerTradeParty);
  }
  
  // Parse delivery info
  const delivery = transaction.ApplicableHeaderTradeDelivery as Record<string, unknown> | undefined;
  const deliveryEvent = delivery?.ActualDeliverySupplyChainEvent as Record<string, unknown> | undefined;
  if (deliveryEvent?.OccurrenceDateTime) {
    data.deliveryDate = extractCiiDate(deliveryEvent.OccurrenceDateTime);
  }
  
  // Parse settlement (payment and totals)
  const settlement = transaction.ApplicableHeaderTradeSettlement as Record<string, unknown> | undefined;
  if (settlement) {
    data.currency = extractTextValue(settlement.InvoiceCurrencyCode);
    data.totals = parseMonetarySummation(settlement.SpecifiedTradeSettlementHeaderMonetarySummation);
    data.payment = parsePaymentTerms(settlement);
    
    // Due date from payment terms
    const paymentTerms = settlement.SpecifiedTradePaymentTerms as Record<string, unknown> | undefined;
    if (paymentTerms?.DueDateDateTime) {
      data.dueDate = extractCiiDate(paymentTerms.DueDateDateTime);
    }
  }
  
  // Parse line items
  const lineItems = transaction.IncludedSupplyChainTradeLineItem;
  if (lineItems) {
    const items = Array.isArray(lineItems) ? lineItems : [lineItems];
    data.lineItems = items.map(parseLineItem).filter(Boolean) as RawInvoiceData["lineItems"];
  }
  
  return data;
}

/** Parse trade party (seller or buyer) */
function parseTradeParty(partyData: unknown): RawInvoiceData["seller"] {
  if (!partyData) return undefined;
  
  const party = partyData as Record<string, unknown>;
  const result: RawInvoiceData["seller"] = {
    name: extractTextValue(party.Name),
  };
  
  // Parse postal address
  if (party.PostalTradeAddress) {
    const address = party.PostalTradeAddress as Record<string, unknown>;
    result.street = extractTextValue(address.LineOne);
    result.city = extractTextValue(address.CityName);
    result.postalCode = extractTextValue(address.PostcodeCode);
    result.country = extractTextValue(address.CountryID);
  }
  
  // Parse tax registrations
  if (party.SpecifiedTaxRegistration) {
    const registrations = Array.isArray(party.SpecifiedTaxRegistration) 
      ? party.SpecifiedTaxRegistration 
      : [party.SpecifiedTaxRegistration];
    
    for (const reg of registrations) {
      const id = (reg as Record<string, unknown>).ID as Record<string, unknown> | undefined;
      if (id) {
        const scheme = id["@_schemeID"] as string | undefined;
        const value = extractTextValue(id);
        
        if (scheme === "VA" || scheme === "VAT") {
          result.vatId = value;
        } else if (scheme === "FC") {
          result.taxId = value;
        }
      }
    }
  }
  
  return result;
}

/** Parse monetary summation (totals) */
function parseMonetarySummation(summationData: unknown): RawInvoiceData["totals"] {
  if (!summationData) return undefined;
  
  const sum = summationData as Record<string, unknown>;
  const result: RawInvoiceData["totals"] = {};
  
  // Net amount (line total)
  const lineTotal = extractAmount(sum.LineTotalAmount);
  if (lineTotal) result.netAmount = lineTotal.amount;
  
  // Tax basis total
  const taxBasis = extractAmount(sum.TaxBasisTotalAmount);
  if (taxBasis) result.netAmount = result.netAmount ?? taxBasis.amount;
  
  // Tax total
  const taxTotal = extractAmount(sum.TaxTotalAmount);
  if (taxTotal) result.taxAmount = taxTotal.amount;
  
  // Gross amount (grand total)
  const grandTotal = extractAmount(sum.GrandTotalAmount);
  if (grandTotal) result.grossAmount = grandTotal.amount;
  
  // Due payable
  const duePayable = extractAmount(sum.DuePayableAmount);
  if (duePayable && !result.grossAmount) {
    result.grossAmount = duePayable.amount;
  }
  
  return result;
}

/** Parse payment terms */
function parsePaymentTerms(settlementData: unknown): RawInvoiceData["payment"] {
  if (!settlementData) return undefined;
  
  const settlement = settlementData as Record<string, unknown>;
  const result: RawInvoiceData["payment"] = {};
  
  // Parse payment terms description
  const paymentTerms = settlement.SpecifiedTradePaymentTerms as Record<string, unknown> | undefined;
  if (paymentTerms?.Description) {
    result.terms = extractTextValue(paymentTerms.Description);
  }
  
  // Parse specified trade settlement payment means
  const paymentMeans = settlement.SpecifiedTradeSettlementPaymentMeans;
  if (paymentMeans) {
    const means = Array.isArray(paymentMeans) ? paymentMeans[0] : paymentMeans;
    
    // Look for IBAN in payee party creditor financial account
    const creditorAccount = (means as Record<string, unknown>).PayeePartyCreditorFinancialAccount;
    if (creditorAccount) {
      result.iban = extractTextValue((creditorAccount as Record<string, unknown>).IBANID);
    }
    
    // Look for BIC
    const creditorInstitution = (means as Record<string, unknown>).PayeeSpecifiedCreditorFinancialInstitution;
    if (creditorInstitution) {
      result.bic = extractTextValue((creditorInstitution as Record<string, unknown>).BICID);
    }
  }
  
  return Object.keys(result).length > 0 ? result : undefined;
}

/** Line item type */
type LineItem = NonNullable<RawInvoiceData["lineItems"]>[number];

/** Parse a line item */
function parseLineItem(itemData: unknown): LineItem | undefined {
  if (!itemData) return undefined;
  
  const item = itemData as Record<string, unknown>;
  const result: LineItem = {};
  
  // Line ID
  const docLine = item.AssociatedDocumentLineDocument as Record<string, unknown> | undefined;
  if (docLine) {
    result.id = extractTextValue(docLine.LineID);
  }
  
  // Product info
  const product = item.SpecifiedTradeProduct as Record<string, unknown> | undefined;
  if (product) {
    result.description = extractTextValue(product.Name) || extractTextValue(product.Description);
  }
  
  // Line agreement (price)
  const agreement = item.SpecifiedLineTradeAgreement as Record<string, unknown> | undefined;
  if (agreement?.NetPriceProductTradePrice) {
    const price = extractAmount((agreement.NetPriceProductTradePrice as Record<string, unknown>).ChargeAmount);
    if (price) result.unitPrice = price.amount;
  }
  
  // Line delivery (quantity)
  const delivery = item.SpecifiedLineTradeDelivery as Record<string, unknown> | undefined;
  if (delivery?.BilledQuantity) {
    const qty = delivery.BilledQuantity as Record<string, unknown>;
    const qtyValue = extractTextValue(qty);
    if (qtyValue) {
      result.quantity = parseFloat(qtyValue);
    }
    result.unit = qty["@_unitCode"] as string | undefined;
  }
  
  // Line settlement (total and VAT)
  const settlement = item.SpecifiedLineTradeSettlement as Record<string, unknown> | undefined;
  if (settlement) {
    // Line total
    const lineSummation = settlement.SpecifiedTradeSettlementLineMonetarySummation as Record<string, unknown> | undefined;
    if (lineSummation) {
      const lineTotal = extractAmount(lineSummation.LineTotalAmount);
      if (lineTotal) result.lineTotal = lineTotal.amount;
    }
    
    // VAT rate
    const tradeTax = settlement.ApplicableTradeTax;
    if (tradeTax) {
      const taxes = Array.isArray(tradeTax) ? tradeTax : [tradeTax];
      for (const tax of taxes) {
        const rate = extractTextValue((tax as Record<string, unknown>).RateApplicablePercent);
        if (rate) {
          result.vatRate = parseFloat(rate);
          break;
        }
      }
    }
  }
  
  return result;
}
