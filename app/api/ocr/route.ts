import { NextRequest, NextResponse } from 'next/server';
import { isSupportedMimeType } from '@/src/server/parsers/ocr';
import { OcrError, OcrErrorCode } from '@/src/server/services/ocr/errors';
import { logger } from '@/src/lib/logging';
import { ocrRateLimiter } from '@/src/lib/rate-limit';
import { getMyOrganizationIdOrThrow } from '@/src/lib/auth/session';
import { ApiError } from '@/src/lib/errors/api-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

interface OcrApiResponse {
  success: boolean;
  data?: {
    text: string;
    confidence: number;
    pages: Array<{
      pageNumber: number;
      text: string;
      confidence: number;
    }>;
    invoice?: {
      invoiceNumber?: string;
      invoiceDate?: string;
      dueDate?: string;
      vendor?: string;
      totalAmount?: number;
      currency?: string;
      taxAmount?: number;
      lineItems?: Array<{
        description: string;
        quantity: number;
        unitPrice: number;
        total: number;
      }>;
    };
    metadata: {
      fileType: string;
      fileSize: number;
      pageCount: number;
      processedAt: string;
    };
  };
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * POST /api/ocr
 *
 * Upload and process a file (PDF, PNG, JPG, TIFF) using OCR.
 * Extracts text and attempts to parse invoice data.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { user } = await getMyOrganizationIdOrThrow();

    logger.info({ userId: user.id }, 'OCR upload request received');

    // Rate Limiting
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';

    const rateLimitResult = ocrRateLimiter.check(ip, user.id);

    if (!rateLimitResult.allowed) {
      const retryAfterSeconds = Math.ceil(
        (rateLimitResult.retryAfterMs || 60_000) / 1000
      );
      const messages: Record<string, string> = {
        ip: 'Zu viele Anfragen. Bitte warte eine Minute.',
        user: 'Tägliches Nutzerlimit erreicht. Bitte versuche es morgen erneut.',
        global:
          'Tägliches Gesamtlimit erreicht. Bitte versuche es morgen erneut.',
      };

      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: messages[rateLimitResult.reason || 'ip'],
            details: { retryAfterSeconds },
          },
        },
        {
          status: 429,
          headers: { 'Retry-After': String(retryAfterSeconds) },
        }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      logger.warn('No file provided in request');
      return NextResponse.json(
        {
          success: false,
          error: {
            code: OcrErrorCode.INVALID_FILE,
            message: 'No file provided. Please upload a file.',
          },
        },
        { status: 400 }
      );
    }

    if (!isSupportedMimeType(file.type)) {
      logger.warn({ mimeType: file.type }, 'Unsupported file type');
      return NextResponse.json(
        {
          success: false,
          error: {
            code: OcrErrorCode.UNSUPPORTED_FILE_TYPE,
            message: `Unsupported file type: ${file.type}. Supported types: PDF, PNG, JPG, TIFF`,
          },
        },
        { status: 415 }
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      logger.warn({ size: file.size }, 'File too large');
      return NextResponse.json(
        {
          success: false,
          error: {
            code: OcrErrorCode.FILE_TOO_LARGE,
            message: `File size exceeds maximum of ${MAX_FILE_SIZE_MB}MB`,
            details: { maxSize: MAX_FILE_SIZE_BYTES, actualSize: file.size },
          },
        },
        { status: 413 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    logger.info(
      { mimeType: file.type, size: file.size, name: file.name },
      'Processing file with OCR'
    );

    const languageHints = formData
      .get('languageHints')
      ?.toString()
      .split(',') || ['de', 'en'];
    const confidenceThreshold = parseFloat(
      formData.get('confidenceThreshold')?.toString() || '0.95'
    );

    const { getOcrService } = await import('@/src/server/services/ocr');
    const ocrService = await getOcrService();

    const ocrResult = await ocrService.processFile(buffer, file.type, {
      languageHints,
      confidenceThreshold,
    });

    const invoiceData = await ocrService.parseInvoice(ocrResult);

    const response: OcrApiResponse = {
      success: true,
      data: {
        text: ocrResult.text,
        confidence: ocrResult.confidence,
        pages: ocrResult.pages.map((page) => ({
          pageNumber: page.pageNumber,
          text: page.text,
          confidence: page.confidence,
        })),
        invoice: {
          invoiceNumber: invoiceData.number,
          invoiceDate: invoiceData.issueDate,
          dueDate: invoiceData.dueDate,
          vendor: invoiceData.supplier?.name,
          totalAmount: invoiceData.totals?.grossAmount
            ? Number(invoiceData.totals.grossAmount)
            : undefined,
          currency: invoiceData.totals?.currency,
          taxAmount: invoiceData.totals?.taxAmount
            ? Number(invoiceData.totals.taxAmount)
            : undefined,
          lineItems: (
            invoiceData as unknown as {
              lineItems?: Array<{
                description: string;
                quantity: number;
                unitPrice: number;
                total: number;
              }>;
            }
          ).lineItems?.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
          })),
        },
        metadata: {
          fileType: ocrResult.metadata.fileType,
          fileSize: ocrResult.metadata.fileSize,
          pageCount: ocrResult.metadata.pageCount,
          processedAt: ocrResult.metadata.processedAt.toISOString(),
        },
      },
    };

    logger.info(
      { confidence: ocrResult.confidence, pages: ocrResult.pages.length },
      'OCR processing completed successfully'
    );

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    if (error instanceof ApiError) return error.toResponse();

    logger.error({ error }, 'OCR processing failed');

    if (error instanceof OcrError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
        },
        { status: error.getHttpStatusCode() }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: OcrErrorCode.UNKNOWN_ERROR,
          message:
            error instanceof Error
              ? error.message
              : 'An unknown error occurred',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ocr
 *
 * Returns information about the OCR endpoint and supported file types.
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    endpoint: '/api/ocr',
    description: 'OCR text extraction using Google Cloud Vision API',
    methods: {
      POST: {
        description: 'Upload and process a file',
        contentType: 'multipart/form-data',
        parameters: {
          file: {
            type: 'File',
            required: true,
            description: 'The file to process (PDF, PNG, JPG, TIFF)',
          },
          languageHints: {
            type: 'string',
            required: false,
            default: 'de,en',
            description:
              "Comma-separated list of language hints (e.g., 'de,en')",
          },
          confidenceThreshold: {
            type: 'number',
            required: false,
            default: 0.95,
            description: 'Minimum confidence threshold (0.0 - 1.0)',
          },
        },
      },
    },
    supportedTypes: [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/tiff',
      'image/tif',
    ],
    limits: {
      maxFileSize: `${MAX_FILE_SIZE_MB}MB`,
      maxPages: 100,
      timeout: '60 seconds',
    },
  });
}
