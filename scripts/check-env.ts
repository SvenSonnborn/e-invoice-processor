#!/usr/bin/env bun
/**
 * Environment Validation Script
 * Checks that all required environment variables are set
 */

import { env } from "@/src/lib/config/env";

const requiredEnvVars = [
  "DATABASE_URL",
  // Add other required environment variables here
] as const;

function checkEnv() {
  console.log("Checking environment variables...\n");

  let hasErrors = false;

  for (const varName of requiredEnvVars) {
    const value = process.env[varName];
    if (!value) {
      console.error(`❌ ${varName} is not set`);
      hasErrors = true;
    } else {
      console.log(`✅ ${varName} is set`);
    }
  }

  if (hasErrors) {
    console.error("\n❌ Some required environment variables are missing!");
    process.exit(1);
  }

  console.log("\n✅ All required environment variables are set!");
  
  // Validate with zod schema (env is already parsed at import time)
  // If env parsing fails, it will throw during import, so we just reference it
  void env;
  console.log("✅ Environment configuration is valid");
}

checkEnv();
