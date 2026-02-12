/**
 * OCR Service - Google Cloud Vision API Integration
 *
 * This module provides OCR (Optical Character Recognition) capabilities
 * using Google Cloud Vision API to extract text from PDFs and images.
 */

export type {
  IOcrService,
  OcrResult,
  OcrPage,
  TextBlock,
  BoundingBox,
  OcrOptions,
  OcrInvoiceLineItem,
  OcrInvoiceData,
} from './types';

export { OcrService, getOcrService } from './service';
export { MockOcrService } from './mock-service';
