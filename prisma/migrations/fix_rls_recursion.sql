-- ============================================================================
-- Fix RLS infinite recursion (OrganizationMember self-reference)
-- ============================================================================
-- Run after setup_rls_policies.sql. Creates SECURITY DEFINER helpers so
-- policies can check membership without recursing into OrganizationMember.
-- ============================================================================

-- Helper: current user is member of org_id (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_org_member(org_id text, supabase_uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM "OrganizationMember" om
    JOIN "User" u ON u."id" = om."userId"
    WHERE om."organizationId" = org_id AND u."supabaseUserId" = supabase_uid
  );
$$;

-- Helper: current user is member of org_id with one of the given roles
CREATE OR REPLACE FUNCTION public.is_org_member_with_role(
  org_id text, supabase_uid uuid, roles text[]
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM "OrganizationMember" om
    JOIN "User" u ON u."id" = om."userId"
    WHERE om."organizationId" = org_id
      AND u."supabaseUserId" = supabase_uid
      AND om."role"::text = ANY(roles)
  );
$$;

-- ============================================================================
-- Drop & recreate OrganizationMember policies
-- ============================================================================

DROP POLICY IF EXISTS "members_select_own_org" ON "OrganizationMember";
CREATE POLICY "members_select_own_org"
ON "OrganizationMember" FOR SELECT
USING (public.is_org_member("organizationId"::text, auth.uid()));

DROP POLICY IF EXISTS "members_insert_owner_admin" ON "OrganizationMember";
CREATE POLICY "members_insert_owner_admin"
ON "OrganizationMember" FOR INSERT
WITH CHECK (public.is_org_member_with_role(
  "organizationId"::text, auth.uid(), ARRAY['OWNER','ADMIN']::text[]));

DROP POLICY IF EXISTS "members_update_owner_admin" ON "OrganizationMember";
CREATE POLICY "members_update_owner_admin"
ON "OrganizationMember" FOR UPDATE
USING (public.is_org_member_with_role(
  "organizationId"::text, auth.uid(), ARRAY['OWNER','ADMIN']::text[]));

DROP POLICY IF EXISTS "members_delete_owner_or_self" ON "OrganizationMember";
CREATE POLICY "members_delete_owner_or_self"
ON "OrganizationMember" FOR DELETE
USING (
  "userId" IN (SELECT id FROM "User" WHERE "supabaseUserId" = auth.uid())
  OR public.is_org_member_with_role(
      "organizationId"::text, auth.uid(), ARRAY['OWNER']::text[])
);

-- ============================================================================
-- Drop & recreate Organization policies (use helpers)
-- ============================================================================

DROP POLICY IF EXISTS "organizations_select_member" ON "Organization";
CREATE POLICY "organizations_select_member"
ON "Organization" FOR SELECT
USING (public.is_org_member("id", auth.uid()));

DROP POLICY IF EXISTS "organizations_update_owner_admin" ON "Organization";
CREATE POLICY "organizations_update_owner_admin"
ON "Organization" FOR UPDATE
USING (public.is_org_member_with_role(
  "id", auth.uid(), ARRAY['OWNER','ADMIN']::text[]));

DROP POLICY IF EXISTS "organizations_delete_owner" ON "Organization";
CREATE POLICY "organizations_delete_owner"
ON "Organization" FOR DELETE
USING (public.is_org_member_with_role(
  "id", auth.uid(), ARRAY['OWNER']::text[]));

-- ============================================================================
-- Drop & recreate File / Invoice / Export / etc. policies (use helpers)
-- ============================================================================

DROP POLICY IF EXISTS "files_select_member" ON "File";
CREATE POLICY "files_select_member" ON "File" FOR SELECT
USING ("organizationId" IS NOT NULL AND public.is_org_member("organizationId"::text, auth.uid()));

DROP POLICY IF EXISTS "files_insert_member" ON "File";
CREATE POLICY "files_insert_member" ON "File" FOR INSERT
WITH CHECK ("organizationId" IS NOT NULL AND public.is_org_member("organizationId"::text, auth.uid()));

DROP POLICY IF EXISTS "files_update_member" ON "File";
CREATE POLICY "files_update_member" ON "File" FOR UPDATE
USING ("organizationId" IS NOT NULL AND public.is_org_member("organizationId"::text, auth.uid()));

DROP POLICY IF EXISTS "files_delete_member" ON "File";
CREATE POLICY "files_delete_member" ON "File" FOR DELETE
USING ("organizationId" IS NOT NULL AND public.is_org_member("organizationId"::text, auth.uid()));

DROP POLICY IF EXISTS "invoices_select_member" ON "Invoice";
CREATE POLICY "invoices_select_member" ON "Invoice" FOR SELECT
USING ("organizationId" IS NOT NULL AND public.is_org_member("organizationId"::text, auth.uid()));

DROP POLICY IF EXISTS "invoices_insert_member" ON "Invoice";
CREATE POLICY "invoices_insert_member" ON "Invoice" FOR INSERT
WITH CHECK ("organizationId" IS NOT NULL AND public.is_org_member("organizationId"::text, auth.uid()));

DROP POLICY IF EXISTS "invoices_update_member" ON "Invoice";
CREATE POLICY "invoices_update_member" ON "Invoice" FOR UPDATE
USING ("organizationId" IS NOT NULL AND public.is_org_member("organizationId"::text, auth.uid()));

DROP POLICY IF EXISTS "invoices_delete_member" ON "Invoice";
CREATE POLICY "invoices_delete_member" ON "Invoice" FOR DELETE
USING ("organizationId" IS NOT NULL AND public.is_org_member("organizationId"::text, auth.uid()));

-- InvoiceLineItem, InvoiceRevision, Export, ExportInvoice: same pattern via Invoice/Export

DROP POLICY IF EXISTS "invoice_line_items_select_member" ON "InvoiceLineItem";
CREATE POLICY "invoice_line_items_select_member" ON "InvoiceLineItem" FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM "Invoice" i
    WHERE i."id" = "InvoiceLineItem"."invoiceId"
      AND i."organizationId" IS NOT NULL
      AND public.is_org_member(i."organizationId"::text, auth.uid())
  )
);

