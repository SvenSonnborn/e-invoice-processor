#!/usr/bin/env bun
/**
 * Create Storage Buckets Script
 *
 * This script creates the required Supabase Storage buckets.
 * Run with: bun scripts/create-storage-buckets.ts
 */

import { Pool } from 'pg';

const DATABASE_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL or DIRECT_URL environment variable is required');
  process.exit(1);
}

async function createBuckets() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
  });

  try {
    console.log('📦 Creating storage buckets...');

    // Documents bucket
    await pool.query(`
      INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      VALUES (
        'documents',
        'documents',
        false,
        52428800,
        ARRAY['application/pdf', 'application/xml', 'text/xml']
      )
      ON CONFLICT (id) DO NOTHING
    `);
    console.log('✅ Documents bucket created/verified');

    // Exports bucket
    await pool.query(`
      INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      VALUES (
        'exports',
        'exports',
        false,
        10485760,
        ARRAY['text/csv', 'application/zip']
      )
      ON CONFLICT (id) DO NOTHING
    `);
    console.log('✅ Exports bucket created/verified');

    // Verify
    const result = await pool.query(`
      SELECT id, name, public, file_size_limit, allowed_mime_types
      FROM storage.buckets
      WHERE id IN ('documents', 'exports')
    `);

    console.log('\n📋 Storage Buckets:');
    result.rows.forEach((bucket) => {
      console.log(`  - ${bucket.name}:`);
      console.log(`    - Public: ${bucket.public}`);
      console.log(`    - Size Limit: ${(bucket.file_size_limit / 1024 / 1024).toFixed(0)}MB`);
      console.log(`    - MIME Types: ${bucket.allowed_mime_types?.join(', ')}`);
    });

    console.log('\n✅ All storage buckets created successfully!');
  } catch (error) {
    console.error('❌ Error creating storage buckets:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

createBuckets();
