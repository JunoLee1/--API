import "dotenv/config";
import { defineConfig } from "prisma/config";
import type { PrismaConfig } from "prisma";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL!,
  },
} satisfies PrismaConfig);
