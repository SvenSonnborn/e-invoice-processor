import { beforeEach, describe, expect, it, mock } from 'bun:test';

let shouldFailTransaction = false;
let mockUploadId = 'upload-1';
let mockInvoiceId = 'invoice-1';
const deletedStorageKeys: string[] = [];
const uploadedStorageKeys: string[] = [];

// Mock session dependencies instead of the session module itself,
// so that mock.module does not leak into tests/auth/session.test.ts.

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

mock.module('@/src/lib/storage', () => ({
  storage: {
    upload: async (key: string) => {
      uploadedStorageKeys.push(key);
      return key;
    },
    delete: async (key: string) => {
      deletedStorageKeys.push(key);
    },
  },
}));

mock.module('@/src/lib/db/client', () => ({
  prisma: {
    user: {
      findUnique: () =>
        Promise.resolve({
          id: 'user-123',
          email: 'user@example.com',
          supabaseUserId: 'sup-123',
        }),
    },
    organizationMember: {
      findUnique: () => Promise.resolve({ organizationId: 'org-123' }),
      findFirst: () => Promise.resolve({ organizationId: 'org-123' }),
    },
    $transaction: async (
      callback: (tx: {
        file: {
          create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
        };
        invoice: {
          create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
        };
      }) => Promise<unknown>
    ) => {
      if (shouldFailTransaction) {
        throw new Error('Transaction failed');
      }

      const tx = {
        file: {
          create: async (args: { data: Record<string, unknown> }) => ({
            id: mockUploadId,
            filename: args.data.filename,
            contentType: args.data.contentType,
            sizeBytes: args.data.sizeBytes,
            storageKey: args.data.storageKey,
            status: 'PENDING',
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
          }),
        },
        invoice: {
          create: async (args: { data: Record<string, unknown> }) => ({
            id: mockInvoiceId,
            fileId: args.data.fileId,
            status: 'UPLOADED',
          }),
        },
      };

      return callback(tx);
    },
  },
}));

import { POST } from '@/app/api/invoices/upload/route';

describe('POST /api/invoices/upload', () => {
  beforeEach(() => {
    shouldFailTransaction = false;
    mockUploadId = 'upload-1';
    mockInvoiceId = 'invoice-1';
    deletedStorageKeys.length = 0;
    uploadedStorageKeys.length = 0;
  });

  it('returns 400 if no file is provided', async () => {
    const formData = new FormData();
    const request = new Request('http://localhost/api/invoices/upload', {
      method: 'POST',
      body: formData,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 415 for unsupported file types', async () => {
    const formData = new FormData();
    formData.append('file', new File(['hello'], 'invoice.txt', { type: 'text/plain' }));
    const request = new Request('http://localhost/api/invoices/upload', {
      method: 'POST',
      body: formData,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(415);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNSUPPORTED_FILE_TYPE');
  });

  it('uploads file and creates file + invoice records', async () => {
    const formData = new FormData();
    formData.append(
      'file',
      new File(['fake-pdf-content'], 'invoice.pdf', { type: 'application/pdf' })
    );

    const request = new Request('http://localhost/api/invoices/upload', {
      method: 'POST',
      body: formData,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.file.id).toBe('upload-1');
    expect(data.invoice.id).toBe('invoice-1');
    expect(data.invoice.fileId).toBe('upload-1');
    expect(data.invoice.status).toBe('UPLOADED');
    expect(uploadedStorageKeys).toHaveLength(1);
    expect(uploadedStorageKeys[0]).toContain('invoices/org-123/user-123/');
    expect(deletedStorageKeys).toHaveLength(0);
  });

  it('cleans up uploaded file when database transaction fails', async () => {
    shouldFailTransaction = true;

    const formData = new FormData();
    formData.append(
      'file',
      new File(['fake-image-content'], 'invoice.png', { type: 'image/png' })
    );
    const request = new Request('http://localhost/api/invoices/upload', {
      method: 'POST',
      body: formData,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(uploadedStorageKeys).toHaveLength(1);
    expect(deletedStorageKeys).toEqual([uploadedStorageKeys[0]]);
  });
});
