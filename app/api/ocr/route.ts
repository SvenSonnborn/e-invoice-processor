import { NextRequest, NextResponse } from "next/server";
import { ocrService } from "@/src/server/services/ocr";
import { parseWithOcr, isSupportedMimeType } from "@/src/server/parsers/ocr";
import { OcrError, OcrErrorCode } from "@/src/server/services/ocr/errors";
import { logger } from "@/src/lib/logging";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // 60 seconds timeout

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
export async function POST(request: NextRequest): Promise<NextResponse<OcrApiResponse>> {
  logger.info("OCR upload request received");

  try {
    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    // Validate file exists
    if (!file) {
      logger.warn("No file provided in request");
      return NextResponse.json(
        {
          success: false,
          error: {
            code: OcrErrorCode.INVALID_FILE,
            message: "No file provided. Please upload a file.",
          },
        },
        { status: 400 }
      );
    }

    // Validate file type
    if (!isSupportedMimeType(file.type)) {
      logger.warn({ mimeType: file.type }, "Unsupported file type");
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

    // Validate file size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      logger.warn({ size: file.size }, "File too large");
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

    // Read file buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    logger.info(
      { mimeType: file.type, size: file.size, name: file.name },
      "Processing file with OCR"
    );

    // Get optional parameters
    const languageHints = formData.get("languageHints")?.toString().split(",") || ["de", "en"];
    const confidenceThreshold = parseFloat(formData.get("confidenceThreshold")?.toString() || "0.95");

    // Process with OCR
    const ocrResult = await ocrService.processFile(buffer, file.type, {
      languageHints,
      confidenceThreshold,
    });

    // Parse invoice data
    const invoiceData = await ocrService.parseInvoice(ocrResult);

    // Build response
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
          invoiceNumber: invoiceData.invoiceNumber,
          invoiceDate: invoiceData.invoiceDate,
          dueDate: invoiceData.dueDate,
          vendor: invoiceData.vendor,
          totalAmount: invoiceData.totalAmount,
          currency: invoiceData.currency,
          taxAmount: invoiceData.taxAmount,
          lineItems: invoiceData.lineItems,
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
      "OCR processing completed successfully"
    );

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    logger.error({ error }, "OCR processing failed");

    // Handle known OCR errors
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

    // Handle unknown errors
    return NextResponse.json(
      {
        success: false,
        error: {
          code: OcrErrorCode.UNKNOWN_ERROR,
          message: error instanceof Error ? error.message : "An unknown error occurred",
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
    endpoint: "/api/ocr",
    description: "OCR text extraction using Google Cloud Vision API",
    methods: {
      POST: {
        description: "Upload and process a file",
        contentType: "multipart/form-data",
        parameters: {
          file: {
            type: "File",
            required: true,
            description: "The file to process (PDF, PNG, JPG, TIFF)",
          },
          languageHints: {
            type: "string",
            required: false,
            default: "de,en",
            description: "Comma-separated list of language hints (e.g., 'de,en')",
          },
          confidenceThreshold: {
            type: "number",
            required: false,
            default: 0.95,
            description: "Minimum confidence threshold (0.0 - 1.0)",
          },
        },
      },
    },
    supportedTypes: [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/tiff",
      "image/tif",
    ],
    limits: {
      maxFileSize: `${MAX_FILE_SIZE_MB}MB`,
      maxPages: 100,
      timeout: "60 seconds",
    },
  });
}
