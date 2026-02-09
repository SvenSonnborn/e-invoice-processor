/**
 * Stripe Customer Portal API Route
 * 
 * Creates a Stripe Customer Portal session for managing subscriptions.
 * 
 * POST /api/stripe/portal
 * Body: { returnUrl: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/src/lib/stripe/client';
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
    const { returnUrl } = body;

    const prisma = new PrismaClient();

    try {
      const dbUser = await prisma.user.findUnique({
        where: { supabaseUserId: user.id },
        include: { subscriptions: true },
      });

      if (!dbUser || !dbUser.subscriptions[0]?.stripeCustomerId) {
        return NextResponse.json(
          { error: 'No active subscription found' },
          { status: 404 }
        );
      }

      const customerId = dbUser.subscriptions[0].stripeCustomerId;

      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl || `${process.env.NEXT_PUBLIC_SITE_URL}/settings`,
      });

      return NextResponse.json({ url: session.url });
    } finally {
      await prisma.$disconnect();
    }
  } catch (error) {
    console.error('Stripe portal error:', error);
    return NextResponse.json(
      { error: 'Failed to create portal session' },
      { status: 500 }
    );
  }
}
