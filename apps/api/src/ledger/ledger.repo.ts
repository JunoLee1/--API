import type { PrismaClient } from "../generated/client";
import type { CreateLedgerEntryDto, LedgerListQuery } from "./dto/ledger.dto";

export class LedgerRepository {
  constructor(private prisma: PrismaClient) {}

  findAll(query: LedgerListQuery) {
    return this.prisma.ledgerEntry.findMany({
      where: {
        ...(query.type && { type: query.type }),
        ...(query.category && { category: query.category as any }),
        ...(query.from || query.to
          ? { createdAt: { ...(query.from && { gte: new Date(query.from) }), ...(query.to && { lte: new Date(query.to) }) } }
          : {}),
      },
      orderBy: { createdAt: "desc" },
    });
  }

  findById(id: number) {
    return this.prisma.ledgerEntry.findUnique({ where: { id } });
  }

  create(data: CreateLedgerEntryDto & { createdById: number; amountKrw: number }) {
    return this.prisma.ledgerEntry.create({
      data: {
        type: data.type,
        category: data.category as any,
        amount: data.amount,
        currency: data.currency ?? "KRW",
        exchangeRate: data.exchangeRate ?? 1,
        amountKrw: data.amountKrw,
        isRefund: data.isRefund ?? false,
        ...(data.description && { description: data.description }),
        ...(data.relatedModule && { relatedModule: data.relatedModule }),
        ...(data.relatedId !== undefined && { relatedId: data.relatedId }),
        createdById: data.createdById,
      },
    });
  }
}
