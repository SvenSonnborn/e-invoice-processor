/**
 * OCR Service - Google Cloud Vision API Integration
 *
 * This module provides OCR (Optical Character Recognition) capabilities
 * using Google Cloud Vision API to extract text from PDFs and images.
 */

import { type Invoice } from '@/src/types';
import { logger } from '@/src/lib/logging';
import { VisionClient } from './vision-client';
import { TextExtractor } from './text-extractor';
import { OcrError, OcrErrorCode } from './errors';

export interface OcrResult {
  text: string;
  confidence: number;
  pages: OcrPage[];
  metadata: {
    processedAt: Date;
    fileType: string;
    fileSize: number;
    pageCount: number;
  };
}

export interface OcrPage {
  pageNumber: number;
  text: string;
  confidence: number;
  blocks: TextBlock[];
}

export interface TextBlock {
  text: string;
  confidence: number;
  boundingBox: BoundingBox;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OcrOptions {
  languageHints?: string[];
  confidenceThreshold?: number;
  timeoutMs?: number;
}

export interface OcrInvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export type OcrInvoiceData = Partial<Invoice> & {
  lineItems?: OcrInvoiceLineItem[];
};

const DEFAULT_OPTIONS: OcrOptions = {
  languageHints: ['de', 'en'],
  confidenceThreshold: 0.95,
  timeoutMs: 60000,
};

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

export class OcrService {
  private visionClient: VisionClient;
  private textExtractor: TextExtractor;

  constructor(apiKey?: string, projectId?: string) {
    this.visionClient = new VisionClient(apiKey, projectId);
    this.textExtractor = new TextExtractor();
  }

  /**
   * Process a file and extract text using OCR
   */
  async processFile(
    fileBuffer: Buffer,
    mimeType: string,
    options: OcrOptions = {}
  ): Promise<OcrResult> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    logger.info(
      { mimeType, fileSize: fileBuffer.length },
      'Starting OCR processing'
    );

    // Validate file
    this.validateFile(fileBuffer, mimeType);

    try {
      let result: OcrResult;

      if (mimeType === 'application/pdf') {
        result = await this.processPdf(fileBuffer, opts);
      } else {
        result = await this.processImage(fileBuffer, mimeType, opts);
      }

      // Filter by confidence threshold
      if (result.confidence < opts.confidenceThreshold!) {
        logger.warn(
          {
            confidence: result.confidence,
            threshold: opts.confidenceThreshold,
          },
          'OCR confidence below threshold'
        );
      }

      logger.info(
        { confidence: result.confidence, pageCount: result.pages.length },
        'OCR processing completed'
      );

      return result;
    } catch (error) {
      logger.error({ error }, 'OCR processing failed');
      throw this.handleError(error);
    }
  }

  /**
   * Process PDF files using batch document processing
   */
  private async processPdf(
    fileBuffer: Buffer,
    options: OcrOptions
  ): Promise<OcrResult> {
    logger.debug('Processing PDF file');

    const responses = await this.visionClient.batchAnnotateFiles(
      fileBuffer,
      'application/pdf',
      options
    );

    return this.textExtractor.extractFromBatchResponse(
      responses,
      fileBuffer.length
    );
  }

  /**
   * Process image files (PNG, JPG, TIFF)
   */
  private async processImage(
    fileBuffer: Buffer,
    mimeType: string,
    options: OcrOptions
  ): Promise<OcrResult> {
    logger.debug({ mimeType }, 'Processing image file');

    const response = await this.visionClient.annotateImage(
      fileBuffer,
      mimeType,
      options
    );

    return this.textExtractor.extractFromResponse(
      response,
      mimeType,
      fileBuffer.length
    );
  }

  /**
   * Parse invoice data from OCR result
   */
  async parseInvoice(ocrResult: OcrResult): Promise<OcrInvoiceData> {
    logger.debug('Parsing invoice from OCR result');
    return this.textExtractor.parseInvoiceFields(ocrResult);
  }

  /**
   * Validate file before processing
   */
  private validateFile(fileBuffer: Buffer, mimeType: string): void {
    // Check file size
    if (fileBuffer.length > MAX_FILE_SIZE_BYTES) {
      throw new OcrError(
        OcrErrorCode.FILE_TOO_LARGE,
        `File size exceeds maximum of ${MAX_FILE_SIZE_MB}MB`,
        { fileSize: fileBuffer.length, maxSize: MAX_FILE_SIZE_BYTES }
      );
    }

    // Check MIME type
    if (!SUPPORTED_MIME_TYPES.includes(mimeType)) {
      throw new OcrError(
        OcrErrorCode.UNSUPPORTED_FILE_TYPE,
        `Unsupported file type: ${mimeType}. Supported types: ${SUPPORTED_MIME_TYPES.join(', ')}`,
        { mimeType, supportedTypes: SUPPORTED_MIME_TYPES }
      );
    }

    logger.debug(
      { mimeType, size: fileBuffer.length },
      'File validation passed'
    );
  }

  /**
   * Handle and normalize errors
   */
  private handleError(error: unknown): OcrError {
    if (error instanceof OcrError) {
      return error;
    }

    if (error instanceof Error) {
      // Check for specific Google API errors
      if (error.message.includes('PERMISSION_DENIED')) {
        return new OcrError(
          OcrErrorCode.API_PERMISSION_DENIED,
          'API permission denied. Check your credentials.',
          { originalError: error.message }
        );
      }

      if (error.message.includes('QUOTA_EXCEEDED')) {
        return new OcrError(
          OcrErrorCode.API_QUOTA_EXCEEDED,
          'API quota exceeded. Please try again later.',
          { originalError: error.message }
        );
      }

      if (
        error.message.includes('timeout') ||
        error.message.includes('ETIMEDOUT')
      ) {
        return new OcrError(
          OcrErrorCode.TIMEOUT,
          'OCR processing timed out. Please try again.',
          { originalError: error.message }
        );
      }

      return new OcrError(OcrErrorCode.PROCESSING_FAILED, error.message, {
        originalError: error.message,
      });
    }

    return new OcrError(
      OcrErrorCode.UNKNOWN_ERROR,
      'An unknown error occurred during OCR processing',
      { error }
    );
  }
}

// Lazy singleton - only instantiated on first access, not at build time
let _ocrService: OcrService | null = null;

export function getOcrService(): OcrService {
  if (!_ocrService) {
    _ocrService = new OcrService(
      process.env.GOOGLE_CLOUD_VISION_API_KEY,
      process.env.GOOGLE_CLOUD_PROJECT_ID
    );
  }
  return _ocrService;
}
