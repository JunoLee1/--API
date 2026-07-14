import { PrismaClient } from "../generated/client";

const NOW = () => new Date();
const IN_30_DAYS = () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
const START_OF_MONTH = () => {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
};

const DEFENSIVE_POSITIONS = [
  "CENTER_BACK",
  "LEFT_WING_BACK",
  "RIGHT_WING_BACK",
  "LEFT_FULL_BACK",
  "RIGHT_FULL_BACK",
] as const;

const ATTACKING_POSITIONS = [
  "STRIKER",
  "SHADOW_STRIKER",
  "WINGER",
  "CENTRAL_ATTACK_MIDFIELDER",
  "RIGHT_ATTACK_MIDFIELDER",
  "LEFT_ATTACK_MIDFIELDER",
] as const;

export class DashboardRepository {
  constructor(private prisma: PrismaClient) {}

  async getAdminStats() {
    const [activePlayerCount, expiringContractCount, injuredPlayerCount, lowStockEquipmentCount] =
      await Promise.all([
        this.prisma.player.count({ where: { status: "ACTIVE" } }),
        this.prisma.contract.count({
          where: { status: "ACTIVE", endDate: { lte: IN_30_DAYS(), gte: NOW() } },
        }),
        this.prisma.injury.count({
          where: { status: { notIn: ["RETURNED"] } },
        }),
        this.prisma.$queryRaw<{ count: bigint }[]>`
          SELECT COUNT(*) as count FROM "EquipmentItem"
          WHERE "trackedIndividually" = false
            AND "lowStockThreshold" IS NOT NULL
            AND "quantity" IS NOT NULL
            AND "quantity" <= "lowStockThreshold"
        `.then((r) => Number(r[0]?.count ?? 0)),
      ]);
    return { activePlayerCount, expiringContractCount, injuredPlayerCount, lowStockEquipmentCount };
  }

  async getGmStats() {
    const [expiringContractCount, injuredPlayerCount, activeTransferCount] = await Promise.all([
      this.prisma.contract.count({
        where: { status: "ACTIVE", endDate: { lte: IN_30_DAYS(), gte: NOW() } },
      }),
      this.prisma.injury.count({ where: { status: { notIn: ["RETURNED"] } } }),
      this.prisma.transfer.count({
        where: {
          type: { in: ["LOAN_OUT", "LOAN_IN"] },
          startDate: { lte: NOW() },
          OR: [{ endDate: null }, { endDate: { gte: NOW() } }],
        },
      }),
    ]);
    return { expiringContractCount, injuredPlayerCount, activeTransferCount };
  }

  async getTdStats() {
    const [activeTransferCount, prospectCount, injuredPlayerCount] = await Promise.all([
      this.prisma.transfer.count({
        where: {
          type: { in: ["LOAN_OUT", "LOAN_IN"] },
          startDate: { lte: NOW() },
          OR: [{ endDate: null }, { endDate: { gte: NOW() } }],
        },
      }),
      this.prisma.prospect.count({ where: { status: "ACTIVE" } }),
      this.prisma.injury.count({ where: { status: { notIn: ["RETURNED"] } } }),
    ]);
    return { activeTransferCount, prospectCount, injuredPlayerCount };
  }

  async getContractManagerStats() {
    const [expiringContractCount, totalActiveContractCount] = await Promise.all([
      this.prisma.contract.count({
        where: { status: "ACTIVE", endDate: { lte: IN_30_DAYS(), gte: NOW() } },
      }),
      this.prisma.contract.count({ where: { status: "ACTIVE" } }),
    ]);
    return { expiringContractCount, totalActiveContractCount };
  }

  async getScoutStats() {
    const [prospectCount, thisMonthProspectCount] = await Promise.all([
      this.prisma.prospect.count({ where: { status: "ACTIVE" } }),
      this.prisma.prospect.count({
        where: { status: "ACTIVE", createdAt: { gte: START_OF_MONTH() } },
      }),
    ]);
    return { prospectCount, thisMonthProspectCount };
  }

