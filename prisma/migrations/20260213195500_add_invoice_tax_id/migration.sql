ALTER TABLE "Invoice"
ADD COLUMN "taxId" TEXT;

CREATE INDEX "Invoice_taxId_idx" ON "Invoice"("taxId");
