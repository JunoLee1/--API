import { PrismaClient } from "../generated/client";
import { PrismaPg } from "@prisma/adapter-pg";

let instance: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (!instance) {
    const adapter = new PrismaPg({ connectionString: process.env["DATABASE_URL"] });
    instance = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

    // IS9: Prevent AuditLog tampering — blocked at query level via $extends
    instance = instance.$extends({
      query: {
        auditLog: {
          update: async () => { throw new Error("AuditLog records are immutable"); },
          updateMany: async () => { throw new Error("AuditLog records are immutable"); },
          delete: async () => { throw new Error("AuditLog records are immutable"); },
          deleteMany: async () => { throw new Error("AuditLog records are immutable"); },
        },
      },
    }) as unknown as PrismaClient;
  }
  return instance;
}
