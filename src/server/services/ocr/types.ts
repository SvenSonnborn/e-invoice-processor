/**
 * OCR Service Type Definitions
 *
 * Shared types for the OCR service module.
 */

import { type Invoice } from '@/src/types';

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

export interface IOcrService {
  processFile(
    fileBuffer: Buffer,
    mimeType: string,
    options?: OcrOptions
  ): Promise<OcrResult>;
  parseInvoice(ocrResult: OcrResult): Promise<OcrInvoiceData>;
}
