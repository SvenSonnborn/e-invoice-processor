/**
 * Stripe Webhook Handler
 * 
 * Handles incoming webhook events from Stripe.
 * 
 * POST /api/stripe/webhook
 */

import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/src/lib/stripe/client';
import { STRIPE_CONFIG, getPlanByPriceId } from '@/src/lib/stripe/config';
import { prisma } from '@/src/lib/db/client';
import { Prisma } from '@/src/generated/prisma/client';
import type { SubscriptionStatus, SubscriptionTier } from '@/src/generated/prisma/client';
import Stripe from 'stripe';
import { logger } from '@/src/lib/logging/logger';

const log = logger.child({ module: 'stripe-webhook' });

async function getRawBody(request: NextRequest): Promise<string> {
  const chunks: Buffer[] = [];
  const reader = request.body?.getReader();
  
  if (!reader) {
    throw new Error('No request body');
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(Buffer.from(value));
  }

  return Buffer.concat(chunks).toString('utf8');
}

// ---------------------------------------------------------------------------
// Stripe SDK v20 helpers
// ---------------------------------------------------------------------------

/**
 * Safely extract a Stripe object ID from a field that could be
 * a string ID or an expanded object.
 */
const resolveId = (value: string | { id: string } | null | undefined): string | undefined => {
  if (!value) return undefined;
  return typeof value === 'string' ? value : value.id;
};

/**
 * In Stripe API 2026-01-28+ `current_period_start` / `current_period_end`
 * live on each SubscriptionItem, not the Subscription itself.
 */
const getSubscriptionPeriod = (subscription: Stripe.Subscription) => {
  const item = subscription.items.data[0];
  return {
    start: item?.current_period_start,
    end: item?.current_period_end,
  };
};

/**
 * In Stripe API 2026-01-28+ `Invoice.subscription` was replaced by
 * `Invoice.parent.subscription_details.subscription`.
 */
const getInvoiceSubscriptionId = (invoice: Stripe.Invoice): string | undefined => {
  const raw = invoice.parent?.subscription_details?.subscription;
  return resolveId(raw);
};

/**
 * Convert Stripe amount in cents to a Prisma Decimal string.
 * Avoids floating-point precision issues by doing integer math.
 */
const centsToPrismaDecimal = (cents: number): Prisma.Decimal => {
  const whole = Math.floor(cents / 100);
  const frac = cents % 100;
  return new Prisma.Decimal(`${whole}.${String(frac).padStart(2, '0')}`);
};

