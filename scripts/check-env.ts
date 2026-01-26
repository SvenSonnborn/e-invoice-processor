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
  
  // Try to validate with zod schema
  try {
    env;
    console.log("✅ Environment configuration is valid");
  } catch (error) {
    console.error("❌ Environment configuration validation failed:", error);
    process.exit(1);
  }
}

checkEnv();
