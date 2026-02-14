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
import { resolveStripeRedirectUrl } from '@/src/lib/stripe/redirect-url';

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

    const returnUrl =
      typeof body.returnUrl === 'string' ? body.returnUrl : undefined;

    if (
      body.returnUrl !== undefined &&
      body.returnUrl !== null &&
      typeof body.returnUrl !== 'string'
    ) {
      throw ApiError.validationError('returnUrl must be a string');
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: { subscriptions: true },
    });

    if (!dbUser || !dbUser.subscriptions[0]?.stripeCustomerId) {
      throw ApiError.notFound('No active subscription found');
    }

    const customerId = dbUser.subscriptions[0].stripeCustomerId;
    const safeReturnUrl = resolveStripeRedirectUrl({
      requestUrl: request.url,
      value: returnUrl,
      defaultPath: '/settings',
      fieldName: 'returnUrl',
    });

    const session = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: safeReturnUrl,
    });

    log.info({ userId: dbUser.id }, 'Portal session created');

    return NextResponse.json({ success: true, url: session.url });
  } catch (error) {
    if (error instanceof ApiError) return error.toResponse();
    log.error({ error }, 'Stripe portal error');
    return ApiError.internal('Failed to create portal session').toResponse();
  }
}
