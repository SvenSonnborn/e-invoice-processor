/**
 * Stripe Checkout Session API Route
 *
 * Creates a Stripe Checkout session for subscription signup.
 *
 * POST /api/stripe/checkout
 * Body: { priceId: string, successUrl: string, cancelUrl: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/src/lib/stripe/client';
import { STRIPE_CONFIG } from '@/src/lib/stripe/config';
import { prisma } from '@/src/lib/db/client';
import { logger } from '@/src/lib/logging/logger';
import { getMyUserOrThrow } from '@/src/lib/auth/session';
import { ApiError } from '@/src/lib/errors/api-error';

const log = logger.child({ module: 'stripe-checkout' });

export async function POST(request: NextRequest) {
  try {
    const user = await getMyUserOrThrow();

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      throw ApiError.validationError('Invalid JSON body');
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw ApiError.validationError('Request body must be a JSON object');
    }

    const { priceId, successUrl, cancelUrl } = body as Record<string, string | undefined>;

    if (!priceId) {
      throw ApiError.validationError('Price ID is required');
    }

    const validPriceIds = [
      STRIPE_CONFIG.PLANS.PRO.priceId,
      STRIPE_CONFIG.PLANS.BUSINESS.priceId,
    ].filter(Boolean);

    if (!validPriceIds.includes(priceId)) {
      throw ApiError.validationError('Invalid price ID');
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: { subscriptions: true },
    });

    if (!dbUser) {
      throw ApiError.notFound('User not found');
    }

    let customerId = dbUser.subscriptions[0]?.stripeCustomerId;

    if (!customerId) {
      const customer = await getStripe().customers.create({
        email: user.email,
        name: dbUser.name || user.email,
        metadata: {
          userId: dbUser.id,
          supabaseUserId: dbUser.supabaseUserId || '',
        },
      });
      customerId = customer.id;

      await prisma.subscription.create({
        data: {
          userId: dbUser.id,
          stripeCustomerId: customerId,
          status: 'INCOMPLETE',
          tier: 'FREE',
        },
      });
    }

    const session = await getStripe().checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      subscription_data: {
        trial_period_days: STRIPE_CONFIG.TRIAL_PERIOD_DAYS,
        metadata: {
          userId: dbUser.id,
        },
      },
      success_url:
        successUrl ||
        `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard?checkout=success`,
      cancel_url:
        cancelUrl ||
        `${process.env.NEXT_PUBLIC_SITE_URL}/pricing?checkout=canceled`,
      metadata: {
        userId: dbUser.id,
        priceId: priceId,
      },
    });

    log.info(
      { userId: dbUser.id, sessionId: session.id },
      'Checkout session created'
    );

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    if (error instanceof ApiError) return error.toResponse();
    log.error({ error }, 'Stripe checkout error');
    return ApiError.internal('Failed to create checkout session').toResponse();
  }
}
