#!/usr/bin/env bun
/**
 * Fix Prisma Client exports
 * Creates default.d.ts file that re-exports from client.ts
 * This is needed because @prisma/client expects .prisma/client/default
 * but Prisma 7.x generates .prisma/client/client.ts
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";

const prismaClientPath = join(process.cwd(), "node_modules/.prisma/client");
const defaultDtsPath = join(prismaClientPath, "default.d.ts");

try {
  writeFileSync(defaultDtsPath, "export * from './client'\n", "utf-8");
  console.log("✅ Created default.d.ts for Prisma Client");
} catch (error) {
  console.error("❌ Failed to create default.d.ts:", error);
  process.exit(1);
}
