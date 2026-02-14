import { prisma } from '@/src/lib/db/client';
import { storage } from '@/src/lib/storage';
import { logger } from '@/src/lib/logging';
import { markAsExported } from '@/src/lib/invoices/processor';
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
import {
  formatValidationErrorMessage,
  validateXRechnungExport,
  validateZugferdExport,
  type EInvoiceValidationFormat,
  type EInvoiceValidationIssue,
} from './einvoice-validation';

export type InvoiceExportFormat = 'xrechnung' | 'zugferd';

export interface GenerateInvoiceExportInput {
  organizationId: string;
  invoiceId: string;
  format: InvoiceExportFormat;
}

export interface GenerateInvoiceExportResult {
  filename: string;
  contentType: string;
  fileBuffer: Buffer;
  storageKey: string;
}

export type InvoiceExportServiceErrorCode =
  | 'NOT_FOUND'
  | 'INVALID_STATE'
  | 'MISSING_REVIEW_DATA'
  | 'VALIDATION_FAILED'
  | 'GENERATION_FAILED';

export class InvoiceExportServiceError extends Error {
  constructor(
    public readonly code: InvoiceExportServiceErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'InvoiceExportServiceError';
  }
}

export async function generateInvoiceExport(
  input: GenerateInvoiceExportInput
): Promise<GenerateInvoiceExportResult> {
  const invoice = await prisma.invoice.findFirst({
    where: {
      id: input.invoiceId,
      organizationId: input.organizationId,
    },
    include: {
      lineItems: true,
    },
  });

  if (!invoice) {
    throw new InvoiceExportServiceError('NOT_FOUND', 'Invoice not found');
  }

  if (invoice.status !== 'VALIDATED' && invoice.status !== 'EXPORTED') {
    throw new InvoiceExportServiceError(
      'INVALID_STATE',
      'Invoice must be in VALIDATED or EXPORTED status before export.'
    );
  }

  const filenameBase = sanitizeFilenameSegment(invoice.number || invoice.id);

  try {
    const generated = await generateFileForFormat({
      invoice: invoice as XRechnungGeneratorInput,
      format: input.format,
      filenameBase,
    });

    const storageKey = buildStorageKey({
      organizationId: input.organizationId,
      invoiceId: invoice.id,
      filename: generated.filename,
    });

    await storage.upload(storageKey, generated.fileBuffer, {
      contentType: generated.contentType,
      metadata: {
        invoiceId: invoice.id,
        organizationId: input.organizationId,
        format: input.format.toUpperCase(),
      },
    });

    if (invoice.status !== 'EXPORTED') {
      await markAsExported(invoice.id);
    }

    return {
      ...generated,
      storageKey,
    };
  } catch (error) {
    if (error instanceof InvoiceExportServiceError) {
      throw error;
    }

    logger.error(
      {
        error,
        invoiceId: invoice.id,
        organizationId: input.organizationId,
        format: input.format,
      },
      'Failed to generate invoice export'
    );

    throw new InvoiceExportServiceError(
      'GENERATION_FAILED',
      error instanceof Error
        ? error.message
        : 'Unknown error while generating invoice export.'
    );
  }
}

async function generateFileForFormat(input: {
  invoice: XRechnungGeneratorInput;
  format: InvoiceExportFormat;
  filenameBase: string;
}): Promise<Omit<GenerateInvoiceExportResult, 'storageKey'>> {
  if (input.format === 'xrechnung') {
    const generatedXml = await generateXRechnung(input.invoice);
    const validation = await validateXRechnungExport({
      xml: generatedXml.xml,
      builtinValidation: generatedXml.validation,
    });

    if (!validation.valid) {
      throw new InvoiceExportServiceError(
        'VALIDATION_FAILED',
        formatValidationErrorMessage('XRECHNUNG', validation)
      );
    }

    logValidationWarnings({
      format: 'XRECHNUNG',
      invoiceId: input.invoice.id,
      issues: validation.issues,
    });

    return {
      filename: `${input.filenameBase}-xrechnung.xml`,
      contentType: 'application/xml; charset=utf-8',
      fileBuffer: Buffer.from(generatedXml.xml, 'utf-8'),
    };
  }

  const reviewData = getValidatedReviewData(input.invoice.rawJson);
  const generatedXml = await generateXRechnung(input.invoice);
  const xmlValidation = await validateXRechnungExport({
    xml: generatedXml.xml,
    builtinValidation: generatedXml.validation,
  });

  if (!xmlValidation.valid) {
    throw new InvoiceExportServiceError(
      'VALIDATION_FAILED',
      formatValidationErrorMessage('XRECHNUNG', xmlValidation)
    );
  }

  const generatedPdf = await generateZugferdPDF({
    validatedInvoice: reviewData,
    xrechnungXml: generatedXml.xml,
    outputBaseFilename: input.filenameBase,
  });

  const pdfValidation = await validateZugferdExport({
    pdf: generatedPdf.pdf,
    xrechnungXml: generatedXml.xml,
  });

  if (!pdfValidation.valid) {
    throw new InvoiceExportServiceError(
      'VALIDATION_FAILED',
      formatValidationErrorMessage('ZUGFERD', pdfValidation)
    );
  }

  logValidationWarnings({
    format: 'ZUGFERD',
    invoiceId: input.invoice.id,
    issues: [...xmlValidation.issues, ...pdfValidation.issues],
  });

  return {
    filename: generatedPdf.filename,
    contentType: 'application/pdf',
    fileBuffer: Buffer.from(generatedPdf.pdf),
  };
}

function getValidatedReviewData(rawJson: unknown): InvoiceReviewFormValues {
  const root = asRecord(rawJson);
  const reviewData = asRecord(root?.reviewData);

  if (!reviewData) {
    throw new InvoiceExportServiceError(
      'MISSING_REVIEW_DATA',
      'ZUGFeRD export requires review data. Please validate the invoice first.'
    );
  }

  const parsed = invoiceReviewSchema.safeParse(reviewData);
  if (!parsed.success) {
    throw new InvoiceExportServiceError(
      'MISSING_REVIEW_DATA',
      'ZUGFeRD export requires complete review data.'
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

function buildStorageKey(input: {
  organizationId: string;
  invoiceId: string;
  filename: string;
}): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `invoices/exports/${input.organizationId}/${input.invoiceId}/${timestamp}-${input.filename}`;
}

function sanitizeFilenameSegment(value: string): string {
  const cleaned = value
    .trim()
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  return cleaned || 'invoice';
}

function logValidationWarnings(input: {
  format: EInvoiceValidationFormat;
  invoiceId: string;
  issues: EInvoiceValidationIssue[];
}): void {
  const warnings = input.issues.filter((issue) => issue.severity === 'warning');
  if (warnings.length === 0) {
    return;
  }

  logger.warn(
    {
      invoiceId: input.invoiceId,
      format: input.format,
      warnings: warnings.map((warning) => ({
        source: warning.source,
        message: warning.message,
      })),
    },
    'Invoice export validation completed with warnings'
  );
}
