#!/usr/bin/env bun
/**
 * STEP 2: User A can read own file
 *
 * Preconditions: test-01 run (file uploaded by User A).
 *
 * Expected:
 * - Download succeeds
 * - File contents returned
 *
 * Run: bun run supabase:test-02
 */

import { getTestConfig, signInAndGetClient } from './test-helpers';

const BUCKET = 'documents';
const REL_PATH = 'test-invoice-a.pdf';

async function main() {
  const config = getTestConfig();
  const supabase = await signInAndGetClient(
    config.userA.email,
    config.userA.password
  );

  const filePath = `${config.orgAId}/${REL_PATH}`;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(filePath);

  if (error) {
    console.error('❌ DOWNLOAD FAILED:', error.message);
    process.exit(1);
  }

  if (!data) {
    console.error('❌ Download ok but no data returned');
    process.exit(1);
  }

  const buf = Buffer.from(await data.arrayBuffer());
  if (buf.length === 0) {
    console.error('❌ File contents empty');
    process.exit(1);
  }

  if (!buf.subarray(0, 8).toString('utf-8').startsWith('%PDF-1.')) {
    console.error('❌ File does not look like PDF');
    process.exit(1);
  }

  console.log('✅ Download succeeded');
  console.log('   Size:', buf.length, 'bytes');
  console.log('   PDF header verified');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
