import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { InvoiceStatus } from '@/src/generated/prisma/client';
import {
  parseInvoice,
  parseInvoiceFromPDF,
  parseInvoiceFromXML,
  parseInvoicesBatch,
  type InvoiceParseResult,
} from '@/src/lib/zugferd/parser';
import { getMyOrganizationIdOrThrow } from '@/src/lib/auth/session';
import { ApiError } from '@/src/lib/errors/api-error';
import { mapInvoiceStatusToApiStatusGroup } from '@/src/lib/invoices/status';
import { logger } from '@/src/lib/logging';
import { persistParsedInvoice } from '@/src/server/services/invoice-import';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_BATCH_FILES = 50;

const saveQuerySchema = z
  .enum(['true', 'false', '1', '0'])
  .optional()
  .transform((value) => value === 'true' || value === '1');

interface ImportRequestContext {
  organizationId: string;
  userId: string;
  saveToDatabase: boolean;
}

interface PersistencePayload {
  saved: true;
  invoiceId: string;
  action: 'created' | 'updated';
  status: InvoiceStatus;
  statusGroup: ReturnType<typeof mapInvoiceStatusToApiStatusGroup>;
  number: string | null;
}

function mapParseResult(
  result: InvoiceParseResult & { filename?: string }
): {
  success: boolean;
  filename?: string;
  invoice?: unknown;
  extendedData?: unknown;
  rawData?: unknown;
  validation: unknown;
  detection: unknown;
  errors: string[];
  warnings: string[];
} {
  return {
    success: result.success,
    filename: result.filename,
    invoice: result.invoice,
    extendedData: result.extendedData,
    rawData: result.rawData,
    validation: result.validation,
    detection: result.detection,
    errors: result.errors,
    warnings: result.warnings,
  };
}

async function persistResultIfNeeded(
  parseResult: InvoiceParseResult,
  ctx: ImportRequestContext,
  source: { mode: 'multipart' | 'json'; filename?: string }
): Promise<PersistencePayload | null> {
  if (!ctx.saveToDatabase) return null;

  const persisted = await persistParsedInvoice({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    parseResult,
    source,
  });

  return {
    saved: true,
    invoiceId: persisted.invoiceId,
    action: persisted.action,
    status: persisted.status,
    statusGroup: mapInvoiceStatusToApiStatusGroup(persisted.status),
    number: persisted.number,
  };
}

type MappedParseResult = ReturnType<typeof mapParseResult> & {
  persistence?: PersistencePayload;
};

async function mapAndPersistBatchResults(
  results: Array<InvoiceParseResult & { filename?: string }>,
  ctx: ImportRequestContext,
  mode: 'multipart' | 'json'
): Promise<{ allSuccess: boolean; mappedResults: MappedParseResult[] }> {
  let allSuccess = true;
  const mappedResults: MappedParseResult[] = [];

  for (const result of results) {
    const mapped = mapParseResult(result);

    if (!result.success) {
      allSuccess = false;
      mappedResults.push(mapped);
      continue;
    }

    if (!ctx.saveToDatabase) {
      mappedResults.push(mapped);
      continue;
    }

    try {
      const persistence = await persistResultIfNeeded(result, ctx, {
        mode,
        filename: result.filename,
      });
      mappedResults.push({
        ...mapped,
        ...(persistence ? { persistence } : {}),
      });
    } catch (error) {
      allSuccess = false;
      logger.error(
        { error, organizationId: ctx.organizationId, filename: result.filename },
        `Failed to persist parsed invoice from ${mode} batch`
      );
      mappedResults.push({
        ...mapped,
        success: false,
        errors: [...mapped.errors, 'Persistence failed'],
      });
    }
  }

  return { allSuccess, mappedResults };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { user, organizationId } = await getMyOrganizationIdOrThrow();
    const saveQuery =
      new URL(request.url).searchParams.get('save') ?? undefined;
    const parsedSave = saveQuerySchema.safeParse(saveQuery);
    if (!parsedSave.success) {
      throw ApiError.validationError(
        'Invalid "save" query parameter. Use true/false or 1/0.'
      );
    }

    const ctx: ImportRequestContext = {
      organizationId,
      userId: user.id,
      saveToDatabase: parsedSave.data,
    };

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data'))
      return await handleFileUpload(request, ctx);
    if (contentType.includes('application/json'))
      return await handleJSONBody(request, ctx);

    throw ApiError.validationError('Unsupported content type');
  } catch (error) {
    if (error instanceof ApiError) return error.toResponse();
    logger.error({ error }, 'ZUGFeRD import failed');
    return ApiError.internal('Internal server error').toResponse();
  }
}

