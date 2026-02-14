#!/usr/bin/env bun
/**
 * Setup RLS Policies Script
 *
 * This script executes the RLS policies SQL file against the Supabase database.
 * Run with: bun scripts/setup-rls.ts
 */

import { readFileSync } from 'fs';
import { Pool } from 'pg';

const DATABASE_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error(
    '❌ DATABASE_URL or DIRECT_URL environment variable is required'
  );
  process.exit(1);
}

async function setupRLS() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
  });

  try {
    console.log('📊 Connecting to database...');

    const setupSql = readFileSync(
      'prisma/migrations/setup_rls_policies.sql',
      'utf-8'
    );
    const recursionFixSql = readFileSync(
      'prisma/migrations/fix_rls_recursion.sql',
      'utf-8'
    );

    console.log('🔒 Executing base RLS policies...');
    await pool.query(setupSql);
    console.log('🛠️ Applying RLS recursion fix helpers/policies...');
    await pool.query(recursionFixSql);

    console.log('✅ RLS policies successfully applied (including recursion fix)!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Create storage buckets in Supabase Dashboard:');
    console.log('   - Bucket: documents (Private, 50MB limit)');
    console.log('   - Bucket: exports (Private, 10MB limit)');
    console.log('2. Enable Email Auth in Supabase Dashboard');
    console.log('3. Configure Email Templates (German)');
  } catch (error) {
    console.error('❌ Error executing RLS policies:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

setupRLS();
