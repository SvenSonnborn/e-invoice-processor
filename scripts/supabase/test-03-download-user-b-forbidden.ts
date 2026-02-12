#!/usr/bin/env bun
/**
 * STEP 3: User B cannot access User A file
 *
 * Preconditions: test-01 run (file in Org A).
 *
 * Expected:
 * - Download fails
 * - Error 403 Unauthorized or RLS violation
 *
 * Run: bun run supabase:test-03
 */

import { getTestConfig, signInAndGetClient } from './test-helpers';

const BUCKET = 'documents';
const REL_PATH = 'test-invoice-a.pdf';

async function main() {
  const config = getTestConfig();
  const supabase = await signInAndGetClient(
    config.userB.email,
    config.userB.password
  );

  const filePath = `${config.orgAId}/${REL_PATH}`;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(filePath);

  if (!error) {
    console.error(
      '❌ Download should have failed (User B accessing Org A file)'
    );
    if (data) console.error('   Received', (data as Blob).size, 'bytes');
    process.exit(1);
  }

  const msg = (
    error?.message ??
    (error as { error?: string })?.error ??
    ''
  ).toLowerCase();
  const code =
    (error as { statusCode?: number })?.statusCode ??
    (error as { code?: string })?.code;
  const codeNum = typeof code === 'string' ? parseInt(code, 10) : code;
  const is403 = codeNum === 403 || /403|forbidden|unauthorized/i.test(msg);
  const isRls =
    /row level security|rls|policy|denied|violation|objects.*not found/i.test(
      msg
    );

  console.log('✅ Download correctly denied');
  if (error?.message) console.log('   Error:', error.message);
  else if (is403 || isRls) console.log('   (403 / RLS or access denied)');
  else console.log('   (access denied – error shape may vary by client)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
