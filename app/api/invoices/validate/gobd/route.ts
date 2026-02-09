import { NextRequest, NextResponse } from 'next/server';
import { validateGoBDCompliance, formatValidationResult } from '@/lib/gobd';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { invoice, options = {} } = body;
    if (!invoice) return NextResponse.json({ success: false, error: 'Rechnungsdaten erforderlich' }, { status: 400 });
    const result = validateGoBDCompliance(invoice, options);
    return NextResponse.json({ success: true, result: formatValidationResult(result) });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Validierung fehlgeschlagen' }, { status: 500 });
  }
}
export async function GET() {
  return NextResponse.json({ description: 'GoBD Compliance Validator', endpoints: { POST: '/api/invoices/validate/gobd' } });
}
