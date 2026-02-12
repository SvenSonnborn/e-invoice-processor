/**
 * Auth Helper Tests
 *
 * Tests for getMyUserOrThrow() and getMyOrganizationIdOrThrow()
 */

import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { ApiError, ApiErrorCode } from '@/src/lib/errors/api-error';

// ── Mocks ────────────────────────────────────────────────

let mockSupabaseUser: { id: string; email: string } | null = null;

mock.module('@/src/lib/supabase/server', () => ({
  createSupabaseServerClient: () =>
    Promise.resolve({
      auth: {
        getUser: () =>
          Promise.resolve(
            mockSupabaseUser
              ? { data: { user: mockSupabaseUser }, error: null }
              : { data: { user: null }, error: { message: 'No session' } }
          ),
      },
    }),
}));

let mockDbUser: { id: string; email: string; supabaseUserId: string } | null =
  null;
let mockMemberships: Array<{
  organizationId: string;
  createdAt: Date;
}> = [];

mock.module('@/src/lib/db/client', () => ({
  prisma: {
    user: {
      findUnique: () => Promise.resolve(mockDbUser),
    },
    organizationMember: {
      findUnique: ({
        where,
      }: {
        where: {
          userId_organizationId: { userId: string; organizationId: string };
        };
      }) => {
        const match = mockMemberships.find(
          (m) => m.organizationId === where.userId_organizationId.organizationId
        );
        return Promise.resolve(
          match ? { organizationId: match.organizationId } : null
        );
      },
      findFirst: () => {
        const sorted = [...mockMemberships].sort(
          (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
        );
        return Promise.resolve(
          sorted[0] ? { organizationId: sorted[0].organizationId } : null
        );
      },
    },
  },
}));

let mockCookieValue: string | undefined = undefined;

mock.module('next/headers', () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) =>
        name === 'active-org-id' && mockCookieValue
          ? { value: mockCookieValue }
          : undefined,
    }),
}));

mock.module('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

// Import AFTER mocks are set up
import {
  getMyUserOrThrow,
  getMyOrganizationIdOrThrow,
} from '@/src/lib/auth/session';

// ── Tests ────────────────────────────────────────────────

describe('getMyUserOrThrow', () => {
  beforeEach(() => {
    mockSupabaseUser = null;
    mockDbUser = null;
    mockMemberships = [];
    mockCookieValue = undefined;
  });

  it('throws UNAUTHENTICATED when no Supabase session', async () => {
    mockSupabaseUser = null;

    await expect(getMyUserOrThrow()).rejects.toMatchObject({
      code: ApiErrorCode.UNAUTHENTICATED,
      statusCode: 401,
    });
  });

  it('throws UNAUTHENTICATED when Supabase user exists but no DB user', async () => {
    mockSupabaseUser = { id: 'sup-123', email: 'test@example.com' };
    mockDbUser = null;

    await expect(getMyUserOrThrow()).rejects.toMatchObject({
      code: ApiErrorCode.UNAUTHENTICATED,
    });
  });

  it('returns DB user when authenticated', async () => {
    mockSupabaseUser = { id: 'sup-123', email: 'test@example.com' };
    mockDbUser = {
      id: 'user-1',
      email: 'test@example.com',
      supabaseUserId: 'sup-123',
    };

    const user = await getMyUserOrThrow();
    expect(user.id).toBe('user-1');
    expect(user.email).toBe('test@example.com');
  });
});

describe('getMyOrganizationIdOrThrow', () => {
  beforeEach(() => {
    mockSupabaseUser = null;
    mockDbUser = null;
    mockMemberships = [];
    mockCookieValue = undefined;
  });

  it('throws UNAUTHENTICATED when no session', async () => {
    mockSupabaseUser = null;

    await expect(getMyOrganizationIdOrThrow()).rejects.toMatchObject({
      code: ApiErrorCode.UNAUTHENTICATED,
      statusCode: 401,
    });
  });

  it('throws NO_ORGANIZATION when user has no memberships', async () => {
    mockSupabaseUser = { id: 'sup-123', email: 'test@example.com' };
    mockDbUser = {
      id: 'user-1',
      email: 'test@example.com',
      supabaseUserId: 'sup-123',
    };
    mockMemberships = [];

    await expect(getMyOrganizationIdOrThrow()).rejects.toMatchObject({
      code: ApiErrorCode.NO_ORGANIZATION,
      statusCode: 403,
    });
  });

  it('returns first membership when no active-org-id cookie', async () => {
    mockSupabaseUser = { id: 'sup-123', email: 'test@example.com' };
    mockDbUser = {
      id: 'user-1',
      email: 'test@example.com',
      supabaseUserId: 'sup-123',
    };
    mockMemberships = [
      { organizationId: 'org-first', createdAt: new Date('2024-01-01') },
      { organizationId: 'org-second', createdAt: new Date('2024-06-01') },
    ];
    mockCookieValue = undefined;

    const result = await getMyOrganizationIdOrThrow();
    expect(result.user.id).toBe('user-1');
    expect(result.organizationId).toBe('org-first');
  });

  it('respects active-org-id cookie when user has that membership', async () => {
    mockSupabaseUser = { id: 'sup-123', email: 'test@example.com' };
    mockDbUser = {
      id: 'user-1',
      email: 'test@example.com',
      supabaseUserId: 'sup-123',
    };
    mockMemberships = [
      { organizationId: 'org-first', createdAt: new Date('2024-01-01') },
      { organizationId: 'org-second', createdAt: new Date('2024-06-01') },
    ];
    mockCookieValue = 'org-second';

    const result = await getMyOrganizationIdOrThrow();
    expect(result.organizationId).toBe('org-second');
  });

  it('falls back to first membership when cookie org is invalid', async () => {
    mockSupabaseUser = { id: 'sup-123', email: 'test@example.com' };
    mockDbUser = {
      id: 'user-1',
      email: 'test@example.com',
      supabaseUserId: 'sup-123',
    };
    mockMemberships = [
      { organizationId: 'org-first', createdAt: new Date('2024-01-01') },
    ];
    mockCookieValue = 'org-nonexistent';

    const result = await getMyOrganizationIdOrThrow();
    expect(result.organizationId).toBe('org-first');
  });
});

describe('ApiError.toResponse', () => {
  it('returns structured JSON error response', async () => {
    const error = ApiError.unauthenticated();
    const response = error.toResponse();

    expect(response.status).toBe(401);

    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNAUTHENTICATED');
    expect(body.error.message).toBe('Authentication required');
  });

  it('includes details when provided', async () => {
    const error = ApiError.validationError('Bad input', {
      field: 'email',
    });
    const response = error.toResponse();

    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details.field).toBe('email');
  });

  it('omits details when not provided', async () => {
    const error = ApiError.notFound();
    const response = error.toResponse();
    const body = await response.json();

    expect(body.error.details).toBeUndefined();
  });
});
