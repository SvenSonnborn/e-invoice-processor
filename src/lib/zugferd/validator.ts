/**
 * XSD Schema Validator for ZUGFeRD/XRechnung
 */

import { XMLParser } from 'fast-xml-parser';
import { ValidationResult, InvoiceFlavor } from './types';

export class ValidatorError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'ValidatorError';
  }
}

let libxmljs: typeof import('libxmljs2') | null = null;
try { libxmljs = await import('libxmljs2'); } catch { /* not available */ }

const SCHEMA_URLS: Record<string, string> = {
  'zugferd-2.3-extended': 'https://www.zugferd.org/schemas/ZF23/FACTUR-X_EXTENDED.xsd',
  'zugferd-2.3-en16931': 'https://www.zugferd.org/schemas/ZF23/FACTUR-X_EN16931.xsd',
  'xrechnung-cii': 'https://www.xrechnung-bund.de/de/leitweg/validation/XRechnung-CII.xsd',
  'xrechnung-ubl': 'https://www.xrechnung-bund.de/de/leitweg/validation/XRechnung-UBL.xsd',
};

const schemaCache = new Map<string, string>();

export async function validateXML(xmlContent: string, flavor: InvoiceFlavor, version?: string, profile?: string): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const wellFormedResult = checkWellFormed(xmlContent);
  if (!wellFormedResult.valid) return { valid: false, errors: wellFormedResult.errors, warnings };

  const fieldValidation = validateRequiredFields(xmlContent, flavor);
  errors.push(...fieldValidation.errors);
  warnings.push(...fieldValidation.warnings);

  if (libxmljs) {
    try {
      const schemaResult = await validateAgainstSchema(xmlContent, flavor, version, profile);
      errors.push(...schemaResult.errors);
      warnings.push(...schemaResult.warnings);
    } catch (error) {
      warnings.push(`Schema validation skipped: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  } else {
    warnings.push('Schema validation skipped: libxmljs2 not available');
  }

  return { valid: errors.length === 0, errors, warnings };
}

function checkWellFormed(xmlContent: string): { valid: boolean; errors: string[] } {
  try {
    new XMLParser({ ignoreAttributes: false, parseAttributeValue: false, parseTagValue: false }).parse(xmlContent);
    return { valid: true, errors: [] };
  } catch (error) {
    return { valid: false, errors: [`XML is not well-formed: ${error instanceof Error ? error.message : 'Unknown error'}`] };
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === 'object') return value as Record<string, unknown>;
  return undefined;
}

function validateRequiredFields(xmlContent: string, flavor: InvoiceFlavor): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
    const parsed = parser.parse(xmlContent);

    if (flavor === 'ZUGFeRD' || isCIIFormat(parsed)) validateCIIFields(parsed, errors, warnings);
    else if (flavor === 'XRechnung' || isUBLFormat(parsed)) validateUBLFields(parsed, errors, warnings);
  } catch (error) {
    errors.push(`Field validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

function validateCIIFields(parsed: Record<string, unknown>, errors: string[], _warnings: string[]): void {
  const cii = asRecord(parsed['rsm:CrossIndustryInvoice'] || parsed.CrossIndustryInvoice);
  if (!cii) { errors.push('Missing root element: CrossIndustryInvoice'); return; }

  const header = asRecord(cii['rsm:ExchangedDocument'] || cii.ExchangedDocument);
  const supplyChainTrade = asRecord(cii['rsm:SupplyChainTradeTransaction'] || cii.SupplyChainTradeTransaction);

  if (!getTextContent(header?.['ram:ID'] || header?.ID)) errors.push('Missing required field: Document ID');
  if (!getTextContent(header?.['ram:TypeCode'] || header?.TypeCode)) errors.push('Missing required field: Document Type Code');

  const agreement = asRecord(supplyChainTrade?.['ram:ApplicableHeaderTradeAgreement'] || supplyChainTrade?.ApplicableHeaderTradeAgreement);
  const seller = asRecord(agreement?.['ram:SellerTradeParty'] || agreement?.SellerTradeParty);
  const buyer = asRecord(agreement?.['ram:BuyerTradeParty'] || agreement?.BuyerTradeParty);

  if (!seller) errors.push('Missing required field: Seller Trade Party');
  else {
    const sellerLegalOrg = asRecord(seller['ram:SpecifiedLegalOrganization'] || seller.SpecifiedLegalOrganization);
    if (!getTextContent(seller['ram:Name'] || seller.Name || sellerLegalOrg?.['ram:TradingBusinessName'] || sellerLegalOrg?.TradingBusinessName)) {
      errors.push('Missing required field: Seller Name');
    }
  }

  if (!buyer) errors.push('Missing required field: Buyer Trade Party');
  else {
    const buyerLegalOrg = asRecord(buyer['ram:SpecifiedLegalOrganization'] || buyer.SpecifiedLegalOrganization);
    if (!getTextContent(buyer['ram:Name'] || buyer.Name || buyerLegalOrg?.['ram:TradingBusinessName'] || buyerLegalOrg?.TradingBusinessName)) {
      errors.push('Missing required field: Buyer Name');
    }
  }

  const settlement = asRecord(supplyChainTrade?.['ram:ApplicableHeaderTradeSettlement'] || supplyChainTrade?.ApplicableHeaderTradeSettlement);
  if (!getTextContent(settlement?.['ram:InvoiceCurrencyCode'] || settlement?.InvoiceCurrencyCode)) errors.push('Missing required field: Invoice Currency Code');
  
  const summation = asRecord(settlement?.['ram:SpecifiedTradeSettlementHeaderMonetarySummation'] || settlement?.SpecifiedTradeSettlementHeaderMonetarySummation);
  if (!summation) errors.push('Missing required field: Monetary Summation');
  else if (!getTextContent(summation['ram:GrandTotalAmount'] || summation.GrandTotalAmount)) errors.push('Missing required field: Grand Total Amount');
}

function validateUBLFields(parsed: Record<string, unknown>, errors: string[], _warnings: string[]): void {
  const invoice = asRecord(parsed['ubl:Invoice'] || parsed.Invoice);
  if (!invoice) { errors.push('Missing root element: Invoice'); return; }

  if (!getTextContent(invoice['cbc:ID'] || invoice.ID)) errors.push('Missing required field: Invoice ID');
  if (!getTextContent(invoice['cbc:IssueDate'] || invoice.IssueDate)) errors.push('Missing required field: Issue Date');
  if (!getTextContent(invoice['cbc:DocumentCurrencyCode'] || invoice.DocumentCurrencyCode)) errors.push('Missing required field: Document Currency Code');

  const supplier = asRecord(invoice['cac:AccountingSupplierParty'] || invoice.AccountingSupplierParty);
  if (!supplier) errors.push('Missing required field: Accounting Supplier Party');
  else {
    const party = asRecord(supplier['cac:Party'] || supplier.Party);
    const partyLegalEntity = asRecord(party?.['cac:PartyLegalEntity'] || party?.PartyLegalEntity);
    if (!getTextContent(party?.['cbc:Name'] || party?.Name || partyLegalEntity?.['cbc:RegistrationName'] || partyLegalEntity?.RegistrationName)) {
      errors.push('Missing required field: Supplier Name');
    }
  }

  const customer = asRecord(invoice['cac:AccountingCustomerParty'] || invoice.AccountingCustomerParty);
  if (!customer) errors.push('Missing required field: Accounting Customer Party');
  else {
    const party = asRecord(customer['cac:Party'] || customer.Party);
    const partyLegalEntity = asRecord(party?.['cac:PartyLegalEntity'] || party?.PartyLegalEntity);
    if (!getTextContent(party?.['cbc:Name'] || party?.Name || partyLegalEntity?.['cbc:RegistrationName'] || partyLegalEntity?.RegistrationName)) {
      errors.push('Missing required field: Customer Name');
    }
  }

  const legalTotal = asRecord(invoice['cac:LegalMonetaryTotal'] || invoice.LegalMonetaryTotal);
  if (!legalTotal) errors.push('Missing required field: Legal Monetary Total');
  else if (!getTextContent(legalTotal['cbc:PayableAmount'] || legalTotal.PayableAmount)) errors.push('Missing required field: Payable Amount');
}

async function validateAgainstSchema(xmlContent: string, flavor: InvoiceFlavor, version?: string, profile?: string): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!libxmljs) {
    warnings.push('libxmljs2 not available for schema validation');
    return { valid: true, errors, warnings };
  }

  try {
    const xmlDoc = libxmljs.parseXml(xmlContent);
    const schemaUrl = getSchemaUrl(flavor, version, profile);
    
    if (!schemaUrl) {
      warnings.push(`No schema URL found for ${flavor} ${version} ${profile}`);
      return { valid: true, errors, warnings };
    }

    const schemaContent = schemaCache.get(schemaUrl);
    if (!schemaContent) {
      warnings.push(`Schema not cached: ${schemaUrl}. Schema validation skipped.`);
      return { valid: true, errors, warnings };
    }

    const schemaDoc = libxmljs.parseXml(schemaContent);
    const isValid = xmlDoc.validate(schemaDoc);

    if (!isValid) {
      (xmlDoc.validationErrors || []).forEach(err => errors.push(`Schema validation: ${err.message} (line ${err.line})`));
    }
  } catch (error) {
    errors.push(`Schema validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

function getSchemaUrl(flavor: InvoiceFlavor, version?: string, profile?: string): string | undefined {
  if (flavor === 'XRechnung') return SCHEMA_URLS['xrechnung-cii'];
  if (flavor === 'ZUGFeRD') {
    const normalizedProfile = profile?.toLowerCase() || 'en16931';
    const key = `zugferd-${version || '2.3'}-${normalizedProfile}`;
    return SCHEMA_URLS[key] || SCHEMA_URLS['zugferd-2.3-en16931'];
  }
  return undefined;
}

function isCIIFormat(parsed: Record<string, unknown>): boolean {
  return !!(parsed['rsm:CrossIndustryInvoice'] || parsed.CrossIndustryInvoice);
}

function isUBLFormat(parsed: Record<string, unknown>): boolean {
  return !!(parsed['ubl:Invoice'] || parsed.Invoice);
}

export function preloadSchema(name: string, schemaContent: string): void {
  schemaCache.set(name, schemaContent);
}

export function getValidationInfo(xmlContent: string): { flavor: InvoiceFlavor; version?: string; profile?: string } {
  try {
    const parser = new XMLParser({ ignoreAttributes: false });
    const parsed = parser.parse(xmlContent);

    if (isCIIFormat(parsed)) {
      const cii = parsed['rsm:CrossIndustryInvoice'] || parsed.CrossIndustryInvoice;
      const context = cii?.['rsm:ExchangedDocumentContext'] || cii?.ExchangedDocumentContext;
      const guid = context?.['ram:GuidelineSpecifiedDocumentContextParameter']?.['ram:ID'] || context?.GuidelineSpecifiedDocumentContextParameter?.ID;
      return { flavor: 'ZUGFeRD', version: '2.3', profile: typeof guid === 'string' ? guid : guid?.['#text'] };
    }

    if (isUBLFormat(parsed)) {
      const invoice = parsed['ubl:Invoice'] || parsed.Invoice;
      const customizationId = invoice?.['cbc:CustomizationID'] || invoice?.CustomizationID;
      const idText = typeof customizationId === 'string' ? customizationId : customizationId?.['#text'];
      return { flavor: idText?.toLowerCase().includes('xrechnung') ? 'XRechnung' : 'ZUGFeRD', version: '2.1', profile: idText };
    }

    return { flavor: 'Unknown' };
  } catch {
    return { flavor: 'Unknown' };
  }
}

function getTextContent(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'object') {
    const rec = value as Record<string, unknown>;
    return (rec['#text'] as string) || (rec.text as string) || String(value);
  }
  return undefined;
}
