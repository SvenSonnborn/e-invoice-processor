#!/usr/bin/env bun
/**
 * Fix Prisma Client exports
 * Creates default.js and default.d.ts files that re-export from client
 * and package.json for proper module resolution
 * This is needed because @prisma/client expects .prisma/client/default
 * but Prisma 7.x generates .prisma/client/client.ts
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";

const prismaClientPath = join(process.cwd(), "node_modules/.prisma/client");
const defaultJsPath = join(prismaClientPath, "default.js");
const defaultDtsPath = join(prismaClientPath, "default.d.ts");
const packageJsonPath = join(prismaClientPath, "package.json");

try {
  // Create default.js (JavaScript re-export)
  writeFileSync(defaultJsPath, "module.exports = require('./client');\n", "utf-8");
  console.log("✅ Created default.js for Prisma Client");

  // Create default.d.ts (TypeScript declarations)
  writeFileSync(defaultDtsPath, "export * from './client';\n", "utf-8");
  console.log("✅ Created default.d.ts for Prisma Client");

  // Create package.json for proper module resolution
  const packageJson = {
    name: ".prisma/client",
    main: "client.js",
    types: "client.d.ts",
    exports: {
      ".": {
        require: "./client.js",
        import: "./client.js",
        types: "./client.d.ts",
      },
      "./default": {
        require: "./default.js",
        import: "./default.js",
        types: "./default.d.ts",
      },
    },
  };

  writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), "utf-8");
  console.log("✅ Created package.json for Prisma Client");
} catch (error) {
  console.error("❌ Failed to fix Prisma Client exports:", error);
  process.exit(1);
}
