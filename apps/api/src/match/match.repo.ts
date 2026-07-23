import { PrismaClient } from "../generated/client";
import { ShotResult } from "../generated/enums";
import { CreateMatchDto, UpdateMatchDto, MatchListQuery, UpsertPlayerStatsDto, UpsertTeamStatsDto, CreateShotEventDto } from "./dto/match.dto";

const n = <T>(v: T | undefined): T | null => v ?? null;

const XA_WEIGHT: Record<string, number> = {
  STRIKER: 0.7,
  SHADOW_STRIKER: 1.1,
  WINGER: 1.0,
  CENTRAL_ATTACK_MIDFIELDER: 1.1,
  RIGHT_ATTACK_MIDFIELDER: 1.0,
  LEFT_ATTACK_MIDFIELDER: 1.0,
  CENTRAL_DEFENSIVE_MIDFIELDER: 0.6,
  LEFT_DEFENSIVE_MIDFIELDER: 0.6,
  RIGHT_DEFENSIVE_MIDFIELDER: 0.6,
  CENTER_BACK: 0.5,
  LEFT_WING_BACK: 0.5,
  LEFT_FULL_BACK: 0.5,
  RIGHT_WING_BACK: 0.5,
  RIGHT_FULL_BACK: 0.5,
  GOALKEEPER: 0.5,
}

const MATCH_SELECT = {
  id: true,
  date: true,
  homeTeamName: true,
  awayTeamName: true,
  homeScore: true,
  awayScore: true,
  competitionType: true,
  venue: true,
  seasonId: true,
  externalId: true,
} as const;

export class MatchRepository {
  constructor(private prisma: PrismaClient) {}

  findAll(query: MatchListQuery) {
    return this.prisma.match.findMany({
      where: {
        ...(query.seasonId && { seasonId: query.seasonId }),
        ...(query.competitionType && { competitionType: query.competitionType }),
      },
      select: MATCH_SELECT,
      orderBy: { date: "desc" },
    });
  }

  findById(id: number) {
    return this.prisma.match.findUnique({
      where: { id },
      select: {
        ...MATCH_SELECT,
        playerMatchStats: {
          select: {
            id: true,
            playerId: true,
            goals: true,
            assists: true,
            xG: true,
            xA: true,
            shots: true,
            passAccuracy: true,
            keyPasses: true,
            tackles: true,
            tackleSuccessRate: true,
            clearances: true,
            interceptions: true,
            saves: true,
            cleanSheet: true,
            minutesPlayed: true,
            aerialDuelSuccessRate: true,
            sprint: true,
            clearCutChanceRate: true,
            penaltyConversionRate: true,
            freeKickConversionRate: true,
            foulsCommitted: true,
            crossesCompleted: true,
            shotsAllowed: true,
            player: { select: { playerName: true, position: true } },
          },
        },
        teamMatchStats: true,
      },
    });
  }

  create(data: CreateMatchDto) {
    return this.prisma.match.create({
      data: {
        date: new Date(data.date),
        homeTeamName: data.homeTeamName,
        awayTeamName: data.awayTeamName,
        competitionType: data.competitionType,
        seasonId: data.seasonId,
        ...(data.externalId && { externalId: data.externalId }),
        ...(data.venue && { venue: data.venue }),
      },
      select: MATCH_SELECT,
    });
  }

  update(id: number, data: UpdateMatchDto) {
    return this.prisma.match.update({
      where: { id },
      data: {
        ...(data.date && { date: new Date(data.date) }),
        ...(data.homeTeamName && { homeTeamName: data.homeTeamName }),
        ...(data.awayTeamName && { awayTeamName: data.awayTeamName }),
        ...(data.homeScore !== undefined && { homeScore: data.homeScore }),
        ...(data.awayScore !== undefined && { awayScore: data.awayScore }),
        ...(data.competitionType && { competitionType: data.competitionType }),
        ...(data.venue && { venue: data.venue }),
      },
      select: MATCH_SELECT,
    });
  }

  findPlayerStats(matchId: number, playerId: string) {
    return this.prisma.playerMatchStats.findFirst({
      where: { matchId, playerId },
    });
  }

  createPlayerStats(matchId: number, dto: UpsertPlayerStatsDto) {
    return this.prisma.playerMatchStats.create({
      data: {
        matchId,
        playerId: dto.playerId,
        goals: n(dto.goals),
        assists: n(dto.assists),
        xG: n(dto.xG),
        xA: n(dto.xA),
        shots: n(dto.shots),
        passAccuracy: n(dto.passAccuracy),
        keyPasses: n(dto.keyPasses),
        tackles: n(dto.tackles),
        tackleSuccessRate: n(dto.tackleSuccessRate),
        clearances: n(dto.clearances),
        interceptions: n(dto.interceptions),
        saves: n(dto.saves),
        cleanSheet: n(dto.cleanSheet),
        minutesPlayed: n(dto.minutesPlayed),
        aerialDuelSuccessRate: n(dto.aerialDuelSuccessRate),
        sprint: n(dto.sprint),
        clearCutChanceRate: n(dto.clearCutChanceRate),
        penaltyConversionRate: n(dto.penaltyConversionRate),
        freeKickConversionRate: n(dto.freeKickConversionRate),
        foulsCommitted: n(dto.foulsCommitted),
        crossesCompleted: n(dto.crossesCompleted),
        shotsAllowed: n(dto.shotsAllowed),
      },
    });
  }

