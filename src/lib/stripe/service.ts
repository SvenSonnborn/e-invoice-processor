/**
 * Subscription Service
 * 
 * Helper functions for managing subscription-based features and usage limits.
 */

import { PrismaClient, SubscriptionTier } from '@prisma/client';
import { STRIPE_CONFIG } from './config';
import type { Plan } from './config';

const prisma = new PrismaClient();

export async function getUserSubscriptionTier(userId: string): Promise<SubscriptionTier> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { subscriptionTier: true },
  });

  return user?.subscriptionTier || 'FREE';
}

export async function getUserSubscription(userId: string) {
  const subscription = await prisma.subscription.findFirst({
    where: { 
      userId,
      status: { in: ['TRIALING', 'ACTIVE'] },
    },
    orderBy: { createdAt: 'desc' },
  });

  return subscription;
}

export async function hasActiveSubscription(userId: string): Promise<boolean> {
  const subscription = await getUserSubscription(userId);
  return subscription !== null;
}

export async function isInTrialPeriod(userId: string): Promise<boolean> {
  const subscription = await prisma.subscription.findFirst({
    where: { 
      userId,
      status: 'TRIALING',
    },
  });

  if (!subscription?.trialEnd) {
    return false;
  }

  return new Date() < subscription.trialEnd;
}

export async function getUserPlan(userId: string): Promise<Plan | null> {
  const tier = await getUserSubscriptionTier(userId);
  
  if (tier === 'FREE') {
    return null;
  }

  return STRIPE_CONFIG.PLANS[tier] || null;
}

export async function canCreateInvoice(userId: string): Promise<{ allowed: boolean; reason?: string }> {
  const tier = await getUserSubscriptionTier(userId);

  if (tier === 'FREE') {
    return { 
      allowed: false, 
      reason: 'Upgrade to Basic or Pro to create invoices' 
    };
  }

  const plan = STRIPE_CONFIG.PLANS[tier];
  if (!plan) {
    return { allowed: false, reason: 'Invalid subscription plan' };
  }

  if (plan.limits.invoicesPerMonth === -1) {
    return { allowed: true };
  }

  return { allowed: true };
}

export async function canCreateExport(userId: string): Promise<{ allowed: boolean; reason?: string }> {
  const tier = await getUserSubscriptionTier(userId);

  if (tier === 'FREE') {
    return { 
      allowed: false, 
      reason: 'Upgrade to Basic or Pro to create exports' 
    };
  }

  return { allowed: true };
}

export async function hasApiAccess(userId: string): Promise<boolean> {
  const tier = await getUserSubscriptionTier(userId);

  if (tier === 'FREE') {
    return false;
  }

  const plan = STRIPE_CONFIG.PLANS[tier];
  return plan?.limits.apiAccess || false;
}

export async function hasPriorityProcessing(userId: string): Promise<boolean> {
  const tier = await getUserSubscriptionTier(userId);

  if (tier === 'FREE') {
    return false;
  }

  const plan = STRIPE_CONFIG.PLANS[tier];
  return plan?.limits.priorityProcessing || false;
}

export async function getUsageStats(userId: string) {
  const tier = await getUserSubscriptionTier(userId);
  const plan = tier !== 'FREE' ? STRIPE_CONFIG.PLANS[tier] : null;

  return {
    tier,
    invoices: {
      used: 0,
      limit: plan?.limits.invoicesPerMonth || 0,
      unlimited: plan?.limits.invoicesPerMonth === -1,
    },
    exports: {
      used: 0,
      limit: plan?.limits.exportsPerMonth || 0,
      unlimited: plan?.limits.exportsPerMonth === -1,
    },
    apiAccess: plan?.limits.apiAccess || false,
    priorityProcessing: plan?.limits.priorityProcessing || false,
  };
}
