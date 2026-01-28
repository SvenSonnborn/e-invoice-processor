-- CreateEnum
CREATE TYPE "ExportStatus" AS ENUM ('CREATED', 'GENERATING', 'READY', 'FAILED');

-- AlterTable
ALTER TABLE "Export" ADD COLUMN     "createdBy" TEXT,
ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "status" "ExportStatus" NOT NULL DEFAULT 'CREATED';

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "createdBy" TEXT;

-- CreateIndex
CREATE INDEX "Export_status_idx" ON "Export"("status");

-- CreateIndex
CREATE INDEX "Export_createdBy_idx" ON "Export"("createdBy");

-- CreateIndex
CREATE INDEX "Invoice_createdBy_idx" ON "Invoice"("createdBy");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Export" ADD CONSTRAINT "Export_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
