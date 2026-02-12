/**
 * Mock OCR Service
 *
 * Drop-in replacement for OcrService that loads pre-defined JSON responses
 * instead of calling Google Cloud Vision API. Use for local development
 * without incurring API costs.
 *
 * Enable via environment variable: OCR_MOCK_ENABLED=true
 */

import { readFileSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import { logger } from '@/src/lib/logging';
import { OcrError, OcrErrorCode } from './errors';
import type {
  IOcrService,
  OcrResult,
  OcrOptions,
  OcrInvoiceData,
  OcrInvoiceLineItem,
} from './types';

interface MockResponseFile {
  ocrResult: {
    text: string;
    confidence: number;
    pages: Array<{
      pageNumber: number;
      text: string;
      confidence: number;
      blocks: Array<{
        text: string;
        confidence: number;
        boundingBox: { x: number; y: number; width: number; height: number };
      }>;
    }>;
    metadata: {
      fileType: string;
      fileSize: number;
      pageCount: number;
    };
  };
  invoiceData: {
    format?: string;
    number?: string;
    supplier?: { name?: string };
    customer?: { name?: string };
    issueDate?: string;
    dueDate?: string;
    totals?: {
      currency: string;
      netAmount?: string;
      taxAmount?: string;
      grossAmount?: string;
    };
    lineItems?: OcrInvoiceLineItem[];
  };
}

const SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/tiff',
  'image/tif',
];

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export class MockOcrService implements IOcrService {
  private responses: MockResponseFile[] = [];
  private currentIndex = 0;

  constructor(mockDir?: string) {
    const dir =
      mockDir || resolve(process.cwd(), 'mocks', 'ocr-responses');
    this.loadResponses(dir);
  }

  async processFile(
    fileBuffer: Buffer,
    mimeType: string,
    options: OcrOptions = {}
  ): Promise<OcrResult> {
    logger.info(
      { mimeType, fileSize: fileBuffer.length, mock: true },
      'Mock OCR: Starting processing'
    );

    this.validateFile(fileBuffer, mimeType);

    const response = this.getNextResponse();
    const threshold = options.confidenceThreshold ?? 0.95;

    if (response.ocrResult.confidence < threshold) {
      logger.warn(
        {
          confidence: response.ocrResult.confidence,
          threshold,
          mock: true,
        },
        'Mock OCR: Confidence below threshold'
      );
    }

    const result: OcrResult = {
      text: response.ocrResult.text,
      confidence: response.ocrResult.confidence,
      pages: response.ocrResult.pages,
      metadata: {
        processedAt: new Date(),
        fileType: mimeType,
        fileSize: fileBuffer.length,
        pageCount: response.ocrResult.pages.length,
      },
    };

    logger.info(
      {
        confidence: result.confidence,
        pageCount: result.pages.length,
        mock: true,
      },
      'Mock OCR: Processing completed'
    );

    return result;
  }

  async parseInvoice(ocrResult: OcrResult): Promise<OcrInvoiceData> {
    logger.debug({ mock: true }, 'Mock OCR: Parsing invoice from OCR result');

    // Find the response that matches this OcrResult by text content
    const matchedResponse = this.responses.find(
      (r) => r.ocrResult.text === ocrResult.text
    );

    if (matchedResponse) {
      return this.toOcrInvoiceData(matchedResponse.invoiceData);
    }

    // Fallback: return the last served response's invoice data
    const fallback = this.responses[Math.max(0, this.currentIndex - 1)];
    if (fallback) {
      return this.toOcrInvoiceData(fallback.invoiceData);
    }

    return {};
  }

  private toOcrInvoiceData(
    data: MockResponseFile['invoiceData']
  ): OcrInvoiceData {
    return {
      format: (data.format as OcrInvoiceData['format']) ?? 'UNKNOWN',
      number: data.number,
      supplier: data.supplier,
      customer: data.customer,
      issueDate: data.issueDate,
      dueDate: data.dueDate,
      totals: data.totals,
      lineItems: data.lineItems,
    };
  }

  private validateFile(fileBuffer: Buffer, mimeType: string): void {
    if (fileBuffer.length > MAX_FILE_SIZE_BYTES) {
      throw new OcrError(
        OcrErrorCode.FILE_TOO_LARGE,
        `File size exceeds maximum of ${MAX_FILE_SIZE_MB}MB`,
        { fileSize: fileBuffer.length, maxSize: MAX_FILE_SIZE_BYTES }
      );
    }

    if (!SUPPORTED_MIME_TYPES.includes(mimeType)) {
      throw new OcrError(
        OcrErrorCode.UNSUPPORTED_FILE_TYPE,
        `Unsupported file type: ${mimeType}. Supported types: ${SUPPORTED_MIME_TYPES.join(', ')}`,
        { mimeType, supportedTypes: SUPPORTED_MIME_TYPES }
      );
    }
  }

  private loadResponses(dir: string): void {
    try {
      const files = readdirSync(dir).filter((f) => f.endsWith('.json'));

      if (files.length === 0) {
        logger.warn(
          { dir },
          'Mock OCR: No JSON response files found in mock directory'
        );
        this.responses = [this.getDefaultResponse()];
        return;
      }

      for (const file of files.sort()) {
        const filePath = join(dir, file);
        const content = readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(content) as MockResponseFile;
        this.responses.push(parsed);
        logger.debug({ file }, 'Mock OCR: Loaded response fixture');
      }

      logger.info(
        { count: this.responses.length },
        'Mock OCR: Loaded response fixtures'
      );
    } catch (error) {
      logger.warn(
        { error, dir },
        'Mock OCR: Failed to load fixtures, using default response'
      );
      this.responses = [this.getDefaultResponse()];
    }
  }

  private getNextResponse(): MockResponseFile {
    const response = this.responses[this.currentIndex % this.responses.length];
    this.currentIndex++;
    return response;
  }

  private getDefaultResponse(): MockResponseFile {
    return {
      ocrResult: {
        text: 'Mock Invoice GmbH\n\nRechnungsnummer: MOCK-001\nDatum: 01.01.2024\n\nGesamtbetrag: EUR 100,00',
        confidence: 0.95,
        pages: [
          {
            pageNumber: 1,
            text: 'Mock Invoice GmbH\n\nRechnungsnummer: MOCK-001\nDatum: 01.01.2024\n\nGesamtbetrag: EUR 100,00',
            confidence: 0.95,
            blocks: [
              {
                text: 'Mock Invoice GmbH',
                confidence: 0.95,
                boundingBox: { x: 0, y: 0, width: 200, height: 30 },
              },
            ],
          },
        ],
        metadata: {
          fileType: 'application/pdf',
          fileSize: 50000,
          pageCount: 1,
        },
      },
      invoiceData: {
        format: 'UNKNOWN',
        number: 'MOCK-001',
        supplier: { name: 'Mock Invoice GmbH' },
        issueDate: '2024-01-01',
        totals: {
          currency: 'EUR',
          grossAmount: '100.00',
        },
        lineItems: [
          {
            description: 'Mock-Dienstleistung',
            quantity: 1,
            unitPrice: 100.0,
            total: 100.0,
          },
        ],
      },
    };
  }
}
