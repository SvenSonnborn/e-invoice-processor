/**
 * Test Setup (preloaded by bun via bunfig.toml)
 *
 * Provides required environment variables for all test files so that
 * modules like `@/src/lib/config/env` pass Zod validation without
 * needing real credentials.
 */

function setDefault(key: string, value: string): void {
  if (!process.env[key]) {
    process.env[key] = value;
  }
}

setDefault("NODE_ENV", "test");
setDefault("DATABASE_URL", "postgresql://test:test@localhost:5432/test");
setDefault("DIRECT_URL", "postgresql://test:test@localhost:5432/test");
setDefault("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321");
setDefault("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-anon-key");
setDefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");
setDefault("LOG_LEVEL", "silent");
