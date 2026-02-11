import { PrismaClient } from "@/src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { env } from "@/src/lib/config/env";

declare global {
  var prisma: PrismaClient | undefined;
}

const dbUrl = env.DATABASE_URL;

// Temporary debug log — remove after resolving connection issue
try {
  const parsed = new URL(dbUrl);
  console.log("[db] Connecting to:", {
    protocol: parsed.protocol,
    host: parsed.host,
    port: parsed.port,
    pathname: parsed.pathname,
    hasPassword: !!parsed.password,
    searchParams: parsed.search,
  });
} catch (e) {
  console.error("[db] DATABASE_URL is not a valid URL. Raw length:", dbUrl?.length, "Starts with:", dbUrl?.substring(0, 15));
}

const pool = new Pool({ connectionString: dbUrl });
const adapter = new PrismaPg(pool);

export const prisma =
  global.prisma ??
  new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") global.prisma = prisma;