DROP POLICY IF EXISTS "invoice_line_items_insert_member" ON "InvoiceLineItem";
CREATE POLICY "invoice_line_items_insert_member" ON "InvoiceLineItem" FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM "Invoice" i
    WHERE i."id" = "InvoiceLineItem"."invoiceId"
      AND i."organizationId" IS NOT NULL
      AND public.is_org_member(i."organizationId"::text, auth.uid())
  )
);

DROP POLICY IF EXISTS "invoice_line_items_update_member" ON "InvoiceLineItem";
CREATE POLICY "invoice_line_items_update_member" ON "InvoiceLineItem" FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM "Invoice" i
    WHERE i."id" = "InvoiceLineItem"."invoiceId"
      AND i."organizationId" IS NOT NULL
      AND public.is_org_member(i."organizationId"::text, auth.uid())
  )
);

DROP POLICY IF EXISTS "invoice_line_items_delete_member" ON "InvoiceLineItem";
CREATE POLICY "invoice_line_items_delete_member" ON "InvoiceLineItem" FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM "Invoice" i
    WHERE i."id" = "InvoiceLineItem"."invoiceId"
      AND i."organizationId" IS NOT NULL
      AND public.is_org_member(i."organizationId"::text, auth.uid())
  )
);

DROP POLICY IF EXISTS "invoice_revisions_select_member" ON "InvoiceRevision";
CREATE POLICY "invoice_revisions_select_member" ON "InvoiceRevision" FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM "Invoice" i
    WHERE i."id" = "InvoiceRevision"."invoiceId"
      AND i."organizationId" IS NOT NULL
      AND public.is_org_member(i."organizationId"::text, auth.uid())
  )
);

DROP POLICY IF EXISTS "invoice_revisions_insert_member" ON "InvoiceRevision";
CREATE POLICY "invoice_revisions_insert_member" ON "InvoiceRevision" FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM "Invoice" i
    WHERE i."id" = "InvoiceRevision"."invoiceId"
      AND i."organizationId" IS NOT NULL
      AND public.is_org_member(i."organizationId"::text, auth.uid())
  )
);

