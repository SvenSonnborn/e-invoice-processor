import { beforeEach, describe, expect, it, mock } from 'bun:test';

let exchangeCodeError: { message: string } | null = null;
let verifyOtpError: { message: string } | null = null;
const exchangeCodeCalls: string[] = [];
const verifyOtpCalls: Array<{ token_hash: string; type: string }> = [];

mock.module('@/src/lib/supabase/server', () => ({
  createSupabaseServerClient: () =>
    Promise.resolve({
      auth: {
        exchangeCodeForSession: async (code: string) => {
          exchangeCodeCalls.push(code);
          return { error: exchangeCodeError };
        },
        verifyOtp: async (params: { token_hash: string; type: string }) => {
          verifyOtpCalls.push(params);
          return { error: verifyOtpError };
        },
      },
    }),
}));

import { GET } from '@/app/auth/callback/route';

describe('GET /auth/callback', () => {
  beforeEach(() => {
    exchangeCodeError = null;
    verifyOtpError = null;
    exchangeCodeCalls.length = 0;
    verifyOtpCalls.length = 0;
  });

  it('redirects recovery code flow to reset-password without token in URL', async () => {
    const request = new Request(
      'http://localhost/auth/callback?code=oauth-code&type=recovery'
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await GET(request as any);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'http://localhost/reset-password'
    );
    expect(exchangeCodeCalls).toEqual(['oauth-code']);
    expect(verifyOtpCalls).toHaveLength(0);
  });

  it('verifies recovery token server-side and redirects without token', async () => {
    const request = new Request(
      'http://localhost/auth/callback?token=recovery-token&type=recovery'
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await GET(request as any);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'http://localhost/reset-password'
    );
    expect(verifyOtpCalls).toEqual([
      { token_hash: 'recovery-token', type: 'recovery' },
    ]);
    expect(exchangeCodeCalls).toHaveLength(0);
  });

  it('redirects to login when recovery token verification fails', async () => {
    verifyOtpError = { message: 'expired' };
    const originalConsoleError = console.error;
    let consoleErrorCallCount = 0;
    console.error = () => {
      consoleErrorCallCount += 1;
    };

    try {
      const request = new Request(
        'http://localhost/auth/callback?token=bad-token&type=recovery'
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await GET(request as any);
      const location = response.headers.get('location');

      expect(response.status).toBe(307);
      expect((location ?? '').startsWith('http://localhost/login?error=')).toBe(
        true
      );
      expect(decodeURIComponent(location?.split('error=')[1] ?? '')).toContain(
        'Passwort-Reset-Link ungültig oder abgelaufen'
      );
      expect(verifyOtpCalls).toEqual([
        { token_hash: 'bad-token', type: 'recovery' },
      ]);
      expect(consoleErrorCallCount).toBe(1);
    } finally {
      console.error = originalConsoleError;
    }
  });

  it('falls back to login for empty callback payload', async () => {
    const request = new Request('http://localhost/auth/callback');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await GET(request as any);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost/login');
  });
});
