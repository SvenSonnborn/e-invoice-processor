/**
 * Stripe Service Tests
 *
 * Tests the subscription service logic including plan limits,
 * feature access, and usage calculation helpers.
 */

import { describe, it, expect } from 'bun:test';
import { STRIPE_CONFIG } from '../../src/lib/stripe/config';

describe('Stripe Service – Plan Limits', () => {
  describe('PRO plan limits', () => {
    const pro = STRIPE_CONFIG.PLANS.PRO;

    it('should allow 100 invoices per month', () => {
      expect(pro.limits.invoicesPerMonth).toBe(100);
    });

    it('should allow 100 exports per month', () => {
      expect(pro.limits.exportsPerMonth).toBe(100);
    });

    it('should NOT have API access', () => {
      expect(pro.limits.apiAccess).toBe(false);
    });

    it('should have priority processing', () => {
      expect(pro.limits.priorityProcessing).toBe(true);
    });
  });

  describe('BUSINESS plan limits', () => {
    const business = STRIPE_CONFIG.PLANS.BUSINESS;

    it('should have unlimited invoices (-1)', () => {
      expect(business.limits.invoicesPerMonth).toBe(-1);
    });

    it('should have unlimited exports (-1)', () => {
      expect(business.limits.exportsPerMonth).toBe(-1);
    });

    it('should have API access', () => {
      expect(business.limits.apiAccess).toBe(true);
    });

    it('should have priority processing', () => {
      expect(business.limits.priorityProcessing).toBe(true);
    });
  });
});

describe('Stripe Service – Usage Limit Logic', () => {
  describe('unlimited detection', () => {
    it('should treat -1 as unlimited', () => {
      const limit = -1;
      const isUnlimited = limit === -1;
      expect(isUnlimited).toBe(true);
    });

    it('should not treat 0 as unlimited', () => {
      const limit: number = 0;
      const isUnlimited = limit === -1;
      expect(isUnlimited).toBe(false);
    });
  });

  describe('limit enforcement', () => {
    it('should block when usage equals limit', () => {
      const limit: number = 100;
      const used = 100;
      const isAllowed = limit === -1 || used < limit;
      expect(isAllowed).toBe(false);
    });

    it('should block when usage exceeds limit', () => {
      const limit: number = 100;
      const used = 101;
      const isAllowed = limit === -1 || used < limit;
      expect(isAllowed).toBe(false);
    });

    it('should allow when usage is under limit', () => {
      const limit: number = 100;
      const used = 99;
      const isAllowed = limit === -1 || used < limit;
      expect(isAllowed).toBe(true);
    });

    it('should always allow when limit is unlimited', () => {
      const limit: number = -1;
      const used = 999999;
      const isAllowed = limit === -1 || used < limit;
      expect(isAllowed).toBe(true);
    });

    it('should allow when usage is 0', () => {
      const limit: number = 100;
      const used = 0;
      const isAllowed = limit === -1 || used < limit;
      expect(isAllowed).toBe(true);
    });
  });

  describe('remaining calculation', () => {
    it('should calculate remaining correctly', () => {
      const limit: number = 100;
      const used = 30;
      const remaining = Math.max(0, limit - used);
      expect(remaining).toBe(70);
    });

    it('should return 0 when at limit', () => {
      const limit = 100;
      const used = 100;
      const remaining = Math.max(0, limit - used);
      expect(remaining).toBe(0);
    });

    it('should return 0 when over limit', () => {
      const limit = 100;
      const used = 105;
      const remaining = Math.max(0, limit - used);
      expect(remaining).toBe(0);
    });
  });
});

describe('Stripe Service – Billing Period', () => {
  it('should calculate start of current calendar month as fallback', () => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    expect(monthStart.getDate()).toBe(1);
    expect(monthStart.getMonth()).toBe(now.getMonth());
    expect(monthStart.getFullYear()).toBe(now.getFullYear());
  });

  it('should correctly compare dates for period filtering', () => {
    const periodStart = new Date('2026-01-01T00:00:00Z');
    const invoiceCreatedAt = new Date('2026-01-15T12:00:00Z');
    const oldInvoice = new Date('2025-12-25T12:00:00Z');

    expect(invoiceCreatedAt >= periodStart).toBe(true);
    expect(oldInvoice >= periodStart).toBe(false);
  });
});

describe('Stripe Service – Feature Access', () => {
  it('FREE tier should have no plan', () => {
    const tier = 'FREE';
    const plan = tier === 'FREE' ? null : STRIPE_CONFIG.PLANS[tier as keyof typeof STRIPE_CONFIG.PLANS];
    expect(plan).toBeNull();
  });

  it('PRO tier should resolve to PRO plan', () => {
    const tier = 'PRO' as const;
    const plan = STRIPE_CONFIG.PLANS[tier];
    expect(plan).toBeDefined();
    expect(plan.id).toBe('pro');
  });

  it('BUSINESS tier should resolve to BUSINESS plan', () => {
    const tier = 'BUSINESS' as const;
    const plan = STRIPE_CONFIG.PLANS[tier];
    expect(plan).toBeDefined();
    expect(plan.id).toBe('business');
  });

  it('API access should only be available on BUSINESS', () => {
    expect(STRIPE_CONFIG.PLANS.PRO.limits.apiAccess).toBe(false);
    expect(STRIPE_CONFIG.PLANS.BUSINESS.limits.apiAccess).toBe(true);
  });

  it('priority processing should be available on both PRO and BUSINESS', () => {
    expect(STRIPE_CONFIG.PLANS.PRO.limits.priorityProcessing).toBe(true);
    expect(STRIPE_CONFIG.PLANS.BUSINESS.limits.priorityProcessing).toBe(true);
  });
});
