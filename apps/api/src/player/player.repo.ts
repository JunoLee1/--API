import { PrismaClient } from "../generated/client";
import { PlayerStatus } from "../generated/enums";
import { CreatePlayerDto, UpdatePlayerDto, PlayerListQuery } from "./dto/player.dto";

const PLAYER_SELECT = {
  id: true,
  playerName: true,
  dateOfBirth: true,
  preferredFoot: true,
  height: true,
  weight: true,
  position: true,
  level: true,
  status: true,
  externalId: true,
  playStyle: true,
  currentMarketValue: true,
  teamId: true,
  nationality: { select: { id: true, name: true, code: true } },
} as const;

export class PlayerRepository {
  constructor(private prisma: PrismaClient) {}

  findAll(query: PlayerListQuery) {
    return this.prisma.player.findMany({
      where: {
        ...(query.status && { status: query.status }),
        ...(query.position && { position: query.position }),
        ...(query.level && { level: query.level }),
        ...(query.nationalityId && { nationalityId: query.nationalityId }),
        ...(query.excludeYouth && { NOT: { team: { type: 'YOUTH' } } }),
        ...(query.teamType && { team: { type: query.teamType } }),
      },
      select: PLAYER_SELECT,
      orderBy: { playerName: "asc" },
    });
  }

  findById(id: string, includePrivate = false) {
    return this.prisma.player.findUnique({
      where: { id },
      select: {
        ...PLAYER_SELECT,
        userId: true,
        agentId: true,
        agencyId: true,
        ...(includePrivate && {
          emergencyContactName: true,
          emergencyContactPhone: true,
          emergencyContactRelation: true,
          allergies: true,
          foodPreferences: true,
        }),
        agency: { select: { id: true, name: true, contactName: true, phone: true } },
        team: { select: { id: true, type: true } },
        contracts: {
          select: {
            id: true,
            startDate: true,
            endDate: true,
            ...(includePrivate && { salary: true }),
            status: true,
          },
          orderBy: { startDate: "desc" },
          take: 1,
        },
        transfers: {
          select: {
            id: true,
            type: true,
            date: true,
            fee: true,
            fromClub: true,
            toClub: true,
          },
          orderBy: { date: "desc" },
        },
      },
    });
  }

  create(data: CreatePlayerDto) {
    return this.prisma.player.create({
      data: {
        playerName: data.playerName,
        dateOfBirth: new Date(data.dateOfBirth),
        preferredFoot: data.preferredFoot,
        height: data.height,
        weight: data.weight,
        position: data.position,
        level: data.level,
        nationalityId: data.nationalityId,
        ...(data.externalId && { externalId: data.externalId }),
        ...(data.userId && { userId: data.userId }),
        ...(data.agentId && { agentId: data.agentId }),
        ...(data.agencyId && { agencyId: data.agencyId }),
        ...(data.emergencyContactName && { emergencyContactName: data.emergencyContactName }),
        ...(data.emergencyContactPhone && { emergencyContactPhone: data.emergencyContactPhone }),
        ...(data.emergencyContactRelation && { emergencyContactRelation: data.emergencyContactRelation }),
      },
      select: PLAYER_SELECT,
    });
  }

  update(id: string, data: UpdatePlayerDto) {
    return this.prisma.player.update({
      where: { id },
      data: {
        ...(data.playerName && { playerName: data.playerName }),
        ...(data.dateOfBirth && { dateOfBirth: new Date(data.dateOfBirth) }),
        ...(data.preferredFoot && { preferredFoot: data.preferredFoot }),
        ...(data.height && { height: data.height }),
        ...(data.weight && { weight: data.weight }),
        ...(data.position && { position: data.position }),
        ...(data.level && { level: data.level }),
        ...(data.nationalityId && { nationalityId: data.nationalityId }),
        ...(data.externalId !== undefined && { externalId: data.externalId }),
        ...(data.agentId !== undefined && { agentId: data.agentId }),
        ...(data.agencyId !== undefined && { agencyId: data.agencyId }),
        ...(data.emergencyContactName !== undefined && { emergencyContactName: data.emergencyContactName }),
        ...(data.emergencyContactPhone !== undefined && { emergencyContactPhone: data.emergencyContactPhone }),
        ...(data.emergencyContactRelation !== undefined && { emergencyContactRelation: data.emergencyContactRelation }),
        ...(data.allergies !== undefined && { allergies: data.allergies }),
        ...(data.foodPreferences !== undefined && { foodPreferences: data.foodPreferences }),
      },
      select: PLAYER_SELECT,
    });
  }

  updateStatus(id: string, status: PlayerStatus) {
    return this.prisma.player.update({
      where: { id },
      data: { status },
      select: { id: true, status: true },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.player.delete({ where: { id } });
  }

  getMatchStats(playerId: string, seasonId?: number) {
    return this.prisma.playerMatchStats.findMany({
      where: {
        playerId,
        ...(seasonId && { match: { seasonId } }),
      },
      include: {
        match: {
          select: { id: true, date: true, homeTeamName: true, awayTeamName: true, seasonId: true },
        },
      },
      orderBy: { match: { date: "desc" } },
    });
  }

  getTrainingResults(playerId: string, from?: string, to?: string) {
    return this.prisma.trainingResult.findMany({
      where: {
        playerId,
        ...(from || to
          ? {
              session: {
                date: {
                  ...(from ? { gte: new Date(from) } : {}),
                  ...(to ? { lte: new Date(to + "T23:59:59Z") } : {}),
                },
              },
            }
          : {}),
      },
      include: {
        session: {
          select: { id: true, date: true, sessionType: true, goal: true },
        },
      },
      orderBy: { session: { date: "desc" } },
      take: 50,
    });
  }

  async getPositionDiversity(playerId: string): Promise<{ position: string; totalMinutes: number }[]> {
    const rows = await this.prisma.$queryRaw<{ position: string; total_minutes: bigint }[]>`
      SELECT
        ls."slotKey" AS position,
        COALESCE(SUM(pms."minutesPlayed"), 0) AS total_minutes
      FROM "LineupSlot" ls
      INNER JOIN "MatchLineup" ml ON ml.id = ls."lineupId"
      LEFT JOIN "PlayerMatchStats" pms
        ON pms."matchId" = ml."matchId" AND pms."playerId" = ls."playerId"
      WHERE ls."playerId" = ${playerId}
        AND ls."isStarter" = true
      GROUP BY ls."slotKey"
      HAVING COALESCE(SUM(pms."minutesPlayed"), 0) > 0
      ORDER BY total_minutes DESC
    `;
    return rows.map((r) => ({ position: r.position, totalMinutes: Number(r.total_minutes) }));
  }
}
