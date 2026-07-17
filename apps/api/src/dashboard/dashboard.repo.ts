import { PrismaClient } from "../generated/client";
import { CoachingRole, Position, SessionType } from "../generated/enums";

const NOW = () => new Date();
const IN_30_DAYS = () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
const START_OF_MONTH = () => {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
};
const START_OF_WEEK = () => {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1; // 월요일 기준
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const DEFENSIVE_POSITIONS: Position[] = [
  Position.CENTER_BACK,
  Position.LEFT_WING_BACK,
  Position.RIGHT_WING_BACK,
  Position.LEFT_FULL_BACK,
  Position.RIGHT_FULL_BACK,
];

const ATTACKING_POSITIONS: Position[] = [
  Position.STRIKER,
  Position.SHADOW_STRIKER,
  Position.WINGER,
  Position.CENTRAL_ATTACK_MIDFIELDER,
  Position.RIGHT_ATTACK_MIDFIELDER,
  Position.LEFT_ATTACK_MIDFIELDER,
];

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

  async getSpecialistCoachStats(coachingRole: CoachingRole, userId: number) {
    const positionFilter: Position[] | undefined =
      coachingRole === CoachingRole.DEFENSIVE_COACH
        ? DEFENSIVE_POSITIONS
        : coachingRole === CoachingRole.ATTACKING_COACH
          ? ATTACKING_POSITIONS
          : coachingRole === CoachingRole.GOALKEEPER_COACH
            ? [Position.GOALKEEPER]
            : undefined;

    const sessionTypeFilter: SessionType | undefined =
      coachingRole === CoachingRole.SET_PIECE_COACH
        ? SessionType.SET_PIECE
        : coachingRole === CoachingRole.GOALKEEPER_COACH
          ? SessionType.GOALKEEPER
          : undefined;

    const [assignedPlayerCount, myThisMonthSessionCount] = await Promise.all([
      positionFilter
        ? this.prisma.player.count({
            where: { status: "ACTIVE", position: { in: positionFilter } },
          })
        : this.prisma.player.count({ where: { status: "ACTIVE" } }),
      this.prisma.trainingSession.count({
        where: {
          createdById: userId,
          date: { gte: START_OF_MONTH() },
          ...(sessionTypeFilter ? { sessionType: sessionTypeFilter } : {}),
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
    const [myActiveInjuryCaseCount, thisMonthReturnReadyCount, totalInjuredPlayerCount] =
      await Promise.all([
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
        this.prisma.injury.count({
          where: { status: { notIn: ["RETURNED"] } },
        }),
      ]);
    return { myActiveInjuryCaseCount, thisMonthReturnReadyCount, totalInjuredPlayerCount };
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

  async getMedicalDashboardStats() {
    const now = NOW();
    const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const startOfWeek = START_OF_WEEK();

    const [
      currentInjuredPlayers,
      weekNewInjuryCount,
      returningIn7DaysPlayers,
      reinjuryRiskGroups,
      incompleteDocCount,
      pendingApprovalCount,
      avgRecoveryRaw,
      injuryGroups,
    ] = await Promise.all([
      this.prisma.injury.findMany({
        where: { status: { notIn: ["RETURNED"] } },
        select: { playerId: true },
        distinct: ["playerId"],
      }),
      this.prisma.injury.count({
        where: { occurredAt: { gte: startOfWeek } },
      }),
      this.prisma.injury.findMany({
        where: {
          status: { notIn: ["RETURNED"] },
          expectedReturnDate: { gte: now, lte: in7Days },
        },
        select: { playerId: true },
        distinct: ["playerId"],
      }),
      this.prisma.injury.groupBy({
        by: ["playerId"],
        _count: { playerId: true },
        having: { playerId: { _count: { gte: 2 } } },
      }),
      this.prisma.medicalExpense.count({
        where: { OR: [{ fileUrl: null }, { status: "DRAFT" }] },
      }),
      this.prisma.medicalExpense.count({
        where: { status: { in: ["SUBMITTED", "LEADER_APPROVED"] } },
      }),
      this.prisma.$queryRaw<{ avg_days: number | null }[]>`
        SELECT ROUND(AVG(EXTRACT(EPOCH FROM ("updatedAt" - "occurredAt")) / 86400))::int AS avg_days
        FROM "Injury"
        WHERE status = 'RETURNED'
      `,
      this.prisma.injury.groupBy({
        by: ["playerId"],
        _count: { id: true },
      }),
    ]);

    const playerIds = injuryGroups.map((g) => g.playerId);
    const players = await this.prisma.player.findMany({
      where: { id: { in: playerIds } },
      select: { id: true, position: true },
    });
    const posMap = new Map(players.map((p) => [p.id, p.position]));

    const GK_POSITIONS = ["GOALKEEPER"];
    const DF_POSITIONS = ["CENTER_BACK", "LEFT_WING_BACK", "RIGHT_WING_BACK", "LEFT_FULL_BACK", "RIGHT_FULL_BACK"];
    const MF_POSITIONS = ["DEFENSIVE_MIDFIELDER", "CENTRAL_MIDFIELDER", "WIDE_MIDFIELDER", "ATTACKING_MIDFIELDER", "CENTRAL_ATTACK_MIDFIELDER", "RIGHT_ATTACK_MIDFIELDER", "LEFT_ATTACK_MIDFIELDER"];
    const FW_POSITIONS = ["STRIKER", "SHADOW_STRIKER", "WINGER"];

    const injuriesByPosition = { GK: 0, DF: 0, MF: 0, FW: 0 };
    for (const g of injuryGroups) {
      const pos = posMap.get(g.playerId);
      if (!pos) continue;
      if (GK_POSITIONS.includes(pos)) injuriesByPosition.GK += g._count.id;
      else if (DF_POSITIONS.includes(pos)) injuriesByPosition.DF += g._count.id;
      else if (MF_POSITIONS.includes(pos)) injuriesByPosition.MF += g._count.id;
      else if (FW_POSITIONS.includes(pos)) injuriesByPosition.FW += g._count.id;
    }

    return {
      currentInjuredCount: currentInjuredPlayers.length,
      weekNewInjuryCount,
      returningIn7DaysCount: returningIn7DaysPlayers.length,
      reinjuryRiskCount: reinjuryRiskGroups.length,
      incompleteDocCount,
      pendingApprovalCount,
      avgRecoveryDays: avgRecoveryRaw[0]?.avg_days ?? null,
      injuriesByPosition,
    };
  }
}
