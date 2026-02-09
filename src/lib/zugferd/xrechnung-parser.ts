/**
 * XRechnung Parser - Parses CII (Cross Industry Invoice) and UBL formats
 */

import { XMLParser } from 'fast-xml-parser';
import { ZUGFeRDInvoice, ZUGFeRDParty, ZUGFeRDTradeLineItem, ZUGFeRDTax, ZUGFeRDMonetarySummation, ZUGFeRDMetaData, ParsedInvoiceResult, InvoiceDetectionResult, InvoiceFlavor } from './types';

export class XRechnungParserError extends Error { constructor(message: string, public cause?: Error) { super(message); this.name = 'XRechnungParserError'; } }
const xmlParserOptions = { ignoreAttributes: false, attributeNamePrefix: '@_', parseAttributeValue: true, parseTagValue: true, trimValues: true, removeNSPrefix: false };

export function detectInvoiceFlavor(xmlContent: string): InvoiceDetectionResult {
  const parser = new XMLParser({ ...xmlParserOptions, stopNodes: ['*'] });
  try {
    const parsed = parser.parse(xmlContent);
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
    const parsed = parser.parse(xmlContent);
    const cii = parsed['rsm:CrossIndustryInvoice'] || parsed.CrossIndustryInvoice;
    if (!cii) return { success: false, errors: ['Invalid CII format'], warnings: [] };
    const supplyChainTrade = cii['rsm:SupplyChainTradeTransaction'] || cii.SupplyChainTradeTransaction;
    if (!supplyChainTrade) return { success: false, errors: ['Missing SupplyChainTradeTransaction'], warnings: [] };
    return { success: true, invoice: parseCIIStructure(cii, supplyChainTrade), errors: [], warnings: [] };
  } catch (error) { return { success: false, errors: [String(error)], warnings: [] }; }
}

export function parseUBL(xmlContent: string): ParsedInvoiceResult {
  try {
    const parser = new XMLParser(xmlParserOptions);
    const parsed = parser.parse(xmlContent);
    const invoice = parsed['ubl:Invoice'] || parsed.Invoice;
    if (!invoice) return { success: false, errors: ['Invalid UBL format'], warnings: [] };
    return { success: true, invoice: parseUBLStructure(invoice), errors: [], warnings: [] };
  } catch (error) { return { success: false, errors: [String(error)], warnings: [] }; }
}

function parseCIIStructure(cii: Record<string, unknown>, supplyChainTrade: Record<string, unknown>): ZUGFeRDInvoice {
  const header = cii['rsm:ExchangedDocument'] || cii.ExchangedDocument;
  const agreement = supplyChainTrade['ram:ApplicableHeaderTradeAgreement'] || supplyChainTrade.ApplicableHeaderTradeAgreement;
  const settlement = supplyChainTrade['ram:ApplicableHeaderTradeSettlement'] || supplyChainTrade.ApplicableHeaderTradeSettlement;
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
  const supplier = ubl['cac:AccountingSupplierParty'] || ubl.AccountingSupplierParty;
  const customer = ubl['cac:AccountingCustomerParty'] || ubl.AccountingCustomerParty;
  if (supplier) invoice.seller = parseUBLParty(supplier['cac:Party'] || supplier.Party);
  if (customer) invoice.buyer = parseUBLParty(customer['cac:Party'] || customer.Party);
  const legalTotal = ubl['cac:LegalMonetaryTotal'] || ubl.LegalMonetaryTotal;
  if (legalTotal) {
    invoice.monetarySummation = { lineTotalAmount: getTextContent(legalTotal['cbc:LineExtensionAmount'] || legalTotal.LineExtensionAmount), taxBasisTotalAmount: getTextContent(legalTotal['cbc:TaxExclusiveAmount'] || legalTotal.TaxExclusiveAmount), grandTotalAmount: getTextContent(legalTotal['cbc:TaxInclusiveAmount'] || legalTotal.TaxInclusiveAmount), duePayableAmount: getTextContent(legalTotal['cbc:PayableAmount'] || legalTotal.PayableAmount) };
  }
  const lineItems = ubl['cac:InvoiceLine'] || ubl.InvoiceLine;
  if (lineItems) invoice.lineItems = parseArray(lineItems).map(parseUBLLineItem);
  const taxTotal = ubl['cac:TaxTotal'] || ubl.TaxTotal;
  if (taxTotal) { const subtotal = taxTotal['cac:TaxSubtotal'] || taxTotal.TaxSubtotal; if (subtotal) invoice.taxes = parseArray(subtotal).map(parseUBLTax); }
  return invoice;
}

