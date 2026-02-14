import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db/client';
import { getMyOrganizationIdOrThrow } from '@/src/lib/auth/session';
import { ApiError } from '@/src/lib/errors/api-error';
import {
  isValidStatusTransition,
  mapInvoiceStatusToApiStatusGroup,
} from '@/src/lib/invoices/status';
import { logger } from '@/src/lib/logging';
import {
  processInvoiceOcr,
  InvoiceProcessingError,
  InvoiceProcessingErrorCode,
} from '@/src/server/services/invoice-processing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/process-invoice/[fileId]
 *
 * Manually triggers OCR processing for an uploaded invoice file.
 * Delegates to the shared processInvoiceOcr service.
 * Supports both initial processing and manual re-processing.
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

    if (!isValidStatusTransition(invoice.status, 'PARSED')) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_STATUS_TRANSITION',
            message: `Invoice in status "${invoice.status}" cannot be moved to PARSED for processing`,
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
        statusGroup: mapInvoiceStatusToApiStatusGroup(updatedInvoice!.status),
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
      if (error.code === InvoiceProcessingErrorCode.DB_UPDATE_FAILED) {
        const conflictField =
          typeof error.details.conflictField === 'string'
            ? error.details.conflictField
            : undefined;
        if (conflictField === 'number') {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'DUPLICATE_INVOICE_NUMBER',
                message: error.message,
              },
            },
            { status: 409 }
          );
        }
      }

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
