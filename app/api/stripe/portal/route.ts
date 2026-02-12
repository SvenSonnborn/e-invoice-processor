/**
 * Stripe Customer Portal API Route
 *
 * Creates a Stripe Customer Portal session for managing subscriptions.
 *
 * POST /api/stripe/portal
 * Body: { returnUrl: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/src/lib/stripe/client';
import { createSupabaseServerClient } from '@/src/lib/supabase/server';
import { prisma } from '@/src/lib/db/client';
import { logger } from '@/src/lib/logging/logger';

const log = logger.child({ module: 'stripe-portal' });

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
    const { returnUrl } = body;

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

    const session = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl || `${process.env.NEXT_PUBLIC_SITE_URL}/settings`,
    });

    log.info({ userId: dbUser.id }, 'Portal session created');

    return NextResponse.json({ url: session.url });
  } catch (error) {
    log.error({ error }, 'Stripe portal error');
    return NextResponse.json(
      { error: 'Failed to create portal session' },
      { status: 500 }
    );
  }
}
