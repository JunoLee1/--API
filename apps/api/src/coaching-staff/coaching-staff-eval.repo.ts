import { PrismaClient } from "../generated/client";

export class CoachingStaffEvalRepository {
  constructor(private prisma: PrismaClient) {}

  listForStaff(staffUserId: number) {
    return this.prisma.coachingStaffEvaluation.findMany({
      where: { staffUserId },
      include: {
        evaluator: { select: { id: true, nickname: true, coachingRole: true } },
      },
      orderBy: { evaluatedAt: "desc" },
    });
  }

  create(staffUserId: number, evaluatorId: number, score: number, comment?: string) {
    return this.prisma.coachingStaffEvaluation.create({
      data: { staffUserId, evaluatorId, score, comment: comment ?? null },
    });
  }
}
