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
import { createSupabaseServerClient } from '@/src/lib/supabase/server';
import { prisma } from '@/src/lib/db/client';
import { logger } from '@/src/lib/logging/logger';

const log = logger.child({ module: 'stripe-checkout' });

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { priceId, successUrl, cancelUrl } = body;

    if (!priceId) {
      return NextResponse.json(
        { error: 'Price ID is required' },
        { status: 400 }
      );
    }

    const validPriceIds = [
      STRIPE_CONFIG.PLANS.PRO.priceId,
      STRIPE_CONFIG.PLANS.BUSINESS.priceId,
    ].filter(Boolean);

    if (!validPriceIds.includes(priceId)) {
      return NextResponse.json({ error: 'Invalid price ID' }, { status: 400 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { supabaseUserId: user.id },
      include: { subscriptions: true },
    });

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let customerId = dbUser.subscriptions[0]?.stripeCustomerId;

    if (!customerId) {
      const customer = await getStripe().customers.create({
        email: user.email,
        name: dbUser.name || user.email,
        metadata: {
          userId: dbUser.id,
          supabaseUserId: user.id,
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

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    log.error({ error }, 'Stripe checkout error');
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
