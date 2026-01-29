#!/usr/bin/env bun
/**
 * STEP 1: Authenticated upload (User A)
 *
 * Preconditions: supabase:setup run, User A → Org A, bucket "documents" private.
 *
 * Expected:
 * - Upload succeeds
 * - File stored in private bucket
 * - No public URL returned
 *
 * Run: bun run supabase:test-01
 */

import {
  getTestConfig,
  signInAndGetClient,
  MINIMAL_PDF,
} from "./test-helpers";

const BUCKET = "documents";
const REL_PATH = "test-invoice-a.pdf";

async function main() {
  const config = getTestConfig();
  const supabase = await signInAndGetClient(
    config.userA.email,
    config.userA.password
  );

  const filePath = `${config.orgAId}/${REL_PATH}`;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, MINIMAL_PDF, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (error) {
    console.error("❌ UPLOAD FAILED:", error.message);
    process.exit(1);
  }

  if (!data?.path) {
    console.error("❌ Upload ok but no path in response");
    process.exit(1);
  }

  const res = data as Record<string, unknown>;
  if ("publicUrl" in res && res.publicUrl) {
    console.error("❌ Public URL must not be returned for private bucket");
    process.exit(1);
  }

  console.log("✅ Upload succeeded");
  console.log("   Path:", data.path);
  console.log("   No public URL (private bucket)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
