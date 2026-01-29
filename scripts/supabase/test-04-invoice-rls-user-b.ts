#!/usr/bin/env bun
/**
 * STEP 4: Invoice RLS – User B sees only Org B
 *
 * Preconditions: supabase:setup run (invoices for Org A and Org B).
 *
 * Expected:
 * - Query succeeds
 * - Only invoices from Organization B returned
 * - No invoices from Organization A
 *
 * Run: bun run supabase:test-04
 */

import { getTestConfig, signInAndGetClient } from "./test-helpers";

async function main() {
  const config = getTestConfig();
  const supabase = await signInAndGetClient(
    config.userB.email,
    config.userB.password
  );

  const { data, error } = await supabase
    .from("Invoice")
    .select("id, organizationId, number");

  if (error) {
    console.error("❌ QUERY FAILED:", error.message);
    process.exit(1);
  }

  const rows = (data ?? []) as Array<{
    id: string;
    organizationId: string | null;
    number: string | null;
  }>;

  const orgAIds = rows.filter((r) => r.organizationId === config.orgAId);
  const orgBIds = rows.filter((r) => r.organizationId === config.orgBId);

  if (orgAIds.length > 0) {
    console.error("❌ User B must not see Org A invoices. Found:", orgAIds);
    process.exit(1);
  }

  if (rows.length === 0) {
    console.error("❌ No invoices returned (expected at least Org B invoices)");
    process.exit(1);
  }

  const allOrgB = rows.every((r) => r.organizationId === config.orgBId);
  if (!allOrgB) {
    console.error("❌ All returned invoices must be Org B. Got:", rows);
    process.exit(1);
  }

  console.log("✅ Query succeeded");
  console.log("   Invoices returned:", rows.length, "(all Org B)");
  console.log("   No Org A invoices");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
