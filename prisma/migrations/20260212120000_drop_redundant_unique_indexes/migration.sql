-- Drop redundant non-unique indexes where a unique index already exists
DROP INDEX IF EXISTS "User_supabaseUserId_idx";
DROP INDEX IF EXISTS "Subscription_stripeCustomerId_idx";
DROP INDEX IF EXISTS "Subscription_stripeSubscriptionId_idx";
DROP INDEX IF EXISTS "Payment_stripePaymentId_idx";
DROP INDEX IF EXISTS "WaitlistEntry_email_idx";
DROP INDEX IF EXISTS "WaitlistEntry_referralCode_idx";
