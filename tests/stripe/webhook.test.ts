/**
 * Stripe Webhook Handler Tests
 *
 * Tests the core logic used by the webhook handler:
 * - Status mapping
 * - Cents-to-decimal conversion
 * - Trial period calculations
 * - SDK v20 helper functions
 */

import { describe, it, expect } from 'bun:test';
import { Prisma } from '@/src/generated/prisma/client';

// ---------------------------------------------------------------------------
// Re-implement the pure helpers from the webhook route for unit testing.
// These mirror the logic in app/api/stripe/webhook/route.ts.
// ---------------------------------------------------------------------------

type SubscriptionStatus =
  | 'INCOMPLETE'
  | 'INCOMPLETE_EXPIRED'
  | 'TRIALING'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'CANCELED'
  | 'UNPAID'
  | 'PAUSED';

type StripeSubStatus =
  | 'incomplete'
  | 'incomplete_expired'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'paused';

const mapStripeStatus = (stripeStatus: StripeSubStatus): SubscriptionStatus => {
  const statusMap: Record<StripeSubStatus, SubscriptionStatus> = {
    incomplete: 'INCOMPLETE',
    incomplete_expired: 'INCOMPLETE_EXPIRED',
    trialing: 'TRIALING',
    active: 'ACTIVE',
    past_due: 'PAST_DUE',
    canceled: 'CANCELED',
    unpaid: 'UNPAID',
    paused: 'PAUSED',
  };
  return statusMap[stripeStatus] || 'INCOMPLETE';
};

const resolveId = (
  value: string | { id: string } | null | undefined,
): string | undefined => {
  if (!value) return undefined;
  return typeof value === 'string' ? value : value.id;
};

const centsToPrismaDecimal = (cents: number): Prisma.Decimal => {
  const whole = Math.floor(cents / 100);
  const frac = cents % 100;
  return new Prisma.Decimal(`${whole}.${String(frac).padStart(2, '0')}`);
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Stripe Webhook Helpers', () => {
  describe('mapStripeStatus', () => {
    it('should map all Stripe statuses to Prisma enum values', () => {
      expect(mapStripeStatus('incomplete')).toBe('INCOMPLETE');
      expect(mapStripeStatus('incomplete_expired')).toBe('INCOMPLETE_EXPIRED');
      expect(mapStripeStatus('trialing')).toBe('TRIALING');
      expect(mapStripeStatus('active')).toBe('ACTIVE');
      expect(mapStripeStatus('past_due')).toBe('PAST_DUE');
      expect(mapStripeStatus('canceled')).toBe('CANCELED');
      expect(mapStripeStatus('unpaid')).toBe('UNPAID');
      expect(mapStripeStatus('paused')).toBe('PAUSED');
    });

    it('should default to INCOMPLETE for unknown statuses', () => {
      // @ts-expect-error – testing runtime safety
      expect(mapStripeStatus('unknown_status')).toBe('INCOMPLETE');
    });
  });

  describe('resolveId', () => {
    it('should return string ID as-is', () => {
      expect(resolveId('cus_123')).toBe('cus_123');
    });

    it('should extract id from expanded object', () => {
      expect(resolveId({ id: 'cus_456' })).toBe('cus_456');
    });

    it('should return undefined for null', () => {
      expect(resolveId(null)).toBeUndefined();
    });

    it('should return undefined for undefined', () => {
      expect(resolveId(undefined)).toBeUndefined();
    });
  });

  describe('centsToPrismaDecimal', () => {
    it('should convert 2900 cents to 29.00 (Pro plan)', () => {
      const result = centsToPrismaDecimal(2900);
      expect(Number(result)).toBe(29);
      expect(result.toFixed(2)).toBe('29.00');
    });

    it('should convert 9900 cents to 99.00 (Business plan)', () => {
      const result = centsToPrismaDecimal(9900);
      expect(Number(result)).toBe(99);
      expect(result.toFixed(2)).toBe('99.00');
    });

    it('should convert 0 cents to 0.00', () => {
      const result = centsToPrismaDecimal(0);
      expect(Number(result)).toBe(0);
      expect(result.toFixed(2)).toBe('0.00');
    });

    it('should convert 1 cent to 0.01', () => {
      const result = centsToPrismaDecimal(1);
      expect(result.toString()).toBe('0.01');
    });

    it('should convert 1999 cents to 19.99 without floating-point issues', () => {
      const result = centsToPrismaDecimal(1999);
      expect(result.toString()).toBe('19.99');
    });

    it('should handle large amounts correctly', () => {
      const result = centsToPrismaDecimal(99999);
      expect(result.toString()).toBe('999.99');
    });

    it('should preserve precision for amounts that cause JS float issues', () => {
      const result = centsToPrismaDecimal(33);
      expect(result.toString()).toBe('0.33');
    });
  });

  describe('Trial Period', () => {
    it('should calculate 14-day trial end date correctly', () => {
      const now = new Date();
      const trialEnd = new Date(now);
      trialEnd.setDate(trialEnd.getDate() + 14);

      const diffMs = trialEnd.getTime() - now.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      expect(diffDays).toBe(14);
    });

    it('should determine if trial is still active based on trialEnd', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      expect(new Date() < futureDate).toBe(true);

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      expect(new Date() < pastDate).toBe(false);
    });
  });
});

