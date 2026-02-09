/**
 * XRechnung Parser - Parses CII (Cross Industry Invoice) and UBL formats
 */

import { XMLParser } from 'fast-xml-parser';
import { ZUGFeRDInvoice, ZUGFeRDParty, ZUGFeRDTradeLineItem, ZUGFeRDTax, ZUGFeRDMonetarySummation, ZUGFeRDMetaData, ParsedInvoiceResult, InvoiceDetectionResult } from './types';

export class XRechnungParserError extends Error { constructor(message: string, public cause?: Error) { super(message); this.name = 'XRechnungParserError'; } }
const xmlParserOptions = { ignoreAttributes: false, attributeNamePrefix: '@_', parseAttributeValue: true, parseTagValue: true, trimValues: true, removeNSPrefix: false };

export function detectInvoiceFlavor(xmlContent: string): InvoiceDetectionResult {
  const parser = new XMLParser({ ...xmlParserOptions, stopNodes: ['*'] });
  try {
    const parsed = parser.parse(xmlContent) as Record<string, unknown>;
    if (parsed['rsm:CrossIndustryInvoice'] || parsed.CrossIndustryInvoice) return { flavor: 'ZUGFeRD', version: '2.3', profile: 'EXTENDED' };
    if (parsed['ubl:Invoice'] || parsed.Invoice) {
      const cid = getTextContent(parsed['cbc:CustomizationID'] || parsed.CustomizationID);
      return { flavor: cid?.toLowerCase().includes('xrechnung') ? 'XRechnung' : 'ZUGFeRD', version: '2.1', profile: cid };
    }
    return { flavor: 'Unknown' };
  } catch { return { flavor: 'Unknown' }; }
}

export function parseCII(xmlContent: string): ParsedInvoiceResult {
  try {
    const parser = new XMLParser(xmlParserOptions);
    const parsed = parser.parse(xmlContent) as Record<string, unknown>;
    const cii = asRecord(parsed['rsm:CrossIndustryInvoice'] || parsed.CrossIndustryInvoice);
    if (!cii) return { success: false, errors: ['Invalid CII format'], warnings: [] };
    const supplyChainTrade = asRecord(cii['rsm:SupplyChainTradeTransaction'] || cii.SupplyChainTradeTransaction);
    if (!supplyChainTrade) return { success: false, errors: ['Missing SupplyChainTradeTransaction'], warnings: [] };
    return { success: true, invoice: parseCIIStructure(cii, supplyChainTrade), errors: [], warnings: [] };
  } catch (error) { return { success: false, errors: [String(error)], warnings: [] }; }
}

export function parseUBL(xmlContent: string): ParsedInvoiceResult {
  try {
    const parser = new XMLParser(xmlParserOptions);
    const parsed = parser.parse(xmlContent) as Record<string, unknown>;
    const invoice = asRecord(parsed['ubl:Invoice'] || parsed.Invoice);
    if (!invoice) return { success: false, errors: ['Invalid UBL format'], warnings: [] };
    return { success: true, invoice: parseUBLStructure(invoice), errors: [], warnings: [] };
  } catch (error) { return { success: false, errors: [String(error)], warnings: [] }; }
}

function parseCIIStructure(cii: Record<string, unknown>, supplyChainTrade: Record<string, unknown>): ZUGFeRDInvoice {
  const header = asRecord(cii['rsm:ExchangedDocument'] || cii.ExchangedDocument);
  const agreement = asRecord(supplyChainTrade['ram:ApplicableHeaderTradeAgreement'] || supplyChainTrade.ApplicableHeaderTradeAgreement);
  const settlement = asRecord(supplyChainTrade['ram:ApplicableHeaderTradeSettlement'] || supplyChainTrade.ApplicableHeaderTradeSettlement);
  const metadata: ZUGFeRDMetaData = { xmlVersion: '2.3', profile: 'EXTENDED', flavor: 'EXTENDED' };
  const invoice: ZUGFeRDInvoice = { metadata, lineItems: [], taxes: [], monetarySummation: {} };
  if (header) { invoice.documentId = getTextContent(header['ram:ID'] || header.ID); invoice.documentDate = getDateContent(header['ram:IssueDateTime'] || header.IssueDateTime); }
  if (agreement) { invoice.seller = parseCIIParty(agreement['ram:SellerTradeParty'] || agreement.SellerTradeParty); invoice.buyer = parseCIIParty(agreement['ram:BuyerTradeParty'] || agreement.BuyerTradeParty); }
  if (settlement) {
    invoice.currency = getTextContent(settlement['ram:InvoiceCurrencyCode'] || settlement.InvoiceCurrencyCode);
    invoice.monetarySummation = parseMonetarySummation(settlement['ram:SpecifiedTradeSettlementHeaderMonetarySummation'] || settlement.SpecifiedTradeSettlementHeaderMonetarySummation);
    const lineItems = supplyChainTrade['ram:IncludedSupplyChainTradeLineItem'] || supplyChainTrade.IncludedSupplyChainTradeLineItem;
    if (lineItems) invoice.lineItems = parseArray(lineItems).map(parseCIILineItem);
    const taxBreakdown = settlement['ram:ApplicableTradeTax'] || settlement.ApplicableTradeTax;
    if (taxBreakdown) invoice.taxes = parseArray(taxBreakdown).map(parseCIITax);
  }
  return invoice;
}

