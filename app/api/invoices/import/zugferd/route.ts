import { NextRequest, NextResponse } from 'next/server';
import { parseInvoice, parseInvoiceFromPDF, parseInvoiceFromXML, parseInvoicesBatch } from '@/src/lib/zugferd/parser';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_BATCH_FILES = 50;

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) return handleFileUpload(request);
    if (contentType.includes('application/json')) return handleJSONBody(request);
    return NextResponse.json({ success: false, error: 'Unsupported content type' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Internal server error', details: String(error) }, { status: 500 });
  }
}

async function handleFileUpload(request: NextRequest): Promise<NextResponse> {
  try {
    const formData = await request.formData();
    const files = formData.getAll('file').filter((f): f is File => f instanceof File);
    if (files.length === 0) return NextResponse.json({ success: false, error: 'No file(s) provided. Use form field "file" (single or multiple).' }, { status: 400 });
    if (files.length > MAX_BATCH_FILES) return NextResponse.json({ success: false, error: `Too many files. Maximum ${MAX_BATCH_FILES} per request.` }, { status: 400 });
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) return NextResponse.json({ success: false, error: `File "${file.name}" too large. Maximum ${MAX_FILE_SIZE / 1024 / 1024} MB.` }, { status: 400 });
    }
    const items = await Promise.all(
      files.map(async (file) => ({ buffer: Buffer.from(await file.arrayBuffer()), filename: file.name, mimeType: file.type }))
    );
    if (items.length === 1) {
      const { buffer, filename, mimeType } = items[0];
      const result = await parseInvoice(buffer, mimeType);
      if (!result.success) return NextResponse.json({ success: false, errors: result.errors, warnings: result.warnings, detection: result.detection }, { status: 400 });
      return NextResponse.json({ success: true, invoice: result.invoice, extendedData: result.extendedData, rawData: result.rawData, validation: result.validation, detection: result.detection, warnings: result.warnings, filename });
    }
    const results = await parseInvoicesBatch(
      items.map(({ buffer, filename }) => ({ buffer, filename })),
      { concurrency: 5 }
    );
    const allSuccess = results.every((r) => r.success);
    return NextResponse.json(
      { success: allSuccess, batch: true, results: results.map((r) => ({ success: r.success, filename: r.filename, invoice: r.invoice, extendedData: r.extendedData, rawData: r.rawData, validation: r.validation, detection: r.detection, errors: r.errors, warnings: r.warnings })) },
      { status: allSuccess ? 200 : 207 }
    );
  } catch (error) {
    return NextResponse.json({ success: false, error: 'File upload failed', details: String(error) }, { status: 400 });
  }
}

async function handleJSONBody(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const invoices = body.invoices;
    if (Array.isArray(invoices)) {
      if (invoices.length === 0) return NextResponse.json({ success: false, error: 'Empty "invoices" array' }, { status: 400 });
      if (invoices.length > MAX_BATCH_FILES) return NextResponse.json({ success: false, error: `Too many items. Maximum ${MAX_BATCH_FILES} per request.` }, { status: 400 });
      const items: Array<{ buffer: Buffer; filename: string }> = [];
      for (let index = 0; index < invoices.length; index++) {
        const item = invoices[index];
        if (!item || typeof item.xml !== 'string') throw new Error(`invoices[${index}]: missing or invalid "xml" field`);
        const buffer = item.format === 'pdf' ? Buffer.from(item.xml, 'base64') : Buffer.from(item.xml, 'utf-8');
        items.push({ buffer, filename: item.format === 'pdf' ? `item-${index}.pdf` : `item-${index}.xml` });
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
    if (!xml || typeof xml !== 'string') return NextResponse.json({ success: false, error: 'Missing or invalid "xml" field' }, { status: 400 });
    let result;
    if (format === 'pdf') result = await parseInvoiceFromPDF(Buffer.from(xml, 'base64'));
    else result = await parseInvoiceFromXML(xml);
    if (!result.success) return NextResponse.json({ success: false, errors: result.errors, warnings: result.warnings, detection: result.detection }, { status: 400 });
    return NextResponse.json({ success: true, invoice: result.invoice, extendedData: result.extendedData, rawData: result.rawData, validation: result.validation, detection: result.detection, warnings: result.warnings });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Invalid JSON body', details: String(error) }, { status: 400 });
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ name: 'ZUGFeRD/XRechnung Import API', version: '1.0.0', supportedFormats: ['ZUGFeRD 2.3', 'XRechnung CII', 'XRechnung UBL', 'Factur-X'] });
}
