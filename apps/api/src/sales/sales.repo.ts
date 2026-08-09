import type { PrismaClient } from "../generated/client";
import type { CreateSalesRecordDto } from "./dto/sales.dto";

export class SalesRepository {
  constructor(private prisma: PrismaClient) {}

  findAll(extraWhere?: Record<string, unknown>) {
    return this.prisma.salesRecord.findMany({
      where: { deletedAt: null, ...extraWhere } as any,
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
        type: data.type as any,
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

  update(id: number, data: { quantity?: number; unitPrice?: number; totalAmount?: number; saleDate?: Date; description?: string | null; updatedById: number }) {
    return this.prisma.salesRecord.update({ where: { id }, data: data as any });
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

  async ticketSummaryByMatch(seasonId: number, homeTeamName?: string) {
    const matches = await this.prisma.match.findMany({
      where: { seasonId, ...(homeTeamName && { homeTeamName }) },
      orderBy: { date: "desc" },
      include: {
        salesRecords: {
          where: { type: { in: ["TICKET", "VIP_TICKET", "COMPLIMENTARY"] as any[] }, deletedAt: null } as any,
          select: { quantity: true, totalAmount: true },
        },
      },
    });

    return matches.map((m) => ({
      matchId: m.id,
      date: m.date.toISOString(),
      homeTeamName: m.homeTeamName,
      awayTeamName: m.awayTeamName,
      totalQuantity: m.salesRecords.reduce((s: number, r: { quantity: number }) => s + r.quantity, 0),
      totalAmount: m.salesRecords.reduce((s: number, r: { totalAmount: unknown }) => s + Number(r.totalAmount), 0),
    }));
  }

  async seasonTicketTotal(seasonId: number): Promise<number> {
    const result = await this.prisma.salesRecord.aggregate({
      where: { type: { in: ["TICKET", "VIP_TICKET", "COMPLIMENTARY"] as any[] }, match: { seasonId }, deletedAt: null } as any,
      _sum: { totalAmount: true },
    });
    return Number((result._sum as any).totalAmount ?? 0);
  }

  findTicketsBySeason(seasonId: number) {
    return this.prisma.salesRecord.findMany({
      where: {
        type: { in: ["TICKET", "VIP_TICKET", "COMPLIMENTARY"] as any[] },
        match: { seasonId },
        deletedAt: null,
      } as any,
      orderBy: { saleDate: "desc" },
      include: { match: { select: { id: true, homeTeamName: true, awayTeamName: true, date: true } } },
    });
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
