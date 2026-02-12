/**
 * OCR Parser for Invoice Processing
 *
 * Integrates with Google Cloud Vision API to extract invoice data
 * from PDFs and images (PNG, JPG, TIFF).
 */

import type { Invoice } from '@/src/types';
import { getOcrService } from '@/src/server/services/ocr';
import { logger } from '@/src/lib/logging';
import { OcrError, OcrErrorCode } from '@/src/server/services/ocr/errors';

export interface OcrParseOptions {
  languageHints?: string[];
  confidenceThreshold?: number;
  timeoutMs?: number;
}

const DEFAULT_OPTIONS: OcrParseOptions = {
  languageHints: ['de', 'en'],
  confidenceThreshold: 0.95,
  timeoutMs: 60000,
};

/**
 * Parse invoice data from a file buffer using OCR
 *
 * @param fileBuffer - The file content as Buffer
 * @param mimeType - MIME type of the file (application/pdf, image/png, etc.)
 * @param options - Optional OCR configuration
 * @returns Partial invoice data extracted from the document
 */
export async function parseWithOcr(
  fileBuffer: Buffer,
  mimeType: string,
  options: OcrParseOptions = {}
): Promise<Partial<Invoice>> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  logger.info(
    { mimeType, size: fileBuffer.length },
    'Starting OCR invoice parsing'
  );

  try {
    // Process file with OCR
    const ocrService = getOcrService();
    const ocrResult = await ocrService.processFile(fileBuffer, mimeType, {
      languageHints: opts.languageHints,
      confidenceThreshold: opts.confidenceThreshold,
      timeoutMs: opts.timeoutMs,
    });

    // Log confidence score
    logger.info(
      { confidence: ocrResult.confidence, pages: ocrResult.pages.length },
      'OCR processing completed'
    );

    // Check if confidence meets threshold
    if (ocrResult.confidence < opts.confidenceThreshold!) {
      logger.warn(
        {
          confidence: ocrResult.confidence,
          threshold: opts.confidenceThreshold,
        },
        'OCR confidence below threshold - results may be inaccurate'
      );
    }

    // Parse invoice fields from OCR result
    const parsedFields = await ocrService.parseInvoice(ocrResult);

    // Map to Invoice type
    const invoice: Partial<Invoice> = {
      format: 'UNKNOWN',
      ...parsedFields,
    };

    if (!invoice.totals) {
      invoice.totals = { currency: 'EUR' };
    } else if (!invoice.totals.currency) {
      invoice.totals.currency = 'EUR';
    }

    logger.info(
      {
        invoiceNumber: invoice.number,
        confidence: ocrResult.confidence,
      },
      'Invoice parsing completed'
    );

    return invoice;
  } catch (error) {
    logger.error({ error }, 'OCR invoice parsing failed');

    if (error instanceof OcrError) {
      throw error;
    }

    throw new OcrError(
      OcrErrorCode.PROCESSING_FAILED,
      `Failed to parse invoice: ${error instanceof Error ? error.message : String(error)}`,
      { originalError: error }
    );
  }
}

/**
 * Check if a MIME type is supported for OCR processing
 */
export function isSupportedMimeType(mimeType: string): boolean {
  const supportedTypes = [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/tiff',
    'image/tif',
  ];

  return supportedTypes.includes(mimeType);
}

/**
 * Get supported MIME types for OCR processing
 */
export function getSupportedMimeTypes(): string[] {
  return [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/tiff',
    'image/tif',
  ];
}

/**
 * Validate file size for OCR processing
 */
export function validateFileSize(
  fileSizeBytes: number,
  maxSizeMB: number = 10
): boolean {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return fileSizeBytes <= maxSizeBytes;
}

// Re-export OCR service types
export { OcrError, OcrErrorCode } from '@/src/server/services/ocr/errors';
export type { OcrResult, OcrPage, OcrOptions } from '@/src/server/services/ocr';
