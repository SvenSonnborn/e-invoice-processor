/**
 * Stripe Configuration
 *
 * This file contains all Stripe-related configuration including
 * price IDs, plan details, and subscription limits.
 */

export const STRIPE_CONFIG = {
  // Trial period in days
  TRIAL_PERIOD_DAYS: 14,

  // Currency
  CURRENCY: 'eur',

  // Subscription plans
  PLANS: {
    PRO: {
      id: 'pro',
      name: 'Pro',
      description: 'Für wachsende Unternehmen',
      price: 29.0,
      priceId: process.env.STRIPE_PRICE_ID_PRO || '',
      features: [
        '100 Rechnungen pro Monat',
        '100 Exports pro Monat',
        'ZUGFeRD & XRechnung Unterstützung',
        'CSV Export',
        'Prioritäre Verarbeitung',
        'E-Mail Support',
        '14 Tage kostenlos testen',
      ],
      limits: {
        invoicesPerMonth: 100,
        exportsPerMonth: 100,
        apiAccess: false,
        priorityProcessing: true,
      },
    },
    BUSINESS: {
      id: 'business',
      name: 'Business',
      description: 'Für Unternehmen mit hohem Volumen',
      price: 99.0,
      priceId: process.env.STRIPE_PRICE_ID_BUSINESS || '',
      features: [
        'Unbegrenzte Rechnungen',
        'Unbegrenzte Exports',
        'ZUGFeRD & XRechnung Unterstützung',
        'Alle Exportformate (CSV, DATEV)',
        'Prioritäre Verarbeitung',
        'API Zugriff',
        'Prioritärer E-Mail Support',
        '14 Tage kostenlos testen',
      ],
      limits: {
        invoicesPerMonth: -1, // Unlimited
        exportsPerMonth: -1, // Unlimited
        apiAccess: true,
        priorityProcessing: true,
      },
    },
  },

  // Webhook events we handle
  WEBHOOK_EVENTS: {
    CHECKOUT_COMPLETED: 'checkout.session.completed',
    SUBSCRIPTION_UPDATED: 'customer.subscription.updated',
    SUBSCRIPTION_DELETED: 'customer.subscription.deleted',
    INVOICE_PAYMENT_SUCCEEDED: 'invoice.payment_succeeded',
    INVOICE_PAYMENT_FAILED: 'invoice.payment_failed',
  },
} as const;

export type PlanId = keyof typeof STRIPE_CONFIG.PLANS;
export type Plan = (typeof STRIPE_CONFIG.PLANS)[PlanId];

/**
 * Get plan by Stripe price ID
 */
export function getPlanByPriceId(priceId: string): Plan | null {
  if (!priceId) return null;
  for (const plan of Object.values(STRIPE_CONFIG.PLANS)) {
    if (plan.priceId && plan.priceId === priceId) {
      return plan;
    }
  }
  return null;
}

/**
 * Get plan by plan ID
 */
export function getPlanById(planId: string): Plan | null {
  const plan = STRIPE_CONFIG.PLANS[planId.toUpperCase() as PlanId];
  return plan || null;
}

/**
 * Check if a plan has unlimited invoices
 */
export function hasUnlimitedInvoices(plan: Plan): boolean {
  return plan.limits.invoicesPerMonth === -1;
}

/**
 * Format price for display
 */
export function formatPrice(price: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: currency,
  }).format(price);
}
