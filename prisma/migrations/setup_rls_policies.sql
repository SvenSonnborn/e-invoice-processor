-- ============================================================================
-- Supabase Row Level Security (RLS) Setup
-- ============================================================================
-- This script enables RLS on all tables and creates policies for multi-tenant
-- access control based on OrganizationMember relationships.
--
-- IMPORTANT: This file uses inline subqueries on OrganizationMember.
-- The companion script `fix_rls_recursion.sql` MUST be applied afterwards.
-- It drops and recreates key policies using SECURITY DEFINER helper functions
-- to avoid infinite recursion when OrganizationMember policies evaluate
-- subqueries against OrganizationMember itself.
--
-- Preferred execution: `bun scripts/setup-rls.ts` (applies both in order).
-- Manual: psql $DATABASE_URL -f prisma/migrations/setup_rls_policies.sql
-- ============================================================================

-- ============================================================================
-- 1. ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE "Organization" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrganizationMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "File" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Invoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InvoiceLineItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InvoiceRevision" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Export" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExportInvoice" ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. USER POLICIES
-- ============================================================================

-- User kann eigene Daten sehen
CREATE POLICY "users_select_own"
ON "User" FOR SELECT
USING ("supabaseUserId"::text = auth.uid()::text);

-- User kann eigene Daten updaten
CREATE POLICY "users_update_own"
ON "User" FOR UPDATE
USING ("supabaseUserId"::text = auth.uid()::text);

-- User kann sich selbst erstellen (Sign-Up)
CREATE POLICY "users_insert_own"
ON "User" FOR INSERT
WITH CHECK ("supabaseUserId"::text = auth.uid()::text);

-- ============================================================================
-- 3. ORGANIZATION POLICIES
-- ============================================================================

-- User sieht alle Orgs, in denen er Member ist
CREATE POLICY "organizations_select_member"
ON "Organization" FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM "OrganizationMember" om
    JOIN "User" u ON u."id" = om."userId"
    WHERE om."organizationId" = "Organization"."id"
    AND u."supabaseUserId"::text = auth.uid()::text
  )
);

-- Jeder authentifizierte User kann Org erstellen
CREATE POLICY "organizations_insert_authenticated"
ON "Organization" FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Nur OWNER/ADMIN kann Org updaten
CREATE POLICY "organizations_update_owner_admin"
ON "Organization" FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM "OrganizationMember" om
    JOIN "User" u ON u."id" = om."userId"
    WHERE om."organizationId" = "Organization"."id"
    AND u."supabaseUserId"::text = auth.uid()::text
    AND om."role" IN ('OWNER', 'ADMIN')
  )
);

-- Nur OWNER kann Org löschen
CREATE POLICY "organizations_delete_owner"
ON "Organization" FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM "OrganizationMember" om
    JOIN "User" u ON u."id" = om."userId"
    WHERE om."organizationId" = "Organization"."id"
    AND u."supabaseUserId"::text = auth.uid()::text
    AND om."role" = 'OWNER'
  )
);

-- ============================================================================
-- 4. ORGANIZATION MEMBER POLICIES
-- ============================================================================

-- Members sehen alle Members der eigenen Orgs
CREATE POLICY "members_select_own_org"
ON "OrganizationMember" FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM "OrganizationMember" om2
    JOIN "User" u ON u."id" = om2."userId"
    WHERE om2."organizationId" = "OrganizationMember"."organizationId"
    AND u."supabaseUserId"::text = auth.uid()::text
  )
);

-- Neue Memberships können nur von OWNER/ADMIN erstellt werden
CREATE POLICY "members_insert_owner_admin"
ON "OrganizationMember" FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM "OrganizationMember" om
    JOIN "User" u ON u."id" = om."userId"
    WHERE om."organizationId" = "OrganizationMember"."organizationId"
    AND u."supabaseUserId"::text = auth.uid()::text
    AND om."role" IN ('OWNER', 'ADMIN')
  )
);

