import { NextRequest, NextResponse } from 'next/server';
import {
  parseInvoice,
  parseInvoiceFromPDF,
  parseInvoiceFromXML,
  parseInvoicesBatch,
} from '@/src/lib/zugferd/parser';
import { getMyOrganizationIdOrThrow } from '@/src/lib/auth/session';
import { ApiError } from '@/src/lib/errors/api-error';
import { logger } from '@/src/lib/logging';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_BATCH_FILES = 50;

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    await getMyOrganizationIdOrThrow();

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data'))
      return await handleFileUpload(request);
    if (contentType.includes('application/json'))
      return await handleJSONBody(request);

    throw ApiError.validationError('Unsupported content type');
  } catch (error) {
    if (error instanceof ApiError) return error.toResponse();
    logger.error({ error }, 'ZUGFeRD import failed');
    return ApiError.internal('Internal server error').toResponse();
  }
}

async function handleFileUpload(request: NextRequest): Promise<NextResponse> {
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
    return NextResponse.json({
      success: true,
      invoice: result.invoice,
      extendedData: result.extendedData,
      rawData: result.rawData,
      validation: result.validation,
      detection: result.detection,
      warnings: result.warnings,
      filename,
    });
  }

  const results = await parseInvoicesBatch(
    items.map(({ buffer, filename }) => ({ buffer, filename })),
    { concurrency: 5 }
  );
  const allSuccess = results.every((r) => r.success);
  return NextResponse.json(
    {
      success: allSuccess,
      batch: true,
      results: results.map((r) => ({
        success: r.success,
        filename: r.filename,
        invoice: r.invoice,
        extendedData: r.extendedData,
        rawData: r.rawData,
        validation: r.validation,
        detection: r.detection,
        errors: r.errors,
        warnings: r.warnings,
      })),
    },
    { status: allSuccess ? 200 : 207 }
  );
}

async function handleJSONBody(request: NextRequest): Promise<NextResponse> {
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
    const allSuccess = results.every((r) => r.success);
    return NextResponse.json(
      {
        success: allSuccess,
        batch: true,
        results: results.map((r) => ({
          success: r.success,
          filename: r.filename,
          invoice: r.invoice,
          extendedData: r.extendedData,
          rawData: r.rawData,
          validation: r.validation,
          detection: r.detection,
          errors: r.errors,
          warnings: r.warnings,
        })),
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

  return NextResponse.json({
    success: true,
    invoice: result.invoice,
    extendedData: result.extendedData,
    rawData: result.rawData,
    validation: result.validation,
    detection: result.detection,
    warnings: result.warnings,
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
