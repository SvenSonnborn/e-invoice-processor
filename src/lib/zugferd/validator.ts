/**
 * Structural and required-fields validation for ZUGFeRD/XRechnung.
 * Performs well-formedness check and EN 16931 required-field checks.
 * Full XSD schema validation is not implemented; use preloadSchema for future use.
 */

import { XMLParser } from 'fast-xml-parser';
import { ValidationResult, InvoiceFlavor } from './types';

export class ValidatorError extends Error { constructor(message: string, public cause?: Error) { super(message); this.name = 'ValidatorError'; } }

/** Cache for optional future XSD schema validation (not yet implemented). */
export const schemaCache = new Map<string, string>();

export async function validateXML(xmlContent: string, flavor: InvoiceFlavor, _version?: string, _profile?: string): Promise<ValidationResult> {
  const errors: string[] = [], warnings: string[] = [];
  const wellFormed = checkWellFormed(xmlContent);
  if (!wellFormed.valid) return { valid: false, errors: wellFormed.errors, warnings };
  const fieldValidation = validateRequiredFields(xmlContent, flavor);
  errors.push(...fieldValidation.errors);
  warnings.push(...fieldValidation.warnings);
  return { valid: errors.length === 0, errors, warnings };
}

function checkWellFormed(xmlContent: string): { valid: boolean; errors: string[] } {
  try { new XMLParser({ ignoreAttributes: false, parseAttributeValue: false, parseTagValue: false }).parse(xmlContent); return { valid: true, errors: [] }; }
  catch (error) { return { valid: false, errors: [`XML is not well-formed: ${error instanceof Error ? error.message : 'Unknown error'}`] }; }
}

function validateRequiredFields(xmlContent: string, flavor: InvoiceFlavor): ValidationResult {
  const errors: string[] = [], warnings: string[] = [];
  try {
    const parsed = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' }).parse(xmlContent);
    if (flavor === 'ZUGFeRD' || isCIIFormat(parsed)) validateCIIFields(parsed, errors);
    else if (flavor === 'XRechnung' || isUBLFormat(parsed)) validateUBLFields(parsed, errors);
  } catch (error) { errors.push(`Field validation error: ${error instanceof Error ? error.message : 'Unknown error'}`); }
  return { valid: errors.length === 0, errors, warnings };
}

/** EN 16931 / CII required fields. */
function validateCIIFields(parsed: Record<string, unknown>, errors: string[]): void {
  const cii = parsed['rsm:CrossIndustryInvoice'] || parsed.CrossIndustryInvoice;
  if (!cii) { errors.push('Missing root element: CrossIndustryInvoice'); return; }
  const root = cii as Record<string, unknown>;
  const exchangedDoc = root['rsm:ExchangedDocument'] || root.ExchangedDocument;
  if (exchangedDoc) {
    const id = getTextContent((exchangedDoc as Record<string, unknown>)['rsm:ID'] ?? (exchangedDoc as Record<string, unknown>).ID);
    if (!id) errors.push('Missing ExchangedDocument/ID');
    const typeCode = getTextContent((exchangedDoc as Record<string, unknown>)['rsm:TypeCode'] ?? (exchangedDoc as Record<string, unknown>).TypeCode);
    if (!typeCode) errors.push('Missing ExchangedDocument/TypeCode');
    const issueDateTime = (exchangedDoc as Record<string, unknown>)['rsm:IssueDateTime'] ?? (exchangedDoc as Record<string, unknown>).IssueDateTime;
    if (!issueDateTime) errors.push('Missing ExchangedDocument/IssueDateTime');
  } else {
    errors.push('Missing ExchangedDocument');
  }
  const supplyChainTrade = root['rsm:SupplyChainTradeTransaction'] || root.SupplyChainTradeTransaction;
  const agreement = (supplyChainTrade as Record<string, unknown>)?.['ram:ApplicableHeaderTradeAgreement'] || (supplyChainTrade as Record<string, unknown>)?.ApplicableHeaderTradeAgreement;
  const seller = (agreement as Record<string, unknown>)?.['ram:SellerTradeParty'] || (agreement as Record<string, unknown>)?.SellerTradeParty;
  const buyer = (agreement as Record<string, unknown>)?.['ram:BuyerTradeParty'] || (agreement as Record<string, unknown>)?.BuyerTradeParty;
  if (!seller) errors.push('Missing Seller');
  if (!buyer) errors.push('Missing Buyer');
  const settlement = (supplyChainTrade as Record<string, unknown>)?.['ram:ApplicableHeaderTradeSettlement'] || (supplyChainTrade as Record<string, unknown>)?.ApplicableHeaderTradeSettlement;
  const settlementObj = settlement as Record<string, unknown> | undefined;
  if (!getTextContent(settlementObj?.['ram:InvoiceCurrencyCode'] ?? settlementObj?.InvoiceCurrencyCode)) errors.push('Missing Currency');
  const summation = settlementObj?.['ram:SpecifiedTradeSettlementHeaderMonetarySummation'] ?? settlementObj?.SpecifiedTradeSettlementHeaderMonetarySummation;
  const grandTotal = summation && getTextContent((summation as Record<string, unknown>)['ram:GrandTotalAmount'] ?? (summation as Record<string, unknown>).GrandTotalAmount);
  if (!grandTotal) errors.push('Missing SpecifiedTradeSettlementHeaderMonetarySummation/GrandTotalAmount');
}

