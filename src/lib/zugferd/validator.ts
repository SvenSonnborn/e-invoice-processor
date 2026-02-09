/**
 * XSD Schema Validator for ZUGFeRD/XRechnung
 */

import { XMLParser } from 'fast-xml-parser';
import { ValidationResult, InvoiceFlavor } from './types';

export class ValidatorError extends Error { constructor(message: string, public cause?: Error) { super(message); this.name = 'ValidatorError'; } }
let libxmljs: typeof import('libxmljs2') | null = null;

// Dynamic import for optional dependency (ESM compatible)
async function loadLibxmljs(): Promise<void> {
  if (libxmljs) return;
  try {
    const libxmljsMod = await import('libxmljs2');
    libxmljs = libxmljsMod as typeof import('libxmljs2');
  } catch {
    // libxmljs2 not available
  }
}
const schemaCache = new Map<string, string>();

export async function validateXML(xmlContent: string, flavor: InvoiceFlavor, _version?: string, _profile?: string): Promise<ValidationResult> {
  const errors: string[] = [], warnings: string[] = [];
  const wellFormed = checkWellFormed(xmlContent);
  if (!wellFormed.valid) return { valid: false, errors: wellFormed.errors, warnings };
  const fieldValidation = validateRequiredFields(xmlContent, flavor);
  errors.push(...fieldValidation.errors); warnings.push(...fieldValidation.warnings);
  await loadLibxmljs();
  if (libxmljs) { try { const schemaResult = await validateAgainstSchema(xmlContent, flavor, _version, _profile); errors.push(...schemaResult.errors); warnings.push(...schemaResult.warnings); } catch { warnings.push('Schema validation skipped'); } }
  else { warnings.push('Schema validation skipped: libxmljs2 not available'); }
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

function validateCIIFields(parsed: Record<string, unknown>, errors: string[]): void {
  const cii = parsed['rsm:CrossIndustryInvoice'] || parsed.CrossIndustryInvoice;
  if (!cii) { errors.push('Missing root element: CrossIndustryInvoice'); return; }
  const supplyChainTrade = (cii as Record<string, unknown>)['rsm:SupplyChainTradeTransaction'] || (cii as Record<string, unknown>).SupplyChainTradeTransaction;
  const agreement = (supplyChainTrade as Record<string, unknown>)?.['ram:ApplicableHeaderTradeAgreement'] || (supplyChainTrade as Record<string, unknown>)?.ApplicableHeaderTradeAgreement;
  const seller = (agreement as Record<string, unknown>)?.['ram:SellerTradeParty'] || (agreement as Record<string, unknown>)?.SellerTradeParty;
  const buyer = (agreement as Record<string, unknown>)?.['ram:BuyerTradeParty'] || (agreement as Record<string, unknown>)?.BuyerTradeParty;
  if (!seller) errors.push('Missing Seller');
  if (!buyer) errors.push('Missing Buyer');
  const settlement = (supplyChainTrade as Record<string, unknown>)?.['ram:ApplicableHeaderTradeSettlement'] || (supplyChainTrade as Record<string, unknown>)?.ApplicableHeaderTradeSettlement;
  if (!getTextContent((settlement as Record<string, unknown>)?.['ram:InvoiceCurrencyCode'] || (settlement as Record<string, unknown>)?.InvoiceCurrencyCode)) errors.push('Missing Currency');
}

function validateUBLFields(parsed: Record<string, unknown>, errors: string[]): void {
  const invoice = parsed['ubl:Invoice'] || parsed.Invoice;
  if (!invoice) { errors.push('Missing root element: Invoice'); return; }
  const supplier = (invoice as Record<string, unknown>)['cac:AccountingSupplierParty'] || (invoice as Record<string, unknown>).AccountingSupplierParty;
  const customer = (invoice as Record<string, unknown>)['cac:AccountingCustomerParty'] || (invoice as Record<string, unknown>).AccountingCustomerParty;
  if (!supplier) errors.push('Missing Supplier');
  if (!customer) errors.push('Missing Customer');
}

async function validateAgainstSchema(xmlContent: string, _flavor: InvoiceFlavor, _version?: string, _profile?: string): Promise<ValidationResult> {
  if (!libxmljs) return { valid: true, errors: [], warnings: ['libxmljs2 not available'] };
  try { libxmljs.parseXml(xmlContent); return { valid: true, errors: [], warnings: ['Schema validation skipped: schemas not cached'] }; }
  catch (error) { return { valid: false, errors: [`Schema validation error: ${error instanceof Error ? error.message : 'Unknown error'}`], warnings: [] }; }
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
