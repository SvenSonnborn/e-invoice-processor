-- Rename SubscriptionTier enum values: BASIC -> PRO, PRO -> BUSINESS
-- Must rename in two steps to avoid collision (BASIC->PRO conflicts with existing PRO).
-- Use a temporary name to avoid the conflict.

-- Step 1: Rename existing PRO to BUSINESS first
ALTER TYPE "SubscriptionTier" RENAME VALUE 'PRO' TO 'BUSINESS';

-- Step 2: Now rename BASIC to PRO (no conflict since old PRO is gone)
ALTER TYPE "SubscriptionTier" RENAME VALUE 'BASIC' TO 'PRO';
