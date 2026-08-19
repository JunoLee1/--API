import { PrismaClient } from "../generated/client";
import type { CreateBudgetHeaderDto, CreateBudgetLineDto, CreateAdjustmentDto } from "./dto/budget-control.dto";

export class BudgetControlRepository {
  constructor(private prisma: PrismaClient) {}

  createHeader(dto: CreateBudgetHeaderDto, createdById: number) {
    return this.prisma.budgetHeader.create({
      data: {
        seasonId: dto.seasonId,
        name: dto.name,
        totalBudget: dto.totalBudget,
        note: dto.note,
        createdById,
      },
      include: { lines: true, adjustments: true },
    });
  }

  findAll(seasonId?: number) {
    return this.prisma.budgetHeader.findMany({
      where: seasonId ? { seasonId } : undefined,
      include: { season: { select: { id: true, name: true } }, createdBy: { select: { id: true, username: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  findById(id: number) {
    return this.prisma.budgetHeader.findUnique({
      where: { id },
      include: {
        lines: { include: { department: { select: { id: true, name: true } } } },
        adjustments: {
          include: {
            createdBy: { select: { id: true, username: true } },
            approvedBy: { select: { id: true, username: true } },
          },
        },
        season: { select: { id: true, name: true } },
        createdBy: { select: { id: true, username: true } },
        approvedBy: { select: { id: true, username: true } },
      },
    });
  }

  updateStatus(id: number, status: "SUBMITTED" | "APPROVED" | "LOCKED", approverId?: number) {
    return this.prisma.budgetHeader.update({
      where: { id },
      data: {
        status,
        ...(status === "APPROVED" && approverId
          ? { approvedById: approverId, approvedAt: new Date() }
          : {}),
      },
    });
  }

  updateHeader(id: number, data: { name?: string; totalBudget?: number; note?: string }) {
    return this.prisma.budgetHeader.update({ where: { id }, data });
  }

  createLine(budgetHeaderId: number, dto: CreateBudgetLineDto) {
    return this.prisma.budgetLine.create({ data: { budgetHeaderId, ...dto } });
  }

  updateLine(lineId: number, data: { originalAmount?: number; note?: string }) {
    return this.prisma.budgetLine.update({ where: { id: lineId }, data });
  }

  deleteLine(lineId: number) {
    return this.prisma.budgetLine.delete({ where: { id: lineId } });
  }

  createAdjustment(budgetHeaderId: number, dto: CreateAdjustmentDto, createdById: number) {
    return this.prisma.budgetAdjustment.create({
      data: { budgetHeaderId, ...dto, createdById },
      include: { createdBy: { select: { id: true, username: true } } },
    });
  }

  updateAdjustmentStatus(id: number, status: "APPROVED" | "REJECTED", approverId: number) {
    return this.prisma.budgetAdjustment.update({
      where: { id },
      data: {
        status,
        approvedById: approverId,
        approvedAt: new Date(),
      },
    });
  }

  sumApprovedAdjustments(budgetHeaderId: number) {
    return this.prisma.budgetAdjustment.groupBy({
      by: ["type"],
      where: { budgetHeaderId, status: "APPROVED" },
      _sum: { amount: true },
    });
  }
}
