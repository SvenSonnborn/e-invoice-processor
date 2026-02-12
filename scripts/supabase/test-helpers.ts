#!/usr/bin/env bun
/**
 * Supabase integration test helpers
 *
 * Loads .env.local, provides auth clients, sign-in, and test config.
 * Run from project root: bun scripts/supabase/<test-script>.ts
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export interface TestConfig {
  orgAId: string;
  orgBId: string;
  userA: { email: string; password: string };
  userB: { email: string; password: string };
}

const TEST_CONFIG_PATH = resolve(
  process.cwd(),
  'scripts/supabase/test-config.json'
);

export function loadEnvLocal() {
  const path = resolve(process.cwd(), '.env.local');
  if (!existsSync(path)) return;
  const content = readFileSync(path, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    )
      val = val.slice(1, -1);
    if (!(key in process.env)) process.env[key] = val;
  }
}

export function getTestConfig(): TestConfig {
  if (!existsSync(TEST_CONFIG_PATH)) {
    console.error('❌ test-config.json not found. Run: bun run supabase:setup');
    process.exit(1);
  }
  const raw = readFileSync(TEST_CONFIG_PATH, 'utf-8');
  return JSON.parse(raw) as TestConfig;
}

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(
      `❌ Missing env: ${name}. Set it in .env.local or run supabase:setup.`
    );
    process.exit(1);
  }
  return v;
}

export function createAnonClient(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error(
      '❌ NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or ANON) required.'
    );
    process.exit(1);
  }
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false },
  });
}

export async function signInAndGetJwt(
  email: string,
  password: string
): Promise<string> {
  const client = createAnonClient();
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (error) {
    console.error('❌ Sign-in failed:', error.message);
    process.exit(1);
  }
  const token = data.session?.access_token;
  if (!token) {
    console.error('❌ No access token in session');
    process.exit(1);
  }
  return token;
}

/** Returns a Supabase client authenticated as the given user (use for storage/DB). */
export async function signInAndGetClient(
  email: string,
  password: string
): Promise<SupabaseClient> {
  const client = createAnonClient();
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (error) {
    console.error('❌ Sign-in failed:', error.message);
    process.exit(1);
  }
  if (!data.session) {
    console.error('❌ No session after sign-in');
    process.exit(1);
  }
  return client;
}

/** Minimal valid PDF for storage upload tests */
export const MINIMAL_PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000125 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n202\n%%EOF\n',
  'utf-8'
);
