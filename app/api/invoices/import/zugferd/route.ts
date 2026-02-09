import { NextRequest, NextResponse } from 'next/server';
import { parseInvoice, parseInvoiceFromPDF, parseInvoiceFromXML } from '@/src/lib/zugferd/parser';

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
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ success: false, error: 'File too large' }, { status: 400 });
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await parseInvoice(buffer, file.type);
    if (!result.success) return NextResponse.json({ success: false, errors: result.errors, warnings: result.warnings, detection: result.detection }, { status: 400 });
    return NextResponse.json({ success: true, invoice: result.invoice, extendedData: result.extendedData, rawData: result.rawData, validation: result.validation, detection: result.detection, warnings: result.warnings });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'File upload failed', details: String(error) }, { status: 400 });
  }
}

async function handleJSONBody(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
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
