import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getMyOrganizationIdOrThrow } from '@/src/lib/auth/session';
import { ApiError } from '@/src/lib/errors/api-error';
import { logger } from '@/src/lib/logging';
import {
  generateInvoiceExport,
  InvoiceExportServiceError,
} from '@/src/server/services/invoice-export';

const exportQuerySchema = z.object({
  format: z.enum(['xrechnung', 'zugferd']),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  try {
    const { invoiceId } = await params;
    const { organizationId } = await getMyOrganizationIdOrThrow();
    const { searchParams } = new URL(request.url);

    const parsedQuery = exportQuerySchema.safeParse({
      format: searchParams.get('format')?.toLowerCase(),
    });

    if (!parsedQuery.success) {
      throw ApiError.validationError(
        'Query parameter "format" must be either "xrechnung" or "zugferd".',
        {
          issues: parsedQuery.error.format(),
        }
      );
    }

    const result = await generateInvoiceExport({
      organizationId,
      invoiceId,
      format: parsedQuery.data.format,
    });

    return new NextResponse(new Uint8Array(result.fileBuffer), {
      status: 200,
      headers: {
        'Content-Type': result.contentType,
        'Content-Disposition': `attachment; filename="${result.filename}"`,
        'Content-Length': String(result.fileBuffer.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    if (error instanceof ApiError) return error.toResponse();

    if (error instanceof InvoiceExportServiceError) {
      if (error.code === 'NOT_FOUND') {
        return ApiError.notFound(error.message).toResponse();
      }

      if (
        error.code === 'INVALID_STATE' ||
        error.code === 'MISSING_REVIEW_DATA' ||
        error.code === 'VALIDATION_FAILED'
      ) {
        return ApiError.validationError(error.message).toResponse();
      }
    }

    logger.error({ error }, 'Failed to export invoice');
    return ApiError.internal('Failed to export invoice').toResponse();
  }
}
