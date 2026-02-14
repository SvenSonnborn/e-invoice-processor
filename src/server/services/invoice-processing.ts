/**
 * Invoice Processing Service
 *
 * Orchestrates the OCR processing pipeline for uploaded invoices.
 * Downloads the file from storage, runs OCR, parses invoice data,
 * and saves structured results to the database.
 *
 * Status flow: UPLOADED → PARSED → VALIDATED (or → FAILED on error)
 */

import { prisma } from '@/src/lib/db/client';
import { isPrismaUniqueConstraintError } from '@/src/lib/db/prisma-errors';
import { replaceLineItems } from '@/src/lib/invoices/line-items';
import { logger } from '@/src/lib/logging';
import { storage } from '@/src/lib/storage';
import { getOcrService } from '@/src/server/services/ocr/service';
import {
  markAsParsed,
  markAsValidated,
  markAsFailed,
} from '@/src/lib/invoices/processor';
import { parseOcrInvoiceData } from '@/src/server/parsers/invoice';

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export enum InvoiceProcessingErrorCode {
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  STORAGE_DOWNLOAD_FAILED = 'STORAGE_DOWNLOAD_FAILED',
  OCR_FAILED = 'OCR_FAILED',
  PARSE_FAILED = 'PARSE_FAILED',
  DB_UPDATE_FAILED = 'DB_UPDATE_FAILED',
}

export class InvoiceProcessingError extends Error {
  public readonly code: InvoiceProcessingErrorCode;
  public readonly details: Record<string, unknown>;

  constructor(
    code: InvoiceProcessingErrorCode,
    message: string,
    details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'InvoiceProcessingError';
    this.code = code;
    this.details = details;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, InvoiceProcessingError);
    }
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProcessInvoiceParams {
  fileId: string;
  invoiceId: string;
  storageKey: string;
  contentType: string;
  sourceFileName?: string;
}

export interface ProcessInvoiceResult {
  invoiceId: string;
  status: string;
  confidence: number;
  pageCount: number;
}

