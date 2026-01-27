import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "./prisma/schema.prisma",
  datasource: {
    // Use the direct connection for Prisma CLI and migrations.
    // Runtime queries use DATABASE_URL via the PrismaPg adapter in src/lib/db/client.ts.
    url: env("DIRECT_URL"),
  },
});