DROP POLICY IF EXISTS "invoice_revisions_update_member" ON "InvoiceRevision";
CREATE POLICY "invoice_revisions_update_member" ON "InvoiceRevision" FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM "Invoice" i
    WHERE i."id" = "InvoiceRevision"."invoiceId"
      AND i."organizationId" IS NOT NULL
      AND public.is_org_member(i."organizationId"::text, auth.uid())
  )
);

DROP POLICY IF EXISTS "invoice_revisions_delete_member" ON "InvoiceRevision";
CREATE POLICY "invoice_revisions_delete_member" ON "InvoiceRevision" FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM "Invoice" i
    WHERE i."id" = "InvoiceRevision"."invoiceId"
      AND i."organizationId" IS NOT NULL
      AND public.is_org_member(i."organizationId"::text, auth.uid())
  )
);

DROP POLICY IF EXISTS "exports_select_member" ON "Export";
CREATE POLICY "exports_select_member" ON "Export" FOR SELECT
USING ("organizationId" IS NOT NULL AND public.is_org_member("organizationId"::text, auth.uid()));

DROP POLICY IF EXISTS "exports_insert_member" ON "Export";
CREATE POLICY "exports_insert_member" ON "Export" FOR INSERT
WITH CHECK ("organizationId" IS NOT NULL AND public.is_org_member("organizationId"::text, auth.uid()));

DROP POLICY IF EXISTS "exports_update_member" ON "Export";
CREATE POLICY "exports_update_member" ON "Export" FOR UPDATE
USING ("organizationId" IS NOT NULL AND public.is_org_member("organizationId"::text, auth.uid()));

DROP POLICY IF EXISTS "exports_delete_member" ON "Export";
CREATE POLICY "exports_delete_member" ON "Export" FOR DELETE
USING ("organizationId" IS NOT NULL AND public.is_org_member("organizationId"::text, auth.uid()));

DROP POLICY IF EXISTS "export_invoices_via_export" ON "ExportInvoice";
CREATE POLICY "export_invoices_via_export" ON "ExportInvoice" FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM "Export" e
    WHERE e."id" = "ExportInvoice"."exportId"
      AND e."organizationId" IS NOT NULL
      AND public.is_org_member(e."organizationId"::text, auth.uid())
  )
);

-- ============================================================================
-- Storage policies (storage.objects)
-- ============================================================================

DROP POLICY IF EXISTS "invoices_member_access" ON storage.objects;
CREATE POLICY "invoices_member_access"
ON storage.objects FOR ALL
USING (
  bucket_id = 'invoices'
  AND (string_to_array(name, '/'))[1] IS NOT NULL
  AND public.is_org_member((string_to_array(name, '/'))[1], auth.uid())
)
WITH CHECK (
  bucket_id = 'invoices'
  AND (string_to_array(name, '/'))[1] IS NOT NULL
  AND public.is_org_member((string_to_array(name, '/'))[1], auth.uid())
);

DROP POLICY IF EXISTS "documents_member_access" ON storage.objects;
CREATE POLICY "documents_member_access"
ON storage.objects FOR ALL
USING (
  bucket_id = 'documents'
  AND (string_to_array(name, '/'))[1] IS NOT NULL
  AND public.is_org_member((string_to_array(name, '/'))[1], auth.uid())
)
WITH CHECK (
  bucket_id = 'documents'
  AND (string_to_array(name, '/'))[1] IS NOT NULL
  AND public.is_org_member((string_to_array(name, '/'))[1], auth.uid())
);

DROP POLICY IF EXISTS "exports_member_access" ON storage.objects;
CREATE POLICY "exports_member_access"
ON storage.objects FOR ALL
USING (
  bucket_id = 'exports'
  AND (string_to_array(name, '/'))[1] IS NOT NULL
  AND public.is_org_member((string_to_array(name, '/'))[1], auth.uid())
)
WITH CHECK (
  bucket_id = 'exports'
  AND (string_to_array(name, '/'))[1] IS NOT NULL
  AND public.is_org_member((string_to_array(name, '/'))[1], auth.uid())
);

-- ============================================================================
-- Grants for Supabase API roles (required in addition to RLS policies)
-- ============================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  "Organization",
  "User",
  "OrganizationMember",
  "File",
  "Invoice",
  "InvoiceLineItem",
  "InvoiceRevision",
  "Export",
  "ExportInvoice"
TO authenticated;
