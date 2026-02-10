import Stripe from 'stripe';

let stripeInstance: Stripe | null = null;

/**
 * Returns the Stripe client. Creates it on first use and caches it.
 * Throws only when called at runtime without STRIPE_SECRET_KEY (not at import time),
 * so the build can complete without Stripe env vars.
 */
export function getStripe(): Stripe {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY is not defined');
    }
    stripeInstance = new Stripe(key, {
      apiVersion: '2026-01-28.clover',
      typescript: true,
    });
  }
  return stripeInstance;
}