// ---------------------------------------------------------------------------
// Webhook event handlers
// ---------------------------------------------------------------------------

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const subscriptionId = resolveId(session.subscription as string | Stripe.Subscription | null);

  if (!userId || !subscriptionId) {
    log.error({ sessionId: session.id }, 'Missing userId or subscriptionId in session metadata');
    return;
  }

  log.info({ sessionId: session.id, userId, subscriptionId }, 'Handling checkout.session.completed');

  const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
  const priceId = subscription.items.data[0]?.price.id;
  const plan = priceId ? getPlanByPriceId(priceId) : null;

  if (!plan) {
    log.error({ priceId }, 'Unknown price ID');
    return;
  }

  const period = getSubscriptionPeriod(subscription);
  const customerId = resolveId(session.customer as string | Stripe.Customer | null);

  if (!customerId) {
    log.error({ sessionId: session.id }, 'Missing customer ID in session');
    return;
  }

  await prisma.subscription.upsert({
    where: {
      stripeSubscriptionId: subscriptionId,
    },
    create: {
      userId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      stripePriceId: priceId,
      status: mapStripeStatus(subscription.status),
      tier: plan.id.toUpperCase() as SubscriptionTier,
      currentPeriodStart: period.start ? new Date(period.start * 1000) : null,
      currentPeriodEnd: period.end ? new Date(period.end * 1000) : null,
      trialStart: subscription.trial_start 
        ? new Date(subscription.trial_start * 1000) 
        : null,
      trialEnd: subscription.trial_end 
        ? new Date(subscription.trial_end * 1000) 
        : null,
    },
    update: {
      stripePriceId: priceId,
      status: mapStripeStatus(subscription.status),
      tier: plan.id.toUpperCase() as SubscriptionTier,
      currentPeriodStart: period.start ? new Date(period.start * 1000) : null,
      currentPeriodEnd: period.end ? new Date(period.end * 1000) : null,
      trialStart: subscription.trial_start 
        ? new Date(subscription.trial_start * 1000) 
        : null,
      trialEnd: subscription.trial_end 
        ? new Date(subscription.trial_end * 1000) 
        : null,
    },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { subscriptionTier: plan.id.toUpperCase() as SubscriptionTier },
  });

  log.info({ userId, tier: plan.id }, 'Subscription created/updated for user');
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  log.info({ subscriptionId: subscription.id }, 'Handling customer.subscription.updated');

  const dbSubscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: subscription.id },
  });

  if (!dbSubscription) {
    log.error({ subscriptionId: subscription.id }, 'Subscription not found in database');
    return;
  }

  const priceId = subscription.items.data[0]?.price.id;
  const plan = priceId ? getPlanByPriceId(priceId) : null;
  const period = getSubscriptionPeriod(subscription);

  await prisma.subscription.update({
    where: { stripeSubscriptionId: subscription.id },
    data: {
      stripePriceId: priceId,
      status: mapStripeStatus(subscription.status),
      tier: plan ? (plan.id.toUpperCase() as SubscriptionTier) : dbSubscription.tier,
      currentPeriodStart: period.start ? new Date(period.start * 1000) : null,
      currentPeriodEnd: period.end ? new Date(period.end * 1000) : null,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      canceledAt: subscription.canceled_at 
        ? new Date(subscription.canceled_at * 1000) 
        : null,
    },
  });

  if (plan) {
    await prisma.user.update({
      where: { id: dbSubscription.userId },
      data: { subscriptionTier: plan.id.toUpperCase() as SubscriptionTier },
    });
  }

  log.info({ subscriptionId: subscription.id }, 'Subscription updated');
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  log.info({ subscriptionId: subscription.id }, 'Handling customer.subscription.deleted');

  const dbSubscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: subscription.id },
  });

  if (!dbSubscription) {
    log.error({ subscriptionId: subscription.id }, 'Subscription not found in database');
    return;
  }

  await prisma.subscription.update({
    where: { stripeSubscriptionId: subscription.id },
    data: {
      status: 'CANCELED',
      cancelAtPeriodEnd: false,
    },
  });

  await prisma.user.update({
    where: { id: dbSubscription.userId },
    data: { subscriptionTier: 'FREE' },
  });

  log.info({ subscriptionId: subscription.id, userId: dbSubscription.userId }, 'Subscription canceled, user downgraded to FREE');
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  log.info({ invoiceId: invoice.id }, 'Handling invoice.payment_succeeded');

  const customerId = resolveId(invoice.customer as string | Stripe.Customer | null);
  const subscriptionId = getInvoiceSubscriptionId(invoice);

  if (!customerId) {
    log.error({ invoiceId: invoice.id }, 'Missing customer ID on invoice');
    return;
  }

  const dbSubscription = await prisma.subscription.findFirst({
    where: {
      OR: [
        { stripeCustomerId: customerId },
        ...(subscriptionId ? [{ stripeSubscriptionId: subscriptionId }] : []),
      ],
    },
  });

  if (!dbSubscription) {
    log.error({ invoiceId: invoice.id, customerId }, 'Subscription not found for invoice');
    return;
  }

  // In Stripe SDK v20+, payment_intent is accessed via invoice.payments
  const paymentIntentId =
    (invoice.payments?.data[0]?.payment?.payment_intent as string | undefined) ?? null;

  // Idempotent: check if a payment for this Stripe invoice already exists
  const existingPayment = await prisma.payment.findFirst({
    where: { stripeInvoiceId: invoice.id },
  });

  if (existingPayment) {
    await prisma.payment.update({
      where: { id: existingPayment.id },
      data: {
        stripePaymentId: paymentIntentId,
        amount: centsToPrismaDecimal(invoice.amount_paid),
        status: 'succeeded',
        receiptUrl: invoice.hosted_invoice_url,
        paidAt: new Date(),
      },
    });
  } else {
    await prisma.payment.create({
      data: {
        userId: dbSubscription.userId,
        stripePaymentId: paymentIntentId,
        stripeInvoiceId: invoice.id,
        amount: centsToPrismaDecimal(invoice.amount_paid),
        currency: invoice.currency.toUpperCase(),
        status: 'succeeded',
        description: `Subscription payment - ${invoice.billing_reason}`,
        receiptUrl: invoice.hosted_invoice_url,
        paidAt: new Date(),
      },
    });
  }

  log.info({ invoiceId: invoice.id, userId: dbSubscription.userId }, 'Payment recorded');
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  log.info({ invoiceId: invoice.id }, 'Handling invoice.payment_failed');

  const customerId = resolveId(invoice.customer as string | Stripe.Customer | null);
  const subscriptionId = getInvoiceSubscriptionId(invoice);

  if (!customerId) {
    log.error({ invoiceId: invoice.id }, 'Missing customer ID on invoice');
    return;
  }

  const dbSubscription = await prisma.subscription.findFirst({
    where: {
      OR: [
        { stripeCustomerId: customerId },
        ...(subscriptionId ? [{ stripeSubscriptionId: subscriptionId }] : []),
      ],
    },
  });

  if (!dbSubscription) {
    log.error({ invoiceId: invoice.id, customerId }, 'Subscription not found for invoice');
    return;
  }

  // Idempotent: check if a payment for this Stripe invoice already exists
  const existingPayment = await prisma.payment.findFirst({
    where: { stripeInvoiceId: invoice.id },
  });

  if (existingPayment) {
    await prisma.payment.update({
      where: { id: existingPayment.id },
      data: {
        amount: centsToPrismaDecimal(invoice.amount_due),
        status: 'failed',
        description: `Failed payment - ${invoice.billing_reason}`,
      },
    });
  } else {
    await prisma.payment.create({
      data: {
        userId: dbSubscription.userId,
        stripeInvoiceId: invoice.id,
        amount: centsToPrismaDecimal(invoice.amount_due),
        currency: invoice.currency.toUpperCase(),
        status: 'failed',
        description: `Failed payment - ${invoice.billing_reason}`,
      },
    });
  }

  await prisma.subscription.update({
    where: { id: dbSubscription.id },
    data: { status: 'PAST_DUE' },
  });

  log.info({ invoiceId: invoice.id, userId: dbSubscription.userId }, 'Failed payment recorded, subscription marked PAST_DUE');
}

