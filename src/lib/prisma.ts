import { PrismaClient } from '../generated/client';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Prisma client singleton. Must be initialized via getPrisma() before use.
 * @see getPrisma
 */
export let prisma!: PrismaClient;

export function getPrisma() {
  if (!prisma) {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
    });
    prisma = new PrismaClient({ adapter });
  }
  return prisma;
}
export { PrismaClient };