function parseUBLStructure(ubl: Record<string, unknown>): ZUGFeRDInvoice {
  const metadata: ZUGFeRDMetaData = { xmlVersion: '2.1', flavor: 'EXTENDED' };
  const invoice: ZUGFeRDInvoice = { metadata, lineItems: [], taxes: [], monetarySummation: {} };
  invoice.documentId = getTextContent(ubl['cbc:ID'] || ubl.ID);
  invoice.documentDate = getTextContent(ubl['cbc:IssueDate'] || ubl.IssueDate);
  invoice.currency = getTextContent(ubl['cbc:DocumentCurrencyCode'] || ubl.DocumentCurrencyCode);
  const supplier = asRecord(ubl['cac:AccountingSupplierParty'] || ubl.AccountingSupplierParty);
  const customer = asRecord(ubl['cac:AccountingCustomerParty'] || ubl.AccountingCustomerParty);
  if (supplier) invoice.seller = parseUBLParty(supplier['cac:Party'] || supplier.Party);
  if (customer) invoice.buyer = parseUBLParty(customer['cac:Party'] || customer.Party);
  const legalTotal = asRecord(ubl['cac:LegalMonetaryTotal'] || ubl.LegalMonetaryTotal);
  if (legalTotal) {
    invoice.monetarySummation = { lineTotalAmount: getTextContent(legalTotal['cbc:LineExtensionAmount'] || legalTotal.LineExtensionAmount), taxBasisTotalAmount: getTextContent(legalTotal['cbc:TaxExclusiveAmount'] || legalTotal.TaxExclusiveAmount), grandTotalAmount: getTextContent(legalTotal['cbc:TaxInclusiveAmount'] || legalTotal.TaxInclusiveAmount), duePayableAmount: getTextContent(legalTotal['cbc:PayableAmount'] || legalTotal.PayableAmount) };
  }
  const lineItems = ubl['cac:InvoiceLine'] || ubl.InvoiceLine;
  if (lineItems) invoice.lineItems = parseArray(lineItems).map(parseUBLLineItem);
  const taxTotal = asRecord(ubl['cac:TaxTotal'] || ubl.TaxTotal);
  if (taxTotal) { const subtotal = taxTotal['cac:TaxSubtotal'] || taxTotal.TaxSubtotal; if (subtotal) invoice.taxes = parseArray(subtotal).map(parseUBLTax); }
  return invoice;
}

function parseCIIParty(party: unknown): ZUGFeRDParty | undefined {
  if (!party) return undefined;
  const p = party as Record<string, unknown>;
  const addr = asRecord(p['ram:PostalTradeAddress'] || p.PostalTradeAddress);
  return { id: getTextContent(p['ram:ID'] || p.ID), name: getTextContent(p['ram:Name'] || p.Name), addressLine1: getTextContent(addr?.['ram:LineOne'] || addr?.LineOne), postcode: getTextContent(addr?.['ram:PostcodeCode'] || addr?.PostcodeCode), city: getTextContent(addr?.['ram:CityName'] || addr?.CityName), countryCode: getTextContent(addr?.['ram:CountryID'] || addr?.CountryID) };
}

function parseUBLParty(party: unknown): ZUGFeRDParty | undefined {
  if (!party) return undefined;
  const p = party as Record<string, unknown>;
  const addr = asRecord(p['cac:PostalAddress'] || p.PostalAddress);
  return { name: getTextContent(p['cbc:Name'] || p.Name), addressLine1: getTextContent(addr?.['cbc:StreetName'] || addr?.StreetName), postcode: getTextContent(addr?.['cbc:PostalZone'] || addr?.PostalZone), city: getTextContent(addr?.['cbc:CityName'] || addr?.CityName), countryCode: getTextContent((addr?.['cac:Country'] as Record<string, unknown> | undefined)?.['cbc:IdentificationCode'] || (addr?.Country as Record<string, unknown> | undefined)?.IdentificationCode) };
}

