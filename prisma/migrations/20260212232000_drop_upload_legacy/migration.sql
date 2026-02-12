-- Drop legacy Upload relation from Invoice
ALTER TABLE "Invoice" DROP CONSTRAINT IF EXISTS "Invoice_uploadId_fkey";
DROP INDEX IF EXISTS "Invoice_uploadId_key";
ALTER TABLE "Invoice" DROP COLUMN IF EXISTS "uploadId";

-- Drop legacy Upload table
DROP TABLE IF EXISTS "Upload";
