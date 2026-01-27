## Supabase RLS & Multi-Tenant Model

This runbook describes how to wire Row Level Security (RLS) for multi-tenant
access control when using Supabase Auth together with this app's Prisma schema.

### 1. Mapping Supabase users to app users

Current Prisma schema models:

- `Organization` – corresponds to a workspace
- `User` – application user, currently not linked to Supabase `auth.users`

Recommended additions (via a Prisma migration):

- Add `supabaseUserId` column to `User`:

```sql
ALTER TABLE "User" ADD COLUMN "supabaseUserId" uuid UNIQUE;
```

- Ensure that `supabaseUserId` is populated when a user signs up via Supabase
  (Server Action or API route using `auth.getUser()`).

### 2. Basic RLS setup

Enable RLS on tenant-aware tables. For now we treat `Organization` as workspace
and scope related tables (`Upload`, `Invoice`, `Export`) by `organizationId`.

Run the following SQL in the Supabase SQL editor (or via MCP):

```sql
-- Enable RLS
ALTER TABLE "Organization" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Upload" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Invoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Export" ENABLE ROW LEVEL SECURITY;
```

### 3. Policies based on auth.uid() + membership

For now, we consider a user a member of an organization if:

- `User.supabaseUserId = auth.uid()`
- `User.organizationId = Organization.id`

Example policies (adapt as your schema evolves toward explicit memberships):

```sql
-- Users can see and update their own user row
CREATE POLICY "users_select_own"
ON "User"
FOR SELECT
USING ("supabaseUserId" = auth.uid());

CREATE POLICY "users_update_own"
ON "User"
FOR UPDATE
USING ("supabaseUserId" = auth.uid());

-- Organizations: a user can see their own organization
CREATE POLICY "organizations_select_own"
ON "Organization"
FOR SELECT
USING (EXISTS (
  SELECT 1
  FROM "User" u
  WHERE u."id" = "Organization"."id"
    AND u."supabaseUserId" = auth.uid()
));

-- Uploads scoped by organization
CREATE POLICY "uploads_select_own_org"
ON "Upload"
FOR SELECT
USING (EXISTS (
  SELECT 1
  FROM "User" u
  WHERE u."organizationId" = "Upload"."organizationId"
    AND u."supabaseUserId" = auth.uid()
));

CREATE POLICY "uploads_insert_own_org"
ON "Upload"
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1
  FROM "User" u
  WHERE u."organizationId" = "Upload"."organizationId"
    AND u."supabaseUserId" = auth.uid()
));

-- Invoices scoped by organization
CREATE POLICY "invoices_select_own_org"
ON "Invoice"
FOR SELECT
USING (EXISTS (
  SELECT 1
  FROM "User" u
  WHERE u."organizationId" = "Invoice"."organizationId"
    AND u."supabaseUserId" = auth.uid()
));

-- Exports scoped by organization
CREATE POLICY "exports_select_own_org"
ON "Export"
FOR SELECT
USING (EXISTS (
  SELECT 1
  FROM "User" u
  WHERE u."organizationId" = "Export"."organizationId"
    AND u."supabaseUserId" = auth.uid()
));
```

### 4. Prisma vs. RLS responsibilities

- **Prisma (application layer):**
  - Always filter by `organizationId` (workspace) in repositories/services.
  - Validate that the current user is a member of the workspace before
    accessing or mutating tenant data.

- **Supabase RLS (defense-in-depth + SDK reads):**
  - Protects access for any queries executed through the Supabase SDK where the
    auth JWT is attached (e.g. simple reads, Storage policies).
  - Ensures that even if an API route forgets a tenant filter, the database
    still enforces tenant isolation for Supabase-authenticated calls.

> NOTE: As you introduce explicit `workspaces` and `memberships` tables, you
> should update the policies above to reference those tables instead of the
> implicit `Organization`/`User` relationship.