async function handleFileUpload(
  request: NextRequest,
  ctx: ImportRequestContext
): Promise<NextResponse> {
  const formData = await request.formData();
  const files = formData
    .getAll('file')
    .filter((f): f is File => f instanceof File);

  if (files.length === 0) {
    throw ApiError.validationError(
      'No file(s) provided. Use form field "file" (single or multiple).'
    );
  }

  if (files.length > MAX_BATCH_FILES) {
    throw ApiError.validationError(
      `Too many files. Maximum ${MAX_BATCH_FILES} per request.`
    );
  }

  for (const file of files) {
    if (file.size > MAX_FILE_SIZE) {
      throw ApiError.validationError(
        `File "${file.name}" too large. Maximum ${MAX_FILE_SIZE / 1024 / 1024} MB.`
      );
    }
  }

  const items = await Promise.all(
    files.map(async (file) => ({
      buffer: Buffer.from(await file.arrayBuffer()),
      filename: file.name,
      mimeType: file.type,
    }))
  );

  if (items.length === 1) {
    const { buffer, filename, mimeType } = items[0];
    const result = await parseInvoice(buffer, mimeType);
    if (!result.success)
      return NextResponse.json(
        {
          success: false,
          errors: result.errors,
          warnings: result.warnings,
          detection: result.detection,
        },
        { status: 400 }
      );

    let persistence: PersistencePayload | null = null;
    try {
      persistence = await persistResultIfNeeded(result, ctx, {
        mode: 'multipart',
        filename,
      });
    } catch (error) {
      logger.error(
        { error, organizationId: ctx.organizationId, filename },
        'Failed to persist parsed invoice'
      );
      return ApiError.internal('Failed to persist parsed invoice').toResponse();
    }

    return NextResponse.json({
      success: true,
      invoice: result.invoice,
      extendedData: result.extendedData,
      rawData: result.rawData,
      validation: result.validation,
      detection: result.detection,
      warnings: result.warnings,
      filename,
      ...(persistence ? { persistence } : {}),
    });
  }

  const results = await parseInvoicesBatch(
    items.map(({ buffer, filename }) => ({ buffer, filename })),
    { concurrency: 5 }
  );
  const { allSuccess, mappedResults } = await mapAndPersistBatchResults(
    results,
    ctx,
    'multipart'
  );

  return NextResponse.json(
    {
      success: allSuccess,
      batch: true,
      results: mappedResults,
    },
    { status: allSuccess ? 200 : 207 }
  );
}

async function handleJSONBody(
  request: NextRequest,
  ctx: ImportRequestContext
): Promise<NextResponse> {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    throw ApiError.validationError('Invalid JSON body');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw ApiError.validationError('Request body must be a JSON object');
  }
  const invoices = body.invoices;

  if (Array.isArray(invoices)) {
    if (invoices.length === 0) {
      throw ApiError.validationError('Empty "invoices" array');
    }
    if (invoices.length > MAX_BATCH_FILES) {
      throw ApiError.validationError(
        `Too many items. Maximum ${MAX_BATCH_FILES} per request.`
      );
    }

    const items: Array<{ buffer: Buffer; filename: string }> = [];
    for (let index = 0; index < invoices.length; index++) {
      const item = invoices[index];
      if (!item || typeof item.xml !== 'string')
        throw ApiError.validationError(
          `invoices[${index}]: missing or invalid "xml" field`
        );
      const buffer =
        item.format === 'pdf'
          ? Buffer.from(item.xml, 'base64')
          : Buffer.from(item.xml, 'utf-8');
      items.push({
        buffer,
        filename:
          item.format === 'pdf' ? `item-${index}.pdf` : `item-${index}.xml`,
      });
    }

    const results = await parseInvoicesBatch(items, { concurrency: 5 });
    const { allSuccess, mappedResults } = await mapAndPersistBatchResults(
      results,
      ctx,
      'json'
    );

    return NextResponse.json(
      {
        success: allSuccess,
        batch: true,
        results: mappedResults,
      },
      { status: allSuccess ? 200 : 207 }
    );
  }

  const { xml, format } = body;
  if (!xml || typeof xml !== 'string') {
    throw ApiError.validationError('Missing or invalid "xml" field');
  }

  let result;
  if (format === 'pdf')
    result = await parseInvoiceFromPDF(Buffer.from(xml, 'base64'));
  else result = await parseInvoiceFromXML(xml);

  if (!result.success)
    return NextResponse.json(
      {
        success: false,
        errors: result.errors,
        warnings: result.warnings,
        detection: result.detection,
      },
      { status: 400 }
    );

  let persistence: PersistencePayload | null = null;
  try {
    persistence = await persistResultIfNeeded(result, ctx, {
      mode: 'json',
      filename: format === 'pdf' ? 'single.pdf' : 'single.xml',
    });
  } catch (error) {
    logger.error(
      { error, organizationId: ctx.organizationId },
      'Failed to persist parsed invoice'
    );
    return ApiError.internal('Failed to persist parsed invoice').toResponse();
  }

  return NextResponse.json({
    success: true,
    invoice: result.invoice,
    extendedData: result.extendedData,
    rawData: result.rawData,
    validation: result.validation,
    detection: result.detection,
    warnings: result.warnings,
    ...(persistence ? { persistence } : {}),
  });
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    name: 'ZUGFeRD/XRechnung Import API',
    version: '1.0.0',
    supportedFormats: [
      'ZUGFeRD 2.3',
      'XRechnung CII',
      'XRechnung UBL',
      'Factur-X',
    ],
  });
}
