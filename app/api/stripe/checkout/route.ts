/**
 * Stripe Checkout Session API Route
 * 
 * Creates a Stripe Checkout session for subscription signup.
 * 
 * POST /api/stripe/checkout
 * Body: { priceId: string, successUrl: string, cancelUrl: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/src/lib/stripe/client';
import { STRIPE_CONFIG } from '@/src/lib/stripe/config';
import { createClient } from '@/src/lib/supabase/server';
import { PrismaClient } from '@prisma/client';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
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
      STRIPE_CONFIG.PLANS.BASIC.priceId,
      STRIPE_CONFIG.PLANS.PRO.priceId,
    ].filter(Boolean);

    if (!validPriceIds.includes(priceId)) {
      return NextResponse.json(
        { error: 'Invalid price ID' },
        { status: 400 }
      );
    }

    const prisma = new PrismaClient();

    try {
      const dbUser = await prisma.user.findUnique({
        where: { supabaseUserId: user.id },
        include: { subscriptions: true },
      });

      if (!dbUser) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }

      let customerId = dbUser.subscriptions[0]?.stripeCustomerId;

      if (!customerId) {
        const customer = await stripe.customers.create({
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

      const session = await stripe.checkout.sessions.create({
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
        success_url: successUrl || `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard?checkout=success`,
        cancel_url: cancelUrl || `${process.env.NEXT_PUBLIC_SITE_URL}/pricing?checkout=canceled`,
        metadata: {
          userId: dbUser.id,
          priceId: priceId,
        },
      });

      return NextResponse.json({ sessionId: session.id, url: session.url });
    } finally {
      await prisma.$disconnect();
    }
  } catch (error) {
    console.error('Stripe checkout error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
