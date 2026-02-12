/**
 * GoBD Validation API Endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  validateGoBDCompliance,
  formatValidationResult,
  InvoiceData,
  ValidationOptions,
} from '@/src/lib/gobd';
import { getMyOrganizationIdOrThrow } from '@/src/lib/auth/session';
import { ApiError } from '@/src/lib/errors/api-error';
import { logger } from '@/src/lib/logging';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    await getMyOrganizationIdOrThrow();

    let body: { invoice: InvoiceData; options?: ValidationOptions };
    try {
      body = await request.json();
    } catch {
      throw ApiError.validationError('Invalid JSON body');
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw ApiError.validationError('Request body must be a JSON object');
    }

    const { invoice, options = {} } = body;

    if (!invoice) {
      throw ApiError.validationError('Rechnungsdaten erforderlich');
    }

    const result = validateGoBDCompliance(invoice, options);
    return NextResponse.json({
      success: true,
      result: formatValidationResult(result),
    });
  } catch (error) {
    if (error instanceof ApiError) return error.toResponse();
    logger.error({ error }, 'GoBD validation failed');
    return ApiError.internal('Validierung fehlgeschlagen').toResponse();
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    description: 'GoBD Compliance Validator',
    requirements: {
      requiredFields: [
        'number - Rechnungsnummer',
        'issueDate - Rechnungsdatum',
        'netAmount - Nettobetrag',
        'taxAmount - Steuerbetrag',
        'grossAmount - Bruttobetrag',
        'currency - Währung',
        'supplierName - Lieferantenname',
        'customerName - Kundenname',
      ],
      validations: [
        'Summenprüfung: Netto + Steuer = Brutto',
        'Steuersätze: 0%, 7%, 19%',
        'Datum: Darf nicht in der Zukunft liegen',
        'Währung: EUR empfohlen',
      ],
    },
    endpoints: {
      POST: '/api/invoices/validate/gobd - Validate invoice (body: { invoice, options? })',
    },
  });
}