-- Nur OWNER/ADMIN kann Memberships updaten
CREATE POLICY "members_update_owner_admin"
ON "OrganizationMember" FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM "OrganizationMember" om
    JOIN "User" u ON u."id" = om."userId"
    WHERE om."organizationId" = "OrganizationMember"."organizationId"
    AND u."supabaseUserId"::text = auth.uid()::text
    AND om."role" IN ('OWNER', 'ADMIN')
  )
);

-- OWNER kann Members löschen, jeder kann sich selbst entfernen
CREATE POLICY "members_delete_owner_or_self"
ON "OrganizationMember" FOR DELETE
USING (
  -- User kann sich selbst entfernen
  EXISTS (
    SELECT 1 FROM "User" u
    WHERE u."id" = "OrganizationMember"."userId"
    AND u."supabaseUserId"::text = auth.uid()::text
  )
  OR
  -- OWNER kann Members entfernen
  EXISTS (
    SELECT 1 FROM "OrganizationMember" om
    JOIN "User" u ON u."id" = om."userId"
    WHERE om."organizationId" = "OrganizationMember"."organizationId"
    AND u."supabaseUserId"::text = auth.uid()::text
    AND om."role" = 'OWNER'
  )
);

-- ============================================================================
-- 5. FILE POLICIES
-- ============================================================================

CREATE POLICY "files_select_member"
ON "File" FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM "OrganizationMember" om
    JOIN "User" u ON u."id" = om."userId"
    WHERE om."organizationId" = "File"."organizationId"
    AND u."supabaseUserId"::text = auth.uid()::text
  )
);

CREATE POLICY "files_insert_member"
ON "File" FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM "OrganizationMember" om
    JOIN "User" u ON u."id" = om."userId"
    WHERE om."organizationId" = "File"."organizationId"
    AND u."supabaseUserId"::text = auth.uid()::text
  )
);

CREATE POLICY "files_update_member"
ON "File" FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM "OrganizationMember" om
    JOIN "User" u ON u."id" = om."userId"
    WHERE om."organizationId" = "File"."organizationId"
    AND u."supabaseUserId"::text = auth.uid()::text
  )
);

CREATE POLICY "files_delete_member"
ON "File" FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM "OrganizationMember" om
    JOIN "User" u ON u."id" = om."userId"
    WHERE om."organizationId" = "File"."organizationId"
    AND u."supabaseUserId"::text = auth.uid()::text
  )
);

-- ============================================================================
-- 6. INVOICE POLICIES
-- ============================================================================

CREATE POLICY "invoices_select_member"
ON "Invoice" FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM "OrganizationMember" om
    JOIN "User" u ON u."id" = om."userId"
    WHERE om."organizationId" = "Invoice"."organizationId"
    AND u."supabaseUserId"::text = auth.uid()::text
  )
);

CREATE POLICY "invoices_insert_member"
ON "Invoice" FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM "OrganizationMember" om
    JOIN "User" u ON u."id" = om."userId"
    WHERE om."organizationId" = "Invoice"."organizationId"
    AND u."supabaseUserId"::text = auth.uid()::text
  )
);

CREATE POLICY "invoices_update_member"
ON "Invoice" FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM "OrganizationMember" om
    JOIN "User" u ON u."id" = om."userId"
    WHERE om."organizationId" = "Invoice"."organizationId"
    AND u."supabaseUserId"::text = auth.uid()::text
  )
);

CREATE POLICY "invoices_delete_member"
ON "Invoice" FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM "OrganizationMember" om
    JOIN "User" u ON u."id" = om."userId"
    WHERE om."organizationId" = "Invoice"."organizationId"
    AND u."supabaseUserId"::text = auth.uid()::text
  )
);

-- ============================================================================
-- 7. INVOICE LINE ITEM POLICIES
-- ============================================================================

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
-- 8. INVOICE REVISION POLICIES
-- ============================================================================

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
-- 9. EXPORT POLICIES
-- ============================================================================

CREATE POLICY "exports_select_member"
ON "Export" FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM "OrganizationMember" om
    JOIN "User" u ON u."id" = om."userId"
    WHERE om."organizationId" = "Export"."organizationId"
    AND u."supabaseUserId"::text = auth.uid()::text
  )
);

