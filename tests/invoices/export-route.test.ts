import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  mock,
} from 'bun:test';

let exportErrorCode:
  | 'NOT_FOUND'
  | 'INVALID_STATE'
  | 'MISSING_REVIEW_DATA'
  | 'VALIDATION_FAILED'
  | 'GENERATION_FAILED'
  | null = null;
const capturedExports: Array<{
  organizationId: string;
  invoiceId: string;
  format: 'xrechnung' | 'zugferd';
}> = [];

let GET: typeof import('@/app/api/export/[invoiceId]/route').GET;

beforeAll(async () => {
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
    },
  }));

  mock.module('@/src/server/services/invoice-export', () => {
    class MockInvoiceExportServiceError extends Error {
      constructor(
        public readonly code:
          | 'NOT_FOUND'
          | 'INVALID_STATE'
          | 'MISSING_REVIEW_DATA'
          | 'VALIDATION_FAILED'
          | 'GENERATION_FAILED',
        message: string
      ) {
        super(message);
        this.name = 'InvoiceExportServiceError';
      }
    }

    return {
      InvoiceExportServiceError: MockInvoiceExportServiceError,
      generateInvoiceExport: async (input: {
        organizationId: string;
        invoiceId: string;
        format: 'xrechnung' | 'zugferd';
      }) => {
        capturedExports.push(input);

        if (exportErrorCode) {
          throw new MockInvoiceExportServiceError(
            exportErrorCode,
            `Export failed with ${exportErrorCode}`
          );
        }

        if (input.format === 'zugferd') {
          return {
            filename: 'RE-2026-1001-zugferd.pdf',
            contentType: 'application/pdf',
            fileBuffer: Buffer.from([1, 2, 3, 4]),
            storageKey: 'invoices/exports/org-123/inv-1/file.pdf',
          };
        }

        return {
          filename: 'RE-2026-1001-xrechnung.xml',
          contentType: 'application/xml; charset=utf-8',
          fileBuffer: Buffer.from('<invoice/>', 'utf-8'),
          storageKey: 'invoices/exports/org-123/inv-1/file.xml',
        };
      },
    };
  });

  const routeModule = await import('@/app/api/export/[invoiceId]/route');
  GET = routeModule.GET;
});

afterAll(() => {
  mock.restore?.();
});

describe('GET /api/export/[invoiceId]', () => {
  beforeEach(() => {
    exportErrorCode = null;
    capturedExports.length = 0;
  });

  it('streams XRechnung XML as attachment', async () => {
    const request = new Request(
      'http://localhost/api/export/inv-1?format=xrechnung'
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await GET(request as any, {
      params: Promise.resolve({ invoiceId: 'inv-1' }),
    });
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('application/xml');
    expect(response.headers.get('Content-Disposition')).toContain(
      'RE-2026-1001-xrechnung.xml'
    );
    expect(body).toBe('<invoice/>');
    expect(capturedExports[0]).toEqual({
      organizationId: 'org-123',
      invoiceId: 'inv-1',
      format: 'xrechnung',
    });
  });

  it('streams ZUGFeRD PDF as attachment', async () => {
    const request = new Request(
      'http://localhost/api/export/inv-1?format=zugferd'
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await GET(request as any, {
      params: Promise.resolve({ invoiceId: 'inv-1' }),
    });
    const body = await response.arrayBuffer();

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/pdf');
    expect(response.headers.get('Content-Disposition')).toContain(
      'RE-2026-1001-zugferd.pdf'
    );
    expect(body.byteLength).toBe(4);
    expect(capturedExports[0]).toEqual({
      organizationId: 'org-123',
      invoiceId: 'inv-1',
      format: 'zugferd',
    });
  });

  it('returns 400 for invalid format query', async () => {
    const request = new Request('http://localhost/api/export/inv-1?format=csv');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await GET(request as any, {
      params: Promise.resolve({ invoiceId: 'inv-1' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('VALIDATION_ERROR');
    expect(capturedExports).toHaveLength(0);
  });

  it('maps NOT_FOUND export errors to 404', async () => {
    exportErrorCode = 'NOT_FOUND';

    const request = new Request(
      'http://localhost/api/export/inv-1?format=xrechnung'
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await GET(request as any, {
      params: Promise.resolve({ invoiceId: 'inv-1' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('NOT_FOUND');
  });

  it('maps VALIDATION_FAILED export errors to 400', async () => {
    exportErrorCode = 'VALIDATION_FAILED';

    const request = new Request(
      'http://localhost/api/export/inv-1?format=zugferd'
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await GET(request as any, {
      params: Promise.resolve({ invoiceId: 'inv-1' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('VALIDATION_ERROR');
  });
});
