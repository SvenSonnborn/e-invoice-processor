-- Ensure invoice numbers are unique within an organization.
-- Multiple NULL values are still allowed by PostgreSQL unique indexes.
CREATE UNIQUE INDEX "Invoice_organizationId_number_key"
ON "Invoice"("organizationId", "number");
