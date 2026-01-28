-- ============================================================================
-- RLS Policies for InvoiceLineItem and InvoiceRevision
-- ============================================================================
-- This script adds RLS policies for InvoiceLineItem and InvoiceRevision tables.
-- These tables check permissions through Invoice.organizationId -> OrganizationMember
-- ============================================================================

-- Enable RLS on the tables
ALTER TABLE "InvoiceLineItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InvoiceRevision" ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- INVOICE LINE ITEM POLICIES
-- ============================================================================

-- Drop policies if they exist (idempotent)
DROP POLICY IF EXISTS "invoice_line_items_select_member" ON "InvoiceLineItem";
DROP POLICY IF EXISTS "invoice_line_items_insert_member" ON "InvoiceLineItem";
DROP POLICY IF EXISTS "invoice_line_items_update_member" ON "InvoiceLineItem";
DROP POLICY IF EXISTS "invoice_line_items_delete_member" ON "InvoiceLineItem";

CREATE POLICY "invoice_line_items_select_member"
ON "InvoiceLineItem" FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM "Invoice" i
    JOIN "OrganizationMember" om ON om."organizationId" = i."organizationId"
    JOIN "User" u ON u."id" = om."userId"
    WHERE i."id" = "InvoiceLineItem"."invoiceId"
    AND u."supabaseUserId"::text = auth.uid()::text
  )
);

CREATE POLICY "invoice_line_items_insert_member"
ON "InvoiceLineItem" FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM "Invoice" i
    JOIN "OrganizationMember" om ON om."organizationId" = i."organizationId"
    JOIN "User" u ON u."id" = om."userId"
    WHERE i."id" = "InvoiceLineItem"."invoiceId"
    AND u."supabaseUserId"::text = auth.uid()::text
  )
);

CREATE POLICY "invoice_line_items_update_member"
ON "InvoiceLineItem" FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM "Invoice" i
    JOIN "OrganizationMember" om ON om."organizationId" = i."organizationId"
    JOIN "User" u ON u."id" = om."userId"
    WHERE i."id" = "InvoiceLineItem"."invoiceId"
    AND u."supabaseUserId"::text = auth.uid()::text
  )
);

CREATE POLICY "invoice_line_items_delete_member"
ON "InvoiceLineItem" FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM "Invoice" i
    JOIN "OrganizationMember" om ON om."organizationId" = i."organizationId"
    JOIN "User" u ON u."id" = om."userId"
    WHERE i."id" = "InvoiceLineItem"."invoiceId"
    AND u."supabaseUserId"::text = auth.uid()::text
  )
);

-- ============================================================================
-- INVOICE REVISION POLICIES
-- ============================================================================

-- Drop policies if they exist (idempotent)
DROP POLICY IF EXISTS "invoice_revisions_select_member" ON "InvoiceRevision";
DROP POLICY IF EXISTS "invoice_revisions_insert_member" ON "InvoiceRevision";
DROP POLICY IF EXISTS "invoice_revisions_update_member" ON "InvoiceRevision";
DROP POLICY IF EXISTS "invoice_revisions_delete_member" ON "InvoiceRevision";

CREATE POLICY "invoice_revisions_select_member"
ON "InvoiceRevision" FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM "Invoice" i
    JOIN "OrganizationMember" om ON om."organizationId" = i."organizationId"
    JOIN "User" u ON u."id" = om."userId"
    WHERE i."id" = "InvoiceRevision"."invoiceId"
    AND u."supabaseUserId"::text = auth.uid()::text
  )
);

CREATE POLICY "invoice_revisions_insert_member"
ON "InvoiceRevision" FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM "Invoice" i
    JOIN "OrganizationMember" om ON om."organizationId" = i."organizationId"
    JOIN "User" u ON u."id" = om."userId"
    WHERE i."id" = "InvoiceRevision"."invoiceId"
    AND u."supabaseUserId"::text = auth.uid()::text
  )
);

CREATE POLICY "invoice_revisions_update_member"
ON "InvoiceRevision" FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM "Invoice" i
    JOIN "OrganizationMember" om ON om."organizationId" = i."organizationId"
    JOIN "User" u ON u."id" = om."userId"
    WHERE i."id" = "InvoiceRevision"."invoiceId"
    AND u."supabaseUserId"::text = auth.uid()::text
  )
);

CREATE POLICY "invoice_revisions_delete_member"
ON "InvoiceRevision" FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM "Invoice" i
    JOIN "OrganizationMember" om ON om."organizationId" = i."organizationId"
    JOIN "User" u ON u."id" = om."userId"
    WHERE i."id" = "InvoiceRevision"."invoiceId"
    AND u."supabaseUserId"::text = auth.uid()::text
  )
);

-- ============================================================================
-- DONE!
-- ============================================================================
