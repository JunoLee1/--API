import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

let prisma: PrismaClient;

export function getPrisma() {
  if (!prisma) {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
    });

    prisma = new PrismaClient({ adapter });
  }
  return prisma;
}