  updatePlayerStats(id: number, dto: UpsertPlayerStatsDto) {
    return this.prisma.playerMatchStats.update({
      where: { id },
      data: {
        goals: n(dto.goals),
        assists: n(dto.assists),
        xG: n(dto.xG),
        xA: n(dto.xA),
        shots: n(dto.shots),
        passAccuracy: n(dto.passAccuracy),
        keyPasses: n(dto.keyPasses),
        tackles: n(dto.tackles),
        tackleSuccessRate: n(dto.tackleSuccessRate),
        clearances: n(dto.clearances),
        interceptions: n(dto.interceptions),
        saves: n(dto.saves),
        cleanSheet: n(dto.cleanSheet),
        minutesPlayed: n(dto.minutesPlayed),
        aerialDuelSuccessRate: n(dto.aerialDuelSuccessRate),
        sprint: n(dto.sprint),
        clearCutChanceRate: n(dto.clearCutChanceRate),
        penaltyConversionRate: n(dto.penaltyConversionRate),
        freeKickConversionRate: n(dto.freeKickConversionRate),
        foulsCommitted: n(dto.foulsCommitted),
        crossesCompleted: n(dto.crossesCompleted),
        shotsAllowed: n(dto.shotsAllowed),
      },
    });
  }

  upsertTeamStats(matchId: number, dto: UpsertTeamStatsDto) {
    return this.prisma.teamMatchStats.upsert({
      where: { matchId },
      create: { matchId, ...dto },
      update: { ...dto },
    });
  }

  findShotEvents(matchId: number) {
    return this.prisma.shotEvent.findMany({
      where: { matchId },
      include: {
        shooter:  { select: { id: true, playerName: true, position: true } },
        assister: { select: { id: true, playerName: true, position: true } },
      },
      orderBy: [{ minute: 'asc' }, { id: 'asc' }],
    });
  }

  createShotEvent(matchId: number, dto: CreateShotEventDto) {
    return this.prisma.shotEvent.create({
      data: {
        matchId,
        shooterId:                dto.shooterId,
        assisterId:               dto.assisterId ?? null,
        assisterPositionOverride: dto.assisterPositionOverride ?? null,
        xG:                       dto.xG,
        result:                   dto.result as ShotResult,
        minute:                   dto.minute ?? null,
      },
      include: {
        shooter:  { select: { id: true, playerName: true, position: true } },
        assister: { select: { id: true, playerName: true, position: true } },
      },
    });
  }

  deleteShotEvent(id: number) {
    return this.prisma.shotEvent.delete({ where: { id } });
  }

  async recalculateXgXa(matchId: number): Promise<void> {
    const shots = await this.prisma.shotEvent.findMany({
      where: { matchId },
      include: {
        shooter:  { select: { id: true, position: true } },
        assister: { select: { id: true, position: true } },
      },
    });

    const xgMap: Record<string, number> = {};
    const xaMap: Record<string, number> = {};
    const keyPassMap: Record<string, number> = {};

    for (const shot of shots) {
      xgMap[shot.shooterId] = (xgMap[shot.shooterId] ?? 0) + shot.xG;
      if (shot.assisterId && shot.assister) {
        const effectivePosition = shot.assisterPositionOverride ?? shot.assister.position;
        const weight = XA_WEIGHT[effectivePosition] ?? 0.7;
        xaMap[shot.assisterId] = (xaMap[shot.assisterId] ?? 0) + shot.xG * weight;
        keyPassMap[shot.assisterId] = (keyPassMap[shot.assisterId] ?? 0) + 1;
      }
    }

    const playerIds = new Set([...Object.keys(xgMap), ...Object.keys(xaMap), ...Object.keys(keyPassMap)]);
    for (const playerId of playerIds) {
      const stat = await this.prisma.playerMatchStats.findFirst({ where: { matchId, playerId } });
      if (stat) {
        await this.prisma.playerMatchStats.update({
          where: { id: stat.id },
          data: {
            ...(xgMap[playerId]      != null ? { xG:        Math.round(xgMap[playerId] * 100) / 100 } : {}),
            ...(xaMap[playerId]      != null ? { xA:        Math.round(xaMap[playerId] * 100) / 100 } : {}),
            ...(keyPassMap[playerId] != null ? { keyPasses: keyPassMap[playerId] }                     : {}),
          },
        });
      }
    }
  }
}
