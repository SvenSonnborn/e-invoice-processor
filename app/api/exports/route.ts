/**
 * Exports API Route
 * Handles invoice exports in various formats (CSV, DATEV)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/src/lib/db/client';
import { getCurrentUser } from '@/src/lib/auth/session';
import { generateExport } from '@/src/server/services/export-service';
import { canCreateExport } from '@/src/lib/stripe/service';
import type { ExportStatus } from '@/src/generated/prisma/client';

// Validation schema for export requests
const exportRequestSchema = z.object({
  format: z.enum(['CSV', 'DATEV']),
  invoiceIds: z.array(z.string()).min(1),
  filename: z.string().optional(),
  // DATEV-specific options
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
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's organization
    const membership = await prisma.organizationMember.findFirst({
      where: { userId: user.id },
      include: { organization: true },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'No organization found' },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as string | undefined;
    const limit = parseInt(searchParams.get('limit') ?? '50');
    const offset = parseInt(searchParams.get('offset') ?? '0');

    const exports = await prisma.export.findMany({
      where: {
        organizationId: membership.organizationId,
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

    return NextResponse.json({ exports });
  } catch (error) {
    console.error('Error fetching exports:', error);
    return NextResponse.json(
      { error: 'Failed to fetch exports' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/exports
 * Create a new export and generate the file
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = exportRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validationResult.error.format() },
        { status: 400 }
      );
    }

    const { format, invoiceIds, filename, datevOptions } =
      validationResult.data;

    // Check subscription limits
    const exportCheck = await canCreateExport(user.id);
    if (!exportCheck.allowed) {
      return NextResponse.json(
        { error: exportCheck.reason ?? 'Export limit reached' },
        { status: 403 }
      );
    }

    // Get user's organization
    const membership = await prisma.organizationMember.findFirst({
      where: { userId: user.id },
      select: { organizationId: true },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'No organization found' },
        { status: 404 }
      );
    }

    // Delegate to the shared export service
    const result = await generateExport({
      organizationId: membership.organizationId,
      userId: user.id,
      format,
      invoiceIds,
      filename,
      datevOptions,
    });

    return NextResponse.json({ export: result }, { status: 201 });
  } catch (error) {
    console.error('Error creating export:', error);
    return NextResponse.json(
      { error: 'Failed to create export' },
      { status: 500 }
    );
  }
}
