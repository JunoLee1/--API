import { PrismaClient } from "../generated/client";
import { PrismaPg } from "@prisma/adapter-pg";

let instance: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (!instance) {
    const adapter = new PrismaPg({ connectionString: process.env["DATABASE_URL"] });
    instance = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);
  }
  return instance;
}