  async getEquipmentManagerStats() {
    const [lowStockEquipmentCount, totalEquipmentItemCount] = await Promise.all([
      this.prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count FROM "EquipmentItem"
        WHERE "trackedIndividually" = false
          AND "lowStockThreshold" IS NOT NULL
          AND "quantity" IS NOT NULL
          AND "quantity" <= "lowStockThreshold"
      `.then((r) => Number(r[0]?.count ?? 0)),
      this.prisma.equipmentItem.count(),
    ]);
    return { lowStockEquipmentCount, totalEquipmentItemCount };
  }

  async getTacticalAnalystStats(userId: number) {
    const [myDraftAnalysisCount, thisMonthMatchCount] = await Promise.all([
      this.prisma.tacticalAnalysis.count({
        where: { createdById: userId, status: "DRAFT" },
      }),
      this.prisma.match.count({ where: { date: { gte: START_OF_MONTH() } } }),
    ]);
    return { myDraftAnalysisCount, thisMonthMatchCount };
  }

  async getHeadCoachStats() {
    const [injuredPlayerCount, thisMonthSessionCount, attendanceWarningPlayerCount] =
      await Promise.all([
        this.prisma.injury.count({ where: { status: { notIn: ["RETURNED"] } } }),
        this.prisma.trainingSession.count({ where: { date: { gte: START_OF_MONTH() } } }),
        this.prisma.notification.count({
          where: { type: "TRAINING_ATTENDANCE_WARNING", readAt: null },
        }),
      ]);
    return { injuredPlayerCount, thisMonthSessionCount, attendanceWarningPlayerCount };
  }

  async getSpecialistCoachStats(coachingRole: string, userId: number) {
    const positionFilter =
      coachingRole === "DEFENSIVE_COACH"
        ? { in: [...DEFENSIVE_POSITIONS] as string[] }
        : coachingRole === "ATTACKING_COACH"
          ? { in: [...ATTACKING_POSITIONS] as string[] }
          : coachingRole === "GOALKEEPER_COACH"
            ? { equals: "GOALKEEPER" }
            : undefined;

    const sessionTypeFilter =
      coachingRole === "SET_PIECE_COACH"
        ? "SET_PIECE"
        : coachingRole === "GOALKEEPER_COACH"
          ? "GOALKEEPER"
          : undefined;

    const [assignedPlayerCount, myThisMonthSessionCount] = await Promise.all([
      positionFilter
        ? this.prisma.player.count({
            where: { status: "ACTIVE", position: positionFilter as any },
          })
        : this.prisma.player.count({ where: { status: "ACTIVE" } }),
      this.prisma.trainingSession.count({
        where: {
          createdById: userId,
          date: { gte: START_OF_MONTH() },
          ...(sessionTypeFilter ? { sessionType: sessionTypeFilter as any } : {}),
        },
      }),
    ]);
    return { assignedPlayerCount, myThisMonthSessionCount };
  }

  async getPhysicalCoachStats(userId: number) {
    const [assignedPlayerCount, myThisMonthSessionCount] = await Promise.all([
      this.prisma.player.count({ where: { status: "ACTIVE" } }),
      this.prisma.trainingSession.count({
        where: {
          createdById: userId,
          sessionType: "PHYSICAL",
          date: { gte: START_OF_MONTH() },
        },
      }),
    ]);
    return { assignedPlayerCount, myThisMonthSessionCount };
  }

  async getMedicalStats(userId: number) {
    const [myActiveInjuryCaseCount, thisMonthReturnReadyCount] = await Promise.all([
      this.prisma.injury.count({
        where: { medicalStaffId: userId, status: { notIn: ["RETURNED"] } },
      }),
      this.prisma.injury.count({
        where: {
          medicalStaffId: userId,
          status: "READY_TO_RETURN",
          occurredAt: { gte: START_OF_MONTH() },
        },
      }),
    ]);
    return { myActiveInjuryCaseCount, thisMonthReturnReadyCount };
  }

  async getMedicalDirectorStats(userId: number) {
    const base = await this.getMedicalStats(userId);
    const totalInjuredPlayerCount = await this.prisma.injury.count({
      where: { status: { notIn: ["RETURNED"] } },
    });
    return { ...base, totalInjuredPlayerCount };
  }

  async getPlayerStats(userId: number) {
    const player = await this.prisma.player.findUnique({ where: { userId } });
    if (!player) return { thisSeasonMatchCount: 0, thisMonthAttendanceRate: 0 };

    const [thisSeasonMatchCount, attendedSessions, totalSessions] = await Promise.all([
      this.prisma.playerMatchStats.count({ where: { playerId: player.id } }),
      this.prisma.trainingParticipant.count({
        where: { playerId: player.id, session: { date: { gte: START_OF_MONTH() } } },
      }),
      this.prisma.trainingSession.count({ where: { date: { gte: START_OF_MONTH() } } }),
    ]);

    const thisMonthAttendanceRate =
      totalSessions > 0 ? Math.round((attendedSessions / totalSessions) * 100) : 0;

    return { thisSeasonMatchCount, thisMonthAttendanceRate };
  }

  async getAgentStats(userId: number) {
    const [managedPlayerCount, injuredManagedPlayerCount, expiringManagedContractCount] =
      await Promise.all([
        this.prisma.player.count({ where: { agentId: userId, status: "ACTIVE" } }),
        this.prisma.injury.count({
          where: { status: { notIn: ["RETURNED"] }, player: { agentId: userId } },
        }),
        this.prisma.contract.count({
          where: {
            status: "ACTIVE",
            endDate: { lte: IN_30_DAYS(), gte: NOW() },
            player: { agentId: userId },
          },
        }),
      ]);
    return { managedPlayerCount, injuredManagedPlayerCount, expiringManagedContractCount };
  }
}
