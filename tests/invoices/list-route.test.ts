import { beforeEach, describe, expect, it, mock } from 'bun:test';

const capturedWhere: unknown[] = [];

// Mock session dependencies instead of the session module itself,
// so that mock.module does not leak into tests/auth/session.test.ts.

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
    invoice: {
      findMany: async (args: { where: unknown; take: number }) => {
        capturedWhere.push(args.where);
        if (args.take === 3) {
          return [
            {
              id: 'inv-1',
              number: 'RE-1001',
              supplierName: 'ACME GmbH',
              status: 'PARSED',
              grossAmount: '123.45',
              createdAt: new Date('2026-02-10T10:00:00.000Z'),
              issueDate: new Date('2026-02-09T00:00:00.000Z'),
            },
            {
              id: 'inv-2',
              number: 'RE-1002',
              supplierName: 'ACME GmbH',
              status: 'VALIDATED',
              grossAmount: null,
              createdAt: new Date('2026-02-09T09:00:00.000Z'),
              issueDate: null,
            },
            {
              id: 'inv-3',
              number: 'RE-1003',
              supplierName: 'ACME GmbH',
              status: 'VALIDATED',
              grossAmount: '10.00',
              createdAt: new Date('2026-02-08T08:00:00.000Z'),
              issueDate: null,
            },
          ];
        }
        return [];
      },
      count: async (args: { where: unknown }) => {
        capturedWhere.push(args.where);
        return 2;
      },
      aggregate: async (args: { where: unknown }) => {
        capturedWhere.push(args.where);
        return { _sum: { grossAmount: '133.45' } };
      },
      groupBy: async (args: { where: unknown }) => {
        capturedWhere.push(args.where);
        return [
          { status: 'PARSED', _count: { _all: 1 } },
          { status: 'VALIDATED', _count: { _all: 1 } },
        ];
      },
    },
  },
}));

import { GET } from '@/app/api/invoices/route';

describe('GET /api/invoices', () => {
  beforeEach(() => {
    capturedWhere.length = 0;
  });

  it('returns filtered invoice list with stats and cursor', async () => {
    const request = new Request(
      'http://localhost/api/invoices?statusGroup=processed&q=acme&limit=2'
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await GET(request as any);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.items).toHaveLength(2);
    expect(payload.nextCursor).toBe(payload.items[payload.items.length - 1].id);
    expect(payload.stats.totalCount).toBe(2);
    expect(payload.stats.currentMonthCount).toBe(2);
    expect(payload.stats.totalGrossAmount).toBe(133.45);
    expect(payload.stats.statusDistribution).toEqual({
      uploaded: 0,
      processed: 2,
      exported: 0,
    });

    expect(capturedWhere.length).toBeGreaterThan(0);
    expect(capturedWhere[0]).toMatchObject({
      organizationId: 'org-123',
      status: { in: ['PARSED', 'VALIDATED'] },
      OR: [
        { number: { contains: 'acme', mode: 'insensitive' } },
        { supplierName: { contains: 'acme', mode: 'insensitive' } },
      ],
    });
  });

  it('returns 400 for invalid statusGroup', async () => {
    const request = new Request(
      'http://localhost/api/invoices?statusGroup=failed'
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await GET(request as any);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('VALIDATION_ERROR');
  });
});
