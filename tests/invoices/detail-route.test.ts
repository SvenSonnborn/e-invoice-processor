import { beforeEach, describe, expect, it, mock } from 'bun:test';

let invoiceExists = true;
let vatValidationMode: 'valid' | 'invalid' | 'unavailable' = 'valid';
let throwDuplicateInvoiceNumberError = false;
let storedInvoice = {
  id: 'inv-1',
  organizationId: 'org-123',
  number: 'RE-1001',
  issueDate: new Date('2026-02-10T00:00:00.000Z'),
  dueDate: null as Date | null,
  customerName: 'Musterkunde AG',
  netAmount: '100.00',
  taxAmount: '19.00',
  grossAmount: '119.00',
  currency: 'EUR',
  supplierName: 'Muster GmbH',
  taxId: null as string | null,
  rawJson: null as Record<string, unknown> | null,
  status: 'PARSED' as 'PARSED' | 'VALIDATED' | 'EXPORTED',
};

const validReviewPayload = {
  header: {
    profile: 'XRECHNUNG_B2G',
    invoiceNumber: ' RE-2026-99 ',
    issueDate: '2026-02-12',
    currency: 'eur',
    dueDate: '2026-02-20',
    buyerReference: ' 12345-LEITWEG ',
  },
  seller: {
    name: ' Neue Lieferantin AG ',
    street: 'Musterweg 1',
    postCode: '12345',
    city: 'Berlin',
    countryCode: 'de',
    vatId: 'de123456789',
    taxNumber: '',
  },
  buyer: {
    name: 'Buyer GmbH',
    street: 'Teststraße 2',
    postCode: '10115',
    city: 'Berlin',
    countryCode: 'de',
  },
  payment: {
    means: 'bankTransfer',
    iban: 'de44 5001 0517 5407 3249 31',
    termsText: '',
  },
  lines: [
    {
      description: 'Leistung A',
      quantity: 1,
      unit: 'Stk',
      unitPrice: 100,
      netAmount: 100,
      vatRate: 19,
      vatCategory: 'S',
    },
  ],
  totals: {
    netAmount: 100,
    vatAmount: 19,
    grossAmount: 119,
  },
  taxBreakdown: [
    {
      rate: 19,
      taxableAmount: 100,
      taxAmount: 19,
    },
  ],
};

mock.module('@/src/lib/supabase/server', () => ({
  createSupabaseServerClient: () =>
    Promise.resolve({
      auth: {
        getUser: () =>
          Promise.resolve({
            data: { user: { id: 'sup-1', email: 'test@test.com' } },
            error: null,
          }),
      },
    }),
}));

mock.module('next/headers', () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) =>
        name === 'active-org-id' ? { value: 'org-123' } : undefined,
    }),
}));

