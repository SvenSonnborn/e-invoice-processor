import { beforeEach, describe, expect, it, mock } from 'bun:test';

type FindManyArgs = {
  where: {
    organizationId: string;
    status?: { in: string[] };
    OR?: Array<{ number?: { contains: string } } | { supplierName?: { contains: string } }>;
  };
  orderBy: Array<{ createdAt?: 'desc' } | { id?: 'desc' }>;
  take: number;
  cursor?: { id: string };
  skip?: number;
};

type CountArgs = {
  where: {
    organizationId: string;
    createdAt?: { gte: Date };
  };
};

type GroupByArgs = {
  where: {
    organizationId: string;
    status?: { in: string[] };
  };
};

const findManyCalls: FindManyArgs[] = [];
const countCalls: CountArgs[] = [];
const groupByCalls: GroupByArgs[] = [];

// Mock session dependencies instead of the session module itself,
// so that mock.module does not leak into tests/auth/session.test.ts.

mock.module('@/src/lib/supabase/server', () => ({
  createSupabaseServerClient: () =>
    Promise.resolve({
      auth: {
        getUser: () =>
          Promise.resolve({
            data: { user: { id: 'sup-123', email: 'test@test.com' } },
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
          id: 'user-123',
          email: 'test@test.com',
          supabaseUserId: 'sup-123',
        }),
    },
    organizationMember: {
      findUnique: () => Promise.resolve({ organizationId: 'org-123' }),
      findFirst: () => Promise.resolve({ organizationId: 'org-123' }),
    },
    invoice: {
      findMany: async (args: FindManyArgs) => {
        findManyCalls.push(args);
        return [
          {
            id: 'inv-3',
            number: 'RE-003',
            supplierName: 'Acme GmbH',
            status: 'PARSED',
            grossAmount: { toNumber: () => 300.0 },
            createdAt: new Date('2026-02-10T10:00:00.000Z'),
            issueDate: new Date('2026-02-08T00:00:00.000Z'),
          },
          {
            id: 'inv-2',
            number: 'RE-002',
            supplierName: 'Acme GmbH',
            status: 'VALIDATED',
            grossAmount: { toNumber: () => 200.5 },
            createdAt: new Date('2026-02-09T10:00:00.000Z'),
            issueDate: new Date('2026-02-07T00:00:00.000Z'),
          },
          {
            id: 'inv-1',
            number: 'RE-001',
            supplierName: 'Acme GmbH',
            status: 'EXPORTED',
            grossAmount: null,
            createdAt: new Date('2026-02-08T10:00:00.000Z'),
            issueDate: null,
          },
        ];
      },
      count: async (args: CountArgs) => {
        countCalls.push(args);
        if (args.where.createdAt?.gte) return 2;
        return 7;
      },
      aggregate: async () => ({
        _sum: {
          grossAmount: '500.50',
        },
      }),
      groupBy: async (args: GroupByArgs) => {
        groupByCalls.push(args);
        return [
          { status: 'UPLOADED', _count: { _all: 1 } },
          { status: 'CREATED', _count: { _all: 2 } },
          { status: 'PARSED', _count: { _all: 3 } },
          { status: 'VALIDATED', _count: { _all: 1 } },
          { status: 'EXPORTED', _count: { _all: 1 } },
        ];
      },
    },
  },
}));

import { GET } from '@/app/api/invoices/route';

describe('GET /api/invoices', () => {
  beforeEach(() => {
    findManyCalls.length = 0;
    countCalls.length = 0;
    groupByCalls.length = 0;
  });

  it('returns filtered invoice items and aggregated stats', async () => {
    const request = new Request(
      'http://localhost/api/invoices?statusGroup=processed&q=acme&limit=2&cursor=inv-99'
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.items).toHaveLength(2);
    expect(data.nextCursor).toBe('inv-2');
    expect(data.stats.totalCount).toBe(7);
    expect(data.stats.currentMonthCount).toBe(2);
    expect(data.stats.totalGrossAmount).toBe(500.5);
    expect(data.stats.statusDistribution).toEqual({
      uploaded: 3,
      processed: 4,
      exported: 1,
    });

    expect(findManyCalls).toHaveLength(1);
    expect(findManyCalls[0].take).toBe(3);
    expect(findManyCalls[0].cursor).toEqual({ id: 'inv-99' });
    expect(findManyCalls[0].skip).toBe(1);
    expect(findManyCalls[0].where.organizationId).toBe('org-123');
    expect(findManyCalls[0].where.status).toEqual({
      in: ['PARSED', 'VALIDATED'],
    });
    expect(findManyCalls[0].where.OR).toBeDefined();
    expect(countCalls).toHaveLength(2);
    expect(groupByCalls).toHaveLength(1);
  });

  it('returns 400 for invalid statusGroup value', async () => {
    const request = new Request(
      'http://localhost/api/invoices?statusGroup=invalid-group'
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });
});
