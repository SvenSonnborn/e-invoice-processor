import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resolveStripeRedirectUrl } from '@/src/lib/stripe/redirect-url';

describe('resolveStripeRedirectUrl', () => {
  let originalSiteUrl: string | undefined;

  beforeEach(() => {
    originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = 'https://app.example.com';
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
  });

  it('allows same-origin relative URLs', () => {
    const url = resolveStripeRedirectUrl({
      requestUrl: 'http://localhost/api/stripe/checkout',
      value: '/dashboard?checkout=success',
      defaultPath: '/fallback',
      fieldName: 'successUrl',
    });

    expect(url).toBe('https://app.example.com/dashboard?checkout=success');
  });

  it('returns fallback URL when no value is provided', () => {
    const url = resolveStripeRedirectUrl({
      requestUrl: 'http://localhost/api/stripe/portal',
      value: undefined,
      defaultPath: '/settings',
      fieldName: 'returnUrl',
    });

    expect(url).toBe('https://app.example.com/settings');
  });

  it('rejects external absolute URLs', () => {
    expect(() =>
      resolveStripeRedirectUrl({
        requestUrl: 'http://localhost/api/stripe/checkout',
        value: 'https://evil.example/steal',
        defaultPath: '/dashboard',
        fieldName: 'cancelUrl',
      })
    ).toThrow('application origin');
  });

  it('rejects non-http protocols', () => {
    expect(() =>
      resolveStripeRedirectUrl({
        requestUrl: 'http://localhost/api/stripe/checkout',
        value: 'javascript:alert(1)',
        defaultPath: '/dashboard',
        fieldName: 'successUrl',
      })
    ).toThrow('http or https');
  });
});
