import { PrismaClient } from '@/src/generated/prisma/client';
import { env } from '@/src/lib/config/env';
import { PrismaPg } from '@prisma/adapter-pg';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

const dbUrl = env.DATABASE_URL;

const adapter = new PrismaPg({
  connectionString: dbUrl,
  // Match Prisma ORM v6 connection pool defaults for timeouts.
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 300_000,
});

export const prisma =
  global.prisma ??
  new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}
