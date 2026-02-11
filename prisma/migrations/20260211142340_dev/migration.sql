-- CreateEnum
CREATE TYPE "GoBDComplianceStatus" AS ENUM ('COMPLIANT', 'NON_COMPLIANT', 'WARNING');

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "gobdStatus" "GoBDComplianceStatus",
ADD COLUMN     "gobdValidatedAt" TIMESTAMP(3),
ADD COLUMN     "gobdViolations" JSONB;

-- CreateTable
CREATE TABLE "WaitlistEntry" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "tier" TEXT NOT NULL DEFAULT 'pro',
    "earlyBird" BOOLEAN NOT NULL DEFAULT true,
    "referralCode" TEXT NOT NULL,
    "referredBy" TEXT,
    "emailSent" BOOLEAN NOT NULL DEFAULT false,
    "emailSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WaitlistEntry_email_key" ON "WaitlistEntry"("email");

-- CreateIndex
CREATE UNIQUE INDEX "WaitlistEntry_referralCode_key" ON "WaitlistEntry"("referralCode");

-- CreateIndex
CREATE INDEX "WaitlistEntry_email_idx" ON "WaitlistEntry"("email");

-- CreateIndex
CREATE INDEX "WaitlistEntry_referralCode_idx" ON "WaitlistEntry"("referralCode");

-- CreateIndex
CREATE INDEX "WaitlistEntry_createdAt_idx" ON "WaitlistEntry"("createdAt");
