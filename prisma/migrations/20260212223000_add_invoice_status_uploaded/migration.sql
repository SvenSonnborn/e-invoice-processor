-- Add UPLOADED invoice status for initial upload state
ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'UPLOADED';
