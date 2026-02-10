#!/usr/bin/env bun
/**
 * Setup Supabase integration test data
 *
 * Creates User A (Org A) and User B (Org B), invoices for each, and writes
 * scripts/supabase/test-config.json for the test scripts.
 *
 * Preconditions:
 * - Supabase project running, RLS and schema applied
 * - Storage buckets "documents" and "exports" exist (bun run scripts/create-storage-buckets.ts)
 * - .env.local has NEXT_PUBLIC_SUPABASE_*, SUPABASE_SERVICE_ROLE_KEY, DIRECT_URL
 *
 * Run: bun run supabase:setup
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { PrismaClient } from "@/src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";
import { requireEnv } from "./test-helpers";

const USER_A_EMAIL = "user-a@test.e-rechnung.local";
const USER_B_EMAIL = "user-b@test.e-rechnung.local";
const TEST_PASSWORD = "TestPassword123!";

async function getOrCreateAuthUser(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any, any, any>,
  email: string,
  password: string
): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (!error) {
    const id = data?.user?.id;
    if (!id) throw new Error(`createUser succeeded but no user id for ${email}`);
    return id;
  }
  const alreadyExists = /already|registered|exists/i.test(error.message);
  if (!alreadyExists) throw error;
  const existing = await resolveAuthUser(admin, email);
  if (!existing) throw new Error(`User ${email} exists but could not be resolved`);
  console.log(`  ${email} already exists, reusing.`);
  return existing;
}

async function resolveAuthUser(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any, any, any>,
  email: string
): Promise<string | null> {
  const { data } = await admin.auth.admin.listUsers();
  const u = data?.users?.find((x) => x.email === email);
  return u?.id ?? null;
}

async function main() {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const directUrl = requireEnv("DIRECT_URL");

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const pool = new Pool({ connectionString: directUrl });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log("Creating Supabase Auth users...");
  const supabaseUserIdA = await getOrCreateAuthUser(
    admin,
    USER_A_EMAIL,
    TEST_PASSWORD
  );
  const supabaseUserIdB = await getOrCreateAuthUser(
    admin,
    USER_B_EMAIL,
    TEST_PASSWORD
  );

  console.log("Creating organizations and app users...");

  const orgA = await prisma.organization.upsert({
    where: { id: "org-a-test-id" },
    create: { id: "org-a-test-id", name: "Organization A" },
    update: {},
  });
  const orgB = await prisma.organization.upsert({
    where: { id: "org-b-test-id" },
    create: { id: "org-b-test-id", name: "Organization B" },
    update: {},
  });

  const appUserA = await prisma.user.upsert({
    where: { email: USER_A_EMAIL },
    create: {
      email: USER_A_EMAIL,
      name: "User A",
      supabaseUserId: supabaseUserIdA,
    },
    update: { supabaseUserId: supabaseUserIdA },
  });
  const appUserB = await prisma.user.upsert({
    where: { email: USER_B_EMAIL },
    create: {
      email: USER_B_EMAIL,
      name: "User B",
      supabaseUserId: supabaseUserIdB,
    },
    update: { supabaseUserId: supabaseUserIdB },
  });

  await prisma.organizationMember.upsert({
    where: {
      userId_organizationId: { userId: appUserA.id, organizationId: orgA.id },
    },
    create: {
      userId: appUserA.id,
      organizationId: orgA.id,
      role: "OWNER",
    },
    update: {},
  });
  await prisma.organizationMember.upsert({
    where: {
      userId_organizationId: { userId: appUserB.id, organizationId: orgB.id },
    },
    create: {
      userId: appUserB.id,
      organizationId: orgB.id,
      role: "OWNER",
    },
    update: {},
  });

  console.log("Creating test invoices...");

  await prisma.invoice.createMany({
    data: [
      { organizationId: orgA.id, createdBy: appUserA.id, number: "INV-A-1" },
      { organizationId: orgA.id, createdBy: appUserA.id, number: "INV-A-2" },
      { organizationId: orgB.id, createdBy: appUserB.id, number: "INV-B-1" },
      { organizationId: orgB.id, createdBy: appUserB.id, number: "INV-B-2" },
    ],
    skipDuplicates: true,
  });

  const dir = resolve(process.cwd(), "scripts/supabase");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const configPath = resolve(dir, "test-config.json");
  const config = {
    orgAId: orgA.id,
    orgBId: orgB.id,
    userA: { email: USER_A_EMAIL, password: TEST_PASSWORD },
    userB: { email: USER_B_EMAIL, password: TEST_PASSWORD },
  };
  writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");

  console.log("✅ test-config.json written to", configPath);
  console.log("  ORG_A_ID:", orgA.id, "| ORG_B_ID:", orgB.id);
  await pool.end();
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
