-- CreateTable
CREATE TABLE "InvoiceLineItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "positionIndex" INTEGER NOT NULL,
    "description" TEXT,
    "quantity" DECIMAL(18,4),
    "unitPrice" DECIMAL(18,4),
    "taxRate" DECIMAL(5,2),
    "netAmount" DECIMAL(18,2),
    "taxAmount" DECIMAL(18,2),
    "grossAmount" DECIMAL(18,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InvoiceLineItem_invoiceId_idx" ON "InvoiceLineItem"("invoiceId");

-- CreateIndex
CREATE INDEX "InvoiceLineItem_positionIndex_idx" ON "InvoiceLineItem"("positionIndex");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceLineItem_invoiceId_positionIndex_key" ON "InvoiceLineItem"("invoiceId", "positionIndex");

-- AddForeignKey
ALTER TABLE "InvoiceLineItem" ADD CONSTRAINT "InvoiceLineItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
