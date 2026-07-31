import { PrismaClient, OperatingCategory } from "../generated/client";

export class OperatingExpenseRepository {
  constructor(private prisma: PrismaClient) {}

  findBySeasonId(seasonId: number) {
    return this.prisma.operatingExpense.findMany({
      where: { seasonId },
      include: { createdBy: { select: { id: true, username: true } } },
      orderBy: { date: "desc" },
    });
  }

  create(data: {
    seasonId: number;
    category: OperatingCategory;
    amount: number;
    date: Date;
    note?: string;
    createdById: number;
  }) {
    return this.prisma.operatingExpense.create({
      data: { ...data, note: data.note ?? null },
      include: { createdBy: { select: { id: true, username: true } } },
    });
  }

  findById(id: number) {
    return this.prisma.operatingExpense.findUnique({ where: { id } });
  }

  delete(id: number) {
    return this.prisma.operatingExpense.delete({ where: { id } });
  }
}
