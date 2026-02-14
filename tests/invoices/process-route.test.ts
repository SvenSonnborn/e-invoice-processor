import { beforeEach, describe, expect, it, mock } from 'bun:test';

let shouldReturnDuplicateConflict = false;

class MockInvoiceProcessingError extends Error {
  public readonly code: string;
  public readonly details: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    details: Record<string, unknown> = {}
  ) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

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
    file: {
      findUnique: async () => ({
        id: 'file-1',
        organizationId: 'org-123',
        storageKey: 'invoices/org-123/user-1/file.pdf',
        contentType: 'application/pdf',
        filename: 'file.pdf',
        invoice: {
          id: 'inv-1',
          status: 'UPLOADED',
        },
      }),
    },
    invoice: {
      findUnique: async () => ({
        id: 'inv-1',
        status: 'VALIDATED',
        number: 'INV-2026-001',
        supplierName: 'Muster GmbH',
        customerName: 'Kunde AG',
        issueDate: new Date('2026-02-10T00:00:00.000Z'),
        dueDate: new Date('2026-02-24T00:00:00.000Z'),
        grossAmount: '119.00',
        format: 'UNKNOWN',
      }),
    },
  },
}));

mock.module('@/src/server/services/invoice-processing', () => ({
  InvoiceProcessingError: MockInvoiceProcessingError,
  InvoiceProcessingErrorCode: {
    DB_UPDATE_FAILED: 'DB_UPDATE_FAILED',
  },
  processInvoiceOcr: async () => {
    if (shouldReturnDuplicateConflict) {
      throw new MockInvoiceProcessingError(
        'DB_UPDATE_FAILED',
        'Duplicate invoice number "INV-2026-001" in this organization',
        { conflictField: 'number' }
      );
    }

    return {
      invoiceId: 'inv-1',
      status: 'VALIDATED',
      confidence: 0.95,
      pageCount: 1,
    };
  },
}));

import { POST } from '@/app/api/process-invoice/[fileId]/route';

describe('POST /api/process-invoice/[fileId]', () => {
  beforeEach(() => {
    shouldReturnDuplicateConflict = false;
  });

  it('returns processed invoice data', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await POST({} as any, {
      params: Promise.resolve({ fileId: 'file-1' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.invoice.id).toBe('inv-1');
    expect(payload.invoice.status).toBe('VALIDATED');
    expect(payload.invoice.statusGroup).toBe('processed');
    expect(payload.ocr.confidence).toBe(0.95);
  });

  it('returns 409 for duplicate invoice numbers', async () => {
    shouldReturnDuplicateConflict = true;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await POST({} as any, {
      params: Promise.resolve({ fileId: 'file-1' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('DUPLICATE_INVOICE_NUMBER');
  });
});
