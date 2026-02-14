import { NextRequest, NextResponse } from 'next/server';
import { getMyOrganizationIdOrThrow } from '@/src/lib/auth/session';
import { isPrismaUniqueConstraintError } from '@/src/lib/db/prisma-errors';
import { ApiError } from '@/src/lib/errors/api-error';
import { mapInvoiceStatusToApiStatusGroup } from '@/src/lib/invoices/status';
import { logger } from '@/src/lib/logging';
import { prisma } from '@/src/lib/db/client';
import type { InvoiceStatus, Prisma } from '@/src/generated/prisma/client';
import { coerceGrossAmountToNumber } from '@/src/lib/dashboard/invoices';
import {
  invoiceReviewSchema,
  mapInvoiceReviewValidationIssues,
  normalizeInvoiceReviewPayload,
} from '@/src/lib/validators/invoice-review';
import { parseIsoDateToUtc } from '@/src/lib/validators/invoice-review-helpers';
import {
  validateSellerVatId,
  type VatValidationResult,
} from '@/src/server/services/vat';

interface InvoiceDetailsResponse {
  id: string;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  totalAmount: number | null;
  currency: string | null;
  vendorName: string | null;
  taxId: string | null;
  status: InvoiceStatus;
  statusGroup: ReturnType<typeof mapInvoiceStatusToApiStatusGroup>;
}

interface ApiWarning {
  code: 'VAT_VALIDATION_UNAVAILABLE';
  field: 'seller.vatId';
  message: string;
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function mapInvoiceForDetailsResponse(invoice: {
  id: string;
  number: string | null;
  issueDate: Date | null;
  grossAmount: unknown;
  currency: string | null;
  supplierName: string | null;
  taxId: string | null;
  status: InvoiceStatus;
}): InvoiceDetailsResponse {
  return {
    id: invoice.id,
    invoiceNumber: invoice.number,
    invoiceDate: invoice.issueDate
      ? invoice.issueDate.toISOString().slice(0, 10)
      : null,
    totalAmount:
      invoice.grossAmount === null
        ? null
        : coerceGrossAmountToNumber(invoice.grossAmount),
    currency: invoice.currency,
    vendorName: invoice.supplierName,
    taxId: invoice.taxId,
    status: invoice.status,
    statusGroup: mapInvoiceStatusToApiStatusGroup(invoice.status),
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  try {
    const { organizationId } = await getMyOrganizationIdOrThrow();
    const { invoiceId } = await params;

    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        organizationId,
      },
      select: {
        id: true,
        number: true,
        issueDate: true,
        grossAmount: true,
        currency: true,
        supplierName: true,
        taxId: true,
        status: true,
      },
    });

    if (!invoice) {
      throw ApiError.notFound('Rechnung nicht gefunden.');
    }

