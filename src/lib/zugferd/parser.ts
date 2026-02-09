/**
 * Main parser entry point for ZUGFeRD/XRechnung invoices
 */

import { extractXMLFromPDF, isPDF, ZUGFeRDParserError } from './zugferd-parser';
import { parseCII, parseUBL, detectInvoiceFlavor, XRechnungParserError } from './xrechnung-parser';
import { validateXML } from './validator';
import { mapToInvoiceModel, mapToExtendedInvoiceData, MapperError } from './mapper';
import { ParsedInvoiceResult, ValidationResult, ZUGFeRDInvoice, InvoiceFlavor, InvoiceDetectionResult } from './types';
import { Invoice } from '@/src/types/invoice';

export { ZUGFeRDParserError, XRechnungParserError, MapperError };
export type { ParsedInvoiceResult, ValidationResult, ZUGFeRDInvoice, InvoiceFlavor, InvoiceDetectionResult } from './types';
export type { ExtendedInvoiceData } from './mapper';
export { mapToExtendedInvoiceData } from './mapper';

export interface InvoiceParseResult {
  success: boolean;
  invoice?: Invoice;
  extendedData?: ReturnType<typeof mapToExtendedInvoiceData>;
  rawData?: ZUGFeRDInvoice;
  validation: ValidationResult;
  detection: InvoiceDetectionResult;
  errors: string[];
  warnings: string[];
}

export async function parseInvoiceFromPDF(pdfBuffer: Buffer | ArrayBuffer | Uint8Array): Promise<InvoiceParseResult> {
  try {
    if (!isPDF(pdfBuffer)) return { success: false, validation: { valid: false, errors: ['Invalid PDF file'], warnings: [] }, detection: { flavor: 'Unknown' }, errors: ['Invalid PDF file'], warnings: [] };
    const xmlContent = await extractXMLFromPDF(pdfBuffer);
    return parseInvoiceFromXML(xmlContent);
  } catch (error) {
    const errorMsg = error instanceof ZUGFeRDParserError ? error.message : 'Unknown error';
    return { success: false, validation: { valid: false, errors: [errorMsg], warnings: [] }, detection: { flavor: 'ZUGFeRD' }, errors: [errorMsg], warnings: [] };
  }
}

export async function parseInvoiceFromXML(xmlContent: string): Promise<InvoiceParseResult> {
  const errors: string[] = [], warnings: string[] = [];
  try {
    const detection = detectInvoiceFlavor(xmlContent);
    let parseResult: ParsedInvoiceResult;
    if (detection.flavor === 'Unknown') {
      parseResult = parseCII(xmlContent);
      if (!parseResult.success) { const ublResult = parseUBL(xmlContent); if (ublResult.success) { parseResult = ublResult; detection.flavor = 'ZUGFeRD'; } }
      else detection.flavor = 'ZUGFeRD';
    } else if (detection.flavor === 'XRechnung') { parseResult = parseCII(xmlContent); if (!parseResult.success) parseResult = parseUBL(xmlContent); }
    else parseResult = parseCII(xmlContent);

    if (!parseResult.success || !parseResult.invoice) return { success: false, validation: { valid: false, errors: parseResult.errors, warnings: parseResult.warnings }, detection, errors: [...errors, ...parseResult.errors], warnings: [...warnings, ...parseResult.warnings] };

    const validation = await validateXML(xmlContent, detection.flavor, detection.version, detection.profile);
    let invoice: Invoice | undefined, extendedData: ReturnType<typeof mapToExtendedInvoiceData> | undefined;
    try { invoice = mapToInvoiceModel(parseResult.invoice); extendedData = mapToExtendedInvoiceData(parseResult.invoice); } catch (error) { errors.push(`Mapping error: ${error instanceof Error ? error.message : 'Unknown'}`); }

    errors.push(...parseResult.errors, ...validation.errors);
    warnings.push(...parseResult.warnings, ...validation.warnings);
    return { success: errors.length === 0 && !!invoice, invoice, extendedData, rawData: parseResult.invoice, validation, detection, errors, warnings };
  } catch (error) {
    return { success: false, validation: { valid: false, errors: [String(error)], warnings: [] }, detection: { flavor: 'Unknown' }, errors: [String(error)], warnings };
  }
}

export async function parseInvoice(buffer: Buffer | ArrayBuffer | Uint8Array, mimeType?: string): Promise<InvoiceParseResult> {
  if (isPDF(buffer) || mimeType === 'application/pdf') return parseInvoiceFromPDF(buffer);
  let xmlContent: string;
  if (Buffer.isBuffer(buffer)) xmlContent = buffer.toString('utf-8');
  else if (buffer instanceof ArrayBuffer) xmlContent = new TextDecoder('utf-8').decode(buffer);
  else xmlContent = new TextDecoder('utf-8').decode(buffer);
  return parseInvoiceFromXML(xmlContent);
}

export async function isValidEInvoice(buffer: Buffer | ArrayBuffer | Uint8Array): Promise<{ valid: boolean; flavor?: InvoiceFlavor; error?: string }> {
  try {
    const result = await parseInvoice(buffer);
    return { valid: result.success, flavor: result.detection.flavor, error: result.errors[0] };
  } catch (error) { return { valid: false, error: String(error) }; }
}

export async function parseInvoicesBatch(items: Array<{ buffer: Buffer | ArrayBuffer | Uint8Array; filename?: string }>): Promise<Array<InvoiceParseResult & { filename?: string }>> {
  return Promise.all(items.map(async item => ({ ...(await parseInvoice(item.buffer)), filename: item.filename })));
}
