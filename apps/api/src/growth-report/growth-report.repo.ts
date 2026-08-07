import type { PrismaClient } from "../generated/client";
import type { CreateGrowthEvaluationDto, AwardBadgeDto } from "./dto/growth-report.dto";

const EVAL_INCLUDE = {
  player: { select: { id: true, playerName: true, guardianId: true } },
  coach: { select: { id: true, username: true, nickname: true } },
  plan: { select: { id: true, goals: true, seasonId: true } },
} as const;

const BADGE_INCLUDE = {
  player: { select: { id: true, playerName: true } },
  coach: { select: { id: true, username: true, nickname: true } },
  session: { select: { id: true, date: true } },
} as const;

export class GrowthReportRepository {
  constructor(private prisma: PrismaClient) {}

  findEvaluationsByPlayer(playerId: string) {
    return this.prisma.growthEvaluation.findMany({
      where: { playerId },
      include: EVAL_INCLUDE,
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });
  }

  findEvaluationById(id: number) {
    return this.prisma.growthEvaluation.findUnique({ where: { id }, include: EVAL_INCLUDE });
  }

  findEvaluationByPeriod(playerId: string, year: number, month: number) {
    return this.prisma.growthEvaluation.findUnique({
      where: { playerId_year_month: { playerId, year, month } },
      include: EVAL_INCLUDE,
    });
  }

  createEvaluation(dto: CreateGrowthEvaluationDto, coachId: number, planId?: number) {
    return this.prisma.growthEvaluation.create({
      data: { ...dto, coachId, ...(planId !== undefined && { planId }) },
      include: EVAL_INCLUDE,
    });
  }

  updateEvaluation(id: number, dto: Partial<CreateGrowthEvaluationDto>) {
    return this.prisma.growthEvaluation.update({
      where: { id },
      data: dto,
      include: EVAL_INCLUDE,
    });
  }

  publishEvaluation(id: number) {
    return this.prisma.growthEvaluation.update({
      where: { id },
      data: { isPublished: true, publishedAt: new Date() },
      include: EVAL_INCLUDE,
    });
  }

  findBadgesByPlayer(playerId: string) {
    return this.prisma.playerBadge.findMany({
      where: { playerId },
      include: BADGE_INCLUDE,
      orderBy: { awardedAt: "desc" },
    });
  }

  awardBadge(dto: AwardBadgeDto, coachId: number) {
    return this.prisma.playerBadge.create({
      data: { ...dto, coachId },
      include: BADGE_INCLUDE,
    });
  }
}