function toDbUpdateProcessingError(
  error: unknown,
  context: {
    fileId: string;
    invoiceId: string;
    invoiceNumber?: string;
  }
): InvoiceProcessingError {
  if (
    isPrismaUniqueConstraintError(error, ['organizationId', 'number']) ||
    isPrismaUniqueConstraintError(error, ['Invoice_organizationId_number_key'])
  ) {
    return new InvoiceProcessingError(
      InvoiceProcessingErrorCode.DB_UPDATE_FAILED,
      `Duplicate invoice number "${context.invoiceNumber ?? 'unknown'}" in this organization`,
      {
        ...context,
        conflictField: 'number',
      }
    );
  }

  return new InvoiceProcessingError(
    InvoiceProcessingErrorCode.DB_UPDATE_FAILED,
    `Failed to persist processed invoice ${context.invoiceId}`,
    {
      ...context,
      originalError:
        error instanceof Error ? error.message : 'Unknown database error',
    }
  );
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Run the full OCR processing pipeline for an uploaded invoice.
 *
 * 1. Download file from storage
 * 2. Run OCR text extraction
 * 3. Parse structured invoice data
 * 4. Save to DB (PARSED → VALIDATED)
 * 5. Create line items
 *
 * On failure the invoice is marked as FAILED.
 */
export async function processInvoiceOcr(
  params: ProcessInvoiceParams
): Promise<ProcessInvoiceResult> {
  const { fileId, invoiceId, storageKey, contentType, sourceFileName } = params;

  logger.info({ fileId, invoiceId }, 'Starting invoice OCR processing');

  try {
    // 1. Download file from storage
    let fileBuffer: Buffer;
    try {
      fileBuffer = await storage.download(storageKey);
    } catch (error) {
      throw new InvoiceProcessingError(
        InvoiceProcessingErrorCode.STORAGE_DOWNLOAD_FAILED,
        `Failed to download file from storage: ${storageKey}`,
        { fileId, storageKey, originalError: (error as Error).message }
      );
    }

    // 2. Run OCR
    const ocrService = await getOcrService();
    let ocrResult;
    try {
      ocrResult = await ocrService.processFile(fileBuffer, contentType, {
        sourceFileName,
      });
    } catch (error) {
      throw new InvoiceProcessingError(
        InvoiceProcessingErrorCode.OCR_FAILED,
        `OCR processing failed for file ${fileId}`,
        { fileId, contentType, originalError: (error as Error).message }
      );
    }

    // 3. Parse invoice data from OCR result
    let invoiceData;
    try {
      invoiceData = await ocrService.parseInvoice(ocrResult);
    } catch (error) {
      throw new InvoiceProcessingError(
        InvoiceProcessingErrorCode.PARSE_FAILED,
        `Invoice parsing failed for file ${fileId}`,
        { fileId, originalError: (error as Error).message }
      );
    }

    // 4. Build raw JSON for revision storage (serialize to plain JSON)
    const rawJson = JSON.parse(
      JSON.stringify({
        ocrResult: {
          text: ocrResult.text,
          confidence: ocrResult.confidence,
          pages: ocrResult.pages,
          metadata: ocrResult.metadata,
        },
        invoiceData,
      })
    );

    // 5. Mark as PARSED (creates revision with raw data)
    await markAsParsed(invoiceId, rawJson);

    // 6. Validate and normalize invoice data
    const parseResult = parseOcrInvoiceData(invoiceData);

    if (!parseResult.success) {
      throw new InvoiceProcessingError(
        InvoiceProcessingErrorCode.PARSE_FAILED,
        `Invoice data validation failed: ${parseResult.errors.map((e) => e.message).join('; ')}`,
        { fileId, invoiceId, validationErrors: parseResult.errors }
      );
    }

    // 7. Persist structured fields and related processing state.
    //    This path is also used for re-processing: existing line items are replaced.
    try {
      await markAsValidated(invoiceId, parseResult.invoiceFields);

      await prisma.file.update({
        where: { id: fileId },
        data: { status: 'PROCESSED', errorMessage: null },
      });

      await replaceLineItems(
        invoiceId,
        parseResult.lineItems.map((item) => ({
          ...item,
          taxRate: null,
          netAmount: null,
          taxAmount: null,
        }))
      );

      if (parseResult.format !== 'UNKNOWN') {
        await prisma.invoice.update({
          where: { id: invoiceId },
          data: { format: parseResult.format },
        });
      }
    } catch (error) {
      throw toDbUpdateProcessingError(error, {
        fileId,
        invoiceId,
        invoiceNumber: parseResult.invoiceFields.number,
      });
    }

    logger.info(
      {
        fileId,
        invoiceId,
        confidence: ocrResult.confidence,
        pageCount: ocrResult.pages.length,
      },
      'Invoice OCR processing completed successfully'
    );

    return {
      invoiceId,
      status: 'VALIDATED',
      confidence: ocrResult.confidence,
      pageCount: ocrResult.pages.length,
    };
  } catch (error) {
    const processingError =
      error instanceof InvoiceProcessingError
        ? error
        : new InvoiceProcessingError(
            InvoiceProcessingErrorCode.OCR_FAILED,
            (error as Error).message,
            { fileId, invoiceId }
          );

    // Mark invoice and file as FAILED
    try {
      await markAsFailed(invoiceId, processingError.message);
      await prisma.file.update({
        where: { id: fileId },
        data: { status: 'FAILED', errorMessage: processingError.message },
      });
    } catch (failError) {
      logger.error(
        { failError: (failError as Error).message, fileId, invoiceId },
        'Failed to mark invoice as FAILED after processing error'
      );
    }

    logger.error(
      {
        code: processingError.code,
        details: processingError.details,
        fileId,
        invoiceId,
      },
      `Invoice processing failed: ${processingError.message}`
    );

    throw processingError;
  }
}
