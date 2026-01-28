-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('CREATED', 'PARSED', 'VALIDATED', 'EXPORTED', 'FAILED');

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "lastProcessedAt" TIMESTAMP(3),
ADD COLUMN     "processingVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "status" "InvoiceStatus" NOT NULL DEFAULT 'CREATED';

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");
