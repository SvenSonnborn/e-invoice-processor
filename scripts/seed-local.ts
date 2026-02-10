#!/usr/bin/env bun
/**
 * Local Database Seeding Script
 * Seeds the local database with test data
 */

import { PrismaClient } from "@/src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function seed() {
  console.log("Seeding database...");

  // TODO: Implement seeding logic
  // Example:
  // await prisma.user.create({
  //   data: {
  //     email: "test@example.com",
  //     name: "Test User",
  //   },
  // });

  console.log("✅ Database seeded successfully");
}

seed()
  .catch((e) => {
    console.error("❌ Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
