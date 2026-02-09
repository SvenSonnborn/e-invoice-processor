/**
 * Subscription Service
 * 
 * Helper functions for managing subscription-based features and usage limits.
 */

import type { SubscriptionTier } from '@/src/generated/prisma/client';
import { prisma } from '@/src/lib/db/client';
import { STRIPE_CONFIG } from './config';
import type { Plan, PlanId } from './config';

// ---------------------------------------------------------------------------
// Tier & subscription helpers
// ---------------------------------------------------------------------------

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

  const planKey = tier as PlanId;
  return STRIPE_CONFIG.PLANS[planKey] ?? null;
}

// ---------------------------------------------------------------------------
// Billing period helper
// ---------------------------------------------------------------------------

/**
 * Get the start of the current billing period for a user.
 * Falls back to the start of the current calendar month if no subscription exists.
 */
async function getBillingPeriodStart(userId: string): Promise<Date> {
  const subscription = await getUserSubscription(userId);

  if (subscription?.currentPeriodStart) {
    return subscription.currentPeriodStart;
  }

  // Fallback: start of current calendar month
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

// ---------------------------------------------------------------------------
// Calendar month helpers (useful for UI display)
// ---------------------------------------------------------------------------

/**
 * Count invoices for user in current calendar month
 */
export async function countUserInvoicesThisMonth(userId: string): Promise<number> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const count = await prisma.invoice.count({
    where: {
      createdBy: userId,
      createdAt: {
        gte: startOfMonth,
        lte: endOfMonth,
      },
    },
  });

  return count;
}

/**
 * Count exports for user in current calendar month
 */
export async function countUserExportsThisMonth(userId: string): Promise<number> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const count = await prisma.export.count({
    where: {
      createdBy: userId,
      createdAt: {
        gte: startOfMonth,
        lte: endOfMonth,
      },
    },
  });

  return count;
}

/**
 * Get remaining invoices for user this month
 */
export async function getRemainingInvoices(userId: string): Promise<number> {
  const tier = await getUserSubscriptionTier(userId);

  if (tier === 'FREE') {
    return 0;
  }

  const planKey = tier as PlanId;
  const plan = STRIPE_CONFIG.PLANS[planKey];
  if (!plan || plan.limits.invoicesPerMonth === -1) {
    return -1; // Unlimited
  }

  const periodStart = await getBillingPeriodStart(userId);
  const currentCount = await prisma.invoice.count({
    where: {
      createdBy: userId,
      createdAt: { gte: periodStart },
    },
  });
  return Math.max(0, plan.limits.invoicesPerMonth - currentCount);
}

// ---------------------------------------------------------------------------
// Usage limit checks
// ---------------------------------------------------------------------------

export async function canCreateInvoice(userId: string): Promise<{ allowed: boolean; reason?: string }> {
  const tier = await getUserSubscriptionTier(userId);

  if (tier === 'FREE') {
    return { 
      allowed: false, 
      reason: 'Upgrade to Basic or Pro to create invoices' 
    };
  }

  const planKey = tier as PlanId;
  const plan = STRIPE_CONFIG.PLANS[planKey];
  if (!plan) {
    return { allowed: false, reason: 'Invalid subscription plan' };
  }

  // Unlimited invoices
  if (plan.limits.invoicesPerMonth === -1) {
    return { allowed: true };
  }

  // Count invoices created in the current billing period
  const periodStart = await getBillingPeriodStart(userId);
  const usedCount = await prisma.invoice.count({
    where: {
      createdBy: userId,
      createdAt: { gte: periodStart },
    },
  });

  if (usedCount >= plan.limits.invoicesPerMonth) {
    return {
      allowed: false,
      reason: `Monthly invoice limit reached (${usedCount}/${plan.limits.invoicesPerMonth}). Upgrade your plan for more.`,
    };
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

  const planKey = tier as PlanId;
  const plan = STRIPE_CONFIG.PLANS[planKey];
  if (!plan) {
    return { allowed: false, reason: 'Invalid subscription plan' };
  }

  // Unlimited exports
  if (plan.limits.exportsPerMonth === -1) {
    return { allowed: true };
  }

  // Count exports created in the current billing period
  const periodStart = await getBillingPeriodStart(userId);
  const usedCount = await prisma.export.count({
    where: {
      createdBy: userId,
      createdAt: { gte: periodStart },
    },
  });

  if (usedCount >= plan.limits.exportsPerMonth) {
    return {
      allowed: false,
      reason: `Monthly export limit reached (${usedCount}/${plan.limits.exportsPerMonth}). Upgrade your plan for more.`,
    };
  }

  return { allowed: true };
}

export async function hasApiAccess(userId: string): Promise<boolean> {
  const tier = await getUserSubscriptionTier(userId);

  if (tier === 'FREE') {
    return false;
  }

  const planKey = tier as PlanId;
  const plan = STRIPE_CONFIG.PLANS[planKey];
  return plan?.limits.apiAccess ?? false;
}

export async function hasPriorityProcessing(userId: string): Promise<boolean> {
  const tier = await getUserSubscriptionTier(userId);

  if (tier === 'FREE') {
    return false;
  }

  const planKey = tier as PlanId;
  const plan = STRIPE_CONFIG.PLANS[planKey];
  return plan?.limits.priorityProcessing ?? false;
}

// ---------------------------------------------------------------------------
// Usage stats
// ---------------------------------------------------------------------------

export async function getUsageStats(userId: string) {
  const tier = await getUserSubscriptionTier(userId);
  const planKey = tier as PlanId;
  const plan = tier !== 'FREE' ? STRIPE_CONFIG.PLANS[planKey] : null;

  const periodStart = await getBillingPeriodStart(userId);

  const [invoiceCount, exportCount] = await Promise.all([
    prisma.invoice.count({
      where: {
        createdBy: userId,
        createdAt: { gte: periodStart },
      },
    }),
    prisma.export.count({
      where: {
        createdBy: userId,
        createdAt: { gte: periodStart },
      },
    }),
  ]);

  return {
    tier,
    invoices: {
      used: invoiceCount,
      limit: plan?.limits.invoicesPerMonth ?? 0,
      unlimited: plan?.limits.invoicesPerMonth === -1,
    },
    exports: {
      used: exportCount,
      limit: plan?.limits.exportsPerMonth ?? 0,
      unlimited: plan?.limits.exportsPerMonth === -1,
    },
    apiAccess: plan?.limits.apiAccess ?? false,
    priorityProcessing: plan?.limits.priorityProcessing ?? false,
  };
}
