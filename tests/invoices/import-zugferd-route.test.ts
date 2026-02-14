import { beforeEach, describe, expect, it, mock } from 'bun:test';
import type { InvoiceParseResult } from '@/src/lib/zugferd/parser';

let persistCalls = 0;
const persistFailuresByFilename = new Set<string>();

let singleParseResult = {
  success: true,
  invoice: {
    id: 'parsed-1',
    format: 'ZUGFERD',
    number: 'INV-2026-001',
    supplier: { name: 'Lieferant GmbH' },
    customer: { name: 'Kunde AG' },
    issueDate: '2026-02-10',
    dueDate: '2026-02-24',
    totals: {
      currency: 'EUR',
      netAmount: '100.00',
      taxAmount: '19.00',
      grossAmount: '119.00',
    },
  },
  extendedData: { lineItems: [] },
  rawData: {},
  validation: { valid: true, errors: [], warnings: [] },
  detection: { flavor: 'ZUGFeRD' },
  errors: [],
  warnings: [],
} as unknown as InvoiceParseResult;

let batchParseResults: Array<InvoiceParseResult & { filename?: string }> = [
  {
    ...singleParseResult,
    invoice: {
      ...singleParseResult.invoice!,
      number: 'INV-2026-101',
    },
    filename: 'item-0.xml',
  },
  {
    ...singleParseResult,
    invoice: {
      ...singleParseResult.invoice!,
      number: 'INV-2026-102',
    },
    filename: 'item-1.xml',
  },
];

mock.module('@/src/lib/auth/session', () => ({
  getMyOrganizationIdOrThrow: () =>
    Promise.resolve({
      user: { id: 'user-1' },
      organizationId: 'org-123',
    }),
}));

mock.module('@/src/lib/logging', () => ({
  logger: {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
  },
}));

mock.module('@/src/lib/zugferd/parser', () => ({
  parseInvoice: async () => singleParseResult,
  parseInvoiceFromPDF: async () => singleParseResult,
  parseInvoiceFromXML: async () => singleParseResult,
  parseInvoicesBatch: async () => batchParseResults,
}));

mock.module('@/src/server/services/invoice-import', () => ({
  persistParsedInvoice: async (params: {
    source: { filename?: string };
    parseResult: InvoiceParseResult;
  }) => {
    persistCalls += 1;

    const filename = params.source.filename ?? 'single.xml';
    if (persistFailuresByFilename.has(filename)) {
      throw new Error('Persistence failed');
    }

    return {
      invoiceId: `db-${params.parseResult.invoice?.number ?? 'unknown'}`,
      action: 'created',
      status: 'VALIDATED',
      number: params.parseResult.invoice?.number ?? null,
    } as const;
  },
}));

import { POST } from '@/app/api/invoices/import/zugferd/route';

describe('POST /api/invoices/import/zugferd', () => {
  beforeEach(() => {
    persistCalls = 0;
    persistFailuresByFilename.clear();
    singleParseResult = {
      success: true,
      invoice: {
        id: 'parsed-1',
        format: 'ZUGFERD',
        number: 'INV-2026-001',
        supplier: { name: 'Lieferant GmbH' },
        customer: { name: 'Kunde AG' },
        issueDate: '2026-02-10',
        dueDate: '2026-02-24',
        totals: {
          currency: 'EUR',
          netAmount: '100.00',
          taxAmount: '19.00',
          grossAmount: '119.00',
        },
      },
      extendedData: { lineItems: [] },
      rawData: {},
      validation: { valid: true, errors: [], warnings: [] },
      detection: { flavor: 'ZUGFeRD' },
      errors: [],
      warnings: [],
    } as unknown as InvoiceParseResult;
    batchParseResults = [
      {
        ...singleParseResult,
        invoice: {
          ...singleParseResult.invoice!,
          number: 'INV-2026-101',
        },
        filename: 'item-0.xml',
      },
      {
        ...singleParseResult,
        invoice: {
          ...singleParseResult.invoice!,
          number: 'INV-2026-102',
        },
        filename: 'item-1.xml',
      },
    ];
  });

  it('keeps parse-only behavior by default', async () => {
    const request = new Request('http://localhost/api/invoices/import/zugferd', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ xml: '<invoice />' }),
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await POST(request as any);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.persistence).toBeUndefined();
    expect(persistCalls).toBe(0);
  });

  it('persists parsed invoice when save=true', async () => {
    const request = new Request(
      'http://localhost/api/invoices/import/zugferd?save=true',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ xml: '<invoice />' }),
      }
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await POST(request as any);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.persistence).toMatchObject({
      saved: true,
      action: 'created',
      status: 'VALIDATED',
      statusGroup: 'processed',
    });
    expect(persistCalls).toBe(1);
  });

  it('returns 400 for invalid save query', async () => {
    const request = new Request(
      'http://localhost/api/invoices/import/zugferd?save=maybe',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ xml: '<invoice />' }),
      }
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await POST(request as any);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 207 for batch save with partial persistence errors', async () => {
    persistFailuresByFilename.add('item-1.xml');

    const request = new Request(
      'http://localhost/api/invoices/import/zugferd?save=true',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoices: [{ xml: '<invoice-a />' }, { xml: '<invoice-b />' }],
        }),
      }
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await POST(request as any);
    const payload = await response.json();

    expect(response.status).toBe(207);
    expect(payload.success).toBe(false);
    expect(payload.results[0].success).toBe(true);
    expect(payload.results[0].persistence.saved).toBe(true);
    expect(payload.results[0].persistence.statusGroup).toBe('processed');
    expect(payload.results[1].success).toBe(false);
    expect(payload.results[1].errors).toContain('Persistence failed');
  });
});
