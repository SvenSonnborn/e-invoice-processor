import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db/client';
import { getMyOrganizationIdOrThrow } from '@/src/lib/auth/session';
import { ApiError } from '@/src/lib/errors/api-error';
import { logger } from '@/src/lib/logging';
import {
  processInvoiceOcr,
  InvoiceProcessingError,
} from '@/src/server/services/invoice-processing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/process-invoice/[fileId]
 *
 * Manually triggers OCR processing for an uploaded invoice file.
 * Delegates to the shared processInvoiceOcr service.
 * Flow: UPLOADED → PARSED → VALIDATED (or → FAILED on error)
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
): Promise<NextResponse> {
  const { fileId } = await params;

  try {
    const { organizationId } = await getMyOrganizationIdOrThrow();

    // Look up file and its invoice
    const file = await prisma.file.findUnique({
      where: { id: fileId },
      include: { invoice: true },
    });

    if (!file) {
      throw ApiError.notFound(`File ${fileId} not found`);
    }

    if (file.organizationId !== organizationId) {
      throw ApiError.forbidden('You do not have access to this file');
    }

    const invoice = file.invoice;
    if (!invoice) {
      throw ApiError.notFound(`No invoice linked to file ${fileId}`);
    }

    if (invoice.status !== 'UPLOADED' && invoice.status !== 'CREATED') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'ALREADY_PROCESSED',
            message: `Invoice is already in status "${invoice.status}" and cannot be re-processed from this endpoint`,
          },
        },
        { status: 409 }
      );
    }

    const result = await processInvoiceOcr({
      fileId: file.id,
      invoiceId: invoice.id,
      storageKey: file.storageKey,
      contentType: file.contentType || 'application/pdf',
      sourceFileName: file.filename,
    });

    // Fetch the final invoice state for the response
    const updatedInvoice = await prisma.invoice.findUnique({
      where: { id: invoice.id },
    });

    return NextResponse.json({
      success: true,
      invoice: {
        id: updatedInvoice!.id,
        status: updatedInvoice!.status,
        number: updatedInvoice!.number,
        supplierName: updatedInvoice!.supplierName,
        customerName: updatedInvoice!.customerName,
        issueDate: updatedInvoice!.issueDate,
        dueDate: updatedInvoice!.dueDate,
        grossAmount: updatedInvoice!.grossAmount,
        format: updatedInvoice!.format,
      },
      ocr: {
        confidence: result.confidence,
        pageCount: result.pageCount,
      },
    });
  } catch (error) {
    if (error instanceof ApiError) return error.toResponse();

    if (error instanceof InvoiceProcessingError) {
      logger.error(
        { code: error.code, details: error.details, fileId },
        `Invoice processing failed: ${error.message}`
      );
      return ApiError.internal('Failed to process invoice').toResponse();
    }

    logger.error({ error, fileId }, 'Invoice processing failed');
    return ApiError.internal('Failed to process invoice').toResponse();
  }
}
