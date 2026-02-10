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

    it('should have PRO plan configured with correct pricing', () => {
      expect(STRIPE_CONFIG.PLANS.PRO).toBeDefined();
      expect(STRIPE_CONFIG.PLANS.PRO.id).toBe('pro');
      expect(STRIPE_CONFIG.PLANS.PRO.name).toBe('Pro');
      expect(STRIPE_CONFIG.PLANS.PRO.price).toBe(29.00);
    });

    it('should have BUSINESS plan configured with correct pricing', () => {
      expect(STRIPE_CONFIG.PLANS.BUSINESS).toBeDefined();
      expect(STRIPE_CONFIG.PLANS.BUSINESS.id).toBe('business');
      expect(STRIPE_CONFIG.PLANS.BUSINESS.name).toBe('Business');
      expect(STRIPE_CONFIG.PLANS.BUSINESS.price).toBe(99.00);
    });

    it('PRO plan should have correct limits', () => {
      expect(STRIPE_CONFIG.PLANS.PRO.limits.invoicesPerMonth).toBe(100);
      expect(STRIPE_CONFIG.PLANS.PRO.limits.exportsPerMonth).toBe(100);
      expect(STRIPE_CONFIG.PLANS.PRO.limits.apiAccess).toBe(false);
      expect(STRIPE_CONFIG.PLANS.PRO.limits.priorityProcessing).toBe(true);
    });

    it('BUSINESS plan should have unlimited access and all features', () => {
      expect(STRIPE_CONFIG.PLANS.BUSINESS.limits.invoicesPerMonth).toBe(-1);
      expect(STRIPE_CONFIG.PLANS.BUSINESS.limits.exportsPerMonth).toBe(-1);
      expect(STRIPE_CONFIG.PLANS.BUSINESS.limits.apiAccess).toBe(true);
      expect(STRIPE_CONFIG.PLANS.BUSINESS.limits.priorityProcessing).toBe(true);
    });
  });

  describe('getPlanById', () => {
    it('should return PRO plan for "pro" (case-insensitive)', () => {
      const plan = getPlanById('pro');
      expect(plan).toBeDefined();
      expect(plan?.id).toBe('pro');
    });

    it('should return BUSINESS plan for "BUSINESS" (uppercase)', () => {
      const plan = getPlanById('BUSINESS');
      expect(plan).toBeDefined();
      expect(plan?.id).toBe('business');
    });

    it('should return null for invalid plan id', () => {
      expect(getPlanById('invalid')).toBeNull();
      expect(getPlanById('')).toBeNull();
    });

    it('should return null for removed BASIC plan id', () => {
      expect(getPlanById('basic')).toBeNull();
    });
  });

  describe('getPlanByPriceId', () => {
    it('should return null for unknown price ID', () => {
      expect(getPlanByPriceId('price_unknown')).toBeNull();
    });

    it('should return null for empty price ID', () => {
      expect(getPlanByPriceId('')).toBeNull();
    });

    it('should match PRO plan when price ID matches env var', () => {
      const proPriceId = STRIPE_CONFIG.PLANS.PRO.priceId;
      if (proPriceId) {
        const plan = getPlanByPriceId(proPriceId);
        expect(plan?.id).toBe('pro');
      }
    });

    it('should match BUSINESS plan when price ID matches env var', () => {
      const businessPriceId = STRIPE_CONFIG.PLANS.BUSINESS.priceId;
      if (businessPriceId) {
        const plan = getPlanByPriceId(businessPriceId);
        expect(plan?.id).toBe('business');
      }
    });
  });

  describe('hasUnlimitedInvoices', () => {
    it('should return true for BUSINESS plan', () => {
      expect(hasUnlimitedInvoices(STRIPE_CONFIG.PLANS.BUSINESS)).toBe(true);
    });

    it('should return false for PRO plan', () => {
      expect(hasUnlimitedInvoices(STRIPE_CONFIG.PLANS.PRO)).toBe(false);
    });
  });

  describe('formatPrice', () => {
    it('should format 29.00 with EUR symbol', () => {
      const formatted = formatPrice(29.00);
      expect(formatted).toContain('29,00');
      expect(formatted).toContain('€');
    });

    it('should format 99.00 with EUR symbol', () => {
      const formatted = formatPrice(99.00);
      expect(formatted).toContain('99,00');
      expect(formatted).toContain('€');
    });

    it('should use EUR as default currency', () => {
      const formatted = formatPrice(0);
      expect(formatted).toContain('€');
    });

    it('should accept custom currency', () => {
      const formatted = formatPrice(10, 'USD');
      expect(formatted).toContain('$');
    });
  });

  describe('Webhook Events', () => {
    it('should define all required webhook event types', () => {
      expect(STRIPE_CONFIG.WEBHOOK_EVENTS.CHECKOUT_COMPLETED).toBe('checkout.session.completed');
      expect(STRIPE_CONFIG.WEBHOOK_EVENTS.SUBSCRIPTION_UPDATED).toBe('customer.subscription.updated');
      expect(STRIPE_CONFIG.WEBHOOK_EVENTS.SUBSCRIPTION_DELETED).toBe('customer.subscription.deleted');
      expect(STRIPE_CONFIG.WEBHOOK_EVENTS.INVOICE_PAYMENT_SUCCEEDED).toBe('invoice.payment_succeeded');
      expect(STRIPE_CONFIG.WEBHOOK_EVENTS.INVOICE_PAYMENT_FAILED).toBe('invoice.payment_failed');
    });
  });

  describe('Plan Features', () => {
    it('BUSINESS plan should have more features than PRO', () => {
      expect(STRIPE_CONFIG.PLANS.BUSINESS.features.length).toBeGreaterThan(
        STRIPE_CONFIG.PLANS.PRO.features.length
      );
    });

    it('all plans should include ZUGFeRD & XRechnung support', () => {
      for (const plan of Object.values(STRIPE_CONFIG.PLANS)) {
        const hasSupport = plan.features.some(
          (f) => f.includes('ZUGFeRD') || f.includes('XRechnung')
        );
        expect(hasSupport).toBe(true);
      }
    });

    it('all plans should mention trial period', () => {
      for (const plan of Object.values(STRIPE_CONFIG.PLANS)) {
        const hasTrial = plan.features.some(
          (f) => f.includes('14 Tage') || f.includes('kostenlos')
        );
        expect(hasTrial).toBe(true);
      }
    });
  });
});
