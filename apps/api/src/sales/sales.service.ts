import { PrismaClient } from "../generated/client";
import { AppError } from "../lib/appError";
import type { SalesRepository } from "./sales.repo";
import type { CreateSalesRecordDto } from "./dto/sales.dto";

const FC_SEOUL = "FC Seoul";

export class SalesService {
  constructor(
    private repo: SalesRepository,
    private prisma: PrismaClient,
  ) {}

  findAll() { return this.repo.findAll(); }

  async findByMatch(matchId: number) {
    return this.repo.findByMatch(matchId);
  }

  async create(dto: CreateSalesRecordDto, createdById: number) {
    if (dto.quantity <= 0) throw new AppError(400, "NEGATIVE_SALES_VALUE");
    if (dto.unitPrice <= 0) throw new AppError(400, "NEGATIVE_SALES_VALUE");

    let matchHomeTeamName: string | undefined;
    let matchAwayTeamName: string | undefined;

    if (dto.type === "TICKET") {
      if (!dto.matchId) throw new AppError(400, "MATCH_ID_REQUIRED_FOR_TICKET");
      const match = await this.prisma.match.findUnique({
        where: { id: dto.matchId },
        select: { homeTeamName: true, awayTeamName: true },
      });
      if (!match) throw new AppError(404, "MATCH_NOT_FOUND");
      if (match.homeTeamName !== FC_SEOUL) throw new AppError(400, "AWAY_MATCH_TICKET_NOT_ALLOWED");
      matchHomeTeamName = match.homeTeamName;
      matchAwayTeamName = match.awayTeamName;
    }

    const totalAmount = dto.quantity * dto.unitPrice;

    return this.prisma.$transaction(async (tx) => {
      const record = await tx.salesRecord.create({
        data: {
          type: dto.type,
          quantity: dto.quantity,
          unitPrice: dto.unitPrice,
          totalAmount,
          currency: dto.currency ?? "KRW",
          saleDate: new Date(dto.saleDate),
          ...(dto.description && { description: dto.description }),
          ...(dto.matchId && { matchId: dto.matchId }),
          createdById,
        },
      });

      if (dto.type === "TICKET") {
        await tx.ledgerEntry.create({
          data: {
            type: "INCOME",
            category: "TICKET_SALES",
            amount: totalAmount,
            currency: dto.currency ?? "KRW",
            exchangeRate: 1,
            amountKrw: totalAmount,
            isRefund: false,
            description: `티켓 판매 — ${matchHomeTeamName} vs ${matchAwayTeamName}`,
            relatedModule: "SalesRecord",
            relatedId: record.id,
            createdById,
          },
        });
      }

      return record;
    });
  }

  async delete(id: number) {
    return this.repo.delete(id);
  }

  async getSummary() {
    return this.repo.groupByType();
  }

  async ticketSummaryByMatch(seasonId: number) {
    return this.repo.ticketSummaryByMatch(seasonId);
  }

  async seasonTicketTotal(seasonId: number) {
    return this.repo.seasonTicketTotal(seasonId);
  }

  searchSales(filters: { type?: string; matchId?: number; fromDate?: string; toDate?: string; minAmount?: number; maxAmount?: number }) {
    return this.repo.findWithFilters(filters);
  }
}
