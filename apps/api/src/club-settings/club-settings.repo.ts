import { PrismaClient } from "../generated/client";

export class ClubSettingsRepository {
  constructor(private prisma: PrismaClient) {}

  async get() {
    return this.prisma.clubSettings.upsert({
      where: { id: 1 },
      create: { id: 1, currency: "KRW" },
      update: {},
    });
  }

  async update(currency: string) {
    return this.prisma.clubSettings.upsert({
      where: { id: 1 },
      create: { id: 1, currency },
      update: { currency },
    });
  }
}
