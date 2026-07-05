import { PrismaClient } from "../generated/client";
import { CreateMatchDto, UpdateMatchDto, MatchListQuery, UpsertPlayerStatsDto, UpsertTeamStatsDto } from "./dto/match.dto";

const n = <T>(v: T | undefined): T | null => v ?? null;

const MATCH_SELECT = {
  id: true,
  date: true,
  homeTeamName: true,
  awayTeamName: true,
  homeScore: true,
  awayScore: true,
  competitionType: true,
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
      },
      select: MATCH_SELECT,
    });
  }

  upsertPlayerStats(matchId: number, dto: UpsertPlayerStatsDto) {
    return this.prisma.playerMatchStats.upsert({
      where: {
        // matchId + playerId 복합 유니크 없으므로 create/update 분기
        id: 0,
      },
      create: {
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
      },
      update: {},
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
}
