import { PrismaClient } from '../generated/client';
import { PrismaPg } from '@prisma/adapter-pg';

export let prisma: PrismaClient;

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