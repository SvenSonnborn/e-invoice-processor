/**
 * Exports API Route
 * Handles invoice exports in various formats (CSV, DATEV)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/src/lib/db/client';
import { getMyOrganizationIdOrThrow } from '@/src/lib/auth/session';
import { generateExport } from '@/src/server/services/export-service';
import { canCreateExport } from '@/src/lib/stripe/service';
import { ApiError } from '@/src/lib/errors/api-error';
import { logger } from '@/src/lib/logging';
import type { ExportStatus } from '@/src/generated/prisma/client';

const exportRequestSchema = z.object({
  format: z.enum(['CSV', 'DATEV']),
  invoiceIds: z.array(z.string()).min(1),
  filename: z.string().optional(),
  datevOptions: z
    .object({
      consultantNumber: z.string().optional(),
      clientNumber: z.string().optional(),
      fiscalYearStart: z.string().optional(),
      defaultExpenseAccount: z.string().optional(),
      defaultRevenueAccount: z.string().optional(),
      defaultContraAccount: z.string().optional(),
      batchName: z.string().optional(),
    })
    .optional(),
});

export type ExportRequest = z.infer<typeof exportRequestSchema>;

/**
 * GET /api/exports
 * List exports for the current organization
 */
export async function GET(request: NextRequest) {
  try {
    const { organizationId } = await getMyOrganizationIdOrThrow();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as string | undefined;
    const limit = parseInt(searchParams.get('limit') ?? '50');
    const offset = parseInt(searchParams.get('offset') ?? '0');

    const exports = await prisma.export.findMany({
      where: {
        organizationId,
        ...(status && { status: status as ExportStatus }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        invoices: {
          include: {
            invoice: {
              select: {
                id: true,
                number: true,
                supplierName: true,
                customerName: true,
                grossAmount: true,
                issueDate: true,
              },
            },
          },
        },
        creator: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return NextResponse.json({ success: true, exports });
  } catch (error) {
    if (error instanceof ApiError) return error.toResponse();
    logger.error({ error }, 'Failed to fetch exports');
    return ApiError.internal('Failed to fetch exports').toResponse();
  }
}

/**
 * POST /api/exports
 * Create a new export and generate the file
 */
export async function POST(request: NextRequest) {
  try {
    const { user, organizationId } = await getMyOrganizationIdOrThrow();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw ApiError.validationError('Invalid JSON body');
    }
    const validationResult = exportRequestSchema.safeParse(body);

    if (!validationResult.success) {
      throw ApiError.validationError('Invalid request', {
        issues: validationResult.error.format(),
      });
    }

    const { format, invoiceIds, filename, datevOptions } =
      validationResult.data;

    const exportCheck = await canCreateExport(user.id);
    if (!exportCheck.allowed) {
      throw ApiError.forbidden(exportCheck.reason ?? 'Export limit reached');
    }

    const result = await generateExport({
      organizationId,
      userId: user.id,
      format,
      invoiceIds,
      filename,
      datevOptions,
    });

    return NextResponse.json(
      { success: true, export: result },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ApiError) return error.toResponse();
    logger.error({ error }, 'Failed to create export');
    return ApiError.internal('Failed to create export').toResponse();
  }
}
