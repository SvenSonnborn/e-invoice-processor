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
  const _errors: string[] = [];
  const warnings: string[] = [];

  try {
    if (!isPDF(pdfBuffer)) {
      return { success: false, validation: { valid: false, errors: ['Invalid PDF file'], warnings: [] }, detection: { flavor: 'Unknown' }, errors: ['Invalid PDF file: File does not have PDF header'], warnings };
    }

    let xmlContent: string;
    try {
      xmlContent = await extractXMLFromPDF(pdfBuffer);
    } catch (error) {
      const errorMsg = error instanceof ZUGFeRDParserError ? error.message : 'Unknown error';
      return { success: false, validation: { valid: false, errors: [`XML extraction failed: ${errorMsg}`], warnings: [] }, detection: { flavor: 'ZUGFeRD' }, errors: [`Failed to extract XML from PDF: ${errorMsg}`], warnings };
    }

    return parseInvoiceFromXML(xmlContent);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, validation: { valid: false, errors: [errorMsg], warnings: [] }, detection: { flavor: 'Unknown' }, errors: [`PDF parsing failed: ${errorMsg}`], warnings };
  }
}

export async function parseInvoiceFromXML(xmlContent: string): Promise<InvoiceParseResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const detection = detectInvoiceFlavor(xmlContent);
    let parseResult: ParsedInvoiceResult;

    if (detection.flavor === 'Unknown') {
      parseResult = parseCII(xmlContent);
      if (!parseResult.success) {
        const ublResult = parseUBL(xmlContent);
        if (ublResult.success) { parseResult = ublResult; detection.flavor = 'ZUGFeRD'; }
      } else { detection.flavor = 'ZUGFeRD'; }
    } else if (detection.flavor === 'XRechnung') {
      parseResult = parseCII(xmlContent);
      if (!parseResult.success) parseResult = parseUBL(xmlContent);
    } else {
      parseResult = parseCII(xmlContent);
    }

    if (!parseResult.success || !parseResult.invoice) {
      return { success: false, validation: { valid: false, errors: parseResult.errors, warnings: parseResult.warnings }, detection, errors: [...errors, ...parseResult.errors], warnings: [...warnings, ...parseResult.warnings] };
    }

    const validation = await validateXML(xmlContent, detection.flavor, detection.version, detection.profile);

    let invoice: Invoice | undefined;
    let extendedData: ReturnType<typeof mapToExtendedInvoiceData> | undefined;

    try {
      invoice = mapToInvoiceModel(parseResult.invoice);
      extendedData = mapToExtendedInvoiceData(parseResult.invoice);
    } catch (error) {
      const errorMsg = error instanceof MapperError ? error.message : 'Mapping failed';
      errors.push(`Mapping error: ${errorMsg}`);
    }

    errors.push(...parseResult.errors, ...validation.errors);
    warnings.push(...parseResult.warnings, ...validation.warnings);

    return { success: errors.length === 0 && !!invoice, invoice, extendedData, rawData: parseResult.invoice, validation, detection, errors, warnings };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, validation: { valid: false, errors: [errorMsg], warnings: [] }, detection: { flavor: 'Unknown' }, errors: [`XML parsing failed: ${errorMsg}`], warnings };
  }
}

export async function parseInvoice(buffer: Buffer | ArrayBuffer | Uint8Array, mimeType?: string): Promise<InvoiceParseResult> {
  const isPdfFile = isPDF(buffer);
  if (isPdfFile || mimeType === 'application/pdf') return parseInvoiceFromPDF(buffer);

  let xmlContent: string;
  if (Buffer.isBuffer(buffer)) xmlContent = buffer.toString('utf-8');
  else if (buffer instanceof ArrayBuffer) xmlContent = new TextDecoder('utf-8').decode(buffer);
  else if (buffer instanceof Uint8Array) xmlContent = new TextDecoder('utf-8').decode(buffer);
  else return { success: false, validation: { valid: false, errors: ['Invalid buffer type'], warnings: [] }, detection: { flavor: 'Unknown' }, errors: ['Invalid buffer type provided'], warnings: [] };

  return parseInvoiceFromXML(xmlContent);
}

export async function isValidEInvoice(buffer: Buffer | ArrayBuffer | Uint8Array): Promise<{ valid: boolean; flavor?: InvoiceFlavor; error?: string }> {
  try {
    const result = await parseInvoice(buffer);
    return { valid: result.success, flavor: result.detection.flavor, error: result.errors.length > 0 ? result.errors[0] : undefined };
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

const DEFAULT_BATCH_CONCURRENCY = 5;

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  const executing: Promise<void>[] = [];

  for (const item of items) {
    const p = fn(item).then((result) => {
      results.push(result);
    });
    executing.push(p);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
      executing.splice(0, executing.findIndex((e) => e === p) + 1);
    }
  }

  await Promise.all(executing);
  return results;
}

export async function parseInvoicesBatch(
  items: Array<{ buffer: Buffer | ArrayBuffer | Uint8Array; filename?: string }>,
  options?: { concurrency?: number }
): Promise<Array<InvoiceParseResult & { filename?: string }>> {
  const concurrency = Math.max(1, options?.concurrency ?? DEFAULT_BATCH_CONCURRENCY);
  return runWithConcurrency(items, concurrency, async (item) => ({
    ...(await parseInvoice(item.buffer)),
    filename: item.filename,
  }));
}