/** EN 16931 / UBL required fields. */
function validateUBLFields(parsed: Record<string, unknown>, errors: string[]): void {
  const invoice = parsed['ubl:Invoice'] || parsed.Invoice;
  if (!invoice) { errors.push('Missing root element: Invoice'); return; }
  const inv = invoice as Record<string, unknown>;
  if (!getTextContent(inv['cbc:ID'] ?? inv.ID)) errors.push('Missing Invoice/ID');
  if (!getTextContent(inv['cbc:IssueDate'] ?? inv.IssueDate)) errors.push('Missing Invoice/IssueDate');
  if (!getTextContent(inv['cbc:DocumentCurrencyCode'] ?? inv.DocumentCurrencyCode)) errors.push('Missing Invoice/DocumentCurrencyCode');
  const supplier = inv['cac:AccountingSupplierParty'] || inv.AccountingSupplierParty;
  const customer = inv['cac:AccountingCustomerParty'] || inv.AccountingCustomerParty;
  if (!supplier) errors.push('Missing Supplier');
  if (!customer) errors.push('Missing Customer');
  const legalTotal = inv['cac:LegalMonetaryTotal'] || inv.LegalMonetaryTotal;
  const payableAmount = legalTotal && getTextContent((legalTotal as Record<string, unknown>)['cbc:PayableAmount'] ?? (legalTotal as Record<string, unknown>).PayableAmount);
  if (!payableAmount) errors.push('Missing LegalMonetaryTotal/PayableAmount');
}

function isCIIFormat(parsed: Record<string, unknown>): boolean { return !!(parsed['rsm:CrossIndustryInvoice'] || parsed.CrossIndustryInvoice); }
function isUBLFormat(parsed: Record<string, unknown>): boolean { return !!(parsed['ubl:Invoice'] || parsed.Invoice); }
export function preloadSchema(name: string, schemaContent: string): void { schemaCache.set(name, schemaContent); }
export function getValidationInfo(xmlContent: string): { flavor: InvoiceFlavor; version?: string; profile?: string } {
  try {
    const parsed = new XMLParser({ ignoreAttributes: false }).parse(xmlContent);
    if (isCIIFormat(parsed)) return { flavor: 'ZUGFeRD', version: '2.3' };
    if (isUBLFormat(parsed)) return { flavor: 'ZUGFeRD', version: '2.1' };
    return { flavor: 'Unknown' };
  } catch { return { flavor: 'Unknown' }; }
}

function getTextContent(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'object') return (value as Record<string, string>)['#text'] || (value as Record<string, string>).text || String(value);
  return undefined;
}
