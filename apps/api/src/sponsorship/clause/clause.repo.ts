import type { PrismaClient } from "../../generated/client";
import type { ClauseStatus } from "../../generated/enums";
import type { CreateClauseDto } from "./dto/clause.dto";

export class ClauseRepository {
  constructor(private prisma: PrismaClient) {}

  create(sponsorshipId: number, dto: CreateClauseDto) {
    return this.prisma.sponsorshipClause.create({
      data: {
        sponsorshipId,
        type: dto.type as any,
        condition: dto.condition,
        ...(dto.rate !== undefined && { rate: dto.rate }),
        ...(dto.fixedAmount !== undefined && { fixedAmount: dto.fixedAmount }),
      },
    });
  }

  findAll(sponsorshipId: number) {
    return this.prisma.sponsorshipClause.findMany({
      where: { sponsorshipId },
      orderBy: { createdAt: "asc" },
    });
  }

  findById(id: number) {
    return this.prisma.sponsorshipClause.findUnique({ where: { id } });
  }

  updateStatus(id: number, status: ClauseStatus) {
    return this.prisma.sponsorshipClause.update({
      where: { id },
      data: { status: status as any },
    });
  }
}
