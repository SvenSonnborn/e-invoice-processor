/**
 * Export Service
 *
 * Shared business logic for generating export files.
 * Used by both the API route and server actions to avoid duplication.
 */

import { prisma } from '@/src/lib/db/client';
import {
  createExport,
  markAsGenerating,
  markAsReady,
  markAsFailed,
} from '@/src/lib/exports/processor';
import { sanitizeExportFilename } from '@/src/lib/exports/filename';
import { csv, datev } from '@/src/server/exporters';
import { storage } from '@/src/lib/storage';
import { logger } from '@/src/lib/logging';
import {
  generateXRechnung,
  type XRechnungGeneratorInput,
} from '@/src/lib/generators/xrechnungGenerator';
import { generateZugferdPDF } from '@/src/lib/generators/zugferdGenerator';
import {
  invoiceReviewSchema,
  normalizeInvoiceReviewPayload,
  type InvoiceReviewFormValues,
} from '@/src/lib/validators/invoice-review';
import type { DatevExportOptions } from '@/src/server/exporters/datev';
import type { Invoice as AppInvoice } from '@/src/types';
import {
  formatValidationErrorMessage,
  validateXRechnungExport,
  validateZugferdExport,
  type EInvoiceValidationFormat,
  type EInvoiceValidationIssue,
} from './einvoice-validation';

export type SupportedExportFormat = 'CSV' | 'DATEV' | 'XRECHNUNG' | 'ZUGFERD';

export interface CreateExportInput {
  organizationId: string;
  userId: string;
  format: SupportedExportFormat;
  invoiceIds: string[];
  filename?: string;
  datevOptions?: DatevExportOptions;
}

export interface ExportResult {
  id: string;
  format: string;
  filename: string;
  status: string;
  invoiceCount: number;
  storageKey: string;
}

/**
 * Generate an export filename based on format and options
 */
export function generateExportFilename(
  format: SupportedExportFormat,
  datevOptions?: DatevExportOptions,
  invoiceNumber?: string
): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const invoiceSegment = sanitizeFilenameSegment(
    invoiceNumber || `invoice_${timestamp}`
  );

  switch (format) {
    case 'DATEV':
      return datev.generateDatevFilename(datevOptions ?? {}, 'csv');
    case 'XRECHNUNG':
      return `${invoiceSegment}-xrechnung.xml`;
    case 'ZUGFERD':
      return `${invoiceSegment}-zugferd.pdf`;
    case 'CSV':
    default:
      return `invoices_export_${timestamp}.csv`;
  }
}

/**
 * Create and generate an export file.
 *
 * Handles the full lifecycle:
 * 1. Verify invoices belong to the organization
 * 2. Create export record (CREATED)
 * 3. Generate file content (GENERATING)
 * 4. Upload to storage
 * 5. Mark as READY
 *
 * @returns The export result with id, filename, storageKey etc.
 * @throws Error if invoices not found, validation fails, or generation fails
 */
