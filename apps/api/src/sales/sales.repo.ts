import type { PrismaClient } from "../generated/client";
import type { CreateSalesRecordDto } from "./dto/sales.dto";

export class SalesRepository {
  constructor(private prisma: PrismaClient) {}

  findAll() {
    return this.prisma.salesRecord.findMany({
      orderBy: { saleDate: "desc" },
      include: { match: { select: { id: true, homeTeamName: true, awayTeamName: true, date: true } } },
    });
  }

  findByMatch(matchId: number) {
    return this.prisma.salesRecord.findMany({
      where: { matchId, type: "TICKET" },
      orderBy: { saleDate: "desc" },
    });
  }

  create(data: CreateSalesRecordDto & { totalAmount: number; createdById: number }) {
    return this.prisma.salesRecord.create({
      data: {
        type: data.type,
        quantity: data.quantity,
        unitPrice: data.unitPrice,
        totalAmount: data.totalAmount,
        currency: data.currency ?? "KRW",
        saleDate: new Date(data.saleDate),
        ...(data.description && { description: data.description }),
        ...(data.matchId && { matchId: data.matchId }),
        createdById: data.createdById,
      },
    });
  }

  delete(id: number) {
    return this.prisma.salesRecord.delete({ where: { id } });
  }

  groupByType() {
    return this.prisma.salesRecord.groupBy({
      by: ["type"],
      _sum: { totalAmount: true },
    });
  }

  async ticketSummaryByMatch(seasonId: number) {
    const records = await this.prisma.salesRecord.findMany({
      where: { type: "TICKET", match: { seasonId } },
      include: { match: { select: { id: true, homeTeamName: true, awayTeamName: true, date: true } } },
    });

    const map = new Map<number, {
      matchId: number; date: string; homeTeamName: string; awayTeamName: string;
      totalQuantity: number; totalAmount: number;
    }>();

    for (const r of records) {
      if (!r.match) continue;
      const key = r.match.id;
      const existing = map.get(key);
      if (existing) {
        existing.totalQuantity += r.quantity;
        existing.totalAmount += Number(r.totalAmount);
      } else {
        map.set(key, {
          matchId: r.match.id,
          date: r.match.date.toISOString(),
          homeTeamName: r.match.homeTeamName,
          awayTeamName: r.match.awayTeamName,
          totalQuantity: r.quantity,
          totalAmount: Number(r.totalAmount),
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  }

  async seasonTicketTotal(seasonId: number): Promise<number> {
    const result = await this.prisma.salesRecord.aggregate({
      where: { type: "TICKET", match: { seasonId } },
      _sum: { totalAmount: true },
    });
    return Number(result._sum.totalAmount ?? 0);
  }

  findWithFilters(filters: {
    type?: string;
    matchId?: number;
    fromDate?: string;
    toDate?: string;
    minAmount?: number;
    maxAmount?: number;
  }) {
    return this.prisma.salesRecord.findMany({
      where: {
        ...(filters.type && { type: filters.type as any }),
        ...(filters.matchId && { matchId: filters.matchId }),
        ...(filters.fromDate && { saleDate: { gte: new Date(filters.fromDate) } }),
        ...(filters.toDate && { saleDate: { lte: new Date(filters.toDate) } }),
        ...(filters.minAmount !== undefined && { totalAmount: { gte: filters.minAmount } }),
        ...(filters.maxAmount !== undefined && { totalAmount: { lte: filters.maxAmount } }),
      },
      include: { match: { select: { id: true, homeTeamName: true, awayTeamName: true, date: true } } },
      orderBy: { saleDate: "desc" },
    });
  }
}
