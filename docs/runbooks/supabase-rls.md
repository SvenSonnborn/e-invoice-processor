## Supabase RLS & Multi-Tenant Model

This runbook describes the current RLS setup for this project with:

- Supabase Auth (`auth.uid()`)
- Prisma models (`Organization`, `User`, `OrganizationMember`, `File`, `Invoice`, `Export`, ...)
- org-based tenant isolation through `organizationId`

### 1. Membership model used by policies

RLS membership checks are based on:

- `User.supabaseUserId = auth.uid()`
- `OrganizationMember.userId = User.id`
- `OrganizationMember.organizationId = <row.organizationId>`

This means users can access tenant data only for organizations where they are members.

### 2. Source of truth SQL files

Current policy scripts live in:

- `prisma/migrations/setup_rls_policies.sql`
- `prisma/migrations/fix_rls_recursion.sql`

Important: the schema now uses `File` (not `Upload`). Policies are defined for `File`, `Invoice`, `Export`, and related tables.

### 3. Apply policies

Preferred:

```bash
bun scripts/setup-rls.ts
```

This executes both SQL files in order:

1. base policies (`setup_rls_policies.sql`)
2. recursion fix + helper functions (`fix_rls_recursion.sql`)

Manual alternative (Supabase SQL editor or psql):

```sql
-- 1) prisma/migrations/setup_rls_policies.sql
-- 2) prisma/migrations/fix_rls_recursion.sql
```

### 4. Why the recursion fix exists

Policies on `OrganizationMember` can recurse when they query the same table.
The fix introduces SECURITY DEFINER helper functions:

- `public.is_org_member(org_id text, supabase_uid uuid)`
- `public.is_org_member_with_role(org_id text, supabase_uid uuid, roles text[])`

Other table policies then use these helpers, avoiding recursive evaluation.

### 5. Verification

Run the project test flow:

```bash
bun run supabase:setup
bun run supabase:test
```

Relevant scripts:

- `scripts/supabase/test-03-download-user-b-forbidden.ts`
- `scripts/supabase/test-04-invoice-rls-user-b.ts`

Expected:

- User B cannot read User A's storage object (RLS denied)
- User B sees only invoices from Organization B

### 6. Prisma vs Supabase RLS responsibilities

- Prisma service code in this app must always scope by `organizationId` and enforce membership via `getMyOrganizationIdOrThrow()`.
- Supabase RLS is defense-in-depth for Supabase SDK access paths (including storage).

Practical note:

- Server-side Prisma connections commonly use elevated DB credentials and may bypass RLS depending on role privileges.
- Therefore, application-level org scoping is mandatory even when RLS is enabled.
