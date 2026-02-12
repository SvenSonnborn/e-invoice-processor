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
import { prisma } from '@/src/lib/db/client';
import { logger } from '@/src/lib/logging/logger';
import { getMyUserOrThrow } from '@/src/lib/auth/session';
import { ApiError } from '@/src/lib/errors/api-error';

const log = logger.child({ module: 'stripe-portal' });

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

    const { returnUrl } = body as Record<string, string | undefined>;

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: { subscriptions: true },
    });

    if (!dbUser || !dbUser.subscriptions[0]?.stripeCustomerId) {
      throw ApiError.notFound('No active subscription found');
    }

    const customerId = dbUser.subscriptions[0].stripeCustomerId;

    const session = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl || `${process.env.NEXT_PUBLIC_SITE_URL}/settings`,
    });

    log.info({ userId: dbUser.id }, 'Portal session created');

    return NextResponse.json({ success: true, url: session.url });
  } catch (error) {
    if (error instanceof ApiError) return error.toResponse();
    log.error({ error }, 'Stripe portal error');
    return ApiError.internal('Failed to create portal session').toResponse();
  }
}
