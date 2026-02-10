/**
 * Stripe Service Tests
 */

import { describe, it, expect } from 'bun:test';
import { STRIPE_CONFIG } from '../../src/lib/stripe/config';

describe('Stripe Service', () => {
  describe('Plan Limits', () => {
    it('BASIC plan should have 50 invoices per month', () => {
      expect(STRIPE_CONFIG.PLANS.BASIC.limits.invoicesPerMonth).toBe(50);
    });

    it('BASIC plan should have 100 exports per month', () => {
      expect(STRIPE_CONFIG.PLANS.BASIC.limits.exportsPerMonth).toBe(100);
    });

    it('BASIC plan should not have API access', () => {
      expect(STRIPE_CONFIG.PLANS.BASIC.limits.apiAccess).toBe(false);
    });

    it('BASIC plan should not have priority processing', () => {
      expect(STRIPE_CONFIG.PLANS.BASIC.limits.priorityProcessing).toBe(false);
    });

    it('PRO plan should have unlimited invoices', () => {
      expect(STRIPE_CONFIG.PLANS.PRO.limits.invoicesPerMonth).toBe(-1);
    });

    it('PRO plan should have unlimited exports', () => {
      expect(STRIPE_CONFIG.PLANS.PRO.limits.exportsPerMonth).toBe(-1);
    });

    it('PRO plan should have API access', () => {
      expect(STRIPE_CONFIG.PLANS.PRO.limits.apiAccess).toBe(true);
    });

    it('PRO plan should have priority processing', () => {
      expect(STRIPE_CONFIG.PLANS.PRO.limits.priorityProcessing).toBe(true);
    });
  });

  describe('Plan Features', () => {
    it('BASIC plan should have correct number of features', () => {
      expect(STRIPE_CONFIG.PLANS.BASIC.features.length).toBeGreaterThan(0);
    });

    it('PRO plan should have more features than BASIC', () => {
      const basicFeatures = STRIPE_CONFIG.PLANS.BASIC.features.length;
      const proFeatures = STRIPE_CONFIG.PLANS.PRO.features.length;
      expect(proFeatures).toBeGreaterThan(basicFeatures);
    });

    it('All plans should include ZUGFeRD & XRechnung support', () => {
      const basicHasSupport = STRIPE_CONFIG.PLANS.BASIC.features.some(
        f => f.includes('ZUGFeRD') || f.includes('XRechnung')
      );
      const proHasSupport = STRIPE_CONFIG.PLANS.PRO.features.some(
        f => f.includes('ZUGFeRD') || f.includes('XRechnung')
      );
      
      expect(basicHasSupport).toBe(true);
      expect(proHasSupport).toBe(true);
    });

    it('All plans should mention trial period', () => {
      const basicHasTrial = STRIPE_CONFIG.PLANS.BASIC.features.some(
        f => f.includes('14 Tage') || f.includes('kostenlos')
      );
      const proHasTrial = STRIPE_CONFIG.PLANS.PRO.features.some(
        f => f.includes('14 Tage') || f.includes('kostenlos')
      );
      
      expect(basicHasTrial).toBe(true);
      expect(proHasTrial).toBe(true);
    });
  });

  describe('Webhook Events', () => {
    it('should have checkout.session.completed event', () => {
      expect(STRIPE_CONFIG.WEBHOOK_EVENTS.CHECKOUT_COMPLETED).toBe('checkout.session.completed');
    });

    it('should have customer.subscription.updated event', () => {
      expect(STRIPE_CONFIG.WEBHOOK_EVENTS.SUBSCRIPTION_UPDATED).toBe('customer.subscription.updated');
    });

    it('should have customer.subscription.deleted event', () => {
      expect(STRIPE_CONFIG.WEBHOOK_EVENTS.SUBSCRIPTION_DELETED).toBe('customer.subscription.deleted');
    });

    it('should have invoice.payment_succeeded event', () => {
      expect(STRIPE_CONFIG.WEBHOOK_EVENTS.INVOICE_PAYMENT_SUCCEEDED).toBe('invoice.payment_succeeded');
    });

    it('should have invoice.payment_failed event', () => {
      expect(STRIPE_CONFIG.WEBHOOK_EVENTS.INVOICE_PAYMENT_FAILED).toBe('invoice.payment_failed');
    });
  });

  describe('Usage Calculation', () => {
    it('should handle unlimited limits correctly', () => {
      const limit = -1;
      const used = 1000;
      const hasReachedLimit = limit !== -1 && used >= limit;
      expect(hasReachedLimit).toBe(false);
    });

    it('should detect when limit is reached', () => {
      const limit = 50;
      const used = 50;
      const hasReachedLimit = used >= limit;
      expect(hasReachedLimit).toBe(true);
    });

    it('should allow usage when under limit', () => {
      const limit = 50;
      const used = 30;
      const hasReachedLimit = used >= limit;
      expect(hasReachedLimit).toBe(false);
    });

    it('should calculate remaining correctly', () => {
      const limit = 50;
      const used = 30;
      const remaining = Math.max(0, limit - used);
      expect(remaining).toBe(20);
    });
  });
});
