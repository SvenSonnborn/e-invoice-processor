-- 1) Pre-flight checks: strict tenant ownership requires non-null organizationId
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Upload" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'Cannot apply migration: Upload.organizationId contains NULL values';
  END IF;

  IF EXISTS (SELECT 1 FROM "Invoice" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'Cannot apply migration: Invoice.organizationId contains NULL values';
  END IF;

  IF EXISTS (SELECT 1 FROM "Export" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'Cannot apply migration: Export.organizationId contains NULL values';
  END IF;
END $$;

-- 2) Enforce strict tenant ownership with non-null FKs
ALTER TABLE "Upload" DROP CONSTRAINT IF EXISTS "Upload_organizationId_fkey";
ALTER TABLE "Invoice" DROP CONSTRAINT IF EXISTS "Invoice_organizationId_fkey";
ALTER TABLE "Export" DROP CONSTRAINT IF EXISTS "Export_organizationId_fkey";

ALTER TABLE "Upload"
  ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "Invoice"
  ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "Export"
  ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "Upload"
  ADD CONSTRAINT "Upload_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Export"
  ADD CONSTRAINT "Export_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 3) Convert Payment.status (text -> enum)
CREATE TYPE "PaymentStatus" AS ENUM ('succeeded', 'failed', 'pending');

ALTER TABLE "Payment" ADD COLUMN "status_new" "PaymentStatus";

UPDATE "Payment"
SET "status_new" = CASE LOWER(COALESCE("status", 'pending'))
  WHEN 'succeeded' THEN 'succeeded'::"PaymentStatus"
  WHEN 'failed' THEN 'failed'::"PaymentStatus"
  WHEN 'pending' THEN 'pending'::"PaymentStatus"
  ELSE 'pending'::"PaymentStatus"
END;

ALTER TABLE "Payment"
  DROP COLUMN "status";

ALTER TABLE "Payment"
  RENAME COLUMN "status_new" TO "status";

ALTER TABLE "Payment"
  ALTER COLUMN "status" SET NOT NULL;

-- 4) Convert WaitlistEntry.tier (text -> enum)
CREATE TYPE "WaitlistTier" AS ENUM ('pro', 'business');

ALTER TABLE "WaitlistEntry" ADD COLUMN "tier_new" "WaitlistTier";

UPDATE "WaitlistEntry"
SET "tier_new" = CASE LOWER(COALESCE("tier", 'pro'))
  WHEN 'pro' THEN 'pro'::"WaitlistTier"
  WHEN 'business' THEN 'business'::"WaitlistTier"
  WHEN 'basic' THEN 'pro'::"WaitlistTier"
  ELSE 'pro'::"WaitlistTier"
END;

ALTER TABLE "WaitlistEntry"
  DROP COLUMN "tier";

ALTER TABLE "WaitlistEntry"
  RENAME COLUMN "tier_new" TO "tier";

ALTER TABLE "WaitlistEntry"
  ALTER COLUMN "tier" SET NOT NULL,
  ALTER COLUMN "tier" SET DEFAULT 'pro';