    return NextResponse.json({
      success: true,
      invoice: mapInvoiceForDetailsResponse(invoice),
    });
  } catch (error) {
    if (error instanceof ApiError) return error.toResponse();
    logger.error({ error }, 'Failed to get invoice');
    return ApiError.internal().toResponse();
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  try {
    const { organizationId } = await getMyOrganizationIdOrThrow();
    const { invoiceId } = await params;

    const existingInvoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        organizationId,
      },
      select: {
        id: true,
        status: true,
        rawJson: true,
      },
    });

    if (!existingInvoice) {
      throw ApiError.notFound('Rechnung nicht gefunden.');
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      throw ApiError.validationError('Ungültiger Request-Body (JSON erwartet).');
    }

    const parsed = invoiceReviewSchema.safeParse(payload);
    if (!parsed.success) {
      throw ApiError.validationError('Eingabedaten sind ungültig.', {
        fieldErrors: mapInvoiceReviewValidationIssues(parsed.error.issues),
      });
    }

    const normalized = normalizeInvoiceReviewPayload(parsed.data);
    const issueDate = parseIsoDateToUtc(normalized.header.issueDate);
    if (!issueDate) {
      throw ApiError.validationError('Eingabedaten sind ungültig.', {
        fieldErrors: {
          'header.issueDate': 'Rechnungsdatum ist ungültig.',
        },
      });
    }
    const dueDate = normalized.header.dueDate
      ? parseIsoDateToUtc(normalized.header.dueDate)
      : null;

    let vatValidation: VatValidationResult | null = null;
    const warnings: ApiWarning[] = [];

    if (normalized.seller.vatId) {
      try {
        vatValidation = await validateSellerVatId(normalized.seller.vatId);
      } catch (error) {
        logger.warn(
          { error, invoiceId, organizationId },
          'VAT validation failed unexpectedly. Continuing without blocking.'
        );
        vatValidation = {
          status: 'unavailable',
          reason: 'vies_unavailable',
          message:
            'VIES-Pruefung ist aktuell nicht verfuegbar. Die lokale Pruefung wurde verwendet.',
          checkedAt: new Date().toISOString(),
          normalizedVatId: normalized.seller.vatId,
          countryCode: null,
          vatNumber: null,
          viesChecked: false,
        };
      }

      if (vatValidation.status === 'invalid') {
        throw ApiError.validationError('Eingabedaten sind ungültig.', {
          fieldErrors: {
            'seller.vatId': vatValidation.message,
          },
        });
      }

      if (vatValidation.status === 'unavailable') {
        warnings.push({
          code: 'VAT_VALIDATION_UNAVAILABLE',
          field: 'seller.vatId',
          message: vatValidation.message,
        });
      }
    }

    const rawJsonBase =
      existingInvoice.rawJson &&
      typeof existingInvoice.rawJson === 'object' &&
      !Array.isArray(existingInvoice.rawJson)
        ? (existingInvoice.rawJson as Record<string, unknown>)
        : {};

    let updatedInvoice;
    try {
      updatedInvoice = await prisma.invoice.update({
        where: { id: existingInvoice.id },
        data: {
          number: normalized.header.invoiceNumber,
          issueDate,
          dueDate,
          currency: normalized.header.currency,
          supplierName: normalized.seller.name,
          customerName: normalized.buyer.name,
          taxId: normalized.seller.vatId ?? normalized.seller.taxNumber ?? null,
          netAmount: normalized.totals.netAmount,
          taxAmount: normalized.totals.vatAmount,
          grossAmount: normalized.totals.grossAmount,
          rawJson: toPrismaJson({
            ...rawJsonBase,
            reviewData: normalized,
            vatValidation,
            reviewValidatedAt: new Date().toISOString(),
          }),
          status:
            existingInvoice.status === 'EXPORTED' ? 'EXPORTED' : 'VALIDATED',
        },
        select: {
          id: true,
          number: true,
          issueDate: true,
          grossAmount: true,
          currency: true,
          supplierName: true,
          taxId: true,
          status: true,
        },
      });
    } catch (error) {
      if (
        isPrismaUniqueConstraintError(error, ['organizationId', 'number']) ||
        isPrismaUniqueConstraintError(error, ['Invoice_organizationId_number_key'])
      ) {
        logger.warn(
          { invoiceId, organizationId, number: normalized.header.invoiceNumber },
          'Duplicate invoice number rejected during manual review update'
        );
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'DUPLICATE_INVOICE_NUMBER',
              message:
                'Eine Rechnung mit dieser Rechnungsnummer existiert bereits in dieser Organisation.',
            },
          },
          { status: 409 }
        );
      }

      throw error;
    }

    return NextResponse.json({
      success: true,
      invoice: mapInvoiceForDetailsResponse(updatedInvoice),
      ...(warnings.length > 0 && { warnings }),
    });
  } catch (error) {
    if (error instanceof ApiError) return error.toResponse();
    logger.error({ error }, 'Failed to update invoice');
    return ApiError.internal().toResponse();
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  try {
    await getMyOrganizationIdOrThrow();
    const { invoiceId } = await params;

    return NextResponse.json({
      success: true,
      message: `Delete invoice ${invoiceId} - coming soon`,
    });
  } catch (error) {
    if (error instanceof ApiError) return error.toResponse();
    logger.error({ error }, 'Failed to delete invoice');
    return ApiError.internal().toResponse();
  }
}
