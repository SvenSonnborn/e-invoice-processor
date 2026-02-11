import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

if (!process.env.DIRECT_URL) {
  throw new Error('DIRECT_URL environment variable is not set');
}

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  // Intentionally minimal seed scaffold.
  // Add org/user/invoice seed data as the app evolves.
  console.log('Seed starting...');
  console.log('Seed finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
