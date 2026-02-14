import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test';

let persistCalls = 0;
const persistFailuresByFilename = new Set<string>();

const buildValidCiiXml = (
  documentNumber: string
): string => `<?xml version="1.0" encoding="UTF-8"?>
<CrossIndustryInvoice xmlns="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100">
  <ExchangedDocument>
    <ID>${documentNumber}</ID>
    <TypeCode>380</TypeCode>
    <IssueDateTime>
      <DateTimeString format="102">20260110</DateTimeString>
    </IssueDateTime>
  </ExchangedDocument>
  <SupplyChainTradeTransaction>
    <ApplicableHeaderTradeAgreement>
      <SellerTradeParty>
        <Name>Lieferant GmbH</Name>
      </SellerTradeParty>
      <BuyerTradeParty>
        <Name>Kunde AG</Name>
      </BuyerTradeParty>
    </ApplicableHeaderTradeAgreement>
    <ApplicableHeaderTradeSettlement>
      <InvoiceCurrencyCode>EUR</InvoiceCurrencyCode>
      <SpecifiedTradeSettlementHeaderMonetarySummation>
        <GrandTotalAmount currencyID="EUR">119.00</GrandTotalAmount>
      </SpecifiedTradeSettlementHeaderMonetarySummation>
    </ApplicableHeaderTradeSettlement>
  </SupplyChainTradeTransaction>
</CrossIndustryInvoice>`;

mock.module('@/src/lib/supabase/server', () => ({
  createSupabaseServerClient: () =>
    Promise.resolve({
      auth: {
        getUser: () =>
          Promise.resolve({
            data: { user: { id: 'sup-123', email: 'user@example.com' } },
            error: null,
          }),
      },
    }),
}));

mock.module('@/src/lib/db/client', () => ({
  prisma: {
    user: {
      findUnique: () =>
        Promise.resolve({
          id: 'user-1',
          email: 'user@example.com',
          supabaseUserId: 'sup-123',
        }),
    },
    organizationMember: {
      findUnique: () => Promise.resolve({ organizationId: 'org-123' }),
      findFirst: () => Promise.resolve({ organizationId: 'org-123' }),
    },
  },
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

mock.module('@/src/server/services/invoice-import', () => ({
  persistParsedInvoice: async (params: {
    source: { filename?: string };
    parseResult: { invoice?: { number?: string | null } };
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
  });

  afterAll(() => {
    mock.restore?.();
  });

  it('keeps parse-only behavior by default', async () => {
    const request = new Request(
      'http://localhost/api/invoices/import/zugferd',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ xml: buildValidCiiXml('INV-2026-001') }),
      }
    );

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
        body: JSON.stringify({ xml: buildValidCiiXml('INV-2026-001') }),
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
        body: JSON.stringify({ xml: buildValidCiiXml('INV-2026-001') }),
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
          invoices: [
            { xml: buildValidCiiXml('INV-2026-101') },
            { xml: buildValidCiiXml('INV-2026-102') },
          ],
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