export async function generateExport(
  input: CreateExportInput
): Promise<ExportResult> {
  const { organizationId, userId, format, invoiceIds, datevOptions } = input;

  // Verify all invoices belong to this organization
  const invoices = await prisma.invoice.findMany({
    where: {
      id: { in: invoiceIds },
      organizationId,
    },
    include: {
      lineItems: true,
    },
  });

  if (invoices.length !== invoiceIds.length) {
    throw new Error('Some invoices not found or not accessible');
  }

  if (
    (format === 'XRECHNUNG' || format === 'ZUGFERD') &&
    invoices.length !== 1
  ) {
    throw new Error(
      `${format} export currently supports exactly one invoice per export job.`
    );
  }

  const finalFilename =
    sanitizeExportFilename(
      input.filename ??
        generateExportFilename(
          format,
          datevOptions,
          invoices[0]?.number || undefined
        ),
      format
    );

  // Create export record
  const exportRecord = await createExport(
    {
      organizationId,
      format,
      filename: finalFilename,
      invoiceIds,
    },
    userId
  );

  // Generate export file
  try {
    await markAsGenerating(exportRecord.id);

    let fileContent: Buffer;
    let contentType: string;

    switch (format) {
      case 'DATEV':
        // Validate DATEV options
        if (datevOptions) {
          const validationErrors = datev.validateDatevOptions(datevOptions);
          if (validationErrors.length > 0) {
            throw new Error(
              `DATEV validation failed: ${validationErrors.join(', ')}`
            );
          }
        }

        // Convert all invoices to a single DATEV CSV
        fileContent = Buffer.from(
          datev.invoicesToDatevCsvFromInvoices(invoices, datevOptions),
          'utf-8'
        );
        contentType = 'text/csv; charset=utf-8';
        break;

      case 'XRECHNUNG': {
        const invoice = invoices[0] as XRechnungGeneratorInput;
        const generated = await generateXRechnung(invoice);
        const validation = await validateXRechnungExport({
          xml: generated.xml,
          builtinValidation: generated.validation,
        });

        if (!validation.valid) {
          throw new Error(
            formatValidationErrorMessage('XRECHNUNG', validation)
          );
        }

        logValidationWarnings({
          exportId: exportRecord.id,
          format: 'XRECHNUNG',
          issues: validation.issues,
        });

        fileContent = Buffer.from(generated.xml, 'utf-8');
        contentType = 'application/xml; charset=utf-8';
        break;
      }

      case 'ZUGFERD': {
        const invoice = invoices[0] as XRechnungGeneratorInput;
        const reviewData = getValidatedReviewData(invoice.rawJson);
        const generatedXml = await generateXRechnung(invoice);

        const xmlValidation = await validateXRechnungExport({
          xml: generatedXml.xml,
          builtinValidation: generatedXml.validation,
        });
        if (!xmlValidation.valid) {
          throw new Error(
            formatValidationErrorMessage('XRECHNUNG', xmlValidation)
          );
        }

        const generatedPdf = await generateZugferdPDF({
          validatedInvoice: reviewData,
          xrechnungXml: generatedXml.xml,
          outputBaseFilename: finalFilename,
        });
        const validation = await validateZugferdExport({
          pdf: generatedPdf.pdf,
          xrechnungXml: generatedXml.xml,
        });

        if (!validation.valid) {
          throw new Error(formatValidationErrorMessage('ZUGFERD', validation));
        }

        logValidationWarnings({
          exportId: exportRecord.id,
          format: 'ZUGFERD',
          issues: [...xmlValidation.issues, ...validation.issues],
        });

        fileContent = Buffer.from(generatedPdf.pdf);
        contentType = 'application/pdf';
        break;
      }

      case 'CSV':
      default: {
        // The CSV exporter uses the app-level Invoice type (with nested objects)
        // while Prisma returns flat fields. Adapt the shape here.
        const appInvoices: AppInvoice[] = invoices.map((inv) => ({
          id: inv.id,
          format: (inv.format ?? 'UNKNOWN') as AppInvoice['format'],
          number: inv.number ?? undefined,
          supplier: inv.supplierName ? { name: inv.supplierName } : undefined,
          customer: inv.customerName ? { name: inv.customerName } : undefined,
          issueDate: inv.issueDate
            ? inv.issueDate.toISOString().slice(0, 10)
            : undefined,
          dueDate: inv.dueDate
            ? inv.dueDate.toISOString().slice(0, 10)
            : undefined,
          totals: {
            currency: inv.currency ?? 'EUR',
            netAmount: inv.netAmount ? String(inv.netAmount) : undefined,
            taxAmount: inv.taxAmount ? String(inv.taxAmount) : undefined,
            grossAmount: inv.grossAmount ? String(inv.grossAmount) : undefined,
          },
        }));
        fileContent = Buffer.from(csv.invoicesToCsv(appInvoices), 'utf-8');
        contentType = 'text/csv; charset=utf-8';
        break;
      }
    }

    // Upload to storage
    const storageKey = `exports/${exportRecord.id}/${finalFilename}`;

    await storage.upload(storageKey, fileContent, {
      contentType,
      metadata: {
        exportId: exportRecord.id,
        format,
        invoiceCount: String(invoices.length),
      },
    });

    // Mark as ready
    await markAsReady(exportRecord.id, storageKey);

    return {
      id: exportRecord.id,
      format,
      filename: finalFilename,
      status: 'READY',
      invoiceCount: invoices.length,
      storageKey,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    logger.error(
      {
        error,
        exportId: exportRecord.id,
        format,
        organizationId,
      },
      'Export generation failed'
    );
    await markAsFailed(exportRecord.id, errorMessage);
    throw error;
  }
}

function sanitizeFilenameSegment(value: string): string {
  const cleaned = value
    .trim()
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  return cleaned || 'invoice';
}

function getValidatedReviewData(rawJson: unknown): InvoiceReviewFormValues {
  const root = asRecord(rawJson);
  const reviewData = asRecord(root?.reviewData);

  if (!reviewData) {
    throw new Error(
      'ZUGFERD export requires reviewed invoice data. Please validate the invoice in the review form first.'
    );
  }

  const parsed = invoiceReviewSchema.safeParse(reviewData);
  if (!parsed.success) {
    throw new Error(
      'ZUGFERD export requires complete review data. Please re-open and save the invoice review form.'
    );
  }

  return normalizeInvoiceReviewPayload(parsed.data);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function logValidationWarnings(input: {
  exportId: string;
  format: EInvoiceValidationFormat;
  issues: EInvoiceValidationIssue[];
}): void {
  const warnings = input.issues.filter((issue) => issue.severity === 'warning');
  if (warnings.length === 0) {
    return;
  }

  logger.warn(
    {
      exportId: input.exportId,
      format: input.format,
      warnings: warnings.map((warning) => ({
        source: warning.source,
        message: warning.message,
      })),
    },
    'E-invoice validation completed with warnings'
  );
}
