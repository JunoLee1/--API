import { PrismaClient } from "../generated/client";
import { CompetitionType } from "../generated/enums";

export interface MatchForRanking {
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
}

export class AnalysisRepository {
  constructor(private prisma: PrismaClient) {}

  findCompletedMatches(seasonId: number, competitionType: CompetitionType): Promise<MatchForRanking[]> {
    return this.prisma.match.findMany({
      where: {
        seasonId,
        competitionType,
        homeScore: { not: null },
        awayScore: { not: null },
      },
      select: {
        homeTeamName: true,
        awayTeamName: true,
        homeScore: true,
        awayScore: true,
      },
    }) as unknown as Promise<MatchForRanking[]>;
  }
}
