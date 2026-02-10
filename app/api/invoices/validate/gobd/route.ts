/**
 * GoBD Validation API Endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateGoBDCompliance, formatValidationResult, InvoiceData, ValidationOptions, GoBDValidationResponse } from '@/src/lib/gobd';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { invoice, options = {} }: { invoice: InvoiceData; options?: ValidationOptions } = body;

    if (!invoice) {
      return NextResponse.json({ success: false, error: 'Rechnungsdaten erforderlich' } as GoBDValidationResponse, { status: 400 });
    }

    const result = validateGoBDCompliance(invoice, options);
    return NextResponse.json({ success: true, result: formatValidationResult(result) } as unknown as GoBDValidationResponse);
  } catch (error) {
    console.error('GoBD validation error:', error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Validierung fehlgeschlagen' } as GoBDValidationResponse, { status: 500 });
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    description: 'GoBD Compliance Validator',
    requirements: {
      requiredFields: ['number - Rechnungsnummer', 'issueDate - Rechnungsdatum', 'netAmount - Nettobetrag', 'taxAmount - Steuerbetrag', 'grossAmount - Bruttobetrag', 'currency - Währung', 'supplierName - Lieferantenname', 'customerName - Kundenname'],
      validations: ['Summenprüfung: Netto + Steuer = Brutto', 'Steuersätze: 0%, 7%, 19%', 'Datum: Darf nicht in der Zukunft liegen', 'Währung: EUR empfohlen'],
    },
    endpoints: { POST: '/api/invoices/validate/gobd - Validate invoice (body: { invoice, options? })' },
  });
}
