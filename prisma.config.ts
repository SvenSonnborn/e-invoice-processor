import fs from 'node:fs';
import path from 'node:path';
import { config } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

// Load .env.local into process.env BEFORE env() calls (only in local dev).
// On Vercel/GitHub, env vars are injected directly.
const localEnvPath = path.resolve(__dirname, '.env.local');
if (fs.existsSync(localEnvPath)) {
  config({ path: localEnvPath });
}

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    // Use the direct connection for Prisma CLI and migrations.
    // Runtime queries use DATABASE_URL via the PrismaPg adapter in src/lib/db/client.ts.
    url: env('DIRECT_URL'),
  },
});
