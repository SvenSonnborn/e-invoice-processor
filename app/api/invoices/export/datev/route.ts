/**
 * DATEV Export API Route
 * POST /api/invoices/export/datev
 *
 * Exports selected invoices to DATEV CSV format
 */

import { prisma } from '@/src/lib/db/client';
import {
  formatInvoicesForDatev,
  type DatevExportConfig,
  type DatevInvoice,
  type DatevInvoiceMapping,
} from '@/src/lib/export/datev';
import { NextRequest, NextResponse } from 'next/server';
import { getMyOrganizationIdOrThrow } from '@/src/lib/auth/session';
import { ApiError } from '@/src/lib/errors/api-error';
import { logger } from '@/src/lib/logging';

interface ExportRequestBody {
  invoiceIds: string[];
  config?: Partial<DatevExportConfig>;
  mapping?: Partial<DatevInvoiceMapping>;
  options?: {
    format?: 'standard' | 'extended';
    detailed?: boolean;
    filename?: string;
  };
}

function convertToDatevInvoice(
  invoice: Awaited<ReturnType<typeof prisma.invoice.findUnique>>,
  lineItems: Awaited<ReturnType<typeof prisma.invoiceLineItem.findMany>>
): DatevInvoice | null {
  if (!invoice) return null;

  const isIncoming =
    invoice.supplierName !== null && invoice.supplierName !== '';

  return {
    id: invoice.id,
    number: invoice.number || undefined,
    supplierName: invoice.supplierName || undefined,
    customerName: invoice.customerName || undefined,
    issueDate: invoice.issueDate || new Date(),
    dueDate: invoice.dueDate || undefined,
    currency: invoice.currency || 'EUR',
    netAmount: Number(invoice.netAmount) || 0,
    taxAmount: Number(invoice.taxAmount) || 0,
    grossAmount: Number(invoice.grossAmount) || 0,
    taxRate: 19,
    isIncoming,
    lineItems: lineItems.map((item) => ({
      description: item.description || '',
      netAmount: Number(item.netAmount) || 0,
      taxAmount: Number(item.taxAmount) || 0,
      grossAmount: Number(item.grossAmount) || 0,
      taxRate: Number(item.taxRate) || 19,
    })),
  };
}

/**
 * POST handler - Generate DATEV export
 */
export async function POST(request: NextRequest) {
  try {
    const { organizationId } = await getMyOrganizationIdOrThrow();

    let body: ExportRequestBody;
    try {
      body = await request.json();
    } catch {
      throw ApiError.validationError('Invalid JSON body');
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw ApiError.validationError('Request body must be a JSON object');
    }

    if (
      !body.invoiceIds ||
      !Array.isArray(body.invoiceIds) ||
      body.invoiceIds.length === 0
    ) {
      throw ApiError.validationError(
        'Mindestens eine Rechnungs-ID ist erforderlich'
      );
    }

    const invoices = await prisma.invoice.findMany({
      where: { id: { in: body.invoiceIds }, organizationId },
      include: { lineItems: true },
    });

    const validInvoices = invoices
      .map((inv) => convertToDatevInvoice(inv, inv.lineItems))
      .filter((inv): inv is DatevInvoice => inv !== null);

    if (validInvoices.length === 0) {
      throw ApiError.notFound('Keine gültigen Rechnungen gefunden');
    }

    const exportConfig: DatevExportConfig = {
      encoding: 'UTF-8',
      beraterNummer: body.config?.beraterNummer,
      mandantenNummer: body.config?.mandantenNummer,
      wirtschaftsjahrBeginn: body.config?.wirtschaftsjahrBeginn,
      sachkontenrahmen: body.config?.sachkontenrahmen,
      bezeichnung: body.config?.bezeichnung,
      datumVon: body.config?.datumVon,
      datumBis: body.config?.datumBis,
    };

    const mapping: DatevInvoiceMapping = {
      kontoEingangsrechnung: body.mapping?.kontoEingangsrechnung || '4400',
      kontoAusgangsrechnung: body.mapping?.kontoAusgangsrechnung || '1200',
      gegenkontoBank: body.mapping?.gegenkontoBank || '1200',
      steuerschluesselStandard: body.mapping?.steuerschluesselStandard || '9',
      steuerschluesselErmäßigt: body.mapping?.steuerschluesselErmäßigt || '8',
      steuerschluesselSteuerfrei:
        body.mapping?.steuerschluesselSteuerfrei || '0',
      defaultKostenstelle: body.mapping?.defaultKostenstelle,
      defaultKostenträger: body.mapping?.defaultKostenträger,
    };

    const result = formatInvoicesForDatev(validInvoices, {
      format: body.options?.format || 'standard',
      detailed: body.options?.detailed || false,
      config: exportConfig,
      mapping,
      filename: body.options?.filename,
    });

    if (!result.success) {
      throw ApiError.validationError('Export fehlgeschlagen', {
        errors: result.errors,
      });
    }

    return NextResponse.json({
      success: true,
      filename: result.filename,
      entryCount: result.entryCount,
      totalAmount: result.totalAmount,
      invoiceCount: validInvoices.length,
      csv: result.csv,
    });
  } catch (error) {
    if (error instanceof ApiError) return error.toResponse();
    logger.error({ error }, 'DATEV export failed');
    return ApiError.internal('Interner Serverfehler').toResponse();
  }
}

/**
 * GET handler - Get export preview/info
 */
export async function GET(request: NextRequest) {
  try {
    const { organizationId } = await getMyOrganizationIdOrThrow();

    const { searchParams } = new URL(request.url);
    const invoiceIds = searchParams.getAll('invoiceId');

    if (invoiceIds.length === 0) {
      throw ApiError.validationError(
        'Mindestens eine Rechnungs-ID ist erforderlich'
      );
    }

    const invoices = await prisma.invoice.findMany({
      where: { id: { in: invoiceIds }, organizationId },
      include: { lineItems: true },
    });

    const validInvoices = invoices
      .filter((inv): inv is NonNullable<typeof inv> => inv !== null)
      .map((inv) => convertToDatevInvoice(inv, inv.lineItems))
      .filter((inv): inv is DatevInvoice => inv !== null);

    if (validInvoices.length === 0) {
      throw ApiError.notFound('Keine gültigen Rechnungen gefunden');
    }

    const { previewExport, getExportSummary } =
      await import('@/src/lib/export/datev');

    const preview = previewExport(validInvoices);
    const summary = getExportSummary(validInvoices);

    return NextResponse.json({ success: true, preview, summary });
  } catch (error) {
    if (error instanceof ApiError) return error.toResponse();
    logger.error({ error }, 'DATEV preview failed');
    return ApiError.internal('Interner Serverfehler').toResponse();
  }
}
