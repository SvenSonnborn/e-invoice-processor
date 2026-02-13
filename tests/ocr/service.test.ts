/**
 * OCR Service Tests
 *
 * Unit tests for the OCR service implementation.
 */

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

// Mock logger to suppress output during tests
mock.module('@/src/lib/logging', () => ({
  logger: {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
  },
}));

// Import from specific sub-modules (not the barrel) to avoid mock
// contamination from route.test.ts which mocks '@/src/server/services/ocr'.
import { OcrError, OcrErrorCode } from '@/src/server/services/ocr/errors';
import { OcrService } from '@/src/server/services/ocr/service';
import type { OcrResult } from '@/src/server/services/ocr/types';

const buildJsonResponse = (payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

const buildImageResponse = () =>
  buildJsonResponse({
    responses: [
      {
        fullTextAnnotation: {
          text: 'Rechnungsnummer: INV-001\nDatum: 15.01.2024\nBetrag: 100,00 EUR',
          pages: [
            {
              blocks: [
                {
                  paragraphs: [
                    {
                      words: [
                        {
                          symbols: [{ text: 'R', confidence: 0.99 }],
                        },
                      ],
                    },
                  ],
                },
              ],
              confidence: 0.98,
            },
          ],
        },
      },
    ],
  });

const originalFetch = global.fetch;

const setFetchResponse = (payload: unknown) => {
  global.fetch = (async () =>
    buildJsonResponse(payload)) as unknown as typeof fetch;
};

describe('OcrService', () => {
  let service: OcrService;

  beforeEach(() => {
    service = new OcrService('test-api-key', 'test-project');
    global.fetch = (async () =>
      buildImageResponse()) as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('processFile', () => {
    it('should process PNG image successfully', async () => {
      const buffer = Buffer.from('fake-image-data');
      const result = await service.processFile(buffer, 'image/png');

      expect(result).toBeDefined();
      expect(result.text).toContain('Rechnungsnummer');
      expect(result.metadata.fileType).toBe('image/png');
    });

    it('should process JPEG image successfully', async () => {
      const buffer = Buffer.from('fake-image-data');
      const result = await service.processFile(buffer, 'image/jpeg');

      expect(result).toBeDefined();
      expect(result.metadata.fileType).toBe('image/jpeg');
    });

    it('should reject unsupported file types', async () => {
      const buffer = Buffer.from('fake-data');

      await expect(
        service.processFile(buffer, 'text/plain')
      ).rejects.toBeInstanceOf(
        OcrError as unknown as new (...args: unknown[]) => unknown
      );
    });

    it('should reject files that are too large', async () => {
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB

      await expect(
        service.processFile(largeBuffer, 'image/png')
      ).rejects.toBeInstanceOf(
        OcrError as unknown as new (...args: unknown[]) => unknown
      );
    });

    it('should handle PDF files', async () => {
      setFetchResponse({
        responses: [
          {
            responses: [
              {
                fullTextAnnotation: {
                  text: 'PDF Content',
                  pages: [
                    {
                      blocks: [],
                      confidence: 0.96,
                    },
                  ],
                },
              },
            ],
          },
        ],
      });

      const buffer = Buffer.from('fake-pdf-data');
      const result = await service.processFile(buffer, 'application/pdf');

      expect(result).toBeDefined();
      expect(result.metadata.fileType).toBe('application/pdf');
    });
  });

  describe('parseInvoice', () => {
    it('should extract invoice number from OCR result', async () => {
      const ocrResult: OcrResult = {
        text: 'Rechnungsnummer: INV-2024-001\nDatum: 15.01.2024',
        confidence: 0.98,
        pages: [
          {
            pageNumber: 1,
            text: 'Rechnungsnummer: INV-2024-001',
            confidence: 0.98,
            blocks: [],
          },
        ],
        metadata: {
          processedAt: new Date(),
          fileType: 'image/png',
          fileSize: 1024,
          pageCount: 1,
        },
      };

      const invoice = await service.parseInvoice(ocrResult);

      expect(invoice.number).toBe('INV-2024-001');
    });

    it('should extract dates from OCR result', async () => {
      const ocrResult: OcrResult = {
        text: 'Rechnungsdatum: 15.01.2024\nZahlbar bis: 14.02.2024',
        confidence: 0.98,
        pages: [
          {
            pageNumber: 1,
            text: 'Rechnungsdatum: 15.01.2024',
            confidence: 0.98,
            blocks: [],
          },
        ],
        metadata: {
          processedAt: new Date(),
          fileType: 'image/png',
          fileSize: 1024,
          pageCount: 1,
        },
      };

      const invoice = await service.parseInvoice(ocrResult);

      expect(invoice.issueDate).toBeDefined();
      expect(invoice.dueDate).toBeDefined();
    });

    it('should extract amount from OCR result', async () => {
      const ocrResult: OcrResult = {
        text: 'Gesamtbetrag: 1.234,56 EUR',
        confidence: 0.98,
        pages: [
          {
            pageNumber: 1,
            text: 'Gesamtbetrag: 1.234,56 EUR',
            confidence: 0.98,
            blocks: [],
          },
        ],
        metadata: {
          processedAt: new Date(),
          fileType: 'image/png',
          fileSize: 1024,
          pageCount: 1,
        },
      };

      const invoice = await service.parseInvoice(ocrResult);

      expect(invoice.totals?.grossAmount).toBe('1234.56');
      expect(invoice.totals?.currency).toBe('EUR');
    });
  });
});

describe('OcrError', () => {
  it('should create error with code and message', () => {
    const error = new OcrError(
      OcrErrorCode.UNSUPPORTED_FILE_TYPE,
      'Test error message'
    );

    expect(error.code).toBe(OcrErrorCode.UNSUPPORTED_FILE_TYPE);
    expect(error.message).toBe('Test error message');
    expect(error.name).toBe('OcrError');
  });

  it('should convert to JSON correctly', () => {
    const error = new OcrError(OcrErrorCode.API_ERROR, 'API failed', {
      detail: 'extra info',
    });

    const json = error.toJSON();

    expect(json.error).toBe('OcrError');
    expect(json.code).toBe(OcrErrorCode.API_ERROR);
    expect(json.message).toBe('API failed');
    expect(json.details).toEqual({ detail: 'extra info' });
  });

  it('should return correct HTTP status codes', () => {
    expect(
      new OcrError(OcrErrorCode.UNSUPPORTED_FILE_TYPE, '').getHttpStatusCode()
    ).toBe(415);

    expect(
      new OcrError(OcrErrorCode.FILE_TOO_LARGE, '').getHttpStatusCode()
    ).toBe(413);

    expect(
      new OcrError(OcrErrorCode.API_QUOTA_EXCEEDED, '').getHttpStatusCode()
    ).toBe(429);

    expect(
      new OcrError(OcrErrorCode.UNKNOWN_ERROR, '').getHttpStatusCode()
    ).toBe(500);
  });

  it('should identify retryable errors', () => {
    expect(new OcrError(OcrErrorCode.NETWORK_ERROR, '').isRetryable()).toBe(
      true
    );

    expect(new OcrError(OcrErrorCode.TIMEOUT, '').isRetryable()).toBe(true);

    expect(
      new OcrError(OcrErrorCode.UNSUPPORTED_FILE_TYPE, '').isRetryable()
    ).toBe(false);
  });
});