function parseCIILineItem(item: unknown): ZUGFeRDTradeLineItem {
  const i = item as Record<string, unknown>;
  const product = asRecord(i['ram:SpecifiedTradeProduct'] || i.SpecifiedTradeProduct);
  const assocDoc = asRecord(i['ram:AssociatedDocumentLineDocument'] || i.AssociatedDocumentLineDocument);
  const lineSettlement = asRecord(i['ram:SpecifiedLineTradeSettlement'] || i.SpecifiedLineTradeSettlement);
  const lineSummary = asRecord(lineSettlement?.['ram:SpecifiedTradeSettlementLineMonetarySummation'] || lineSettlement?.SpecifiedTradeSettlementLineMonetarySummation);
  const delivery = asRecord(i['ram:SpecifiedLineTradeDelivery'] || i.SpecifiedLineTradeDelivery);
  return { id: getTextContent(assocDoc?.['ram:LineID'] || assocDoc?.LineID), name: getTextContent(product?.['ram:Name'] || product?.Name), billedQuantity: getTextContent(delivery?.['ram:BilledQuantity']), lineTotalAmount: getTextContent(lineSummary?.['ram:LineTotalAmount'] || lineSummary?.LineTotalAmount) };
}

function parseUBLLineItem(item: unknown): ZUGFeRDTradeLineItem {
  const i = item as Record<string, unknown>;
  const itemData = asRecord(i['cac:Item'] || i.Item);
  return { id: getTextContent(i['cbc:ID'] || i.ID), name: getTextContent(itemData?.['cbc:Name'] || itemData?.Name), billedQuantity: getTextContent(i['cbc:InvoicedQuantity'] || i.InvoicedQuantity), lineTotalAmount: getTextContent(i['cbc:LineExtensionAmount'] || i.LineExtensionAmount) };
}

function parseCIITax(tax: unknown): ZUGFeRDTax {
  const t = tax as Record<string, unknown>;
  return { typeCode: getTextContent(t['ram:TypeCode'] || t.TypeCode), categoryCode: getTextContent(t['ram:CategoryCode'] || t.CategoryCode), ratePercent: getTextContent(t['ram:RateApplicablePercent'] || t.RateApplicablePercent), calculatedAmount: getTextContent(t['ram:CalculatedAmount'] || t.CalculatedAmount) };
}

function parseUBLTax(tax: unknown): ZUGFeRDTax {
  const t = tax as Record<string, unknown>;
  const tc = asRecord(t['cac:TaxCategory'] || t.TaxCategory);
  return { typeCode: getTextContent((tc?.['cac:TaxScheme'] as Record<string, unknown> | undefined)?.['cbc:ID'] || (tc?.TaxScheme as Record<string, unknown> | undefined)?.ID), categoryCode: getTextContent(tc?.['cbc:ID'] || tc?.ID), ratePercent: getTextContent(tc?.['cbc:Percent'] || tc?.Percent), calculatedAmount: getTextContent(t['cbc:TaxAmount'] || t.TaxAmount) };
}

function parseMonetarySummation(summation: unknown): ZUGFeRDMonetarySummation {
  const s = summation as Record<string, unknown>;
  return { lineTotalAmount: getTextContent(s['ram:LineTotalAmount'] || s.LineTotalAmount), taxBasisTotalAmount: getTextContent(s['ram:TaxBasisTotalAmount'] || s.TaxBasisTotalAmount), taxTotalAmount: getTextContent(s['ram:TaxTotalAmount'] || s.TaxTotalAmount), grandTotalAmount: getTextContent(s['ram:GrandTotalAmount'] || s.GrandTotalAmount), duePayableAmount: getTextContent(s['ram:DuePayableAmount'] || s.DuePayableAmount) };
}

function getTextContent(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'object') return (value as Record<string, string>)['#text'] || (value as Record<string, string>).text || String(value);
  return undefined;
}

function getDateContent(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const dateTime = asRecord(record['udt:DateTimeString']);
    return getTextContent(record['#text'] || dateTime?.['#text']);
  }
  return getTextContent(value);
}

function parseArray<T>(value: T | T[]): T[] { return !value ? [] : Array.isArray(value) ? value : [value]; }

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;
}