function parseCIIParty(party: unknown): ZUGFeRDParty | undefined {
  if (!party) return undefined;
  const p = party as Record<string, unknown>;
  const addr = p['ram:PostalTradeAddress'] || p.PostalTradeAddress;
  return { id: getTextContent(p['ram:ID'] || p.ID), name: getTextContent(p['ram:Name'] || p.Name), addressLine1: getTextContent((addr as Record<string, unknown>)?.['ram:LineOne'] || (addr as Record<string, unknown>)?.LineOne), postcode: getTextContent((addr as Record<string, unknown>)?.['ram:PostcodeCode'] || (addr as Record<string, unknown>)?.PostcodeCode), city: getTextContent((addr as Record<string, unknown>)?.['ram:CityName'] || (addr as Record<string, unknown>)?.CityName), countryCode: getTextContent((addr as Record<string, unknown>)?.['ram:CountryID'] || (addr as Record<string, unknown>)?.CountryID) };
}

function parseUBLParty(party: unknown): ZUGFeRDParty | undefined {
  if (!party) return undefined;
  const p = party as Record<string, unknown>;
  const addr = p['cac:PostalAddress'] || p.PostalAddress;
  return { name: getTextContent(p['cbc:Name'] || p.Name), addressLine1: getTextContent((addr as Record<string, unknown>)?.['cbc:StreetName'] || (addr as Record<string, unknown>)?.StreetName), postcode: getTextContent((addr as Record<string, unknown>)?.['cbc:PostalZone'] || (addr as Record<string, unknown>)?.PostalZone), city: getTextContent((addr as Record<string, unknown>)?.['cbc:CityName'] || (addr as Record<string, unknown>)?.CityName), countryCode: getTextContent((addr as Record<string, unknown>)?.['cac:Country']?.['cbc:IdentificationCode'] || (addr as Record<string, unknown>)?.Country?.IdentificationCode) };
}

function parseCIILineItem(item: unknown): ZUGFeRDTradeLineItem {
  const i = item as Record<string, unknown>;
  const product = i['ram:SpecifiedTradeProduct'] || i.SpecifiedTradeProduct;
  return { id: getTextContent((i['ram:AssociatedDocumentLineDocument'] as Record<string, unknown>)?.['ram:LineID'] || (i.AssociatedDocumentLineDocument as Record<string, unknown>)?.LineID), name: getTextContent((product as Record<string, unknown>)?.['ram:Name'] || (product as Record<string, unknown>)?.Name), lineTotalAmount: getTextContent((i['ram:SpecifiedLineTradeSettlement'] as Record<string, unknown>)?.['ram:SpecifiedTradeSettlementLineMonetarySummation']?.['ram:LineTotalAmount'] || (i.SpecifiedLineTradeSettlement as Record<string, unknown>)?.SpecifiedTradeSettlementLineMonetarySummation?.LineTotalAmount) };
}

function parseUBLLineItem(item: unknown): ZUGFeRDTradeLineItem {
  const i = item as Record<string, unknown>;
  const itemData = i['cac:Item'] || i.Item;
  return { id: getTextContent(i['cbc:ID'] || i.ID), name: getTextContent((itemData as Record<string, unknown>)?.['cbc:Name'] || (itemData as Record<string, unknown>)?.Name), lineTotalAmount: getTextContent(i['cbc:LineExtensionAmount'] || i.LineExtensionAmount) };
}

function parseCIITax(tax: unknown): ZUGFeRDTax {
  const t = tax as Record<string, unknown>;
  return { typeCode: getTextContent(t['ram:TypeCode'] || t.TypeCode), categoryCode: getTextContent(t['ram:CategoryCode'] || t.CategoryCode), ratePercent: getTextContent(t['ram:RateApplicablePercent'] || t.RateApplicablePercent), calculatedAmount: getTextContent(t['ram:CalculatedAmount'] || t.CalculatedAmount) };
}

function parseUBLTax(tax: unknown): ZUGFeRDTax {
  const t = tax as Record<string, unknown>;
  const tc = t['cac:TaxCategory'] || t.TaxCategory;
  return { typeCode: getTextContent((tc as Record<string, unknown>)?.['cac:TaxScheme']?.['cbc:ID'] || (tc as Record<string, unknown>)?.TaxScheme?.ID), categoryCode: getTextContent((tc as Record<string, unknown>)?.['cbc:ID'] || (tc as Record<string, unknown>)?.ID), ratePercent: getTextContent((tc as Record<string, unknown>)?.['cbc:Percent'] || (tc as Record<string, unknown>)?.Percent), calculatedAmount: getTextContent(t['cbc:TaxAmount'] || t.TaxAmount) };
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
  if (typeof value === 'object') return getTextContent((value as Record<string, unknown>)['#text'] || (value as Record<string, unknown>)['udt:DateTimeString']?.['#text']);
  return getTextContent(value);
}

function parseArray<T>(value: T | T[]): T[] { return !value ? [] : Array.isArray(value) ? value : [value]; }