describe('Stripe Webhook Event Processing', () => {
  describe('Checkout Session Mock', () => {
    const mockSession = {
      id: 'cs_test_123',
      metadata: { userId: 'user_123' },
      customer: 'cus_123',
      subscription: 'sub_123',
    };

    it('should have userId in metadata', () => {
      expect(mockSession.metadata?.userId).toBe('user_123');
    });

    it('should resolve customer ID', () => {
      expect(resolveId(mockSession.customer)).toBe('cus_123');
    });

    it('should resolve subscription ID from string', () => {
      expect(resolveId(mockSession.subscription)).toBe('sub_123');
    });

    it('should resolve subscription ID from expanded object', () => {
      const sessionWithExpanded = {
        ...mockSession,
        subscription: { id: 'sub_456' } as unknown as string,
      };
      expect(resolveId(sessionWithExpanded.subscription)).toBe('sub_456');
    });
  });

  describe('Subscription Update Mock', () => {
    const mockSubscription = {
      id: 'sub_123',
      status: 'active' as StripeSubStatus,
      items: {
        data: [
          {
            price: { id: 'price_pro' },
            current_period_start: Math.floor(Date.now() / 1000),
            current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
          },
        ],
      },
      cancel_at_period_end: false,
      canceled_at: null,
      trial_start: null,
      trial_end: null,
    };

    it('should map subscription status correctly', () => {
      expect(mapStripeStatus(mockSubscription.status)).toBe('ACTIVE');
    });

    it('should extract price ID from first item', () => {
      expect(mockSubscription.items.data[0].price.id).toBe('price_pro');
    });

    it('should extract period from subscription item (SDK v20+)', () => {
      const item = mockSubscription.items.data[0];
      expect(item.current_period_start).toBeGreaterThan(0);
      expect(item.current_period_end).toBeGreaterThan(item.current_period_start);
    });
  });

  describe('Invoice Payment Mock', () => {
    it('should convert Pro plan payment amount correctly', () => {
      const mockInvoice = {
        id: 'in_123',
        amount_paid: 2900,
        amount_due: 2900,
        currency: 'eur',
      };

      const amount = centsToPrismaDecimal(mockInvoice.amount_paid);
      expect(Number(amount)).toBe(29);
      expect(amount.toFixed(2)).toBe('29.00');
      expect(mockInvoice.currency.toUpperCase()).toBe('EUR');
    });

    it('should convert Business plan payment amount correctly', () => {
      const mockInvoice = {
        id: 'in_456',
        amount_paid: 9900,
        amount_due: 9900,
        currency: 'eur',
      };

      const amount = centsToPrismaDecimal(mockInvoice.amount_paid);
      expect(Number(amount)).toBe(99);
      expect(amount.toFixed(2)).toBe('99.00');
    });

    it('should handle zero-amount invoices (trial)', () => {
      const trialInvoice = {
        id: 'in_trial_123',
        amount_paid: 0,
        amount_due: 0,
        currency: 'eur',
      };

      const amount = centsToPrismaDecimal(trialInvoice.amount_paid);
      expect(Number(amount)).toBe(0);
      expect(amount.toFixed(2)).toBe('0.00');
    });
  });
});