CREATE POLICY "exports_insert_member"
ON "Export" FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM "OrganizationMember" om
    JOIN "User" u ON u."id" = om."userId"
    WHERE om."organizationId" = "Export"."organizationId"
    AND u."supabaseUserId"::text = auth.uid()::text
  )
);

CREATE POLICY "exports_update_member"
ON "Export" FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM "OrganizationMember" om
    JOIN "User" u ON u."id" = om."userId"
    WHERE om."organizationId" = "Export"."organizationId"
    AND u."supabaseUserId"::text = auth.uid()::text
  )
);

CREATE POLICY "exports_delete_member"
ON "Export" FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM "OrganizationMember" om
    JOIN "User" u ON u."id" = om."userId"
    WHERE om."organizationId" = "Export"."organizationId"
    AND u."supabaseUserId"::text = auth.uid()::text
  )
);

-- ============================================================================
-- 10. EXPORT INVOICE POLICIES (Junction Table)
-- ============================================================================

CREATE POLICY "export_invoices_via_export"
ON "ExportInvoice" FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM "Export" e
    JOIN "OrganizationMember" om ON om."organizationId" = e."organizationId"
    JOIN "User" u ON u."id" = om."userId"
    WHERE e."id" = "ExportInvoice"."exportId"
    AND u."supabaseUserId"::text = auth.uid()::text
  )
);

-- ============================================================================
-- 11. STORAGE POLICIES (for buckets: invoices, documents, exports)
-- ============================================================================
-- NOTE: These policies assume the file path structure:
--       {bucket}/{organizationId}/...
-- Storage policies are applied to the storage.objects table.

-- Invoices bucket: Only members can access
CREATE POLICY "invoices_member_access"
ON storage.objects FOR ALL
USING (
  bucket_id = 'invoices' AND
  EXISTS (
    SELECT 1 FROM "OrganizationMember" om
    JOIN "User" u ON u."id" = om."userId"
    WHERE u."supabaseUserId"::text = auth.uid()::text
    AND om."organizationId" = (string_to_array(name, '/'))[1]
  )
)
WITH CHECK (
  bucket_id = 'invoices' AND
  EXISTS (
    SELECT 1 FROM "OrganizationMember" om
    JOIN "User" u ON u."id" = om."userId"
    WHERE u."supabaseUserId"::text = auth.uid()::text
    AND om."organizationId" = (string_to_array(name, '/'))[1]
  )
);

-- Documents bucket: Only members can access
CREATE POLICY "documents_member_access"
ON storage.objects FOR ALL
USING (
  bucket_id = 'documents' AND
  EXISTS (
    SELECT 1 FROM "OrganizationMember" om
    JOIN "User" u ON u."id" = om."userId"
    WHERE u."supabaseUserId"::text = auth.uid()::text
    AND om."organizationId" = (string_to_array(name, '/'))[1]
  )
)
WITH CHECK (
  bucket_id = 'documents' AND
  EXISTS (
    SELECT 1 FROM "OrganizationMember" om
    JOIN "User" u ON u."id" = om."userId"
    WHERE u."supabaseUserId"::text = auth.uid()::text
    AND om."organizationId" = (string_to_array(name, '/'))[1]
  )
);

-- Exports bucket: Only members can access
CREATE POLICY "exports_member_access"
ON storage.objects FOR ALL
USING (
  bucket_id = 'exports' AND
  EXISTS (
    SELECT 1 FROM "OrganizationMember" om
    JOIN "User" u ON u."id" = om."userId"
    WHERE u."supabaseUserId"::text = auth.uid()::text
    AND om."organizationId" = (string_to_array(name, '/'))[1]
  )
)
WITH CHECK (
  bucket_id = 'exports' AND
  EXISTS (
    SELECT 1 FROM "OrganizationMember" om
    JOIN "User" u ON u."id" = om."userId"
    WHERE u."supabaseUserId"::text = auth.uid()::text
    AND om."organizationId" = (string_to_array(name, '/'))[1]
  )
);

-- ============================================================================
-- DONE!
-- ============================================================================
-- All RLS policies have been created.
-- Next steps:
-- 1. Create storage buckets 'documents' and 'exports' in Supabase Dashboard
-- 2. Test the policies with different users and organizations
-- ============================================================================