mock.module('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

mock.module('@/src/lib/logging', () => ({
  logger: {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
  },
}));

mock.module('@/src/server/services/vat', () => ({
  validateSellerVatId: async (vatId: string) => {
    if (vatValidationMode === 'invalid') {
      return {
        status: 'invalid',
        reason: 'vies_invalid',
        message: 'USt-IdNr. konnte im VIES-System nicht bestaetigt werden.',
        checkedAt: new Date().toISOString(),
        normalizedVatId: vatId,
        countryCode: 'DE',
        vatNumber: '123456789',
        viesChecked: true,
      };
    }

    if (vatValidationMode === 'unavailable') {
      return {
        status: 'unavailable',
        reason: 'vies_unavailable',
        message:
          'VIES-Pruefung ist aktuell nicht verfuegbar. Die lokale Pruefung wurde verwendet.',
        checkedAt: new Date().toISOString(),
        normalizedVatId: vatId,
        countryCode: 'DE',
        vatNumber: '123456789',
        viesChecked: true,
      };
    }

    return {
      status: 'valid',
      reason: 'ok',
      message: 'USt-IdNr. wurde ueber VIES bestaetigt.',
      checkedAt: new Date().toISOString(),
      normalizedVatId: vatId,
      countryCode: 'DE',
      vatNumber: '123456789',
      viesChecked: true,
    };
  },
}));

mock.module('@/src/lib/db/client', () => ({
  prisma: {
    user: {
      findUnique: () =>
        Promise.resolve({
          id: 'user-1',
          email: 'test@test.com',
          supabaseUserId: 'sup-1',
        }),
    },
    organizationMember: {
      findUnique: () => Promise.resolve({ organizationId: 'org-123' }),
      findFirst: () => Promise.resolve({ organizationId: 'org-123' }),
    },
    invoice: {
      findFirst: async (args: {
        where: { id: string; organizationId: string };
      }) => {
        if (!invoiceExists) return null;
        if (args.where.id !== storedInvoice.id) return null;
        if (args.where.organizationId !== storedInvoice.organizationId) {
          return null;
        }

        return storedInvoice;
      },
      update: async (args: {
        where: { id: string };
        data: {
          number: string;
          issueDate: Date;
          dueDate: Date | null;
          currency: string;
          supplierName: string;
          customerName: string;
          taxId: string | null;
          netAmount: number;
          taxAmount: number;
          grossAmount: number;
          rawJson: Record<string, unknown>;
          status: 'VALIDATED' | 'EXPORTED';
        };
      }) => {
        if (args.where.id !== storedInvoice.id) {
          throw new Error('Invoice not found in update');
        }

        if (throwDuplicateInvoiceNumberError) {
          throw {
            code: 'P2002',
            meta: { target: ['organizationId', 'number'] },
          };
        }

        storedInvoice = {
          ...storedInvoice,
          number: args.data.number,
          issueDate: args.data.issueDate,
          dueDate: args.data.dueDate,
          currency: args.data.currency,
          supplierName: args.data.supplierName,
          customerName: args.data.customerName,
          taxId: args.data.taxId,
          netAmount: String(args.data.netAmount),
          taxAmount: String(args.data.taxAmount),
          grossAmount: String(args.data.grossAmount),
          rawJson: args.data.rawJson,
          status: args.data.status,
        };

        return storedInvoice;
      },
    },
  },
}));

import { GET, PUT } from '@/app/api/invoices/[invoiceId]/route';

describe('GET/PUT /api/invoices/[invoiceId]', () => {
  beforeEach(() => {
    invoiceExists = true;
    vatValidationMode = 'valid';
    throwDuplicateInvoiceNumberError = false;
    storedInvoice = {
      id: 'inv-1',
      organizationId: 'org-123',
      number: 'RE-1001',
      issueDate: new Date('2026-02-10T00:00:00.000Z'),
      dueDate: null,
      customerName: 'Musterkunde AG',
      netAmount: '100.00',
      taxAmount: '19.00',
      grossAmount: '119.00',
      currency: 'EUR',
      supplierName: 'Muster GmbH',
      taxId: null,
      rawJson: null,
      status: 'PARSED',
    };
  });

  it('returns invoice details', async () => {
    const request = new Request('http://localhost/api/invoices/inv-1');
    const response = await GET(request, {
      params: Promise.resolve({ invoiceId: 'inv-1' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.invoice).toMatchObject({
      id: 'inv-1',
      invoiceNumber: 'RE-1001',
      invoiceDate: '2026-02-10',
      totalAmount: 119,
      currency: 'EUR',
      vendorName: 'Muster GmbH',
      taxId: null,
      status: 'PARSED',
      statusGroup: 'processing',
    });
  });

  it('returns 400 for nested validation errors', async () => {
    const request = new Request('http://localhost/api/invoices/inv-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...validReviewPayload,
        header: {
          ...validReviewPayload.header,
          profile: 'XRECHNUNG_B2G',
          buyerReference: '',
          dueDate: '2026-02-01',
        },
        seller: {
          ...validReviewPayload.seller,
          vatId: '',
          taxNumber: '',
        },
      }),
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await PUT(request as any, {
      params: Promise.resolve({ invoiceId: 'inv-1' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('VALIDATION_ERROR');
    expect(payload.error.details.fieldErrors['header.buyerReference']).toBe(
      'Für XRECHNUNG_B2G ist eine Buyer Reference (Leitweg-ID) erforderlich.'
    );
    expect(payload.error.details.fieldErrors['seller.vatId']).toBe(
      'USt-IdNr. oder Steuernummer ist erforderlich.'
    );
    expect(payload.error.details.fieldErrors['header.dueDate']).toBe(
      'Fälligkeitsdatum darf nicht vor dem Rechnungsdatum liegen.'
    );
  });

  it('returns 400 for invalid DE postal code', async () => {
    const request = new Request('http://localhost/api/invoices/inv-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...validReviewPayload,
        seller: {
          ...validReviewPayload.seller,
          countryCode: 'DE',
          postCode: '12A45',
        },
      }),
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await PUT(request as any, {
      params: Promise.resolve({ invoiceId: 'inv-1' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('VALIDATION_ERROR');
    expect(payload.error.details.fieldErrors['seller.postCode']).toBe(
      'PLZ muss für Deutschland aus genau 5 Ziffern bestehen.'
    );
  });

  it('updates invoice from normalized review payload', async () => {
    const request = new Request('http://localhost/api/invoices/inv-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validReviewPayload),
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await PUT(request as any, {
      params: Promise.resolve({ invoiceId: 'inv-1' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.invoice).toMatchObject({
      invoiceNumber: 'RE-2026-99',
      invoiceDate: '2026-02-12',
      totalAmount: 119,
      currency: 'EUR',
      vendorName: 'Neue Lieferantin AG',
      taxId: 'DE123456789',
      status: 'VALIDATED',
      statusGroup: 'processed',
    });
    const reviewData = (storedInvoice.rawJson ?? {}) as Record<string, unknown>;
    const normalized = reviewData.reviewData as
      | {
          header?: { currency?: string };
          payment?: { iban?: string };
        }
      | undefined;

    expect(normalized?.header?.currency).toBe('EUR');
    expect(normalized?.payment?.iban).toBe('DE44500105175407324931');
  });

  it('returns 400 when VIES marks vat id as invalid', async () => {
    vatValidationMode = 'invalid';

    const request = new Request('http://localhost/api/invoices/inv-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validReviewPayload),
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await PUT(request as any, {
      params: Promise.resolve({ invoiceId: 'inv-1' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('VALIDATION_ERROR');
    expect(payload.error.details.fieldErrors['seller.vatId']).toBe(
      'USt-IdNr. konnte im VIES-System nicht bestaetigt werden.'
    );
  });

  it('returns warning when VIES is unavailable but still saves', async () => {
    vatValidationMode = 'unavailable';

    const request = new Request('http://localhost/api/invoices/inv-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validReviewPayload),
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await PUT(request as any, {
      params: Promise.resolve({ invoiceId: 'inv-1' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.warnings).toEqual([
      {
        code: 'VAT_VALIDATION_UNAVAILABLE',
        field: 'seller.vatId',
        message:
          'VIES-Pruefung ist aktuell nicht verfuegbar. Die lokale Pruefung wurde verwendet.',
      },
    ]);

    const reviewData = (storedInvoice.rawJson ?? {}) as Record<string, unknown>;
    const vatValidation = reviewData.vatValidation as
      | { status?: string }
      | undefined;
    expect(vatValidation?.status).toBe('unavailable');
  });

  it('returns 409 when invoice number already exists in the organization', async () => {
    throwDuplicateInvoiceNumberError = true;

    const request = new Request('http://localhost/api/invoices/inv-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validReviewPayload),
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await PUT(request as any, {
      params: Promise.resolve({ invoiceId: 'inv-1' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('DUPLICATE_INVOICE_NUMBER');
  });
});