function mapStripeStatus(stripeStatus: Stripe.Subscription.Status): SubscriptionStatus {
  const statusMap: Record<Stripe.Subscription.Status, SubscriptionStatus> = {
    'incomplete': 'INCOMPLETE',
    'incomplete_expired': 'INCOMPLETE_EXPIRED',
    'trialing': 'TRIALING',
    'active': 'ACTIVE',
    'past_due': 'PAST_DUE',
    'canceled': 'CANCELED',
    'unpaid': 'UNPAID',
    'paused': 'PAUSED',
  };

  return statusMap[stripeStatus] || 'INCOMPLETE';
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await getRawBody(request);
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      );
    }

    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      log.error('STRIPE_WEBHOOK_SECRET is not defined');
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      );
    }

    let event: Stripe.Event;
    try {
      event = getStripe().webhooks.constructEvent(
        rawBody,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      log.error({ error: errorMessage }, 'Webhook signature verification failed');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    log.info({ eventType: event.type, eventId: event.id }, 'Received Stripe webhook event');

    switch (event.type) {
      case STRIPE_CONFIG.WEBHOOK_EVENTS.CHECKOUT_COMPLETED:
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case STRIPE_CONFIG.WEBHOOK_EVENTS.SUBSCRIPTION_UPDATED:
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case STRIPE_CONFIG.WEBHOOK_EVENTS.SUBSCRIPTION_DELETED:
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case STRIPE_CONFIG.WEBHOOK_EVENTS.INVOICE_PAYMENT_SUCCEEDED:
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case STRIPE_CONFIG.WEBHOOK_EVENTS.INVOICE_PAYMENT_FAILED:
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        log.debug({ eventType: event.type }, 'Unhandled webhook event type');
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    log.error({ error }, 'Webhook processing error');
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
