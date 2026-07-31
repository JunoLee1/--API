import { PrismaClient } from "../generated/client";

export class FinancialReportRepository {
  constructor(private prisma: PrismaClient) {}

  async upsert(seasonId: number, totalRevenue: number, note?: string) {
    const noteVal = note ?? null;
    return this.prisma.financialReport.upsert({
      where: { seasonId },
      create: { seasonId, totalRevenue, note: noteVal },
      update: { totalRevenue, note: noteVal },
    });
  }

  async findBySeasonId(seasonId: number) {
    return this.prisma.financialReport.findUnique({ where: { seasonId } });
  }
}
