import { PrismaClient } from "../generated/client";

export class ClubSettingsRepository {
  constructor(private prisma: PrismaClient) {}

  async get() {
    return this.prisma.clubSettings.upsert({
      where: { id: 1 },
      create: { id: 1, currency: "KRW", ibiBeta: 1.0 },
      update: {},
    });
  }

  async update(data: { currency?: string; ibiBeta?: number }) {
    return this.prisma.clubSettings.upsert({
      where: { id: 1 },
      create: { id: 1, currency: "KRW", ibiBeta: 1.0, ...data },
      update: data,
    });
  }
}
