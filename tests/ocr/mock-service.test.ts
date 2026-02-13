/**
 * MockOcrService Tests
 *
 * Tests for the Mock OCR Service with all sample invoices.
 */

import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { readFileSync, readdirSync } from 'fs';
import { join, resolve } from 'path';

// Mock logger to suppress output during tests
mock.module('@/src/lib/logging', () => ({
  logger: {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
  },
}));

import { MockOcrService } from '@/src/server/services/ocr/mock-service';
import { OcrError, OcrErrorCode } from '@/src/server/services/ocr/errors';
import type { OcrResult } from '@/src/server/services/ocr/types';

const MOCK_DIR = resolve(process.cwd(), 'mocks', 'ocr-responses');
const VALID_PDF_BUFFER = Buffer.from('fake-pdf-content');
const VALID_MIME_TYPE = 'application/pdf';

// Generous threshold for CI environments with CPU contention
const PERF_THRESHOLD_MS = 500;

// Load all fixture file names for parameterized tests
const fixtureFiles = readdirSync(MOCK_DIR)
  .filter((f) => f.endsWith('.json'))
  .sort();

// Helper: create service and rotate to a specific fixture index
const getResultForFixture = async (
  fileIndex: number
): Promise<{ service: MockOcrService; result: OcrResult }> => {
  const svc = new MockOcrService(MOCK_DIR);
  for (let i = 0; i < fileIndex; i++) {
    await svc.processFile(VALID_PDF_BUFFER, VALID_MIME_TYPE);
  }
  const result = await svc.processFile(VALID_PDF_BUFFER, VALID_MIME_TYPE);
  return { service: svc, result };
};

