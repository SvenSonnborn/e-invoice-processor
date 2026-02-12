#!/usr/bin/env bun
/**
 * Environment Validation Script
 * Checks that all required environment variables are set
 * Warns about optional/TODO variables but does not fail if they are missing
 */

import { env } from '@/src/lib/config/env';

// Required environment variables (must be set for the app to work)
const requiredEnvVars = [
  'DATABASE_URL',
  'DIRECT_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_ID_PRO',
  'STRIPE_PRICE_ID_BUSINESS',
] as const;

// Optional environment variables with defaults (nice to have, but not required)
const optionalEnvVars = [
  'LOG_LEVEL', // Has default: "info"
  'NODE_ENV', // Usually set by Next.js/Bun automatically
] as const;

// TODO: Future environment variables (not yet implemented, warnings only)
const todoEnvVars = [
  // Storage
  'STORAGE_DRIVER',
  'STORAGE_BUCKET',
  'STORAGE_ACCESS_KEY_ID',
  'STORAGE_SECRET_ACCESS_KEY',
  // Auth/Session
  'SESSION_SECRET',
  // Rate Limiting
  'RATE_LIMIT_MAX_REQUESTS',
  'RATE_LIMIT_WINDOW_MS',
  // Telemetry
  'OTEL_SERVICE_NAME',
  'OTEL_EXPORTER_OTLP_ENDPOINT',
] as const;

function checkEnv() {
  console.log('Checking environment variables...\n');

  let hasErrors = false;
  let hasWarnings = false;

  // Check required variables
  console.log('📋 Required Variables:');
  for (const varName of requiredEnvVars) {
    const value = process.env[varName];
    if (!value) {
      console.error(`  ❌ ${varName} is not set (REQUIRED)`);
      hasErrors = true;
    } else {
      // Mask sensitive values (show only first/last few chars)
      const masked = maskSensitiveValue(varName, value);
      console.log(`  ✅ ${varName} is set: ${masked}`);
    }
  }

  // Check optional variables (informational only)
  console.log('\n📋 Optional Variables (have defaults):');
  for (const varName of optionalEnvVars) {
    const value = process.env[varName];
    if (value) {
      console.log(`  ℹ️  ${varName} is set: ${value}`);
    } else {
      console.log(`  ⚪ ${varName} is not set (using default)`);
    }
  }

  // Check TODO variables (warnings only, don't fail)
  console.log('\n📋 Future Variables (TODO - not yet implemented):');
  const setTodoVars: string[] = [];
  for (const varName of todoEnvVars) {
    const value = process.env[varName];
    if (value) {
      setTodoVars.push(varName);
      const masked = maskSensitiveValue(varName, value);
      console.log(
        `  ⚠️  ${varName} is set: ${masked} (not yet used by application)`
      );
      hasWarnings = true;
    }
  }
  if (setTodoVars.length === 0) {
    console.log(
      "  ℹ️  No TODO variables are set (this is fine, they're not implemented yet)"
    );
  }

  // Validate with zod schema (env is already parsed at import time)
  // If env parsing fails, it will throw during import, so we just reference it
  try {
    void env;
    console.log(
      '\n✅ Environment configuration is valid (Zod schema validation passed)'
    );
  } catch (error) {
    console.error('\n❌ Environment configuration validation failed:');
    console.error(error);
    hasErrors = true;
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  if (hasErrors) {
    console.error('❌ Some required environment variables are missing!');
    console.error('   Please set the required variables and try again.');
    process.exit(1);
  } else if (hasWarnings) {
    console.log('✅ All required environment variables are set!');
    console.log(
      "⚠️  Some TODO variables are set (they won't be used until implemented)"
    );
    process.exit(0);
  } else {
    console.log('✅ All required environment variables are set!');
    process.exit(0);
  }
}

/**
 * Masks sensitive environment variable values for display
 * Shows first 4 and last 4 characters, masks the middle
 */
function maskSensitiveValue(varName: string, value: string): string {
  // Don't mask if it's short or contains URL-like patterns (might be a connection string)
  if (value.length <= 12 || value.includes('://') || value.includes('@')) {
    // For URLs/connection strings, just show the structure
    if (value.includes('://')) {
      try {
        const url = new URL(value);
        return `${url.protocol}//${url.hostname}${url.pathname ? url.pathname.substring(0, 20) + '...' : ''}`;
      } catch {
        // If URL parsing fails, just mask it
        return (
          value.substring(0, 4) + '...' + value.substring(value.length - 4)
        );
      }
    }
    // For short values, show first 4 chars only
    return value.substring(0, 4) + '***';
  }
  // For longer values, show first 4 and last 4
  return value.substring(0, 4) + '...' + value.substring(value.length - 4);
}

checkEnv();
