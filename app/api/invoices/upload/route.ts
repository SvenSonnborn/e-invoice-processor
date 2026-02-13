import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db/client';
import { getMyOrganizationIdOrThrow } from '@/src/lib/auth/session';
import { ApiError } from '@/src/lib/errors/api-error';
import { logger } from '@/src/lib/logging';
import { storage } from '@/src/lib/storage';
import { isSupportedMimeType } from '@/src/server/parsers/ocr';
import {
  processInvoiceOcr,
  InvoiceProcessingError,
} from '@/src/server/services/invoice-processing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

function sanitizeFilename(filename: string): string {
  const sanitized = filename
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  return sanitized || 'invoice-upload';
}

/**
 * POST /api/invoices/upload
 * Upload invoice file, store metadata, create initial invoice record.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  let uploadedStorageKey: string | null = null;

  try {
    const { user, organizationId } = await getMyOrganizationIdOrThrow();

    const formData = await request.formData();
    const uploadedFile = formData.get('file');

    if (!(uploadedFile instanceof File)) {
      throw ApiError.validationError(
        'No file provided. Use multipart/form-data with field "file".'
      );
    }

    if (!uploadedFile.type || !isSupportedMimeType(uploadedFile.type)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNSUPPORTED_FILE_TYPE',
            message: `Unsupported file type: ${uploadedFile.type || 'unknown'}`,
          },
        },
        { status: 415 }
      );
    }

    if (uploadedFile.size > MAX_FILE_SIZE_BYTES) {
      throw ApiError.validationError(
        `File too large. Maximum ${MAX_FILE_SIZE_MB}MB.`
      );
    }

    const safeFilename = sanitizeFilename(uploadedFile.name);
    const storageKey = `invoices/${organizationId}/${user.id}/${Date.now()}-${randomUUID()}-${safeFilename}`;
    const fileBuffer = Buffer.from(await uploadedFile.arrayBuffer());

    uploadedStorageKey = await storage.upload(storageKey, fileBuffer, {
      contentType: uploadedFile.type,
      metadata: {
        organizationId,
        userId: user.id,
        originalFilename: uploadedFile.name || safeFilename,
      },
    });

    const { file, invoice } = await prisma.$transaction(async (tx) => {
      const fileRecord = await tx.file.create({
        data: {
          organizationId,
          filename: uploadedFile.name || safeFilename,
          contentType: uploadedFile.type || null,
          sizeBytes: uploadedFile.size,
          storageKey: uploadedStorageKey!,
        },
      });

      const invoiceRecord = await tx.invoice.create({
        data: {
          organizationId,
          fileId: fileRecord.id,
          createdBy: user.id,
          status: 'UPLOADED',
        },
      });

      return { file: fileRecord, invoice: invoiceRecord };
    });

    // Fire-and-forget: trigger OCR processing in the background
    processInvoiceOcr({
      fileId: file.id,
      invoiceId: invoice.id,
      storageKey: file.storageKey,
      contentType: file.contentType || 'application/pdf',
      sourceFileName: file.filename,
    }).catch((ocrError: InvoiceProcessingError) => {
      logger.error(
        {
          code: ocrError.code,
          message: ocrError.message,
          fileId: file.id,
          invoiceId: invoice.id,
        },
        'Background OCR processing failed'
      );
    });

    return NextResponse.json(
      {
        success: true,
        file: {
          id: file.id,
          filename: file.filename,
          contentType: file.contentType,
          sizeBytes: file.sizeBytes,
          storageKey: file.storageKey,
          status: file.status,
          createdAt: file.createdAt,
        },
        invoice: {
          id: invoice.id,
          fileId: invoice.fileId,
          status: invoice.status,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (uploadedStorageKey) {
      try {
        await storage.delete(uploadedStorageKey);
      } catch (cleanupError) {
        logger.warn(
          { cleanupError, storageKey: uploadedStorageKey },
          'Failed to clean up uploaded file after error'
        );
      }
    }

    if (error instanceof ApiError) return error.toResponse();
    logger.error({ error }, 'Invoice upload failed');
    return ApiError.internal('Failed to upload invoice').toResponse();
  }
}
