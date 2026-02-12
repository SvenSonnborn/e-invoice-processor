'use server';

/**
 * Export Server Actions
 *
 * Server actions for creating exports, fetching export history,
 * and loading invoices for the export selector.
 */

import { prisma } from '@/src/lib/db/client';
import { getCurrentUser } from '@/src/lib/auth/session';
import { generateExport } from '@/src/server/services/export-service';
import { canCreateExport } from '@/src/lib/stripe/service';
import type { DatevExportOptions } from '@/src/server/exporters/datev';

// ---------------------------------------------------------------------------
// Helper: get the current user's organization membership
// ---------------------------------------------------------------------------
async function requireOrgMembership() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Unauthorized');
  }

  const membership = await prisma.organizationMember.findFirst({
    where: { userId: user.id },
    select: { organizationId: true },
  });

  if (!membership) {
    throw new Error('No organization found');
  }

  return { user, organizationId: membership.organizationId };
}

// ---------------------------------------------------------------------------
// createExportAction
// ---------------------------------------------------------------------------

export interface CreateExportActionInput {
  format: 'CSV' | 'DATEV';
  invoiceIds: string[];
  filename?: string;
  datevOptions?: DatevExportOptions;
}

export interface CreateExportActionResult {
  success: true;
  export: {
    id: string;
    format: string;
    filename: string;
    status: string;
    invoiceCount: number;
  };
}

export interface ActionError {
  success: false;
  error: string;
}

/**
 * Create a new export and generate the file.
 */
export async function createExportAction(
  input: CreateExportActionInput
): Promise<CreateExportActionResult | ActionError> {
  try {
    const { user, organizationId } = await requireOrgMembership();

    // Check subscription limits
    const exportCheck = await canCreateExport(user.id);
    if (!exportCheck.allowed) {
      return {
        success: false,
        error: exportCheck.reason ?? 'Export limit reached',
      };
    }

    const result = await generateExport({
      organizationId,
      userId: user.id,
      format: input.format,
      invoiceIds: input.invoiceIds,
      filename: input.filename,
      datevOptions: input.datevOptions,
    });

    return {
      success: true,
      export: {
        id: result.id,
        format: result.format,
        filename: result.filename,
        status: result.status,
        invoiceCount: result.invoiceCount,
      },
    };
  } catch (error) {
    console.error('Error creating export:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ---------------------------------------------------------------------------
// fetchExportsAction
// ---------------------------------------------------------------------------

export interface ExportListItem {
  id: string;
  format: string;
  filename: string;
  status: string;
  errorMessage: string | null;
  invoiceCount: number;
  creatorName: string | null;
  createdAt: string;
}

/**
 * Fetch past exports for the current organization.
 */
export async function fetchExportsAction(): Promise<ExportListItem[]> {
  try {
    const { organizationId } = await requireOrgMembership();

    const exports = await prisma.export.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        invoices: true,
        creator: {
          select: { name: true, email: true },
        },
      },
    });

    return exports.map((exp) => ({
      id: exp.id,
      format: exp.format,
      filename: exp.filename,
      status: exp.status,
      errorMessage: exp.errorMessage,
      invoiceCount: exp.invoices.length,
      creatorName: exp.creator?.name ?? exp.creator?.email ?? null,
      createdAt: exp.createdAt.toISOString(),
    }));
  } catch (error) {
    console.error('Error fetching exports:', error);
    return [];
  }
}

// ---------------------------------------------------------------------------
// fetchInvoicesAction
// ---------------------------------------------------------------------------

export interface InvoiceListItem {
  id: string;
  number: string | null;
  supplierName: string | null;
  customerName: string | null;
  grossAmount: number | null;
  currency: string | null;
  issueDate: string | null;
  status: string;
}

/**
 * Fetch invoices for the current organization (for the invoice selector).
 */
export async function fetchInvoicesAction(): Promise<InvoiceListItem[]> {
  try {
    const { organizationId } = await requireOrgMembership();

    const invoices = await prisma.invoice.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        number: true,
        supplierName: true,
        customerName: true,
        grossAmount: true,
        currency: true,
        issueDate: true,
        status: true,
      },
    });

    return invoices.map((inv) => ({
      id: inv.id,
      number: inv.number,
      supplierName: inv.supplierName,
      customerName: inv.customerName,
      grossAmount: inv.grossAmount ? Number(inv.grossAmount) : null,
      currency: inv.currency,
      issueDate: inv.issueDate ? inv.issueDate.toISOString() : null,
      status: inv.status,
    }));
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return [];
  }
}
