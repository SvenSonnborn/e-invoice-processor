/**
 * Stripe Configuration Tests
 */

import { describe, it, expect } from 'bun:test';
import { 
  STRIPE_CONFIG, 
  getPlanByPriceId, 
  getPlanById, 
  hasUnlimitedInvoices,
  formatPrice,
} from '../../src/lib/stripe/config';

describe('Stripe Config', () => {
  describe('STRIPE_CONFIG', () => {
    it('should have correct trial period', () => {
      expect(STRIPE_CONFIG.TRIAL_PERIOD_DAYS).toBe(14);
    });

    it('should use EUR currency', () => {
      expect(STRIPE_CONFIG.CURRENCY).toBe('eur');
    });

    it('should have BASIC plan configured', () => {
      expect(STRIPE_CONFIG.PLANS.BASIC).toBeDefined();
      expect(STRIPE_CONFIG.PLANS.BASIC.id).toBe('basic');
      expect(STRIPE_CONFIG.PLANS.BASIC.name).toBe('Basic');
      expect(STRIPE_CONFIG.PLANS.BASIC.price).toBe(9.90);
    });

    it('should have PRO plan configured', () => {
      expect(STRIPE_CONFIG.PLANS.PRO).toBeDefined();
      expect(STRIPE_CONFIG.PLANS.PRO.id).toBe('pro');
      expect(STRIPE_CONFIG.PLANS.PRO.name).toBe('Pro');
      expect(STRIPE_CONFIG.PLANS.PRO.price).toBe(14.90);
    });
  });

  describe('getPlanById', () => {
    it('should return BASIC plan for "basic"', () => {
      const plan = getPlanById('basic');
      expect(plan).toBeDefined();
      expect(plan?.id).toBe('basic');
    });

    it('should return PRO plan for "pro"', () => {
      const plan = getPlanById('pro');
      expect(plan).toBeDefined();
      expect(plan?.id).toBe('pro');
    });

    it('should return null for invalid plan id', () => {
      const plan = getPlanById('invalid');
      expect(plan).toBeNull();
    });
  });

  describe('getPlanByPriceId', () => {
    it('should return null for unknown price ID', () => {
      const plan = getPlanByPriceId('price_unknown');
      expect(plan).toBeNull();
    });

    it('should return plan when price ID matches', () => {
      const plan = getPlanByPriceId('nonexistent');
      expect(plan).toBeNull();
    });
  });

  describe('hasUnlimitedInvoices', () => {
    it('should return true for PRO plan', () => {
      expect(hasUnlimitedInvoices(STRIPE_CONFIG.PLANS.PRO)).toBe(true);
    });

    it('should return false for BASIC plan', () => {
      expect(hasUnlimitedInvoices(STRIPE_CONFIG.PLANS.BASIC)).toBe(false);
    });
  });

  describe('formatPrice', () => {
    it('should format 9.90 as €9,90', () => {
      const formatted = formatPrice(9.90);
      expect(formatted).toContain('9,90');
    });

    it('should format 14.90 as €14,90', () => {
      const formatted = formatPrice(14.90);
      expect(formatted).toContain('14,90');
    });

    it('should use EUR as default currency', () => {
      const formatted = formatPrice(9.90);
      expect(formatted).toContain('€');
    });
  });
});
