import { PrismaClient } from "../generated/client";

export class CoachingStaffRepository {
  constructor(private prisma: PrismaClient) {}

  findAll(weekStart: Date, weekEnd: Date) {
    return this.prisma.user.findMany({
      where: { role: "COACHING_STAFF", isDeleted: false },
      select: {
        id: true,
        nickname: true,
        coachingRole: true,
        teamId: true,
        coachAvailabilities: {
          where: {
            startDate: { lte: weekEnd },
            endDate: { gte: weekStart },
          },
          select: {
            id: true,
            startDate: true,
            endDate: true,
            reason: true,
            createdById: true,
          },
          orderBy: { startDate: "asc" },
        },
      },
      orderBy: { id: "asc" },
    });
  }
}