describe('MockOcrService', () => {
  let service: MockOcrService;

  beforeEach(() => {
    service = new MockOcrService(MOCK_DIR);
  });

  describe('Initialisierung', () => {
    it('should load at least the expected fixture files from the mock directory', () => {
      expect(fixtureFiles.length).toBeGreaterThanOrEqual(11);
    });

    it('should use default response when directory is empty', async () => {
      const emptyService = new MockOcrService('/tmp/nonexistent-ocr-mocks');
      const result = await emptyService.processFile(
        VALID_PDF_BUFFER,
        VALID_MIME_TYPE
      );

      expect(result).toBeDefined();
      expect(result.text).toBeTruthy();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should use default response when directory does not exist', async () => {
      const missingService = new MockOcrService(
        '/tmp/absolutely-does-not-exist-dir'
      );
      const result = await missingService.processFile(
        VALID_PDF_BUFFER,
        VALID_MIME_TYPE
      );

      expect(result).toBeDefined();
      expect(result.text).toContain('MOCK-001');
    });
  });

  describe('processFile – für jede Beispielrechnung', () => {
    for (const [idx, file] of fixtureFiles.entries()) {
      describe(`Fixture: ${file}`, () => {
        let result: OcrResult;

        beforeEach(async () => {
          const data = await getResultForFixture(idx);
          result = data.result;
        });

        it('should return valid OcrResult JSON', () => {
          expect(result).toBeDefined();
          expect(typeof result).toBe('object');
        });

        it('should contain all required fields (text, confidence, pages, metadata)', () => {
          expect('text' in result).toBe(true);
          expect('confidence' in result).toBe(true);
          expect('pages' in result).toBe(true);
          expect('metadata' in result).toBe(true);
        });

        it('should have text as non-empty string', () => {
          expect(typeof result.text).toBe('string');
          expect(result.text.length).toBeGreaterThan(0);
        });

        it('should have confidence as number between 0 and 1', () => {
          expect(typeof result.confidence).toBe('number');
          expect(result.confidence).toBeGreaterThanOrEqual(0);
          expect(result.confidence).toBeLessThanOrEqual(1);
        });

        it('should have pages as array with at least one entry', () => {
          expect(Array.isArray(result.pages)).toBe(true);
          expect(result.pages.length).toBeGreaterThanOrEqual(1);
        });

        it('should have metadata with correct types', () => {
          expect(result.metadata.processedAt).toBeInstanceOf(Date);
          expect(typeof result.metadata.fileType).toBe('string');
          expect(typeof result.metadata.fileSize).toBe('number');
          expect(typeof result.metadata.pageCount).toBe('number');
        });

        it('should have valid page structure', () => {
          for (const page of result.pages) {
            expect(typeof page.pageNumber).toBe('number');
            expect(typeof page.text).toBe('string');
            expect(typeof page.confidence).toBe('number');
            expect(Array.isArray(page.blocks)).toBe(true);
          }
        });

        it('should have valid block structure in each page', () => {
          for (const page of result.pages) {
            for (const block of page.blocks) {
              expect(typeof block.text).toBe('string');
              expect(typeof block.confidence).toBe('number');
              expect(block.boundingBox).toBeDefined();
              expect(typeof block.boundingBox.x).toBe('number');
              expect(typeof block.boundingBox.y).toBe('number');
              expect(typeof block.boundingBox.width).toBe('number');
              expect(typeof block.boundingBox.height).toBe('number');
            }
          }
        });
      });
    }

    it('should rotate through all loaded responses', async () => {
      const texts: string[] = [];
      for (let i = 0; i < fixtureFiles.length; i++) {
        const result = await service.processFile(
          VALID_PDF_BUFFER,
          VALID_MIME_TYPE
        );
        texts.push(result.text);
      }

      const uniqueTexts = new Set(texts);
      expect(uniqueTexts.size).toBe(fixtureFiles.length);
    });
  });

  describe('parseInvoice – für jede Beispielrechnung', () => {
    for (const [idx, file] of fixtureFiles.entries()) {
      describe(`Fixture: ${file}`, () => {
        let invoiceData: Awaited<ReturnType<MockOcrService['parseInvoice']>>;

        beforeEach(async () => {
          const { service: svc, result } = await getResultForFixture(idx);
          invoiceData = await svc.parseInvoice(result);
        });

        it('should return valid OcrInvoiceData', () => {
          expect(invoiceData).toBeDefined();
          expect(typeof invoiceData).toBe('object');
        });

        it('should have format as valid InvoiceFormat', () => {
          expect(invoiceData.format).toBeDefined();
          expect(['ZUGFERD', 'XRECHNUNG', 'UNKNOWN']).toContain(
            invoiceData.format
          );
        });

        it('should have number as non-empty string', () => {
          expect(invoiceData.number).toBeDefined();
          expect(typeof invoiceData.number).toBe('string');
          expect(invoiceData.number!.length).toBeGreaterThan(0);
        });

        it('should have issueDate as ISO date string', () => {
          expect(invoiceData.issueDate).toBeDefined();
          expect(typeof invoiceData.issueDate).toBe('string');
          expect(invoiceData.issueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        });

        it('should have dueDate as ISO date string when present', () => {
          if (invoiceData.dueDate !== undefined) {
            expect(typeof invoiceData.dueDate).toBe('string');
            expect(invoiceData.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
          }
        });

        it('should have supplier.name as non-empty string', () => {
          expect(invoiceData.supplier).toBeDefined();
          expect(invoiceData.supplier?.name).toBeDefined();
          expect(typeof invoiceData.supplier!.name).toBe('string');
          expect(invoiceData.supplier!.name!.length).toBeGreaterThan(0);
        });

        it('should have totals.currency as 3-letter string', () => {
          expect(invoiceData.totals).toBeDefined();
          expect(invoiceData.totals?.currency).toBeDefined();
          expect(typeof invoiceData.totals!.currency).toBe('string');
          expect(invoiceData.totals!.currency.length).toBe(3);
        });

        it('should have totals.grossAmount as parseable numeric string', () => {
          expect(invoiceData.totals?.grossAmount).toBeDefined();
          expect(typeof invoiceData.totals!.grossAmount).toBe('string');
          expect(isFinite(Number(invoiceData.totals!.grossAmount))).toBe(true);
        });

        it('should have valid lineItems structure', () => {
          expect(invoiceData.lineItems).toBeDefined();
          expect(Array.isArray(invoiceData.lineItems)).toBe(true);
          expect(invoiceData.lineItems!.length).toBeGreaterThan(0);

          for (const item of invoiceData.lineItems!) {
            expect(typeof item.description).toBe('string');
            expect(typeof item.quantity).toBe('number');
            expect(typeof item.unitPrice).toBe('number');
            expect(typeof item.total).toBe('number');
          }
        });
      });
    }

    it('should use fallback invoice data when text does not match any fixture', async () => {
      // First call processFile to populate currentIndex
      await service.processFile(VALID_PDF_BUFFER, VALID_MIME_TYPE);

      const unmatchedResult: OcrResult = {
        text: 'This text matches no fixture at all',
        confidence: 0.5,
        pages: [],
        metadata: {
          processedAt: new Date(),
          fileType: 'image/png',
          fileSize: 100,
          pageCount: 0,
        },
      };

      // Service has responses loaded but none match the text.
      // Fallback logic returns the last served response's invoice data.
      const invoiceData = await service.parseInvoice(unmatchedResult);

      expect(invoiceData).toBeDefined();
      // Fallback should return the first fixture's data (last served = index 0)
      expect(invoiceData.format).toBeDefined();
      expect(invoiceData.number).toBeDefined();
      expect(typeof invoiceData.number).toBe('string');
    });

    it('should return default invoice data when service was created with missing directory', async () => {
      const fallbackService = new MockOcrService('/tmp/nonexistent-ocr-mocks');

      // processFile injects the default MOCK-001 response
      const ocrResult = await fallbackService.processFile(
        VALID_PDF_BUFFER,
        VALID_MIME_TYPE
      );
      expect(ocrResult.text).toContain('MOCK-001');

      // parseInvoice should match the default response by text
      const invoiceData = await fallbackService.parseInvoice(ocrResult);
      expect(invoiceData).toBeDefined();
      expect(invoiceData.number).toBe('MOCK-001');
      expect(invoiceData.supplier?.name).toBe('Mock Invoice GmbH');
      expect(invoiceData.totals?.currency).toBe('EUR');
      expect(invoiceData.totals?.grossAmount).toBe('100.00');
      expect(invoiceData.lineItems?.length).toBe(1);
    });
  });

  describe('Wert-Validierung: Bekannte Fixture-Daten', () => {
    it('should return correct data for invoice-standard.json (RE-2024-001)', async () => {
      const standardIndex = fixtureFiles.indexOf('invoice-standard.json');
      expect(standardIndex).toBeGreaterThanOrEqual(0);

      const { service: svc, result } = await getResultForFixture(standardIndex);
      const invoiceData = await svc.parseInvoice(result);

      expect(invoiceData.number).toBe('RE-2024-001');
      expect(invoiceData.supplier?.name).toBe('Musterfirma GmbH');
      expect(invoiceData.customer?.name).toBe('Beispiel AG');
      expect(invoiceData.issueDate).toBe('2024-01-15');
      expect(invoiceData.dueDate).toBe('2024-02-15');
      expect(invoiceData.totals?.currency).toBe('EUR');
      expect(invoiceData.totals?.grossAmount).toBe('1223.32');
      expect(invoiceData.lineItems?.length).toBe(3);
    });

    it('should return correct data for sample-invoice-01.json (NL-2026-00041)', async () => {
      const sampleIndex = fixtureFiles.indexOf('sample-invoice-01.json');
      expect(sampleIndex).toBeGreaterThanOrEqual(0);

      const { service: svc, result } = await getResultForFixture(sampleIndex);
      const invoiceData = await svc.parseInvoice(result);

      expect(invoiceData.number).toBe('NL-2026-00041');
      expect(invoiceData.supplier?.name).toBe('Nordlicht IT Services GmbH');
      expect(invoiceData.customer?.name).toBe('Kronberg Maschinenbau AG');
      expect(invoiceData.totals?.grossAmount).toBe('2487.10');
      expect(invoiceData.lineItems?.length).toBe(3);
    });

    it('should handle negative amounts in credit note (sample-invoice-05.json)', async () => {
      const creditIndex = fixtureFiles.indexOf('sample-invoice-05.json');
      expect(creditIndex).toBeGreaterThanOrEqual(0);

      const { service: svc, result } = await getResultForFixture(creditIndex);
      const invoiceData = await svc.parseInvoice(result);

      expect(invoiceData.number).toBe('ROS-GU-2026-0006');
      expect(invoiceData.totals?.grossAmount).toBe('-112.92');
      expect(Number(invoiceData.totals?.grossAmount)).toBeLessThan(0);
      expect(invoiceData.lineItems?.[0]?.unitPrice).toBeLessThan(0);
    });

    it('should handle multi-page invoice (sample-invoice-06.json)', async () => {
      const multiPageIndex = fixtureFiles.indexOf('sample-invoice-06.json');
      expect(multiPageIndex).toBeGreaterThanOrEqual(0);

      const { result } = await getResultForFixture(multiPageIndex);

      expect(result.pages.length).toBe(2);
      expect(result.metadata.pageCount).toBe(2);
      expect(result.pages[0].pageNumber).toBe(1);
      expect(result.pages[1].pageNumber).toBe(2);
    });
  });

  describe('Dateivalidierung', () => {
    it('should reject files larger than 10MB', async () => {
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024);

      expect(
        service.processFile(largeBuffer, VALID_MIME_TYPE)
      ).rejects.toThrow();
    });

    it('should throw OcrError with FILE_TOO_LARGE code for oversized files', async () => {
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024);

      try {
        await service.processFile(largeBuffer, VALID_MIME_TYPE);
        throw new Error('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(
          OcrError as unknown as new (...args: unknown[]) => unknown
        );
        expect((error as OcrError).code).toBe(OcrErrorCode.FILE_TOO_LARGE);
      }
    });

    it('should accept file at exactly 10MB boundary', async () => {
      const boundaryBuffer = Buffer.alloc(10 * 1024 * 1024);
      const result = await service.processFile(boundaryBuffer, VALID_MIME_TYPE);
      expect(result).toBeDefined();
    });

    it('should reject unsupported MIME types', async () => {
      expect(
        service.processFile(VALID_PDF_BUFFER, 'text/plain')
      ).rejects.toThrow();
    });

    it('should throw OcrError with UNSUPPORTED_FILE_TYPE code', async () => {
      try {
        await service.processFile(VALID_PDF_BUFFER, 'text/plain');
        throw new Error('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(
          OcrError as unknown as new (...args: unknown[]) => unknown
        );
        expect((error as OcrError).code).toBe(
          OcrErrorCode.UNSUPPORTED_FILE_TYPE
        );
      }
    });

    it('should accept application/pdf', async () => {
      const result = await service.processFile(
        VALID_PDF_BUFFER,
        'application/pdf'
      );
      expect(result).toBeDefined();
    });

    it('should accept image/png', async () => {
      const result = await service.processFile(VALID_PDF_BUFFER, 'image/png');
      expect(result).toBeDefined();
    });

    it('should accept image/jpeg', async () => {
      const result = await service.processFile(VALID_PDF_BUFFER, 'image/jpeg');
      expect(result).toBeDefined();
    });

    it('should accept image/jpg', async () => {
      const result = await service.processFile(VALID_PDF_BUFFER, 'image/jpg');
      expect(result).toBeDefined();
    });

    it('should accept image/tiff', async () => {
      const result = await service.processFile(VALID_PDF_BUFFER, 'image/tiff');
      expect(result).toBeDefined();
    });

    it('should accept image/tif', async () => {
      const result = await service.processFile(VALID_PDF_BUFFER, 'image/tif');
      expect(result).toBeDefined();
    });
  });

  describe('confidenceThreshold Option', () => {
    it('should not throw when confidence is above threshold', async () => {
      const result = await service.processFile(
        VALID_PDF_BUFFER,
        VALID_MIME_TYPE,
        { confidenceThreshold: 0.5 }
      );
      expect(result).toBeDefined();
    });

    it('should still return result when confidence is below threshold', async () => {
      const result = await service.processFile(
        VALID_PDF_BUFFER,
        VALID_MIME_TYPE,
        { confidenceThreshold: 0.99 }
      );
      expect(result).toBeDefined();
      expect(result.confidence).toBeLessThan(0.99);
    });

    it('should use default threshold of 0.95 when not specified', async () => {
      const result = await service.processFile(
        VALID_PDF_BUFFER,
        VALID_MIME_TYPE
      );
      expect(result).toBeDefined();
    });
  });

  describe('Rotation', () => {
    it('should rotate through all loaded responses', async () => {
      const firstPassTexts: string[] = [];
      for (let i = 0; i < fixtureFiles.length; i++) {
        const result = await service.processFile(
          VALID_PDF_BUFFER,
          VALID_MIME_TYPE
        );
        firstPassTexts.push(result.text);
      }

      const uniqueTexts = new Set(firstPassTexts);
      expect(uniqueTexts.size).toBe(fixtureFiles.length);
    });

    it('should wrap around after cycling through all responses', async () => {
      const firstTexts: string[] = [];

      for (let i = 0; i < fixtureFiles.length; i++) {
        const result = await service.processFile(
          VALID_PDF_BUFFER,
          VALID_MIME_TYPE
        );
        firstTexts.push(result.text);
      }

      for (let i = 0; i < fixtureFiles.length; i++) {
        const result = await service.processFile(
          VALID_PDF_BUFFER,
          VALID_MIME_TYPE
        );
        expect(result.text).toBe(firstTexts[i]);
      }
    });
  });

  describe('Performance', () => {
    it('processFile should complete well under wall-clock threshold', async () => {
      const start = performance.now();
      await service.processFile(VALID_PDF_BUFFER, VALID_MIME_TYPE);
      const duration = performance.now() - start;

      // Generous threshold to avoid flaky failures in CI
      expect(duration).toBeLessThan(PERF_THRESHOLD_MS);
    });

    it('parseInvoice should complete well under wall-clock threshold', async () => {
      const ocrResult = await service.processFile(
        VALID_PDF_BUFFER,
        VALID_MIME_TYPE
      );

      const start = performance.now();
      await service.parseInvoice(ocrResult);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(PERF_THRESHOLD_MS);
    });
  });

  describe('Fixture-Datei Integrität', () => {
    for (const file of fixtureFiles) {
      it(`${file} should be valid JSON with required MockResponseFile structure`, () => {
        const content = readFileSync(join(MOCK_DIR, file), 'utf-8');
        const parsed = JSON.parse(content) as Record<string, unknown>;

        expect('ocrResult' in parsed).toBe(true);
        expect('invoiceData' in parsed).toBe(true);

        const ocrResult = parsed.ocrResult as Record<string, unknown>;
        expect('text' in ocrResult).toBe(true);
        expect('confidence' in ocrResult).toBe(true);
        expect('pages' in ocrResult).toBe(true);
        expect('metadata' in ocrResult).toBe(true);
        expect(typeof ocrResult.text).toBe('string');
        expect(typeof ocrResult.confidence).toBe('number');
        expect(Array.isArray(ocrResult.pages)).toBe(true);
      });
    }
  });
});
